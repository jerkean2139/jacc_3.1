import { db } from "./db";
import { responseCache } from "./response-cache";
import { sql } from "drizzle-orm";
import os from "os";

interface PerformanceSnapshot {
  timestamp: string;
  systemInfo: {
    uptime: number;
    nodeVersion: string;
    platform: string;
    architecture: string;
  };
  memory: {
    usage: {
      heapUsed: number;
      heapTotal: number;
      rss: number;
      external: number;
      arrayBuffers: number;
    };
    percentages: {
      heap: number;
      system: number;
    };
    trends: {
      last5Min: number[];
      average: number;
    };
  };
  performance: {
    responseTime: {
      endpoints: Record<string, number>;
      average: number;
      p95: number;
      p99: number;
    };
    throughput: {
      requestsPerMinute: number;
      requestsLast5Min: number;
    };
  };
  database: {
    status: string;
    activeConnections: number;
    queryPerformance: {
      slowQueries: number;
      averageQueryTime: number;
    };
    stats: {
      totalUsers: number;
      totalChats: number;
      totalDocuments: number;
      totalMessages: number;
    };
  };
  cache: {
    size: number;
    capacity: number;
    hitRate: number;
    evictionCount: number;
    memoryUsage: number;
  };
  apis: {
    status: Record<string, boolean>;
    errors: Record<string, number>;
    lastChecked: string;
  };
  errors: {
    last24Hours: number;
    byType: Record<string, number>;
    recentErrors: Array<{
      timestamp: string;
      type: string;
      message: string;
    }>;
  };
  userActivity: {
    activeUsers: number;
    last24Hours: {
      logins: number;
      chats: number;
      documents: number;
    };
    topUsers: Array<{
      email: string;
      activity: number;
    }>;
  };
}

// Memory tracking for trends
const memoryHistory: number[] = [];
const MAX_HISTORY = 60; // Keep last 60 measurements (5 minutes at 5-second intervals)

// Response time tracking
const responseTimeHistory: Map<string, number[]> = new Map();

// Error tracking
const errorLog: Array<{ timestamp: Date; type: string; message: string }> = [];
const MAX_ERROR_LOG = 100;

export function trackMemoryUsage() {
  const usage = process.memoryUsage();
  const percentage = Math.round((usage.heapUsed / usage.heapTotal) * 100);
  memoryHistory.push(percentage);
  
  if (memoryHistory.length > MAX_HISTORY) {
    memoryHistory.shift();
  }
}

export function trackResponseTime(endpoint: string, duration: number) {
  if (!responseTimeHistory.has(endpoint)) {
    responseTimeHistory.set(endpoint, []);
  }
  
  const times = responseTimeHistory.get(endpoint)!;
  times.push(duration);
  
  // Keep only last 100 measurements per endpoint
  if (times.length > 100) {
    times.shift();
  }
}

export function trackError(type: string, message: string) {
  errorLog.push({
    timestamp: new Date(),
    type,
    message: message.substring(0, 200) // Limit message length
  });
  
  if (errorLog.length > MAX_ERROR_LOG) {
    errorLog.shift();
  }
}

async function getDatabaseStats() {
  try {
    const [userCount] = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
    const [chatCount] = await db.execute(sql`SELECT COUNT(*) as count FROM chats`);
    const [docCount] = await db.execute(sql`SELECT COUNT(*) as count FROM documents`);
    const [msgCount] = await db.execute(sql`SELECT COUNT(*) as count FROM chat_messages`);
    
    return {
      totalUsers: Number(userCount.count) || 0,
      totalChats: Number(chatCount.count) || 0,
      totalDocuments: Number(docCount.count) || 0,
      totalMessages: Number(msgCount.count) || 0
    };
  } catch (error) {
    console.error('Error getting database stats:', error);
    return {
      totalUsers: 0,
      totalChats: 0,
      totalDocuments: 0,
      totalMessages: 0
    };
  }
}

