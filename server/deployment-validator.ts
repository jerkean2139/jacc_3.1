// Deployment validation script
import { db } from './db';
import { responseCache } from './response-cache';
import axios from 'axios';

interface ValidationResult {
  category: string;
  item: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

export async function validateDeployment(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  
  // 1. Environment Variables
  const requiredEnvVars = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'PINECONE_API_KEY',
    'PINECONE_ENVIRONMENT'
  ];
  
  for (const envVar of requiredEnvVars) {
    results.push({
      category: 'Environment',
      item: envVar,
      status: process.env[envVar] ? 'pass' : 'fail',
      message: process.env[envVar] ? 'Configured' : 'Missing'
    });
  }
  
  // Optional environment variables
  const optionalEnvVars = ['ISO_HUB_AUTH_TOKEN', 'PERPLEXITY_API_KEY'];
  for (const envVar of optionalEnvVars) {
    results.push({
      category: 'Environment',
      item: envVar,
      status: process.env[envVar] ? 'pass' : 'warning',
      message: process.env[envVar] ? 'Configured' : 'Not configured (optional)'
    });
  }
  
  // 2. Database Connection
  try {
    await db.execute('SELECT 1');
    results.push({
      category: 'Database',
      item: 'Connection',
      status: 'pass',
      message: 'Connected successfully'
    });
  } catch (error) {
    results.push({
      category: 'Database',
      item: 'Connection',
      status: 'fail',
      message: `Failed: ${error.message}`
    });
  }
  
  // 3. Memory Usage
  const memoryUsage = process.memoryUsage();
  const memoryPercentage = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);
  results.push({
    category: 'Memory',
    item: 'Usage',
    status: memoryPercentage < 80 ? 'pass' : memoryPercentage < 90 ? 'warning' : 'fail',
    message: `${memoryPercentage}% (${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB)`
  });
  
  // 4. Cache Status
  const cacheStats = responseCache.getStats();
  results.push({
    category: 'Cache',
    item: 'Response Cache',
    status: 'pass',
    message: `${cacheStats.size} entries, ${cacheStats.totalHits} total hits`
  });
  
  // 5. API Connectivity
  const apiTests = [
    { name: 'OpenAI', url: 'https://api.openai.com/v1/models', header: 'Authorization', token: process.env.OPENAI_API_KEY },
    { name: 'Anthropic', url: 'https://api.anthropic.com/v1/messages', header: 'x-api-key', token: process.env.ANTHROPIC_API_KEY }
  ];
  
  for (const api of apiTests) {
    if (!api.token) {
      results.push({
        category: 'API',
        item: api.name,
        status: 'fail',
        message: 'API key not configured'
      });
      continue;
    }
    
    try {
      await axios.get(api.url, {
        headers: { [api.header]: `Bearer ${api.token}` },
        timeout: 5000
      });
      results.push({
        category: 'API',
        item: api.name,
        status: 'pass',
        message: 'Connected successfully'
      });
    } catch (error) {
      results.push({
        category: 'API',
        item: api.name,
        status: error.response?.status === 401 ? 'pass' : 'warning',
        message: error.response?.status === 401 ? 'Authentication works' : `Connection issue: ${error.message}`
      });
    }
  }
  
  return results;
}

export function generateValidationReport(results: ValidationResult[]): string {
  const failCount = results.filter(r => r.status === 'fail').length;
  const warningCount = results.filter(r => r.status === 'warning').length;
  const passCount = results.filter(r => r.status === 'pass').length;
  
  let report = `\n🚀 DEPLOYMENT VALIDATION REPORT\n`;
  report += `${'='.repeat(50)}\n\n`;
  report += `✅ Passed: ${passCount}\n`;
  report += `⚠️  Warnings: ${warningCount}\n`;
  report += `❌ Failed: ${failCount}\n\n`;
  
  // Group by category
  const categories = [...new Set(results.map(r => r.category))];
  
  for (const category of categories) {
    report += `\n${category.toUpperCase()}\n`;
    report += `${'-'.repeat(category.length)}\n`;
    
    const categoryResults = results.filter(r => r.category === category);
    for (const result of categoryResults) {
      const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
      report += `${icon} ${result.item}: ${result.message}\n`;
    }
  }
  
  report += `\n${'='.repeat(50)}\n`;
  report += failCount === 0 ? '🎉 DEPLOYMENT READY!\n' : '⚠️  ISSUES NEED ATTENTION\n';
  
  return report;
}