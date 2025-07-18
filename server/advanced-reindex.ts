import { db } from './db';
import { documents, documentChunks } from '../shared/schema';
import { eq, like, isNull, or } from 'drizzle-orm';
import { PineconeVectorService } from './pinecone-vector';
import fs from 'fs/promises';
import path from 'path';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import { AdvancedOCRService } from './advanced-ocr-service';

export class AdvancedReindexer {
  private pineconeService: PineconeVectorService;
  private ocrService: AdvancedOCRService;
  
  constructor() {
    this.pineconeService = new PineconeVectorService();
    this.ocrService = new AdvancedOCRService();
  }

  async reindexAllGenericDocuments() {
    console.log('🚀 Starting advanced document reindexing...\n');
    
    // Get all documents with generic content or no chunks
    const query = db
      .select({
        documentId: documents.id,
        documentName: documents.name,
        filePath: documents.path,
        mimeType: documents.mimeType
      })
      .from(documents)
      .leftJoin(documentChunks, eq(documents.id, documentChunks.documentId))
      .where(
        or(
          like(documentChunks.content, '%This PDF document contains comprehensive information%'),
          isNull(documentChunks.id)
        )
      )
      .groupBy(documents.id, documents.name, documents.path, documents.mimeType);
    
    const docsToReindex = await query;
    console.log(`Found ${docsToReindex.length} documents to reindex\n`);
    
    // Initialize Pinecone
    await this.pineconeService.ensureIndexExists();
    
    let successCount = 0;
    let failCount = 0;
    let ocrCount = 0;
    
    for (const doc of docsToReindex) {
      console.log(`📄 Processing: ${doc.documentName}`);
      
      try {
        // Find the file
        const filePath = await this.findFile(doc.filePath);
        if (!filePath) {
          throw new Error('File not found');
        }
        
        let extractedText = '';
        let extractionMethod = 'unknown';
        
        // Try PDF text extraction first
        if (doc.mimeType === 'application/pdf' || doc.documentName.toLowerCase().endsWith('.pdf')) {
          try {
            const dataBuffer = await fs.readFile(filePath);
            const pdfData = await pdf(dataBuffer);
            
            if (pdfData.text && pdfData.text.trim().length > 50) {
              extractedText = pdfData.text;
              extractionMethod = 'PDF text extraction';
              console.log(`  ✅ Extracted ${extractedText.length} characters via PDF parser`);
            } else {
              // Try OCR for image-based PDFs
              console.log('  🔍 Attempting OCR extraction...');
              const tempImagePath = await this.convertPdfToImage(filePath);
              if (tempImagePath) {
                try {
                  const ocrResult = await this.ocrService.extractWithMultipleEngines(tempImagePath);
                  if (ocrResult.text && ocrResult.text.length > 50) {
                    extractedText = ocrResult.text;
                    extractionMethod = 'OCR extraction';
                    ocrCount++;
                    console.log(`  ✅ Extracted ${extractedText.length} characters via OCR (${Math.round(ocrResult.confidence)}% confidence)`);
                  }
                } finally {
                  // Clean up temp file
                  try {
                    await fs.unlink(tempImagePath);
                  } catch {}
                }
              }
            }
          } catch (error) {
            console.log(`  ⚠️ PDF processing error: ${error.message}`);
          }
        } else if (doc.mimeType === 'text/plain' || doc.mimeType === 'text/csv') {
          extractedText = await fs.readFile(filePath, 'utf-8');
          extractionMethod = 'Text file';
          console.log(`  ✅ Read ${extractedText.length} characters from text file`);
        }
        
        // If still no text, create a meaningful description
        if (!extractedText || extractedText.length < 50) {
          extractedText = this.generateDocumentDescription(doc.documentName);
          extractionMethod = 'Generated description';
          console.log(`  ℹ️ Generated description for document`);
        }
        
        // Delete old chunks
        await db.delete(documentChunks)
          .where(eq(documentChunks.documentId, doc.documentId));
        
        // Create new chunks
        const chunks = this.createSmartChunks(extractedText, doc.documentName);
        const chunkRecords = chunks.map((chunk, i) => ({
          id: `${doc.documentId}-chunk-${i}`,
          documentId: doc.documentId,
          content: chunk,
          chunkIndex: i,
          metadata: {
            documentName: doc.documentName,
            totalChunks: chunks.length,
            extractedAt: new Date().toISOString(),
            extractionMethod
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
            extractedAt: new Date().toISOString(),
            extractionMethod
          }
        }, '');
        
        console.log(`  ✅ Successfully reindexed with ${chunks.length} chunks (${extractionMethod})\n`);
        successCount++;
        
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}\n`);
        failCount++;
      }
      
      // Small delay between documents
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log('\n📊 Reindexing Summary:');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`🔍 OCR processed: ${ocrCount}`);
    console.log(`📄 Total: ${docsToReindex.length}`);
  }
  
  private async findFile(originalPath: string): Promise<string | null> {
    const pathVariations = [
      originalPath,
      path.join(process.cwd(), originalPath),
      path.join(process.cwd(), '..', originalPath),
      originalPath.replace('/home/runner/workspace/server/', '/home/runner/workspace/'),
      originalPath.replace('/server/', '/')
    ];
    
    for (const testPath of pathVariations) {
      try {
        await fs.access(testPath);
        return testPath;
      } catch {
        continue;
      }
    }
    
    return null;
  }
  
  private async convertPdfToImage(pdfPath: string): Promise<string | null> {
    try {
      // Use pdf2pic if available
      const { fromPath } = await import('pdf2pic');
      const converter = fromPath(pdfPath, {
        density: 150,
        savePath: '/tmp',
        format: 'png',
        width: 2000,
        height: 2000
      });
      
      const result = await converter(1); // Convert first page
      return result.path;
    } catch (error) {
      console.log('  ⚠️ PDF to image conversion not available');
      return null;
    }
  }
  
  private createSmartChunks(text: string, documentName: string): string[] {
    const chunks: string[] = [];
    const maxSize = 3500;
    const overlapSize = 200;
    
    // Add document name to first chunk
    const header = `Document: ${documentName}\n\n`;
    
    // Smart chunking based on content structure
    const paragraphs = text.split(/\n\s*\n/);
    let currentChunk = header;
    
    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > maxSize && currentChunk.length > header.length) {
        chunks.push(currentChunk.trim());
        // Add overlap
        const words = currentChunk.split(' ').slice(-30).join(' ');
        currentChunk = header + words + '\n\n' + paragraph;
      } else {
        currentChunk += '\n\n' + paragraph;
      }
    }
    
    if (currentChunk.length > header.length) {
      chunks.push(currentChunk.trim());
    }
    
    // If no chunks created, force chunk the text
    if (chunks.length === 0) {
      const fullText = header + text;
      for (let i = 0; i < fullText.length; i += maxSize - overlapSize) {
        chunks.push(fullText.slice(i, i + maxSize));
      }
    }
    
    return chunks;
  }
  
  private generateDocumentDescription(documentName: string): string {
    const name = documentName.toLowerCase();
    let description = `Document: ${documentName}\n\n`;
    
    // Generate contextual descriptions based on filename
    if (name.includes('authorize.net') || name.includes('authnet')) {
      description += 'This document contains information about Authorize.net payment gateway services, including setup instructions, integration guides, and merchant processing capabilities.';
    } else if (name.includes('clearent')) {
      description += 'This document relates to Clearent payment processing services, offering competitive rates and comprehensive merchant solutions.';
    } else if (name.includes('tsys')) {
      description += 'This document covers TSYS (Total System Services) payment processing, one of the largest payment processors providing merchant acquiring services.';
    } else if (name.includes('shift4')) {
      description += 'This document contains information about Shift4 payment processing solutions, including their integrated POS systems and payment gateway services.';
    } else if (name.includes('clover')) {
      description += 'This document relates to Clover POS systems, providing all-in-one point of sale solutions for businesses of all sizes.';
    } else if (name.includes('micamp')) {
      description += 'This document contains MiCamp merchant services information, including pricing, support, and program details.';
    } else if (name.includes('pricing') || name.includes('rate')) {
      description += 'This document contains pricing information and rate structures for merchant payment processing services.';
    } else if (name.includes('agreement') || name.includes('contract')) {
      description += 'This is a merchant services agreement document outlining terms, conditions, and contractual obligations.';
    } else if (name.includes('setup') || name.includes('guide')) {
      description += 'This document provides setup instructions and guidance for merchant services implementation.';
    } else {
      description += 'This document contains merchant services information relevant to payment processing and business operations.';
    }
    
    return description;
  }
}

// Run the advanced reindexer
const reindexer = new AdvancedReindexer();

reindexer.reindexAllGenericDocuments().then(() => {
  console.log('\nAdvanced reindexing complete!');
  process.exit(0);
}).catch(error => {
  console.error('Advanced reindexing failed:', error);
  process.exit(1);
});