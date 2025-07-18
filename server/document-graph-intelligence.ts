import { db } from "./db";
import { documents, documentChunks } from "@shared/schema";
import { eq, and, or, like } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface DocumentRelationship {
  sourceDocId: string;
  targetDocId: string;
  relationshipType: 'references' | 'contradicts' | 'supports' | 'extends' | 'supersedes';
  confidence: number;
  context: string;
  evidence: string[];
}

export interface ConflictDetection {
  conflictId: string;
  documentsInvolved: string[];
  conflictType: 'factual' | 'numerical' | 'procedural' | 'policy';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidenceSnippets: string[];
  resolutionSuggestion?: string;
}

export interface DocumentContext {
  documentId: string;
  relatedDocuments: DocumentRelationship[];
  keyEntities: string[];
  topics: string[];
  factualClaims: Array<{
    claim: string;
    confidence: number;
    supportingEvidence: string[];
  }>;
}

export class DocumentGraphIntelligence {
  
  /**
   * Analyzes relationships between documents to build knowledge graph
   */
  async analyzeDocumentRelationships(documentId: string): Promise<DocumentRelationship[]> {
    try {
      // Get the target document content
      const [targetDoc] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, documentId))
        .limit(1);

      if (!targetDoc) return [];

      // Get related documents in the same folder or similar topics
      const relatedDocs = await db
        .select()
        .from(documents)
        .where(and(
          eq(documents.folderId, targetDoc.folderId || ''),
          // Different document
          // Note: Using string comparison as fallback since != may not work with mixed types
        ))
        .limit(10);

      const relationships: DocumentRelationship[] = [];

      for (const relatedDoc of relatedDocs) {
        if (relatedDoc.id === documentId) continue;

        const relationship = await this.detectRelationship(targetDoc, relatedDoc);
        if (relationship) {
          relationships.push(relationship);
        }
      }

