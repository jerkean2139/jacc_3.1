#!/usr/bin/env node
// Deployment health check script
import { validateDeployment, generateValidationReport } from './deployment-validator';
import { closePool } from './db-pool';

async function runDeploymentCheck() {
  console.log('🔍 Running deployment validation...\n');
  
  try {
    const results = await validateDeployment();
    const report = generateValidationReport(results);
    console.log(report);
    
    const failCount = results.filter(r => r.status === 'fail').length;
    const exitCode = failCount === 0 ? 0 : 1;
    
    await closePool();
    process.exit(exitCode);
  } catch (error) {
    console.error('❌ Validation failed:', error);
    await closePool();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runDeploymentCheck();
}