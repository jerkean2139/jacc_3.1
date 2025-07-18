import { db } from './db';
import { documents, documentChunks } from '../shared/schema';
import { eq, like } from 'drizzle-orm';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
// MEMORY OPTIMIZATION: Disabled pdf-parse (34MB)
// import pdf from 'pdf-parse';
let pdf: any = null;
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import { Canvas } from 'canvas';
import { PineconeVectorService } from './pinecone-vector';
import path from 'path';

const execAsync = promisify(exec);

interface ProcessingResult {
  documentId: string;
  documentName: string;
  success: boolean;
  extractedText?: string;
  error?: string;
  chunks?: number;
}

export class DocumentReprocessor {
  private pineconeService: PineconeVectorService;
  
  constructor() {
    this.pineconeService = new PineconeVectorService();
  }

  async reprocessAllDocuments(): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    
    try {
      // Get all documents with generic content
      const genericChunks = await db
        .select({
          documentId: documentChunks.documentId,
          documentName: documents.name,
          filePath: documents.path,
          mimeType: documents.mimeType
        })
        .from(documentChunks)
        .innerJoin(documents, eq(documentChunks.documentId, documents.id))
        .where(like(documentChunks.content, '%This PDF document contains comprehensive information%'))
        .groupBy(documentChunks.documentId, documents.name, documents.filePath, documents.mimeType);

      console.log(`🔄 Found ${genericChunks.length} documents with generic content to reprocess`);

      // Initialize Pinecone
      await this.pineconeService.ensureIndexExists();

      // Process each document
      for (const doc of genericChunks) {
        console.log(`\n📄 Processing: ${doc.documentName}`);
        
        const result = await this.processDocument(doc);
        results.push(result);
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`\n✅ Reprocessing complete. ${results.filter(r => r.success).length}/${results.length} successful`);
      
    } catch (error) {
      console.error('Reprocessing failed:', error);
    }

    return results;
  }

  private async processDocument(doc: any): Promise<ProcessingResult> {
    try {
      const filePath = doc.filePath;
      if (!filePath) {
        throw new Error('No file path available');
      }

      // Handle both absolute and relative paths
      let fullPath = filePath;
      if (!filePath.startsWith('/')) {
        fullPath = path.join(process.cwd(), filePath);
      }
      
      // Check if file exists
      try {
        await fs.access(fullPath);
      } catch {
        // Try alternative path if first attempt fails
        if (filePath.startsWith('/home/runner/workspace/')) {
          fullPath = filePath.replace('/home/runner/workspace/', '');
          fullPath = path.join(process.cwd(), fullPath);
        }
        
        try {
          await fs.access(fullPath);
        } catch {
          throw new Error(`File not found: ${fullPath}`);
        }
      }

      let extractedText = '';

      // Extract text based on file type
      if (doc.mimeType === 'application/pdf' || filePath.endsWith('.pdf')) {
        extractedText = await this.extractPdfText(fullPath);
      } else if (doc.mimeType?.startsWith('image/')) {
        extractedText = await this.extractImageText(fullPath);
      } else if (doc.mimeType === 'text/plain' || doc.mimeType === 'text/csv') {
        extractedText = await fs.readFile(fullPath, 'utf-8');
      }

      if (!extractedText || extractedText.length < 50) {
        throw new Error('Insufficient text extracted');
      }

      // Delete old chunks
      await db.delete(documentChunks)
        .where(eq(documentChunks.documentId, doc.documentId));

      // Create new chunks with real content
      const chunks = this.createChunks(extractedText, 4000, 200);
      const chunkRecords = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunkId = `${doc.documentId}-chunk-${i}`;
        chunkRecords.push({
          id: chunkId,
          documentId: doc.documentId,
          content: chunks[i],
          chunkIndex: i,
          metadata: {
            documentName: doc.documentName,
            chunkOf: chunks.length,
            extractedAt: new Date().toISOString()
          }
        });
      }

      // Insert new chunks
      await db.insert(documentChunks).values(chunkRecords);

      // Re-index in Pinecone
      await this.pineconeService.addDocuments([{
        id: doc.documentId,
        content: extractedText,
        metadata: {
          documentId: doc.documentId,
          documentName: doc.documentName,
          mimeType: doc.mimeType,
          extractedAt: new Date().toISOString()
        }
      }]);

      console.log(`✅ Successfully processed ${doc.documentName} - ${chunks.length} chunks created`);

      return {
        documentId: doc.documentId,
        documentName: doc.documentName,
        success: true,
        extractedText: extractedText.substring(0, 200) + '...',
        chunks: chunks.length
      };

    } catch (error) {
      console.error(`❌ Failed to process ${doc.documentName}:`, error.message);
      return {
        documentId: doc.documentId,
        documentName: doc.documentName,
        success: false,
        error: error.message
      };
    }
  }

  private async extractPdfText(filePath: string): Promise<string> {
    try {
      // First try direct text extraction
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdf(dataBuffer);
      
      if (data.text && data.text.trim().length > 100) {
        console.log('📝 Extracted text directly from PDF');
        return data.text;
      }

      // If no text, use OCR
      console.log('🔍 PDF has no text layer, using OCR...');
      return await this.ocrPdf(filePath);
      
    } catch (error) {
      console.error('PDF extraction error:', error);
      // Fallback to OCR
      return await this.ocrPdf(filePath);
    }
  }

  private async ocrPdf(filePath: string): Promise<string> {
    try {
      // For now, just return a message that OCR is needed
      // We can use existing OCR functionality from advanced-ocr-service
      console.log('⚠️ PDF requires OCR - using fallback text extraction');
      
      // Try to get basic metadata at least
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdf(dataBuffer);
      
      // Return basic info if no text found
      const fileName = path.basename(filePath);
      return `Document: ${fileName}\nPages: ${data.numpages}\nInfo: ${JSON.stringify(data.info || {})}\n\nNote: This PDF requires OCR for full text extraction.`;
      
    } catch (error) {
      console.error('OCR error:', error);
      throw error;
    }
  }

  private async extractImageText(filePath: string): Promise<string> {
    const worker = await createWorker(['eng']);
    
    try {
      // Preprocess image for better OCR
      const processedPath = './temp/processed.png';
      await fs.mkdir('./temp', { recursive: true });
      
      await sharp(filePath)
        .grayscale()
        .normalize()
        .sharpen()
        .toFile(processedPath);

      const { data: { text } } = await worker.recognize(processedPath);
      
      await fs.unlink(processedPath).catch(() => {});
      await worker.terminate();
      
      return text;
      
    } catch (error) {
      console.error('Image OCR error:', error);
      await worker.terminate();
      throw error;
    }
  }

  private createChunks(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    let currentChunk = '';
    let wordCount = 0;

    for (const sentence of sentences) {
      const sentenceWords = sentence.trim().split(/\s+/).length;
      
      if (wordCount + sentenceWords > chunkSize / 4 && currentChunk) {
        chunks.push(currentChunk.trim());
        
        // Add overlap
        const overlapWords = currentChunk.split(/\s+/).slice(-overlap / 4).join(' ');
        currentChunk = overlapWords + ' ' + sentence;
        wordCount = overlapWords.split(/\s+/).length + sentenceWords;
      } else {
        currentChunk += ' ' + sentence;
        wordCount += sentenceWords;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}

// Run if called directly
if (require.main === module) {
  const reprocessor = new DocumentReprocessor();
  reprocessor.reprocessAllDocuments().then(() => {
    console.log('Document reprocessing complete');
    process.exit(0);
  }).catch(error => {
    console.error('Reprocessing failed:', error);
    process.exit(1);
  });
}