import { PineconeVectorService } from './pinecone-vector';
import { db } from './db';
import { documents, documentChunks, faqKnowledgeBase } from '../shared/schema';
import { eq, ilike, or, and, sql } from 'drizzle-orm';
import { searchAnalyticsTracker } from './search-analytics';

export interface SearchResult {
  score: number;
  id: string;
  content: string;
  metadata: any;
  source: 'pinecone' | 'database' | 'faq';
  relevanceBoost?: number;
}

export class EnhancedSearchService {
  private pineconeService: PineconeVectorService;
  
  constructor() {
    this.pineconeService = new PineconeVectorService();
  }
  
  async performEnhancedSearch(query: string, limit: number = 10, userId?: string): Promise<SearchResult[]> {
    console.log(`🔍 Enhanced Search: "${query}"`);
    
    // Initialize results map
    const resultsMap = new Map<string, SearchResult>();
    
    // 1. Search FAQ Knowledge Base first (highest priority)
    const faqResults = await this.searchFAQs(query);
    faqResults.forEach(r => resultsMap.set(r.id, r));
    
    // 2. Search Pinecone vectors with enhanced query processing
    const vectorResults = await this.searchVectors(query);
    vectorResults.forEach(r => {
      const existing = resultsMap.get(r.id);
      if (existing && existing.source === 'faq') {
        // Don't override FAQ results
        return;
      }
      resultsMap.set(r.id, r);
    });
    
    // 3. Search database with keyword matching
    const dbResults = await this.searchDatabase(query);
    dbResults.forEach(r => {
      const existing = resultsMap.get(r.id);
      if (existing && (existing.source === 'faq' || existing.source === 'pinecone')) {
        // Boost score if found in multiple sources
        existing.score = Math.min(1.0, existing.score * 1.15);
        existing.relevanceBoost = (existing.relevanceBoost || 0) + 0.15;
      } else {
        resultsMap.set(r.id, r);
      }
    });
    
    // 4. Apply relevance scoring enhancements
    const enhancedResults = Array.from(resultsMap.values())
      .map(r => this.enhanceRelevanceScore(r, query))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    // 5. Track search analytics
    await searchAnalyticsTracker.trackSearch(query, enhancedResults, userId);
    
    console.log(`✅ Found ${enhancedResults.length} enhanced results`);
    return enhancedResults;
  }
  
  private async searchFAQs(query: string): Promise<SearchResult[]> {
    try {
      const faqs = await db
        .select()
        .from(faqKnowledgeBase)
        .where(
          or(
            ilike(faqKnowledgeBase.question, `%${query}%`),
            ilike(faqKnowledgeBase.answer, `%${query}%`),
            sql`array_to_string(${faqKnowledgeBase.tags}, ' ') ILIKE ${`%${query}%`}`
          )
        )
        .limit(5);
      
      return faqs.map(faq => ({
        id: `faq-${faq.id}`,
        score: 0.95, // High base score for FAQ matches
        content: `Q: ${faq.question}\n\nA: ${faq.answer}`,
        metadata: {
          type: 'faq',
          category: faq.category,
          tags: faq.tags,
          priority: faq.priority
        },
        source: 'faq' as const
      }));
    } catch (error) {
      console.error('FAQ search error:', error);
      return [];
    }
  }
  
  private async searchVectors(query: string): Promise<SearchResult[]> {
    try {
      // Generate query variations
      const queryVariations = this.generateQueryVariations(query);
      const allResults = new Map<string, SearchResult>();
      
      // Search with each variation
      for (const variation of queryVariations) {
        const results = await this.pineconeService.searchDocuments(variation, 10, ['']);
        results.forEach(r => {
          const key = r.metadata?.documentName || r.id;
          const existing = allResults.get(key);
          if (!existing || r.score > existing.score) {
            allResults.set(key, {
              id: r.id,
              score: r.score,
              content: r.content || '',
              metadata: r.metadata,
              source: 'pinecone'
            });
          }
        });
      }
      
      return Array.from(allResults.values());
    } catch (error) {
      console.error('Vector search error:', error);
      return [];
    }
  }
  
  private async searchDatabase(query: string): Promise<SearchResult[]> {
    try {
      // Extract key terms
      const terms = this.extractKeyTerms(query);
      
      // Build search conditions
      const searchConditions = terms.map(term => 
        or(
          ilike(documents.name, `%${term}%`),
          sql`${documentChunks.content}::text ILIKE ${`%${term}%`}`
        )
      );
      
      const results = await db
        .select({
          docId: documents.id,
          docName: documents.name,
          chunkContent: documentChunks.content,
          chunkMetadata: documentChunks.metadata
        })
        .from(documents)
        .leftJoin(documentChunks, eq(documents.id, documentChunks.documentId))
        .where(and(...searchConditions))
        .limit(20);
      
      // Group by document and calculate relevance
      const docScores = new Map<string, SearchResult>();
      
      results.forEach(r => {
        if (!r.docId) return;
        
        const existing = docScores.get(r.docId);
        const termMatchCount = terms.filter(term => 
          r.docName?.toLowerCase().includes(term.toLowerCase()) ||
          r.chunkContent?.toLowerCase().includes(term.toLowerCase())
        ).length;
        
        const score = termMatchCount / terms.length * 0.7; // Max 0.7 for DB results
        
        if (!existing || score > existing.score) {
          docScores.set(r.docId, {
            id: r.docId,
            score,
            content: r.chunkContent || `Document: ${r.docName}`,
            metadata: {
              documentName: r.docName,
              ...r.chunkMetadata
            },
            source: 'database'
          });
        }
      });
      
      return Array.from(docScores.values());
    } catch (error) {
      console.error('Database search error:', error);
      return [];
    }
  }
  
