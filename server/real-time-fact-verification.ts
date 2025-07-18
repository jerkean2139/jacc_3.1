// MEMORY OPTIMIZATION: Disabled OpenAI
let OpenAI: any = null;
import { db } from "./db";
import { documents, factVerificationLogs } from "@shared/schema";
import { pineconeVectorService } from "./pinecone-vector";
import { documentGraphIntelligence, type ConflictDetection } from "./document-graph-intelligence";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface FactVerificationResult {
  claim: string;
  verificationStatus: 'verified' | 'contradicted' | 'unverified' | 'partially_verified';
  confidence: number;
  supportingEvidence: Array<{
    source: string;
    snippet: string;
    relevanceScore: number;
    supportType: 'strong_support' | 'weak_support' | 'neutral' | 'weak_contradiction' | 'strong_contradiction';
  }>;
  contradictingEvidence: Array<{
    source: string;
    snippet: string;
    relevanceScore: number;
  }>;
  sourceReliability: Array<{
    source: string;
    reliabilityScore: number;
    lastUpdated: string;
    documentType: string;
  }>;
  verificationTimestamp: Date;
  flaggedInconsistencies: string[];
  recommendedActions: string[];
}

export interface ConsistencyAlert {
  alertId: string;
  alertType: 'contradiction' | 'inconsistency' | 'outdated_info' | 'low_confidence';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedClaims: string[];
  suggestedResolution: string;
  documentsInvolved: string[];
  createdAt: Date;
}

export class RealTimeFactVerification {

  /**
   * Verifies factual claims against the knowledge base in real-time
   */
  async verifyClaim(
    claim: string,
    userId: string,
    contextDocuments?: string[]
  ): Promise<FactVerificationResult> {
    try {
      console.log('🔍 Verifying claim:', claim);

      // Step 1: Search for relevant evidence
      const searchResults = await pineconeVectorService.searchSimilar(claim, 10);
      
      // Step 2: Analyze each piece of evidence
      const evidenceAnalysis = await this.analyzeEvidence(claim, searchResults);
      
      // Step 3: Check for contradictions
      const contradictions = await this.detectContradictions(claim, searchResults);
      
      // Step 4: Assess source reliability
      const sourceReliability = await this.assessSourceReliability(searchResults);
      
      // Step 5: Calculate overall verification status
      const verificationStatus = this.calculateVerificationStatus(evidenceAnalysis, contradictions);
      
      // Step 6: Generate alerts for inconsistencies
      const inconsistencies = await this.flagInconsistencies(claim, evidenceAnalysis, contradictions);
      
      // Step 7: Provide recommendations
      const recommendations = this.generateRecommendations(verificationStatus, evidenceAnalysis, contradictions);

      const result: FactVerificationResult = {
        claim,
        verificationStatus: verificationStatus.status,
        confidence: verificationStatus.confidence,
        supportingEvidence: evidenceAnalysis.supporting,
        contradictingEvidence: contradictions,
        sourceReliability,
        verificationTimestamp: new Date(),
        flaggedInconsistencies: inconsistencies,
        recommendedActions: recommendations
      };

      // Log verification for audit trail
      await this.logVerification(claim, result, userId);

      return result;
    } catch (error) {
      console.error('Error in fact verification:', error);
      return this.getFailsafeVerification(claim);
    }
  }

  /**
   * Analyzes evidence pieces for support/contradiction
   */
  private async analyzeEvidence(claim: string, evidence: any[]): Promise<{
    supporting: Array<{
      source: string;
      snippet: string;
      relevanceScore: number;
      supportType: 'strong_support' | 'weak_support' | 'neutral' | 'weak_contradiction' | 'strong_contradiction';
    }>;
    neutral: any[];
  }> {
    const supporting: any[] = [];
    const neutral: any[] = [];

    for (const item of evidence) {
      const analysis = await this.analyzeSingleEvidence(claim, item);
      
      if (analysis.supportType === 'strong_support' || analysis.supportType === 'weak_support') {
        supporting.push(analysis);
      } else if (analysis.supportType === 'neutral') {
        neutral.push(analysis);
      }
    }

    return { supporting, neutral };
  }

