// MEMORY OPTIMIZATION: Disabled tesseract.js
// import Tesseract from 'tesseract.js';
let Tesseract: any = null;
import fs from 'fs/promises';
import path from 'path';
// MEMORY OPTIMIZATION: Disabled canvas (24MB) and sharp
// import { createCanvas, loadImage } from 'canvas';
// import sharp from 'sharp';
let sharp: any = null;
const createCanvas = () => null;
const loadImage = () => null;

interface OCRResult {
  text: string;
  confidence: number;
  method: string;
  processedWords: number;
  improvements: string[];
}

interface PreprocessingResult {
  processedPath: string;
  improvements: string[];
}

export class AdvancedOCRService {
  private static instance: AdvancedOCRService;
  private workers: Map<string, Tesseract.Worker> = new Map();

  static getInstance(): AdvancedOCRService {
    if (!AdvancedOCRService.instance) {
      AdvancedOCRService.instance = new AdvancedOCRService();
    }
    return AdvancedOCRService.instance;
  }

  /**
   * Advanced image preprocessing with multiple enhancement techniques
   */
  private async preprocessImage(imagePath: string): Promise<PreprocessingResult> {
    const improvements: string[] = [];
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });

    const processedPath = path.join(tempDir, `processed_${Date.now()}.png`);

    try {
      // Load and analyze image
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      
      let pipeline = image;
      
      // 1. Resolution enhancement for small images
      if (metadata.width && metadata.width < 1200) {
        pipeline = pipeline.resize({
          width: Math.max(1200, metadata.width * 2),
          height: Math.max(800, (metadata.height || 600) * 2),
          kernel: sharp.kernel.cubic
        });
        improvements.push('Resolution upscaling applied');
      }

      // 2. Contrast and brightness optimization
      pipeline = pipeline.normalize({
        lower: 5,
        upper: 95
      }).linear(1.2, -(128 * 1.2) + 128);
      improvements.push('Contrast and brightness optimization');

      // 3. Noise reduction
      pipeline = pipeline.median(3);
      improvements.push('Noise reduction filter');

      // 4. Sharpening for text clarity
      pipeline = pipeline.sharpen({
        sigma: 1,
        m1: 0.5,
        m2: 2,
        x1: 2,
        y1: 10
      });
      improvements.push('Text sharpening');

      // 5. Convert to high contrast grayscale
      pipeline = pipeline.grayscale().gamma(1.2);
      improvements.push('Grayscale conversion with gamma correction');

      await pipeline.png({ quality: 100 }).toFile(processedPath);
      
      return { processedPath, improvements };

    } catch (error) {
      console.error('Preprocessing error:', error);
      return { processedPath: imagePath, improvements: ['Preprocessing failed - using original'] };
    }
  }

  /**
   * Advanced text cleaning and post-processing
   */
  private cleanExtractedText(rawText: string): { cleanedText: string; improvements: string[] } {
    const improvements: string[] = [];
    let text = rawText;

    // Check if this appears to be debug/console output instead of actual document content
    const debugPatterns = [
      /Download the React DevTools/i,
      /\[vite\] (?:connected|connecting|hot updated)/i,
      /Banner not shown: beforeinstallpromptevent/i,
      /console\.(log|warn|error|debug)/i,
      /localhost:\d+/i,
      /\d+:\d+:\d+ (AM|PM) \[express\]/i,
      /sessionId: [a-zA-Z0-9]+/i,
      /GET|POST|PUT|DELETE|PATCH \/api/i,
      /Cleared \d+ popup flags/i,
      /admin-control-center\.tsx:\d+/i
    ];
    
    // If this looks like debug content, return empty
    const isDebugContent = debugPatterns.some(pattern => pattern.test(text));
    if (isDebugContent) {
      console.warn('OCR detected debug/console content instead of document content');
      improvements.push('Rejected debug content');
      return { cleanedText: '', improvements };
    }

    // 1. Remove OCR artifacts and noise characters
    const artifactPatterns = [
      /[^\w\s\-.,!?@#$%^&*()+={}[\]:;"'<>\/\\|`~]/g, // Non-standard characters
      /\s{3,}/g, // Multiple spaces
      /[\r\n]{3,}/g, // Multiple line breaks
      /\s*\|\s*/g, // Table separators
      /\s*\\\s*/g, // Backslash artifacts
    ];

    artifactPatterns.forEach(pattern => {
      const before = text.length;
      text = text.replace(pattern, pattern === /\s{3,}/g ? ' ' : 
                         pattern === /[\r\n]{3,}/g ? '\n\n' : '');
      if (before !== text.length) improvements.push('OCR artifacts removed');
    });

    // 2. Fix common OCR misrecognitions
    const ocrFixes = [
      { pattern: /\bl\b/g, replacement: 'I', description: 'Fixed l -> I' },
      { pattern: /\b0\b/g, replacement: 'O', description: 'Fixed 0 -> O' },
      { pattern: /rn/g, replacement: 'm', description: 'Fixed rn -> m' },
      { pattern: /vv/g, replacement: 'w', description: 'Fixed vv -> w' },
      { pattern: /\bTlie\b/g, replacement: 'The', description: 'Fixed Tlie -> The' },
      { pattern: /\bWlien\b/g, replacement: 'When', description: 'Fixed Wlien -> When' },
      { pattern: /\btlie\b/g, replacement: 'the', description: 'Fixed tlie -> the' },
      { pattern: /\bwlien\b/g, replacement: 'when', description: 'Fixed wlien -> when' },
    ];

    ocrFixes.forEach(fix => {
      if (fix.pattern.test(text)) {
        text = text.replace(fix.pattern, fix.replacement);
        improvements.push(fix.description);
      }
    });

    // 3. Reconstruct broken words and sentences
    text = text.replace(/(\w+)\s+(\w{1,2})\s+(\w+)/g, (match, w1, w2, w3) => {
      // Rejoin artificially split words
      if (w2.length <= 2 && /^[a-z]{1,2}$/i.test(w2)) {
        improvements.push('Rejoined split words');
        return `${w1}${w2}${w3}`;
      }
      return match;
    });

    // 4. Standardize currency and percentage symbols
    text = text.replace(/\$\s*(\d)/g, '$$$1');
    text = text.replace(/(\d)\s*%/g, '$1%');
    text = text.replace(/(\d)\s*\.\s*(\d)/g, '$1.$2');
    improvements.push('Standardized currency and numbers');

    // 5. Clean up spacing and punctuation
    text = text.replace(/\s+/g, ' ');
    text = text.replace(/\s*([.,:;!?])\s*/g, '$1 ');
    text = text.replace(/\s+$/, '');
    text = text.replace(/^\s+/, '');
    improvements.push('Normalized spacing and punctuation');

    return { cleanedText: text, improvements };
  }

  /**
   * Multi-engine OCR with confidence-based selection
   */
  async extractWithMultipleEngines(imagePath: string): Promise<OCRResult> {
    const results: Array<{ text: string; confidence: number; method: string; words: number }> = [];

    // Preprocess image for better OCR
    const { processedPath, improvements: preprocessImprovements } = await this.preprocessImage(imagePath);

    try {
      // Engine 1: Standard Tesseract with optimized settings
      const worker1 = await Tesseract.createWorker('eng', 1, {
        logger: () => {} // Disable logging
      });

      await worker1.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?@#$%^&*()_+-=[]{}|;:\'\"<>? /',
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
        preserve_interword_spaces: '1',
        tessjs_create_hocr: '0',
        tessjs_create_tsv: '0',
      });

      const result1 = await worker1.recognize(processedPath);
      results.push({
        text: result1.data.text,
        confidence: result1.data.confidence,
        method: 'Standard Tesseract',
        words: result1.data.words?.length || 0
      });
      await worker1.terminate();

      // Engine 2: Document-optimized Tesseract
      const worker2 = await Tesseract.createWorker('eng', 1, {
        logger: () => {}
      });

      await worker2.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
        tessjs_create_pdf: '0',
        tessjs_create_hocr: '0',
        tessjs_create_tsv: '0',
        classify_enable_learning: '0',
        textord_really_old_xheight: '1',
        textord_min_linesize: '2.5',
        preserve_interword_spaces: '1',
      });

      const result2 = await worker2.recognize(processedPath);
      results.push({
        text: result2.data.text,
        confidence: result2.data.confidence,
        method: 'Document-optimized',
        words: result2.data.words?.length || 0
      });
      await worker2.terminate();

      // Engine 3: Line-by-line processing for complex layouts
      const worker3 = await Tesseract.createWorker('eng', 1, {
        logger: () => {}
      });

      await worker3.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_TEXT_LINE,
        tessjs_create_pdf: '0',
        tessjs_create_hocr: '0',
        tessjs_create_tsv: '0',
      });

      const result3 = await worker3.recognize(processedPath);
      results.push({
        text: result3.data.text,
        confidence: result3.data.confidence,
        method: 'Line-by-line',
        words: result3.data.words?.length || 0
      });
      await worker3.terminate();

      // Select best result based on confidence and content length
      const bestResult = results.reduce((best, current) => {
        const currentScore = (current.confidence * 0.7) + (current.text.length * 0.3);
        const bestScore = (best.confidence * 0.7) + (best.text.length * 0.3);
        return currentScore > bestScore ? current : best;
      });

      // Clean and enhance the selected text
      const { cleanedText, improvements: cleaningImprovements } = this.cleanExtractedText(bestResult.text);

      // Cleanup temporary file
      try {
        if (processedPath !== imagePath) {
          await fs.unlink(processedPath);
        }
      } catch (error) {
        console.error('Error cleaning up temporary file:', error);
      }

      // Count words from cleaned text instead of relying on Tesseract word array
      const wordCount = cleanedText.trim().split(/\s+/).filter(word => word.length > 0).length;
      
      return {
        text: cleanedText,
        confidence: bestResult.confidence,
        method: bestResult.method,
        processedWords: wordCount || bestResult.words,
        improvements: [...preprocessImprovements, ...cleaningImprovements]
      };

    } catch (error) {
      console.error('Multi-engine OCR error:', error);
      // Fallback to basic extraction
      return this.basicExtraction(imagePath);
    }
  }

  /**
   * Fallback basic extraction method
   */
  private async basicExtraction(imagePath: string): Promise<OCRResult> {
    try {
      const worker = await Tesseract.createWorker('eng');
      const result = await worker.recognize(imagePath);
      await worker.terminate();

      const { cleanedText } = this.cleanExtractedText(result.data.text);
      const wordCount = cleanedText.trim().split(/\s+/).filter(word => word.length > 0).length;
      
      return {
        text: cleanedText,
        confidence: result.data.confidence,
        method: 'Basic fallback',
        processedWords: wordCount || result.data.words?.length || 0,
        improvements: ['Basic processing only']
      };
    } catch (error) {
      return {
        text: '',
        confidence: 0,
        method: 'Failed',
        processedWords: 0,
        improvements: ['OCR processing failed']
      };
    }
  }

  /**
   * Batch processing for multiple pages/images
   */
  async processBatch(imagePaths: string[]): Promise<OCRResult[]> {
    const results: OCRResult[] = [];
    
    for (const imagePath of imagePaths) {
      try {
        const result = await this.extractWithMultipleEngines(imagePath);
        results.push(result);
      } catch (error) {
        console.error(`Error processing ${imagePath}:`, error);
        results.push({
          text: '',
          confidence: 0,
          method: 'Error',
          processedWords: 0,
          improvements: [`Failed to process ${path.basename(imagePath)}`]
        });
      }
    }

    return results;
  }

  /**
   * Get OCR confidence assessment
   */
  assessConfidence(confidence: number, textLength: number, wordCount: number): {
    quality: 'excellent' | 'good' | 'fair' | 'poor';
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    let quality: 'excellent' | 'good' | 'fair' | 'poor';

    if (confidence >= 85 && textLength > 200 && wordCount > 20) {
      quality = 'excellent';
      recommendations.push('High-quality extraction achieved');
    } else if (confidence >= 70 && textLength > 100) {
      quality = 'good';
      recommendations.push('Good extraction with minor artifacts');
    } else if (confidence >= 50 && textLength > 50) {
      quality = 'fair';
      recommendations.push('Acceptable extraction, may need manual review');
      if (wordCount < 10) recommendations.push('Consider re-scanning at higher resolution');
    } else {
      quality = 'poor';
      recommendations.push('Low-quality extraction, manual review required');
      recommendations.push('Consider improving image quality or scanning settings');
    }

    return { quality, recommendations };
  }
}

export const advancedOCR = AdvancedOCRService.getInstance();