async function getUserActivity() {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const [loginCount] = await db.execute(sql`
      SELECT COUNT(*) as count FROM user_stats 
      WHERE last_login > ${yesterday}
    `);
    
    const [chatActivity] = await db.execute(sql`
      SELECT COUNT(DISTINCT user_id) as active_users,
             COUNT(*) as total_chats
      FROM chats 
      WHERE created_at > ${yesterday}
    `);
    
    const [topUsers] = await db.execute(sql`
      SELECT u.email, COUNT(c.id) as activity
      FROM users u
      JOIN chats c ON u.id = c.user_id
      WHERE c.created_at > ${yesterday}
      GROUP BY u.email
      ORDER BY activity DESC
      LIMIT 5
    `);
    
    return {
      activeUsers: Number(chatActivity[0]?.active_users) || 0,
      last24Hours: {
        logins: Number(loginCount.count) || 0,
        chats: Number(chatActivity[0]?.total_chats) || 0,
        documents: 0 // TODO: Track document access
      },
      topUsers: topUsers.map(u => ({
        email: String(u.email),
        activity: Number(u.activity)
      }))
    };
  } catch (error) {
    console.error('Error getting user activity:', error);
    return {
      activeUsers: 0,
      last24Hours: {
        logins: 0,
        chats: 0,
        documents: 0
      },
      topUsers: []
    };
  }
}

function calculatePercentiles(values: number[]): { p95: number; p99: number } {
  if (values.length === 0) return { p95: 0, p99: 0 };
  
  const sorted = [...values].sort((a, b) => a - b);
  const p95Index = Math.floor(sorted.length * 0.95);
  const p99Index = Math.floor(sorted.length * 0.99);
  
  return {
    p95: sorted[p95Index] || 0,
    p99: sorted[p99Index] || 0
  };
}

export async function generatePerformanceSnapshot(): Promise<PerformanceSnapshot> {
  const memUsage = process.memoryUsage();
  const cacheStats = responseCache.getStats();
  
  // Calculate response time metrics
  const endpointTimes: Record<string, number> = {};
  let allTimes: number[] = [];
  
  responseTimeHistory.forEach((times, endpoint) => {
    if (times.length > 0) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      endpointTimes[endpoint] = Math.round(avg);
      allTimes = allTimes.concat(times);
    }
  });
  
  const avgResponseTime = allTimes.length > 0 
    ? Math.round(allTimes.reduce((a, b) => a + b, 0) / allTimes.length)
    : 0;
  
  const percentiles = calculatePercentiles(allTimes);
  
  // Count errors by type
  const errorsByType: Record<string, number> = {};
  const last24Hours = new Date();
  last24Hours.setDate(last24Hours.getDate() - 1);
  
  let errors24h = 0;
  errorLog.forEach(error => {
    if (error.timestamp > last24Hours) {
      errors24h++;
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
    }
  });
  
  // Get database and user stats
  const [dbStats, userActivity] = await Promise.all([
    getDatabaseStats(),
    getUserActivity()
  ]);
  
  // Check API status
  const apiStatus = {
    openai: !!process.env.OPENAI_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    pinecone: !!process.env.PINECONE_API_KEY,
    perplexity: !!process.env.PERPLEXITY_API_KEY
  };
  
  const snapshot: PerformanceSnapshot = {
    timestamp: new Date().toISOString(),
    systemInfo: {
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: os.platform(),
      architecture: os.arch()
    },
    memory: {
      usage: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024)
      },
      percentages: {
        heap: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
        system: Math.round((memUsage.rss / (os.totalmem())) * 100)
      },
      trends: {
        last5Min: memoryHistory.slice(-12), // Last 12 measurements = 1 minute
        average: memoryHistory.length > 0 
          ? Math.round(memoryHistory.reduce((a, b) => a + b, 0) / memoryHistory.length)
          : 0
      }
    },
    performance: {
      responseTime: {
        endpoints: endpointTimes,
        average: avgResponseTime,
        p95: percentiles.p95,
        p99: percentiles.p99
      },
      throughput: {
        requestsPerMinute: 0, // TODO: Implement request counting
        requestsLast5Min: 0
      }
    },
    database: {
      status: 'healthy', // TODO: Implement actual health check
      activeConnections: 0, // TODO: Get from pool
      queryPerformance: {
        slowQueries: 0,
        averageQueryTime: 0
      },
      stats: dbStats
    },
    cache: {
      size: cacheStats.size,
      capacity: 50, // From response-cache.ts configuration
      hitRate: cacheStats.hitRate,
      evictionCount: 0, // TODO: Track evictions
      memoryUsage: 0 // TODO: Calculate actual memory usage
    },
    apis: {
      status: apiStatus,
      errors: {}, // TODO: Track API errors
      lastChecked: new Date().toISOString()
    },
    errors: {
      last24Hours: errors24h,
      byType: errorsByType,
      recentErrors: errorLog.slice(-10).reverse().map(e => ({
        timestamp: e.timestamp.toISOString(),
        type: e.type,
        message: e.message
      }))
    },
    userActivity
  };
  
  return snapshot;
}

// Start memory tracking
setInterval(trackMemoryUsage, 5000); // Every 5 seconds