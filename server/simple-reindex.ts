import { db } from './db';
import { documents, documentChunks } from '../shared/schema';
import { eq, like } from 'drizzle-orm';
import { PineconeVectorService } from './pinecone-vector';
import fs from 'fs/promises';
import path from 'path';
import pdf from 'pdf-parse/lib/pdf-parse.js';

export class SimpleReindexer {
  private pineconeService: PineconeVectorService;
  
  constructor() {
    this.pineconeService = new PineconeVectorService();
  }

  async reindexDocuments(limit?: number) {
    console.log('🚀 Starting simple document reindexing...\n');
    
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
    
    const docsToReindex = await query;
    console.log(`Found ${docsToReindex.length} documents to reindex\n`);
    
    // Initialize Pinecone
    await this.pineconeService.ensureIndexExists();
    
    let successCount = 0;
    let failCount = 0;
    
    for (const doc of docsToReindex) {
      console.log(`📄 Processing: ${doc.documentName}`);
      
      try {
        // Find the file
        const filePath = await this.findFile(doc.filePath);
        if (!filePath) {
          throw new Error('File not found');
        }
        
        // Extract text based on file type
        let extractedText = '';
        
        if (doc.mimeType === 'application/pdf' || doc.documentName.toLowerCase().endsWith('.pdf')) {
          // Extract PDF text
          const dataBuffer = await fs.readFile(filePath);
          try {
            const pdfData = await pdf(dataBuffer);
            extractedText = pdfData.text || '';
            console.log(`  ✅ Extracted ${extractedText.length} characters from PDF`);
          } catch (pdfError) {
            console.log(`  ⚠️ PDF extraction failed, file may be image-based`);
            extractedText = `${doc.documentName}\n\nThis PDF file requires OCR processing to extract text content. The document appears to be image-based or scanned.`;
          }
        } else if (doc.mimeType === 'text/plain' || doc.mimeType === 'text/csv') {
          // Read text files directly
          extractedText = await fs.readFile(filePath, 'utf-8');
          console.log(`  ✅ Read ${extractedText.length} characters from text file`);
        } else {
          extractedText = `${doc.documentName}\n\nFile type: ${doc.mimeType}\n\nThis file type requires specialized processing.`;
        }
        
        if (extractedText && extractedText.length > 50) {
          // Delete old chunks
          await db.delete(documentChunks)
            .where(eq(documentChunks.documentId, doc.documentId));
          
          // Create new chunks
          const chunks = this.createChunks(extractedText);
          const chunkRecords = chunks.map((chunk, i) => ({
            id: `${doc.documentId}-chunk-${i}`,
            documentId: doc.documentId,
            content: chunk,
            chunkIndex: i,
            metadata: {
              documentName: doc.documentName,
              totalChunks: chunks.length,
              extractedAt: new Date().toISOString()
            }
          }));
          
          // Insert new chunks
          await db.insert(documentChunks).values(chunkRecords);
          
          // Re-index in Pinecone
          await this.pineconeService.indexDocument({
            id: doc.documentId,
            content: extractedText,
            metadata: {
              documentId: doc.documentId,
              documentName: doc.documentName,
              mimeType: doc.mimeType,
              extractedAt: new Date().toISOString()
            }
          }, '');
          
          console.log(`  ✅ Successfully reindexed with ${chunks.length} chunks\n`);
          successCount++;
        } else {
          console.log(`  ❌ Insufficient text extracted\n`);
          failCount++;
        }
        
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}\n`);
        failCount++;
      }
      
      // Small delay between documents
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n📊 Reindexing Summary:');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📄 Total: ${docsToReindex.length}`);
  }
  
  private async findFile(originalPath: string): Promise<string | null> {
    // Try different path variations
    const pathVariations = [
      originalPath,
      originalPath.replace('/home/runner/workspace/server/', '/home/runner/workspace/'),
      path.join(process.cwd(), '..', originalPath),
      path.join(process.cwd(), originalPath),
      originalPath.replace('/server/', '/')
    ];
    
    for (const testPath of pathVariations) {
      try {
        await fs.access(testPath);
        return testPath;
      } catch {
        // Continue trying
      }
    }
    
    return null;
  }
  
  private createChunks(text: string, maxSize: number = 4000): string[] {
    const chunks: string[] = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    let currentChunk = '';
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxSize && currentChunk) {
        chunks.push(currentChunk.trim());
        // Add some overlap
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-20).join(' ');
        currentChunk = overlapWords + ' ' + sentence;
      } else {
        currentChunk += ' ' + sentence;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    // If no good chunks, just split by size
    if (chunks.length === 0 && text.length > 0) {
      for (let i = 0; i < text.length; i += maxSize - 200) {
        chunks.push(text.slice(i, i + maxSize));
      }
    }
    
    return chunks;
  }
}

// Run the reindexer
const reindexer = new SimpleReindexer();
const limit = process.argv[2] ? parseInt(process.argv[2]) : 5;

reindexer.reindexDocuments(limit).then(() => {
  console.log('\nReindexing complete!');
  process.exit(0);
}).catch(error => {
  console.error('Reindexing failed:', error);
  process.exit(1);
});