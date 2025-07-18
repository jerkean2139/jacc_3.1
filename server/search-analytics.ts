import { db } from './db.js';
import { sql } from 'drizzle-orm';

export interface SearchAnalytics {
  query: string;
  resultCount: number;
  averageScore: number;
  timestamp: Date;
  sources: string[];
  userId?: string;
  hasGoodResults: boolean;
}

export class SearchAnalyticsTracker {
  private analytics: SearchAnalytics[] = [];
  private poorQueriesCache = new Map<string, number>();
  
  async trackSearch(
    query: string, 
    results: any[], 
    userId?: string
  ): Promise<void> {
    const scores = results.map(r => r.score || 0);
    const averageScore = scores.length > 0 
      ? scores.reduce((a, b) => a + b, 0) / scores.length 
      : 0;
    
    const sources = [...new Set(results.map(r => r.source || 'unknown'))];
    const hasGoodResults = results.length > 0 && averageScore >= 0.4;
    
    const analytics: SearchAnalytics = {
      query: query.toLowerCase().trim(),
      resultCount: results.length,
      averageScore,
      timestamp: new Date(),
      sources,
      userId,
      hasGoodResults
    };
    
    this.analytics.push(analytics);
    
    // Track poor performing queries
    if (!hasGoodResults) {
      const count = this.poorQueriesCache.get(analytics.query) || 0;
      this.poorQueriesCache.set(analytics.query, count + 1);
    }
    
    // Store in database for persistence (create table if needed)
    try {
      await db.execute(sql`
        INSERT INTO search_analytics (
          query, result_count, average_score, sources, user_id, has_good_results, created_at
        ) VALUES (
          ${analytics.query},
          ${analytics.resultCount},
          ${analytics.averageScore},
          ${JSON.stringify(analytics.sources)},
          ${analytics.userId || null},
          ${analytics.hasGoodResults},
          ${analytics.timestamp}
        )
      `);
    } catch (error) {
      // Table might not exist, log for now
      console.log('Search analytics tracking (in-memory):', analytics);
    }
  }
  
  async getPoorPerformingQueries(limit: number = 20): Promise<{
    query: string;
    searchCount: number;
    averageScore: number;
    suggestedKeywords: string[];
  }[]> {
    // Get queries with poor results from cache
    const poorQueries = Array.from(this.poorQueriesCache.entries())
      .map(([query, count]) => {
        const queryAnalytics = this.analytics.filter(a => a.query === query);
        const avgScore = queryAnalytics.reduce((sum, a) => sum + a.averageScore, 0) / queryAnalytics.length;
        
        return {
          query,
          searchCount: count,
          averageScore: avgScore,
          suggestedKeywords: this.generateSuggestedKeywords(query)
        };
      })
      .sort((a, b) => b.searchCount - a.searchCount)
      .slice(0, limit);
    
    return poorQueries;
  }
  
  private generateSuggestedKeywords(query: string): string[] {
    const suggestions: string[] = [];
    const queryLower = query.toLowerCase();
    
    // Processor name variations
    const processorMappings = new Map([
      ['authnet', ['authorize.net', 'authorize net', 'auth.net']],
      ['auth.net', ['authorize.net', 'authorize net', 'authnet']],
      ['authorize', ['authorize.net', 'auth.net', 'authnet']],
      ['square', ['block', 'square payments', 'square terminal']],
      ['block', ['square', 'square payments', 'block payments']],
      ['shift 4', ['shift4', 'shift four']],
      ['shift4', ['shift 4', 'shift four']],
      ['helcom', ['helcim']],
      ['helcim', ['helcom']],
      ['stripe', ['stripe terminal', 'stripe payments']],
      ['clover', ['clover pos', 'clover flex', 'clover mini']],
      ['tsys', ['tsys merchant', 'vital']],
      ['paypal', ['paypal here', 'paypal zettle']],
      ['first data', ['fiserv', 'clover']],
      ['fiserv', ['first data', 'clover']]
    ]);
    
    // Check for processor variations
    for (const [key, values] of processorMappings) {
      if (queryLower.includes(key)) {
        suggestions.push(...values);
      }
    }
    
    // Common misspellings and variations
    if (queryLower.includes('setup') || queryLower.includes('set up')) {
      suggestions.push('installation', 'configure', 'integrate');
    }
    
    if (queryLower.includes('price') || queryLower.includes('pricing')) {
      suggestions.push('rates', 'fees', 'cost', 'charges');
    }
    
    if (queryLower.includes('integrate') || queryLower.includes('integration')) {
      suggestions.push('setup', 'connect', 'api', 'documentation');
    }
    
    if (queryLower.includes('pos')) {
      suggestions.push('point of sale', 'terminal', 'hardware');
    }
    
    if (queryLower.includes('ecommerce') || queryLower.includes('e-commerce')) {
      suggestions.push('online', 'website', 'virtual terminal');
    }
    
    return [...new Set(suggestions)]; // Remove duplicates
  }
  
  async getSearchInsights(): Promise<{
    totalSearches: number;
    successRate: number;
    averageResultCount: number;
    topPoorQueries: any[];
    commonFailurePatterns: string[];
  }> {
    const totalSearches = this.analytics.length;
    const successfulSearches = this.analytics.filter(a => a.hasGoodResults).length;
    const successRate = totalSearches > 0 ? successfulSearches / totalSearches : 0;
    
    const totalResults = this.analytics.reduce((sum, a) => sum + a.resultCount, 0);
    const averageResultCount = totalSearches > 0 ? totalResults / totalSearches : 0;
    
    const topPoorQueries = await this.getPoorPerformingQueries(10);
    
    // Identify common failure patterns
    const failurePatterns: string[] = [];
    const failedQueries = this.analytics.filter(a => !a.hasGoodResults).map(a => a.query);
    
    if (failedQueries.some(q => q.includes('pricing') || q.includes('rates'))) {
      failurePatterns.push('Pricing/rates information requests often fail');
    }
    
    if (failedQueries.some(q => q.includes('api') || q.includes('documentation'))) {
      failurePatterns.push('Technical documentation queries need improvement');
    }
    
    if (failedQueries.some(q => q.includes('compare') || q.includes('vs'))) {
      failurePatterns.push('Comparison queries lack comprehensive data');
    }
    
    return {
      totalSearches,
      successRate,
      averageResultCount,
      topPoorQueries,
      commonFailurePatterns: failurePatterns
    };
  }
  
  // Method to export analytics for further analysis
  async exportAnalytics(): Promise<SearchAnalytics[]> {
    return [...this.analytics]; // Return copy
  }
  
  // Clear old analytics (keep last 7 days)
  async cleanupOldAnalytics(): Promise<void> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    this.analytics = this.analytics.filter(a => a.timestamp > sevenDaysAgo);
    
    // Rebuild poor queries cache
    this.poorQueriesCache.clear();
    this.analytics
      .filter(a => !a.hasGoodResults)
      .forEach(a => {
        const count = this.poorQueriesCache.get(a.query) || 0;
        this.poorQueriesCache.set(a.query, count + 1);
      });
  }
}

// Export singleton instance
export const searchAnalyticsTracker = new SearchAnalyticsTracker();