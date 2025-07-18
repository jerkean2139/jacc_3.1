// Memory optimization utilities for production deployment

export async function configureMemoryOptimization() {
  // Force garbage collection more frequently
  if (global.gc) {
    setInterval(() => {
      try {
        global.gc();
        console.log('🧹 Manual garbage collection completed');
      } catch (e) {
        console.error('GC error:', e);
      }
    }, 60000); // Every 60 seconds instead of 30
  }

  // Monitor memory usage less frequently
  setInterval(() => {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    const percentage = Math.round((usage.heapUsed / usage.heapTotal) * 100);
    
    console.log(`📊 Memory: ${heapUsedMB}MB / ${heapTotalMB}MB (${percentage}%)`);
    
    // Warn if memory usage is high
    if (percentage > 70) {
      console.warn(`⚠️ HIGH MEMORY USAGE: ${percentage}%`);
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }
  }, 300000); // Every 5 minutes instead of 1
}

// Optimize large string operations
export function optimizeStringOperations() {
  // Limit the size of strings we process
  const MAX_STRING_LENGTH = 1024 * 1024; // 1MB
  
  return {
    truncateString: (str: string) => {
      if (str.length > MAX_STRING_LENGTH) {
        console.warn(`⚠️ Truncating large string: ${str.length} chars`);
        return str.substring(0, MAX_STRING_LENGTH) + '... [truncated]';
      }
      return str;
    },
    
    // Process strings in chunks to avoid memory spikes
    processInChunks: async (text: string, chunkSize = 1024 * 10) => {
      const chunks = [];
      for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.substring(i, i + chunkSize));
        // Allow event loop to process other tasks
        if (i % (chunkSize * 10) === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }
      return chunks;
    }
  };
}

// Configure process limits
export function configureProcessLimits() {
  // Set max memory usage (if running with --max-old-space-size flag)
  const maxMemoryMB = parseInt(process.env.MAX_MEMORY || '512');
  
  // Monitor for memory leaks
  let lastHeapUsed = 0;
  let increasingCount = 0;
  
  setInterval(() => {
    const currentHeapUsed = process.memoryUsage().heapUsed;
    
    if (currentHeapUsed > lastHeapUsed) {
      increasingCount++;
      if (increasingCount > 10) {
        console.warn('⚠️ Potential memory leak detected - heap usage increasing');
      }
    } else {
      increasingCount = 0;
    }
    
    lastHeapUsed = currentHeapUsed;
  }, 30000); // Check every 30 seconds
}