  private generateQueryVariations(query: string): string[] {
    const variations = new Set<string>();
    variations.add(query);
    
    // Handle common variations
    const lowerQuery = query.toLowerCase();
    
    // Auth.net variations
    if (lowerQuery.includes('auth.net') || lowerQuery.includes('authnet') || lowerQuery.includes('authorize')) {
      variations.add(query.replace(/auth\.?net/gi, 'authorize.net'));
      variations.add(query.replace(/auth\.?net/gi, 'authorize net'));
      variations.add(query.replace(/auth\.?net/gi, 'authorize'));
      variations.add(query.replace(/authorize/gi, 'auth.net'));
      variations.add(query.replace(/authorize/gi, 'authnet'));
    }
    
    // Comprehensive payment processor variations
    const processors = [
      { short: 'tsys', full: 'total system services', alternates: ['vital', 'global payments'] },
      { short: 'fiserv', full: 'first data', alternates: ['clover'] },
      { short: 'worldpay', full: 'world pay', alternates: ['vantiv', 'fis'] },
      { short: 'square', full: 'block', alternates: ['square payments', 'square terminal'] },
      { short: 'clover', full: 'clover pos', alternates: ['clover flex', 'clover mini'] },
      { short: 'shift4', full: 'shift 4', alternates: ['shift four', 'harbortouch'] },
      { short: 'stripe', full: 'stripe payments', alternates: ['stripe terminal', 'stripe connect'] },
      { short: 'helcim', full: 'helcom', alternates: ['helcim payments'] },
      { short: 'paypal', full: 'paypal here', alternates: ['paypal zettle', 'braintree'] },
      { short: 'chase', full: 'chase paymentech', alternates: ['paymentech'] },
      { short: 'elavon', full: 'elavon merchant', alternates: ['us bank', 'converge'] },
      { short: 'hubwallet', full: 'hub wallet', alternates: ['tracer hub wallet'] },
      { short: 'quantic', full: 'quantic pos', alternates: ['quantic retail'] },
      { short: 'clearent', full: 'clearent payments', alternates: ['tsys clearent'] }
    ];
    
    processors.forEach(({ short, full, alternates }) => {
      if (lowerQuery.includes(short)) {
        variations.add(query.replace(new RegExp(short, 'gi'), full));
        alternates.forEach(alt => variations.add(query.replace(new RegExp(short, 'gi'), alt)));
      }
      if (lowerQuery.includes(full)) {
        variations.add(query.replace(new RegExp(full, 'gi'), short));
        alternates.forEach(alt => variations.add(query.replace(new RegExp(full, 'gi'), alt)));
      }
    });
    
    // Common terminology variations
    if (lowerQuery.includes('pricing') || lowerQuery.includes('rates') || lowerQuery.includes('price')) {
      variations.add(query.replace(/pricing/gi, 'rates'));
      variations.add(query.replace(/rates/gi, 'pricing'));
      variations.add(query.replace(/pric(e|ing|es)/gi, 'fees'));
      variations.add(query.replace(/pric(e|ing|es)/gi, 'cost'));
    }
    
    if (lowerQuery.includes('setup') || lowerQuery.includes('set up')) {
      variations.add(query.replace(/set\s*up/gi, 'install'));
      variations.add(query.replace(/set\s*up/gi, 'configure'));
      variations.add(query.replace(/set\s*up/gi, 'integrate'));
    }
    
    if (lowerQuery.includes('pos')) {
      variations.add(query.replace(/\bpos\b/gi, 'point of sale'));
      variations.add(query.replace(/\bpos\b/gi, 'terminal'));
    }
    
    if (lowerQuery.includes('ecommerce') || lowerQuery.includes('e-commerce')) {
      variations.add(query.replace(/e-?commerce/gi, 'online'));
      variations.add(query.replace(/e-?commerce/gi, 'website'));
      variations.add(query.replace(/e-?commerce/gi, 'virtual terminal'));
    }
    
    return Array.from(variations);
  }
  
  private extractKeyTerms(query: string): string[] {
    // Remove common words and extract key terms
    const stopWords = new Set(['how', 'do', 'i', 'what', 'is', 'the', 'a', 'an', 'for', 'to', 'of', 'in', 'on', 'at', 'with']);
    
    const terms = query
      .toLowerCase()
      .replace(/[^\w\s.-]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 2 && !stopWords.has(term));
    
    // Add full query if it's short
    if (query.length < 30) {
      terms.unshift(query);
    }
    
    return [...new Set(terms)];
  }
  
  private enhanceRelevanceScore(result: SearchResult, query: string): SearchResult {
    let scoreMultiplier = 1.0;
    const lowerQuery = query.toLowerCase();
    const lowerContent = result.content.toLowerCase();
    const docName = (result.metadata?.documentName || '').toLowerCase();
    
    // Boost exact matches
    if (lowerContent.includes(lowerQuery) || docName.includes(lowerQuery)) {
      scoreMultiplier *= 1.2;
    }
    
    // Boost based on source priority
    if (result.source === 'faq') {
      scoreMultiplier *= 1.3;
    } else if (result.source === 'pinecone') {
      scoreMultiplier *= 1.1;
    }
    
    // Boost if document name contains key terms
    const keyTerms = this.extractKeyTerms(query);
    const nameMatchCount = keyTerms.filter(term => docName.includes(term)).length;
    if (nameMatchCount > 0) {
      scoreMultiplier *= (1 + nameMatchCount * 0.1);
    }
    
    // Apply relevance boost if it exists
    if (result.relevanceBoost) {
      scoreMultiplier *= (1 + result.relevanceBoost);
    }
    
    result.score = Math.min(1.0, result.score * scoreMultiplier);
    return result;
  }
}

export const enhancedSearchService = new EnhancedSearchService();