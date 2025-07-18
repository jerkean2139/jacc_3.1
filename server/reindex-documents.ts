import { db } from './db';
import { documents, documentChunks } from '../shared/schema';
import { eq, like } from 'drizzle-orm';
import { AdvancedOCRService } from './advanced-ocr-service';
import { PineconeVectorService } from './pinecone-vector';
import path from 'path';
import { promises as fs } from 'fs';

interface ReindexResult {
  documentId: string;
  documentName: string;
  success: boolean;
  extractedText?: string;
  error?: string;
  chunks?: number;
}

export class DocumentReindexer {
  private ocrService: AdvancedOCRService;
  private pineconeService: PineconeVectorService;
  
  constructor() {
    this.ocrService = new AdvancedOCRService();
    this.pineconeService = new PineconeVectorService();
  }

  async reindexGenericDocuments(limit?: number): Promise<ReindexResult[]> {
    const results: ReindexResult[] = [];
    
    try {
      // Get documents with generic content
      let query = db
        .select({
          documentId: documentChunks.documentId,
          documentName: documents.name,
          filePath: documents.path,
          mimeType: documents.mimeType
        })
        .from(documentChunks)
        .innerJoin(documents, eq(documentChunks.documentId, documents.id))
        .where(like(documentChunks.content, '%This PDF document contains comprehensive information%'))
        .groupBy(documentChunks.documentId, documents.name, documents.path, documents.mimeType);
      
      if (limit) {
        query = query.limit(limit);
      }
      
      const genericDocs = await query;
      
      console.log(`\n🔄 Found ${genericDocs.length} documents with generic content to reindex\n`);

      // Initialize Pinecone
      await this.pineconeService.ensureIndexExists();

      // Process each document
      for (const doc of genericDocs) {
        console.log(`\n📄 Processing: ${doc.documentName}`);
        
        const result = await this.processDocument(doc);
        results.push(result);
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`\n✅ Reindexing complete. ${results.filter(r => r.success).length}/${results.length} successful`);
      
    } catch (error) {
      console.error('Reindexing failed:', error);
    }

    return results;
  }

  private async processDocument(doc: any): Promise<ReindexResult> {
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
      let fileExists = false;
      try {
        await fs.access(fullPath);
        fileExists = true;
      } catch {
        // Try alternative paths
        const alternativePaths = [
          fullPath.replace('/home/runner/workspace/server/', '/home/runner/workspace/'),
          fullPath.replace('/server/', '/'),
          path.join(process.cwd(), '..', filePath),
          filePath // Try as-is
        ];
        
        for (const altPath of alternativePaths) {
          try {
            await fs.access(altPath);
            fullPath = altPath;
            fileExists = true;
            break;
          } catch {
            // Continue trying
          }
        }
      }
      
      if (!fileExists) {
        throw new Error(`File not found: ${fullPath}`);
      }

      // Use OCR service to extract text
      console.log('🔍 Extracting text using OCR service...');
      const ocrResult = await this.ocrService.extractWithMultipleEngines(fullPath);
      
      if (!ocrResult.text || ocrResult.text.length < 50) {
        throw new Error(`Insufficient text extracted: only ${ocrResult.text?.length || 0} characters`);
      }

      const extractedText = ocrResult.text;
      console.log(`✅ Extracted ${extractedText.length} characters with ${Math.round(ocrResult.confidence * 100)}% confidence`);

      // Delete old chunks
      await db.delete(documentChunks)
        .where(eq(documentChunks.documentId, doc.documentId));

      // Create new chunks with real content
      const chunks = this.createSmartChunks(extractedText);
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
            extractedAt: new Date().toISOString(),
            ocrConfidence: ocrResult.confidence
          }
        });
      }

      // Insert new chunks
      await db.insert(documentChunks).values(chunkRecords);

      // Re-index in Pinecone
      console.log('📍 Re-indexing in Pinecone...');
      await this.pineconeService.addDocuments([{
        id: doc.documentId,
        content: extractedText,
        metadata: {
          documentId: doc.documentId,
          documentName: doc.documentName,
          mimeType: doc.mimeType,
          extractedAt: new Date().toISOString(),
          ocrConfidence: ocrResult.confidence
        }
      }]);

      console.log(`✅ Successfully reindexed ${doc.documentName} - ${chunks.length} chunks created`);

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

  private createSmartChunks(text: string, maxChunkSize: number = 4000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    let currentChunk = '';
    let currentSize = 0;

    for (const sentence of sentences) {
      const sentenceSize = sentence.trim().length;
      
      if (currentSize + sentenceSize > maxChunkSize && currentChunk) {
        chunks.push(currentChunk.trim());
        
        // Create overlap by keeping last few characters
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + ' ' + sentence;
        currentSize = overlapText.length + sentenceSize;
      } else {
        currentChunk += ' ' + sentence;
        currentSize += sentenceSize;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // If no good chunks, just split by size
    if (chunks.length === 0 && text.length > 0) {
      for (let i = 0; i < text.length; i += maxChunkSize - overlap) {
        chunks.push(text.slice(i, i + maxChunkSize));
      }
    }

    return chunks;
  }
}

// Run the reindexer
const reindexer = new DocumentReindexer();

// Process first 5 documents as a test
const limit = process.argv[2] ? parseInt(process.argv[2]) : 5;

console.log(`🚀 Starting document reindexing (limit: ${limit})...`);

reindexer.reindexGenericDocuments(limit).then(results => {
  console.log('\n📊 Summary:');
  console.log(`Total processed: ${results.length}`);
  console.log(`Successful: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);
  
  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    console.log('\n❌ Failed documents:');
    failed.forEach(f => console.log(`  - ${f.documentName}: ${f.error}`));
  }
  
  process.exit(0);
}).catch(error => {
  console.error('Reindexing failed:', error);
  process.exit(1);
});