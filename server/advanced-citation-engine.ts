import { db } from "./db";
import { documents } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import OpenAI from "openai";
import { realTimeFactVerification, type FactVerificationResult } from "./real-time-fact-verification";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface CitationSource {
  sourceId: string;
  documentName: string;
  documentType: 'contract' | 'policy' | 'manual' | 'statement' | 'guide' | 'other';
  relevanceScore: number;
  reliabilityScore: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  lastVerified: Date;
  supportingEvidence: Array<{
    snippet: string;
    pageNumber?: number;
    sectionTitle?: string;
    evidenceType: 'direct_quote' | 'paraphrase' | 'numerical_data' | 'procedural_step';
    strength: 'strong' | 'moderate' | 'weak';
  }>;
  contradictingEvidence?: Array<{
    snippet: string;
    conflictType: 'factual' | 'numerical' | 'procedural';
    severity: 'minor' | 'moderate' | 'major';
  }>;
}

export interface AdvancedCitation {
  citationId: string;
  claim: string;
  primarySources: CitationSource[];
  secondarySources: CitationSource[];
  verificationStatus: 'fully_verified' | 'partially_verified' | 'conflicted' | 'unverified';
  overallConfidence: number;
  evidenceStrength: 'strong' | 'moderate' | 'weak' | 'insufficient';
  lastUpdated: Date;
  recommendedActions: string[];
  warningFlags: Array<{
    flag: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
}

export class AdvancedCitationEngine {

