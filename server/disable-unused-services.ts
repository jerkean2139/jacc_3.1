// Disable unused services to save memory

export function disableUnusedServices() {
  console.log('🔧 Disabling unused services to save memory...');
  
  // Disable modules we don't need in production
  const modulesToDisable = [
    'puppeteer', // Heavy browser automation
    'canvas', // Image manipulation
    'sharp', // Image processing
    // 'tesseract.js', // OCR processing - RE-ENABLED for document indexing
  ];
  
  // Override require to return lightweight stubs for heavy modules
  const originalRequire = require;
  require = new Proxy(originalRequire, {
    apply(target, thisArg, args) {
      const moduleName = args[0];
      
      if (modulesToDisable.includes(moduleName)) {
        console.log(`💡 Stubbing heavy module: ${moduleName}`);
        return {
          launch: () => Promise.resolve({ close: () => {} }),
          createCanvas: () => ({ getContext: () => ({}) }),
          create: () => ({ recognize: () => Promise.resolve({ data: { text: '' } }) })
        };
      }
      
      return target.apply(thisArg, args);
    }
  });
}

// Clear module cache for unused modules
export function clearModuleCache() {
  const moduleBlacklist = [
    'puppeteer',
    'canvas', 
    'sharp',
    // 'tesseract', // RE-ENABLED for OCR
    'pdf2pic',
    'mammoth'
  ];
  
  Object.keys(require.cache).forEach(key => {
    if (moduleBlacklist.some(mod => key.includes(mod))) {
      delete require.cache[key];
      console.log(`🗑️ Cleared cache for: ${key.split('/').pop()}`);
    }
  });
}