      return relationships;
    } catch (error) {
      console.error('Error analyzing document relationships:', error);
      return [];
    }
  }

  /**
   * Detects specific relationship between two documents using AI
   */
  private async detectRelationship(
    docA: any, 
    docB: any
  ): Promise<DocumentRelationship | null> {
    try {
      const prompt = `Analyze the relationship between these two documents:

Document A: ${docA.name}
Content Preview: ${docA.content?.substring(0, 500)}...

Document B: ${docB.name}  
Content Preview: ${docB.content?.substring(0, 500)}...

Determine if there is a significant relationship and classify it:
- references: Document A cites or mentions Document B
- contradicts: Documents contain conflicting information
- supports: Documents reinforce each other's claims
- extends: Document A builds upon Document B
- supersedes: Document A replaces or updates Document B

Return JSON format:
{
  "hasRelationship": boolean,
  "relationshipType": "references|contradicts|supports|extends|supersedes",
  "confidence": 0-100,
  "context": "brief explanation",
  "evidence": ["specific examples"]
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      if (analysis.hasRelationship && analysis.confidence > 60) {
        return {
          sourceDocId: docA.id,
          targetDocId: docB.id,
          relationshipType: analysis.relationshipType,
          confidence: analysis.confidence / 100,
          context: analysis.context,
          evidence: analysis.evidence || []
        };
      }

      return null;
    } catch (error) {
      console.error('Error detecting relationship:', error);
      return null;
    }
  }

  /**
   * Detects conflicts and contradictions across document corpus
   */
  async detectDocumentConflicts(documentIds: string[]): Promise<ConflictDetection[]> {
    try {
      const conflicts: ConflictDetection[] = [];
      
      // Get all documents
      const docs = await db
        .select()
        .from(documents)
        .where(or(...documentIds.map(id => eq(documents.id, id))))
        .limit(20);

      // Compare pairs of documents for conflicts
      for (let i = 0; i < docs.length; i++) {
        for (let j = i + 1; j < docs.length; j++) {
          const conflict = await this.analyzeConflictBetweenDocs(docs[i], docs[j]);
          if (conflict) {
            conflicts.push(conflict);
          }
        }
      }

      return conflicts;
    } catch (error) {
      console.error('Error detecting conflicts:', error);
      return [];
    }
  }

  /**
   * Analyzes potential conflicts between two specific documents
   */
  private async analyzeConflictBetweenDocs(docA: any, docB: any): Promise<ConflictDetection | null> {
    try {
      const prompt = `Analyze these two documents for conflicts or contradictions:

Document A: ${docA.name}
Content: ${docA.content?.substring(0, 1000)}...

Document B: ${docB.name}
Content: ${docB.content?.substring(0, 1000)}...

Look for:
1. Factual contradictions (different numbers, dates, procedures)
2. Policy conflicts (contradictory rules or guidelines)  
3. Numerical discrepancies (rates, fees, percentages)
4. Procedural differences (conflicting steps or requirements)

Return JSON format:
{
  "hasConflict": boolean,
  "conflictType": "factual|numerical|procedural|policy",
  "severity": "low|medium|high|critical", 
  "description": "specific conflict description",
  "evidenceSnippets": ["conflicting text excerpts"],
  "resolutionSuggestion": "how to resolve"
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      if (analysis.hasConflict) {
        return {
          conflictId: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          documentsInvolved: [docA.id, docB.id],
          conflictType: analysis.conflictType,
          severity: analysis.severity,
          description: analysis.description,
          evidenceSnippets: analysis.evidenceSnippets || [],
          resolutionSuggestion: analysis.resolutionSuggestion
        };
      }

      return null;
    } catch (error) {
      console.error('Error analyzing conflict:', error);
      return null;
    }
  }

  /**
   * Builds comprehensive context for a document including all relationships
   */
  async buildDocumentContext(documentId: string): Promise<DocumentContext> {
    try {
      const relationships = await this.analyzeDocumentRelationships(documentId);
      const entities = await this.extractKeyEntities(documentId);
      const topics = await this.extractTopics(documentId);
      const claims = await this.extractFactualClaims(documentId);

      return {
        documentId,
        relatedDocuments: relationships,
        keyEntities: entities,
        topics: topics,
        factualClaims: claims
      };
    } catch (error) {
      console.error('Error building document context:', error);
      return {
        documentId,
        relatedDocuments: [],
        keyEntities: [],
        topics: [],
        factualClaims: []
      };
    }
  }

  /**
   * Extracts key entities from document content
   */
  private async extractKeyEntities(documentId: string): Promise<string[]> {
    try {
      const [doc] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, documentId))
        .limit(1);

      if (!doc?.content) return [];

      const prompt = `Extract key entities from this merchant services document:

${doc.content.substring(0, 2000)}

Focus on:
- Company names
- Product names  
- Technical terms
- Financial terms
- Key people/roles
- Specific rates/fees
- Important dates

Return as JSON array: ["entity1", "entity2", ...]`;

      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0].message.content || '{"entities": []}');
      return result.entities || [];
    } catch (error) {
      console.error('Error extracting entities:', error);
      return [];
    }
  }

  /**
   * Extracts main topics from document
   */
  private async extractTopics(documentId: string): Promise<string[]> {
    try {
      const [doc] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, documentId))
        .limit(1);

      if (!doc?.content) return [];

      const prompt = `Identify the main topics covered in this document:

${doc.content.substring(0, 1500)}

Return 5-8 specific topics as JSON array: ["topic1", "topic2", ...]`;

      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0].message.content || '{"topics": []}');
      return result.topics || [];
    } catch (error) {
      console.error('Error extracting topics:', error);
      return [];
    }
  }

  /**
   * Extracts factual claims with confidence scores
   */
  private async extractFactualClaims(documentId: string): Promise<Array<{
    claim: string;
    confidence: number;
    supportingEvidence: string[];
  }>> {
    try {
      const [doc] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, documentId))
        .limit(1);

      if (!doc?.content) return [];

      const prompt = `Extract specific factual claims from this document:

${doc.content.substring(0, 2000)}

Focus on:
- Specific rates, fees, percentages
- Concrete procedures or requirements
- Definitive statements about capabilities
- Specific timeframes or deadlines

For each claim, provide:
- The exact claim
- Confidence level (0-100)
- Supporting evidence from the text

Return JSON format:
{
  "claims": [
    {
      "claim": "specific factual statement",
      "confidence": 85,
      "supportingEvidence": ["text excerpts that support this"]
    }
  ]
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0].message.content || '{"claims": []}');
      return result.claims || [];
    } catch (error) {
      console.error('Error extracting factual claims:', error);
      return [];
    }
  }
}

export const documentGraphIntelligence = new DocumentGraphIntelligence();