  /**
   * Generates advanced citations with confidence intervals and reliability scores
   */
  async generateAdvancedCitation(
    claim: string,
    searchResults: any[],
    userId: string
  ): Promise<AdvancedCitation> {
    try {
      console.log('📝 Generating advanced citation for claim:', claim);

      // Step 1: Rank and verify sources
      const rankedSources = await this.rankSources(searchResults, claim);
      
      // Step 2: Verify the claim against sources
      const verification = await realTimeFactVerification.verifyClaim(claim, userId);
      
      // Step 3: Calculate confidence intervals
      const confidenceAnalysis = await this.calculateConfidenceIntervals(claim, rankedSources);
      
      // Step 4: Detect evidence strength
      const evidenceStrength = this.assessEvidenceStrength(rankedSources, verification);
      
      // Step 5: Generate warnings and recommendations
      const warnings = await this.generateWarnings(claim, rankedSources, verification);
      const recommendations = this.generateRecommendations(verification, evidenceStrength);

      const citation: AdvancedCitation = {
        citationId: `citation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        claim,
        primarySources: rankedSources.filter(s => s.reliabilityScore > 0.7).slice(0, 3),
        secondarySources: rankedSources.filter(s => s.reliabilityScore <= 0.7).slice(0, 2),
        verificationStatus: this.mapVerificationStatus(verification.verificationStatus),
        overallConfidence: verification.confidence,
        evidenceStrength,
        lastUpdated: new Date(),
        recommendedActions: recommendations,
        warningFlags: warnings
      };

      return citation;
    } catch (error) {
      console.error('Error generating advanced citation:', error);
      return this.getFailsafeCitation(claim);
    }
  }

  /**
   * Ranks sources by reliability and relevance
   */
  private async rankSources(searchResults: any[], claim: string): Promise<CitationSource[]> {
    const citationSources: CitationSource[] = [];

    for (const result of searchResults) {
      const source = await this.analyzeSingleSource(result, claim);
      if (source) {
        citationSources.push(source);
      }
    }

    // Sort by combined score (reliability * relevance)
    return citationSources.sort((a, b) => 
      (b.reliabilityScore * b.relevanceScore) - (a.reliabilityScore * a.relevanceScore)
    );
  }

  /**
   * Analyzes a single source for citation quality
   */
  private async analyzeSingleSource(result: any, claim: string): Promise<CitationSource | null> {
    try {
      // Get document details
      const [document] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, result.documentId))
        .limit(1);

      if (!document) return null;

      // Calculate reliability score
      const reliabilityScore = await this.calculateReliabilityScore(document);
      
      // Extract supporting evidence
      const evidence = await this.extractSupportingEvidence(result.content, claim);
      
      // Calculate confidence interval
      const confidenceInterval = this.calculateSourceConfidenceInterval(reliabilityScore, result.score);

      return {
        sourceId: result.id,
        documentName: document.name,
        documentType: this.categorizeDocument(document.name),
        relevanceScore: result.score,
        reliabilityScore,
        confidenceInterval,
        lastVerified: new Date(),
        supportingEvidence: evidence
      };
    } catch (error) {
      console.error('Error analyzing source:', error);
      return null;
    }
  }

  /**
   * Calculates reliability score based on document characteristics
   */
  private async calculateReliabilityScore(document: any): Promise<number> {
    let score = 0.5; // Base reliability

    // Document type scoring
    const docType = this.categorizeDocument(document.name);
    switch (docType) {
      case 'contract': score += 0.3; break;
      case 'policy': score += 0.25; break;
      case 'manual': score += 0.2; break;
      case 'statement': score += 0.15; break;
      case 'guide': score += 0.1; break;
      default: score += 0.05; break;
    }

    // Document age scoring
    const docAge = Date.now() - new Date(document.createdAt).getTime();
    const monthsOld = docAge / (1000 * 60 * 60 * 24 * 30);
    
    if (monthsOld < 6) {
      score += 0.15; // Recent documents are more reliable
    } else if (monthsOld > 24) {
      score -= 0.1; // Old documents may be outdated
    }

    // Document completeness scoring
    if (document.content && document.content.length > 1000) {
      score += 0.05; // Comprehensive documents are more reliable
    }

    return Math.max(0.1, Math.min(1.0, score));
  }

  /**
   * Categorizes document type from name
   */
  private categorizeDocument(name: string): 'contract' | 'policy' | 'manual' | 'statement' | 'guide' | 'other' {
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('contract') || lowerName.includes('agreement')) return 'contract';
    if (lowerName.includes('policy') || lowerName.includes('rule')) return 'policy';
    if (lowerName.includes('manual') || lowerName.includes('handbook')) return 'manual';
    if (lowerName.includes('statement') || lowerName.includes('report')) return 'statement';
    if (lowerName.includes('guide') || lowerName.includes('tutorial')) return 'guide';
    
    return 'other';
  }

  /**
   * Extracts supporting evidence from content
   */
  private async extractSupportingEvidence(content: string, claim: string): Promise<Array<{
    snippet: string;
    pageNumber?: number;
    sectionTitle?: string;
    evidenceType: 'direct_quote' | 'paraphrase' | 'numerical_data' | 'procedural_step';
    strength: 'strong' | 'moderate' | 'weak';
  }>> {
    const prompt = `Extract supporting evidence for this claim from the content:

Claim: "${claim}"
Content: "${content.substring(0, 1500)}"

Find specific evidence that supports the claim. For each piece of evidence, identify:
1. The exact text snippet (keep it under 100 characters)
2. Type of evidence (direct quote, paraphrase, numerical data, or procedural step)
3. Strength of support (strong, moderate, weak)

Return JSON format:
{
  "evidence": [
    {
      "snippet": "exact text from content",
      "evidenceType": "direct_quote|paraphrase|numerical_data|procedural_step",
      "strength": "strong|moderate|weak"
    }
  ]
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result.evidence || [];
    } catch (error) {
      console.error('Error extracting evidence:', error);
      return [];
    }
  }

  /**
   * Calculates confidence intervals for sources
   */
  private async calculateConfidenceIntervals(
    claim: string, 
    sources: CitationSource[]
  ): Promise<void> {
    for (const source of sources) {
      // Calculate confidence interval based on reliability and relevance
      const baseConfidence = source.reliabilityScore * source.relevanceScore;
      const margin = this.calculateMarginOfError(source);
      
      source.confidenceInterval = {
        lower: Math.max(0, baseConfidence - margin),
        upper: Math.min(1, baseConfidence + margin)
      };
    }
  }

  /**
   * Calculates margin of error for confidence interval
   */
  private calculateMarginOfError(source: CitationSource): number {
    let margin = 0.1; // Base margin
    
    // Increase margin for less reliable sources
    if (source.reliabilityScore < 0.5) margin += 0.15;
    if (source.reliabilityScore < 0.3) margin += 0.2;
    
    // Increase margin for less relevant sources
    if (source.relevanceScore < 0.7) margin += 0.1;
    if (source.relevanceScore < 0.5) margin += 0.15;
    
    // Decrease margin for strong evidence
    const strongEvidence = source.supportingEvidence.filter(e => e.strength === 'strong').length;
    if (strongEvidence >= 2) margin -= 0.05;
    if (strongEvidence >= 3) margin -= 0.1;
    
    return Math.max(0.05, Math.min(0.4, margin));
  }

  /**
   * Calculates confidence interval for a single source
   */
  private calculateSourceConfidenceInterval(
    reliabilityScore: number, 
    relevanceScore: number
  ): { lower: number; upper: number } {
    const baseConfidence = reliabilityScore * relevanceScore;
    const margin = 0.1 + (0.2 * (1 - reliabilityScore)); // Higher margin for less reliable sources
    
    return {
      lower: Math.max(0, baseConfidence - margin),
      upper: Math.min(1, baseConfidence + margin)
    };
  }

  /**
   * Assesses overall evidence strength
   */
  private assessEvidenceStrength(
    sources: CitationSource[], 
    verification: FactVerificationResult
  ): 'strong' | 'moderate' | 'weak' | 'insufficient' {
    const strongSources = sources.filter(s => s.reliabilityScore > 0.7).length;
    const strongEvidence = sources.reduce((total, source) => 
      total + source.supportingEvidence.filter(e => e.strength === 'strong').length, 0
    );
    
    if (verification.contradictingEvidence.length > 0) {
      return 'weak'; // Contradictions weaken evidence
    }
    
    if (strongSources >= 2 && strongEvidence >= 3) return 'strong';
    if (strongSources >= 1 && strongEvidence >= 2) return 'moderate';
    if (sources.length >= 2) return 'weak';
    
    return 'insufficient';
  }

  /**
   * Generates warning flags for potential issues
   */
  private async generateWarnings(
    claim: string,
    sources: CitationSource[],
    verification: FactVerificationResult
  ): Promise<Array<{
    flag: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>> {
    const warnings: any[] = [];

    // Check for contradictions
    if (verification.contradictingEvidence.length > 0) {
      warnings.push({
        flag: 'conflicting_sources',
        severity: 'high',
        description: `Found ${verification.contradictingEvidence.length} contradicting sources`
      });
    }

    // Check for low reliability
    const lowReliabilitySources = sources.filter(s => s.reliabilityScore < 0.4).length;
    if (lowReliabilitySources > sources.length / 2) {
      warnings.push({
        flag: 'low_source_reliability',
        severity: 'medium',
        description: 'Majority of sources have low reliability scores'
      });
    }

    // Check for outdated information
    const oldSources = sources.filter(s => {
      // Assume lastVerified represents document age
      const daysSinceVerified = (Date.now() - s.lastVerified.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceVerified > 365; // More than a year old
    }).length;
    
    if (oldSources > 0) {
      warnings.push({
        flag: 'potentially_outdated',
        severity: 'low',
        description: `${oldSources} sources may contain outdated information`
      });
    }

    // Check for insufficient evidence
    if (sources.length < 2) {
      warnings.push({
        flag: 'insufficient_sources',
        severity: 'medium',
        description: 'Limited number of sources to verify this claim'
      });
    }

    return warnings;
  }

  /**
   * Generates recommendations based on verification results
   */
  private generateRecommendations(
    verification: FactVerificationResult,
    evidenceStrength: string
  ): string[] {
    const recommendations: string[] = [];

    if (verification.verificationStatus === 'contradicted') {
      recommendations.push('Investigate contradicting sources and resolve conflicts');
      recommendations.push('Verify which information is most current and authoritative');
    }

    if (verification.verificationStatus === 'unverified') {
      recommendations.push('Seek additional authoritative sources');
      recommendations.push('Consider manual verification by subject matter expert');
    }

    if (evidenceStrength === 'weak' || evidenceStrength === 'insufficient') {
      recommendations.push('Add more supporting documentation to knowledge base');
      recommendations.push('Cross-reference with external authoritative sources');
    }

    if (verification.confidence < 0.6) {
      recommendations.push('Flag for manual review due to low confidence');
      recommendations.push('Request additional context or clarification');
    }

    return recommendations;
  }

  /**
   * Maps verification status to citation status
   */
  private mapVerificationStatus(
    status: 'verified' | 'contradicted' | 'unverified' | 'partially_verified'
  ): 'fully_verified' | 'partially_verified' | 'conflicted' | 'unverified' {
    switch (status) {
      case 'verified': return 'fully_verified';
      case 'contradicted': return 'conflicted';
      case 'partially_verified': return 'partially_verified';
      default: return 'unverified';
    }
  }

  /**
   * Failsafe citation when generation fails
   */
  private getFailsafeCitation(claim: string): AdvancedCitation {
    return {
      citationId: `failsafe_${Date.now()}`,
      claim,
      primarySources: [],
      secondarySources: [],
      verificationStatus: 'unverified',
      overallConfidence: 0.3,
      evidenceStrength: 'insufficient',
      lastUpdated: new Date(),
      recommendedActions: ['Manual verification required due to system error'],
      warningFlags: [{
        flag: 'system_error',
        severity: 'high',
        description: 'Citation generation failed - manual review required'
      }]
    };
  }

  /**
   * Gets citation history for audit trail
   */
  async getCitationHistory(citationId: string): Promise<{
    originalCitation: AdvancedCitation;
    revisions: Array<{
      revisionDate: Date;
      changes: string[];
      revisedBy: string;
      reason: string;
    }>;
    verificationHistory: Array<{
      verifiedDate: Date;
      verifiedBy: string;
      verificationMethod: string;
      result: string;
    }>;
  }> {
    // This would retrieve citation history from database
    // For now, return empty history
    return {
      originalCitation: this.getFailsafeCitation(''),
      revisions: [],
      verificationHistory: []
    };
  }

  /**
   * Updates citation reliability based on feedback
   */
  async updateCitationReliability(
    citationId: string,
    feedback: 'accurate' | 'inaccurate' | 'outdated',
    userId: string
  ): Promise<void> {
    try {
      console.log('📊 Updating citation reliability:', {
        citationId,
        feedback,
        userId,
        timestamp: new Date()
      });

      // This would update citation reliability scores in database
      // and trigger recomputation of confidence intervals
    } catch (error) {
      console.error('Error updating citation reliability:', error);
    }
  }
}

export const advancedCitationEngine = new AdvancedCitationEngine();