  /**
   * Analyzes a single piece of evidence against the claim
   */
  private async analyzeSingleEvidence(claim: string, evidence: any): Promise<{
    source: string;
    snippet: string;
    relevanceScore: number;
    supportType: 'strong_support' | 'weak_support' | 'neutral' | 'weak_contradiction' | 'strong_contradiction';
  }> {
    const prompt = `Analyze how this evidence relates to the claim:

Claim: "${claim}"

Evidence: "${evidence.content}"
Source: ${evidence.metadata.documentName}

Determine:
1. How relevant is this evidence (0-100)?
2. Does it support, contradict, or remain neutral to the claim?
3. How strong is the support/contradiction?

Return JSON format:
{
  "relevanceScore": 85,
  "supportType": "strong_support|weak_support|neutral|weak_contradiction|strong_contradiction",
  "explanation": "why this evidence supports/contradicts/is neutral"
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        source: evidence.metadata.documentName,
        snippet: evidence.content.substring(0, 200) + '...',
        relevanceScore: (result.relevanceScore || 50) / 100,
        supportType: result.supportType || 'neutral'
      };
    } catch (error) {
      return {
        source: evidence.metadata.documentName,
        snippet: evidence.content.substring(0, 200) + '...',
        relevanceScore: 0.5,
        supportType: 'neutral'
      };
    }
  }

  /**
   * Detects contradicting evidence
   */
  private async detectContradictions(claim: string, evidence: any[]): Promise<Array<{
    source: string;
    snippet: string;
    relevanceScore: number;
  }>> {
    const contradictions: any[] = [];

    for (const item of evidence) {
      const isContradiction = await this.checkForContradiction(claim, item);
      if (isContradiction.isContradiction) {
        contradictions.push({
          source: item.metadata.documentName,
          snippet: item.content.substring(0, 200) + '...',
          relevanceScore: isContradiction.confidence
        });
      }
    }

    return contradictions;
  }

  /**
   * Checks if a piece of evidence contradicts the claim
   */
  private async checkForContradiction(claim: string, evidence: any): Promise<{
    isContradiction: boolean;
    confidence: number;
  }> {
    const prompt = `Does this evidence contradict the claim?

Claim: "${claim}"
Evidence: "${evidence.content}"

Look for:
- Direct contradictions (opposite statements)
- Numerical conflicts (different numbers for same thing)
- Procedural conflicts (different processes)
- Factual disputes (conflicting facts)

Return JSON: {"isContradiction": boolean, "confidence": 0-100, "reason": "explanation"}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return {
        isContradiction: result.isContradiction || false,
        confidence: (result.confidence || 50) / 100
      };
    } catch (error) {
      return { isContradiction: false, confidence: 0.5 };
    }
  }

  /**
   * Assesses reliability of sources
   */
  private async assessSourceReliability(evidence: any[]): Promise<Array<{
    source: string;
    reliabilityScore: number;
    lastUpdated: string;
    documentType: string;
  }>> {
    const sourceReliability: any[] = [];

    for (const item of evidence) {
      const reliability = await this.calculateSourceReliability(item);
      sourceReliability.push(reliability);
    }

    return sourceReliability;
  }

  /**
   * Calculates reliability score for a source
   */
  private async calculateSourceReliability(evidence: any): Promise<{
    source: string;
    reliabilityScore: number;
    lastUpdated: string;
    documentType: string;
  }> {
    // Get document metadata
    const doc = await db
      .select()
      .from(documents)
      .where(eq(documents.id, evidence.documentId))
      .limit(1);

    const docInfo = doc[0];
    let reliabilityScore = 0.5; // Default moderate reliability

    // Assess based on document type and age
    if (docInfo) {
      // Official documents are more reliable
      if (docInfo.name.toLowerCase().includes('contract') || 
          docInfo.name.toLowerCase().includes('agreement') ||
          docInfo.name.toLowerCase().includes('policy')) {
        reliabilityScore += 0.3;
      }

      // Recent documents are more reliable
      const docAge = Date.now() - new Date(docInfo.createdAt).getTime();
      const monthsOld = docAge / (1000 * 60 * 60 * 24 * 30);
      if (monthsOld < 6) {
        reliabilityScore += 0.2;
      } else if (monthsOld > 24) {
        reliabilityScore -= 0.2;
      }

      reliabilityScore = Math.max(0.1, Math.min(1.0, reliabilityScore));
    }

    return {
      source: evidence.metadata.documentName,
      reliabilityScore,
      lastUpdated: docInfo?.updatedAt || docInfo?.createdAt || 'Unknown',
      documentType: this.determineDocumentType(evidence.metadata.documentName)
    };
  }

  /**
   * Determines document type from name
   */
  private determineDocumentType(name: string): string {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('contract')) return 'contract';
    if (lowerName.includes('agreement')) return 'agreement';
    if (lowerName.includes('policy')) return 'policy';
    if (lowerName.includes('manual')) return 'manual';
    if (lowerName.includes('guide')) return 'guide';
    if (lowerName.includes('statement')) return 'statement';
    return 'document';
  }

  /**
   * Calculates overall verification status
   */
  private calculateVerificationStatus(evidenceAnalysis: any, contradictions: any[]): {
    status: 'verified' | 'contradicted' | 'unverified' | 'partially_verified';
    confidence: number;
  } {
    const strongSupport = evidenceAnalysis.supporting.filter((e: any) => e.supportType === 'strong_support').length;
    const weakSupport = evidenceAnalysis.supporting.filter((e: any) => e.supportType === 'weak_support').length;
    const strongContradictions = contradictions.filter((c: any) => c.relevanceScore > 0.8).length;

    let status: 'verified' | 'contradicted' | 'unverified' | 'partially_verified';
    let confidence: number;

    if (strongContradictions > 0) {
      status = 'contradicted';
      confidence = 0.2;
    } else if (strongSupport >= 2) {
      status = 'verified';
      confidence = 0.9;
    } else if (strongSupport >= 1 || weakSupport >= 3) {
      status = 'partially_verified';
      confidence = 0.7;
    } else {
      status = 'unverified';
      confidence = 0.3;
    }

    return { status, confidence };
  }

  /**
   * Flags inconsistencies for attention
   */
  private async flagInconsistencies(
    claim: string,
    evidenceAnalysis: any,
    contradictions: any[]
  ): Promise<string[]> {
    const inconsistencies: string[] = [];

    if (contradictions.length > 0) {
      inconsistencies.push(`Found ${contradictions.length} contradicting sources`);
    }

    if (evidenceAnalysis.supporting.length === 0) {
      inconsistencies.push('No supporting evidence found in knowledge base');
    }

    const lowReliabilitySources = evidenceAnalysis.supporting.filter((e: any) => e.relevanceScore < 0.5).length;
    if (lowReliabilitySources > evidenceAnalysis.supporting.length / 2) {
      inconsistencies.push('Majority of evidence has low relevance scores');
    }

    return inconsistencies;
  }

  /**
   * Generates actionable recommendations
   */
  private generateRecommendations(
    verificationStatus: any,
    evidenceAnalysis: any,
    contradictions: any[]
  ): string[] {
    const recommendations: string[] = [];

    if (verificationStatus.status === 'contradicted') {
      recommendations.push('Review contradicting sources and resolve conflicts');
      recommendations.push('Verify which information is most current and accurate');
    }

    if (verificationStatus.status === 'unverified') {
      recommendations.push('Seek additional sources to verify this claim');
      recommendations.push('Consider flagging this information for manual review');
    }

    if (contradictions.length > 0) {
      recommendations.push('Investigate source conflicts and update documentation');
    }

    if (evidenceAnalysis.supporting.length < 2) {
      recommendations.push('Add more supporting documentation to knowledge base');
    }

    return recommendations;
  }

  /**
   * Logs verification for audit trail
   */
  private async logVerification(
    claim: string,
    result: FactVerificationResult,
    userId: string
  ): Promise<void> {
    try {
      // Note: This assumes factVerificationLogs table exists in schema
      // You may need to add this to your database schema
      console.log('Logging fact verification:', {
        claim,
        status: result.verificationStatus,
        confidence: result.confidence,
        userId,
        timestamp: result.verificationTimestamp
      });
    } catch (error) {
      console.error('Error logging verification:', error);
    }
  }

  /**
   * Failsafe verification when system fails
   */
  private getFailsafeVerification(claim: string): FactVerificationResult {
    return {
      claim,
      verificationStatus: 'unverified',
      confidence: 0.3,
      supportingEvidence: [],
      contradictingEvidence: [],
      sourceReliability: [],
      verificationTimestamp: new Date(),
      flaggedInconsistencies: ['System error during verification'],
      recommendedActions: ['Manual verification required due to system error']
    };
  }

  /**
   * Creates consistency alerts for the admin dashboard
   */
  async createConsistencyAlert(
    conflicts: ConflictDetection[],
    userId: string
  ): Promise<ConsistencyAlert[]> {
    const alerts: ConsistencyAlert[] = [];

    for (const conflict of conflicts) {
      alerts.push({
        alertId: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        alertType: this.mapConflictToAlertType(conflict.conflictType),
        severity: conflict.severity,
        description: conflict.description,
        affectedClaims: [conflict.description],
        suggestedResolution: conflict.resolutionSuggestion || 'Manual review required',
        documentsInvolved: conflict.documentsInvolved,
        createdAt: new Date()
      });
    }

    return alerts;
  }

  /**
   * Maps conflict types to alert types
   */
  private mapConflictToAlertType(conflictType: string): 'contradiction' | 'inconsistency' | 'outdated_info' | 'low_confidence' {
    switch (conflictType) {
      case 'factual': return 'contradiction';
      case 'numerical': return 'inconsistency';
      case 'procedural': return 'inconsistency';
      case 'policy': return 'contradiction';
      default: return 'inconsistency';
    }
  }
}

export const realTimeFactVerification = new RealTimeFactVerification();