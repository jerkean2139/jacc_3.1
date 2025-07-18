import { db } from './db.js';
import { documents, documentChunks } from '../shared/schema.js';
import { eq, lt, and, isNull, or, ilike } from 'drizzle-orm';
import { PineconeVectorService } from './pinecone-vector.js';

export interface QualityMetrics {
  documentId: string;
  documentName: string;
  confidence: number;
  contentLength: number;
  extractionMethod: string;
  issues: string[];
  recommendations: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export class ContentQualityReviewer {
  private pineconeService: PineconeVectorService;
  
  constructor() {
    this.pineconeService = new PineconeVectorService();
  }
  
  async performQualityReview(): Promise<{
    summary: {
      totalDocuments: number;
      criticalIssues: number;
      highIssues: number;
      mediumIssues: number;
      lowIssues: number;
      averageConfidence: number;
    };
    documents: QualityMetrics[];
  }> {
    console.log('🔍 Starting comprehensive content quality review...');
    
    // Get all documents with their chunks
    const allDocs = await db
      .select({
        id: documents.id,
        name: documents.name,
        mimeType: documents.mimeType,
        metadata: documents.metadata,
        processingStatus: documents.processingStatus
      })
      .from(documents);
    
    const qualityMetrics: QualityMetrics[] = [];
    let totalConfidence = 0;
    let documentCount = 0;
    
    for (const doc of allDocs) {
      const chunks = await db
        .select()
        .from(documentChunks)
        .where(eq(documentChunks.documentId, doc.id));
      
      const metrics = await this.analyzeDocument(doc, chunks);
      if (metrics) {
        qualityMetrics.push(metrics);
        totalConfidence += metrics.confidence;
        documentCount++;
      }
    }
    
    // Sort by priority
    qualityMetrics.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    
    // Calculate summary
    const summary = {
      totalDocuments: documentCount,
      criticalIssues: qualityMetrics.filter(m => m.priority === 'critical').length,
      highIssues: qualityMetrics.filter(m => m.priority === 'high').length,
      mediumIssues: qualityMetrics.filter(m => m.priority === 'medium').length,
      lowIssues: qualityMetrics.filter(m => m.priority === 'low').length,
      averageConfidence: documentCount > 0 ? totalConfidence / documentCount : 0
    };
    
    console.log(`✅ Quality review complete. Found ${summary.criticalIssues} critical issues.`);
    
    return { summary, documents: qualityMetrics };
  }
  
  private async analyzeDocument(doc: any, chunks: any[]): Promise<QualityMetrics | null> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Extract metadata
    const metadata = typeof doc.metadata === 'string' ? JSON.parse(doc.metadata) : doc.metadata;
    const confidence = metadata?.confidence || 0;
    const extractionMethod = metadata?.extractionMethod || 'unknown';
    
    // Calculate total content length
    const totalContent = chunks.map(c => c.content || '').join(' ');
    const contentLength = totalContent.length;
    
    // Identify issues
    if (confidence < 0.3) {
      issues.push('Very low OCR confidence');
      recommendations.push('Manual review and re-upload with better scan quality');
    } else if (confidence < 0.5) {
      issues.push('Low OCR confidence');
      recommendations.push('Consider re-scanning with higher resolution');
    }
    
    if (contentLength < 100) {
      issues.push('Minimal content extracted');
      recommendations.push('Document may need manual text entry');
    } else if (contentLength < 500) {
      issues.push('Limited content extracted');
      recommendations.push('Verify all pages were processed');
    }
    
    if (extractionMethod === 'fallback') {
      issues.push('Used fallback extraction method');
      recommendations.push('Original OCR failed - document quality may be poor');
    }
    
    // Check for generic content
    const genericPhrases = [
      'This PDF document contains',
      'This document is available for processing',
      'Found document:',
      'Document contains information'
    ];
    
    const hasGenericContent = genericPhrases.some(phrase => 
      totalContent.toLowerCase().includes(phrase.toLowerCase())
    );
    
    if (hasGenericContent) {
      issues.push('Contains generic placeholder content');
      recommendations.push('Re-index document with actual content extraction');
    }
    
    // Check for specific processor content
    const processorKeywords = [
      'authorize.net', 'auth.net', 'clover', 'shift4', 'square', 
      'stripe', 'paypal', 'helcim', 'hubwallet', 'tsys'
    ];
    
    const hasProcessorContent = processorKeywords.some(keyword =>
      totalContent.toLowerCase().includes(keyword)
    );
    
    if (!hasProcessorContent && doc.name.toLowerCase().includes('authorize')) {
      issues.push('Authorize.net document missing processor-specific content');
      recommendations.push('Ensure OCR captured actual Auth.net information');
    }
    
    // Determine priority
    let priority: 'critical' | 'high' | 'medium' | 'low' = 'low';
    if (issues.includes('Very low OCR confidence') || contentLength < 100) {
      priority = 'critical';
    } else if (issues.includes('Low OCR confidence') || hasGenericContent) {
      priority = 'high';
    } else if (issues.length > 0) {
      priority = 'medium';
    }
    
    return {
      documentId: doc.id,
      documentName: doc.name,
      confidence,
      contentLength,
      extractionMethod,
      issues,
      recommendations,
      priority
    };
  }
  
  async generateImprovementReport(): Promise<string> {
    const { summary, documents } = await this.performQualityReview();
    
    let report = `# Content Quality Review Report\n\n`;
    report += `Generated: ${new Date().toISOString()}\n\n`;
    
    report += `## Summary\n`;
    report += `- Total Documents: ${summary.totalDocuments}\n`;
    report += `- Average Confidence: ${(summary.averageConfidence * 100).toFixed(1)}%\n`;
    report += `- Critical Issues: ${summary.criticalIssues}\n`;
    report += `- High Priority: ${summary.highIssues}\n`;
    report += `- Medium Priority: ${summary.mediumIssues}\n`;
    report += `- Low Priority: ${summary.lowIssues}\n\n`;
    
    report += `## Documents Requiring Attention\n\n`;
    
    // Group by priority
    const priorities = ['critical', 'high', 'medium', 'low'] as const;
    for (const priority of priorities) {
      const priorityDocs = documents.filter(d => d.priority === priority);
      if (priorityDocs.length > 0) {
        report += `### ${priority.toUpperCase()} Priority (${priorityDocs.length} documents)\n\n`;
        
        for (const doc of priorityDocs) {
          report += `#### ${doc.documentName}\n`;
          report += `- Confidence: ${(doc.confidence * 100).toFixed(1)}%\n`;
          report += `- Content Length: ${doc.contentLength} characters\n`;
          report += `- Extraction Method: ${doc.extractionMethod}\n`;
          report += `- Issues:\n`;
          doc.issues.forEach(issue => {
            report += `  - ${issue}\n`;
          });
          report += `- Recommendations:\n`;
          doc.recommendations.forEach(rec => {
            report += `  - ${rec}\n`;
          });
          report += `\n`;
        }
      }
    }
    
    return report;
  }
}

// Export singleton instance
export const contentQualityReviewer = new ContentQualityReviewer();