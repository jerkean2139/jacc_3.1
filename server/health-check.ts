import { Router } from 'express';
import { db } from './db';
import { responseCache } from './response-cache';

const router = Router();

// Basic health check
router.get('/api/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  };
  
  res.json(health);
});

// Detailed health check
router.get('/api/health/detailed', async (req, res) => {
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
  const memoryPercentage = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);
  
  // Check database
  let dbStatus = 'healthy';
  let dbError = null;
  try {
    await db.execute('SELECT 1');
  } catch (error) {
    dbStatus = 'unhealthy';
    dbError = error.message;
  }
  
  // Get cache stats
  const cacheStats = responseCache.getStats();
  
  const health = {
    status: memoryPercentage < 85 && dbStatus === 'healthy' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    memory: {
      used: heapUsedMB,
      total: heapTotalMB,
      percentage: memoryPercentage,
      status: memoryPercentage < 80 ? 'healthy' : memoryPercentage < 90 ? 'warning' : 'critical'
    },
    database: {
      status: dbStatus,
      error: dbError
    },
    cache: {
      size: cacheStats.size,
      totalHits: cacheStats.totalHits,
      hitRate: cacheStats.size > 0 ? Math.round((cacheStats.totalHits / (cacheStats.totalHits + cacheStats.size)) * 100) : 0
    },
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      pid: process.pid
    },
    apis: {
      openai: !!process.env.OPENAI_API_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      perplexity: !!process.env.PERPLEXITY_API_KEY,
      pinecone: !!process.env.PINECONE_API_KEY
    }
  };
  
  // Set appropriate status code
  const statusCode = health.status === 'healthy' ? 200 : 
                    health.status === 'degraded' ? 503 : 500;
  
  res.status(statusCode).json(health);
});

// Ready check for load balancers
router.get('/api/ready', async (req, res) => {
  try {
    // Check critical dependencies
    await db.execute('SELECT 1');
    
    const memoryUsage = process.memoryUsage();
    const memoryPercentage = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);
    
    if (memoryPercentage > 95) {
      return res.status(503).json({ ready: false, reason: 'Memory usage critical' });
    }
    
    res.json({ ready: true });
  } catch (error) {
    res.status(503).json({ ready: false, reason: error.message });
  }
});

export default router;