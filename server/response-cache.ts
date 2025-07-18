// Response caching system for frequently asked questions
import { LRUCache } from 'lru-cache';
import crypto from 'crypto';

interface CachedResponse {
  response: string;
  sources: any[];
  timestamp: number;
  hitCount: number;
}

class ResponseCache {
  private cache: LRUCache<string, CachedResponse>;
  private readonly TTL = 1000 * 60 * 30; // 30 minutes to reduce memory
  
  constructor() {
    this.cache = new LRUCache<string, CachedResponse>({
      max: 10, // Further reduced to 10 items
      ttl: 1000 * 60 * 5, // 5 minutes
      updateAgeOnGet: true,
      updateAgeOnHas: true,
      // Add size calculation to limit memory usage
      sizeCalculation: (value) => {
        // Rough estimate: 1 char = 2 bytes
        return JSON.stringify(value).length * 2;
      },
      maxSize: 1 * 1024 * 1024, // 1MB max cache size
    });
  }

  // Generate cache key from query
  private getCacheKey(query: string): string {
    const normalized = query.toLowerCase().trim();
    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  // Check if response is cached
  async get(query: string): Promise<CachedResponse | null> {
    const key = this.getCacheKey(query);
    const cached = this.cache.get(key);
    
    if (cached) {
      // Increment hit count
      cached.hitCount++;
      this.cache.set(key, cached);
      
      console.log(`📋 CACHE HIT: "${query}" (${cached.hitCount} hits)`);
      return cached;
    }
    
    return null;
  }

  // Cache a response
  async set(query: string, response: string, sources: any[]): Promise<void> {
    const key = this.getCacheKey(query);
    
    this.cache.set(key, {
      response,
      sources,
      timestamp: Date.now(),
      hitCount: 1
    });
    
    console.log(`💾 CACHED: "${query}"`);
  }

  // Get cache statistics
  getStats() {
    const entries = Array.from(this.cache.entries());
    const totalHits = entries.reduce((sum, [_, value]) => sum + value.hitCount, 0);
    
    return {
      size: this.cache.size,
      totalHits,
      topQueries: entries
        .sort((a, b) => b[1].hitCount - a[1].hitCount)
        .slice(0, 10)
        .map(([key, value]) => ({
          hitCount: value.hitCount,
          age: Date.now() - value.timestamp
        }))
    };
  }

  // Clear cache
  clear(): void {
    this.cache.clear();
  }
}

export const responseCache = new ResponseCache();