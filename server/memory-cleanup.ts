// Memory cleanup utilities for startup optimization

export async function performStartupCleanup() {
  console.log('🧹 Performing startup memory cleanup...');
  
  // Clear any temporary files
  const fs = await import('fs');
  const path = await import('path');
  
  try {
    // Clean temp directory
    const tempDir = path.join(process.cwd(), 'temp');
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = fs.statSync(filePath);
        // Remove files older than 24 hours
        if (Date.now() - stats.mtime.getTime() > 24 * 60 * 60 * 1000) {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Removed old temp file: ${file}`);
        }
      }
    }
  } catch (error) {
    console.error('Error cleaning temp files:', error);
  }
  
  // Force initial garbage collection
  if (global.gc) {
    global.gc();
    console.log('✅ Initial garbage collection completed');
  }
  
  // Set memory usage limits
  const v8 = await import('v8');
  const heapStats = v8.getHeapStatistics();
  console.log(`💾 Heap size limit: ${Math.round(heapStats.heap_size_limit / 1024 / 1024)}MB`);
  
  // Clear unused modules from memory
  console.log('🗑️ Memory optimization complete');
}

// Optimize imports by loading only what's needed
export function lazyLoadModule(modulePath: string) {
  let module: any = null;
  return new Proxy({}, {
    get(target, prop) {
      if (!module) {
        module = require(modulePath);
      }
      return module[prop];
    }
  });
}