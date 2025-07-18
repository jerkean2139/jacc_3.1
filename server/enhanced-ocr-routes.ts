import { Router } from 'express';
import { advancedOCR } from './advanced-ocr-service.js';
import { db } from './db.js';
import { documents, documentChunks } from '../shared/schema.js';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';
import pdf2pic from 'pdf2pic';
// MEMORY OPTIMIZATION: Disabled pdf-parse (34MB)
// import pdfParse from 'pdf-parse';
let pdfParse: any = null;

const router = Router();

// Enhanced OCR processing endpoint
router.post('/api/admin/ocr/process-document/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { forceReprocess = false } = req.body;

    // Get document information
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const filePath = document.path;
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'Document file not found' });
    }

    // Check if already processed (unless forced)
    if (!forceReprocess) {
      const existingChunks = await db
        .select()
        .from(documentChunks)
        .where(eq(documentChunks.documentId, id))
        .limit(1);

      if (existingChunks.length > 0) {
        return res.json({ 
          message: 'Document already processed',
          suggestion: 'Use forceReprocess=true to reprocess'
        });
      }
    }

    let ocrResults: any[] = [];

    if (document.mimeType === 'application/pdf') {
      // First try to extract text directly from PDF
      try {
        const pdfBuffer = await fs.readFile(filePath);
        const pdfData = await pdfParse(pdfBuffer);
        
        if (pdfData.text && pdfData.text.trim().length > 50) {
          // PDF has extractable text, use it directly
          console.log(`Direct PDF text extraction successful: ${pdfData.text.length} characters`);
          const wordCount = pdfData.text.trim().split(/\s+/).filter(word => word.length > 0).length;
          ocrResults = [{
            text: pdfData.text,
            confidence: 95, // High confidence for direct text extraction
            method: 'Direct PDF Text Extraction',
            processedWords: wordCount,
            improvements: ['Text extracted directly from PDF']
          }];
        } else {
          // PDF has no text or very little text, fall back to OCR
          console.log('PDF has no extractable text, falling back to OCR');
          
          // Convert PDF to images for OCR processing
          // Ensure temp directory exists
          const tempDir = path.join(process.cwd(), 'temp');
          await fs.mkdir(tempDir, { recursive: true });
          
          const convert = pdf2pic.fromPath(filePath, {
            density: 300,
            saveFilename: `page`,
            savePath: tempDir,
            format: 'png',
            width: 1200,
            height: 1600
          });

          const pages = await convert.bulk(-1);
          const imagePaths = pages.map(page => page.path);

          // Process all pages with advanced OCR
          ocrResults = await advancedOCR.processBatch(imagePaths);

          // Clean up temporary images
          for (const imagePath of imagePaths) {
            try {
              await fs.unlink(imagePath);
            } catch (error) {
              console.error('Error cleaning up temp file:', error);
            }
          }
        }
      } catch (error) {
        console.error('PDF processing error:', error);
        return res.status(500).json({ error: 'Failed to process PDF: ' + error.message });
      }

    } else if (document.mimeType?.startsWith('image/')) {
      // Process single image
      const result = await advancedOCR.extractWithMultipleEngines(filePath);
      ocrResults = [result];

    } else {
      return res.status(400).json({ error: 'Document type not supported for OCR processing' });
    }

    // Calculate overall quality metrics
    const totalConfidence = ocrResults.reduce((sum, result) => sum + result.confidence, 0) / ocrResults.length;
    const totalText = ocrResults.map(result => result.text).join('\n\n');
    const totalWords = ocrResults.reduce((sum, result) => sum + result.processedWords, 0);
    const allImprovements = ocrResults.flatMap(result => result.improvements);

    // Assess overall quality
    const qualityAssessment = advancedOCR.assessConfidence(totalConfidence, totalText.length, totalWords);

    // Save OCR results to database (if forceReprocess, delete existing chunks first)
    if (forceReprocess) {
      await db
        .delete(documentChunks)
        .where(eq(documentChunks.documentId, id));
    }

    // Create enhanced chunks with OCR metadata
    let chunksCreated = 0;
    for (let i = 0; i < ocrResults.length; i++) {
      const result = ocrResults[i];
      if (result.text.length > 10) { // Only save chunks with meaningful content
        await db.insert(documentChunks).values({
          id: `${id}-ocr-chunk-${i}`,
          documentId: id,
          content: result.text,
          chunkIndex: i,
          metadata: JSON.stringify({
            ocrMethod: result.method,
            confidence: result.confidence,
            processedWords: result.processedWords,
            improvements: result.improvements,
            qualityAssessment: qualityAssessment,
            isOCRProcessed: true,
            extractedAt: new Date().toISOString()
          }),
          createdAt: new Date(),
        });
        chunksCreated++;
      }
    }
    
    // Check if OCR failed to extract any meaningful content
    if (chunksCreated === 0) {
      console.error(`OCR failed to extract content from document ${id} - possible debug content or corrupted file`);
      return res.status(422).json({
        error: 'OCR failed to extract meaningful content',
        message: 'The document may be corrupted or contain non-document content. Please verify the file and try again.',
        documentId: id,
        suggestions: [
          'Verify the document file is a valid PDF or image',
          'Check if the document contains actual text content',
          'Try re-uploading the document',
          'Contact support if the issue persists'
        ]
      });
    }

    res.json({
      success: true,
      documentId: id,
      pages: ocrResults.length,
      totalCharacters: totalText.length,
      totalWords: totalWords,
      averageConfidence: Math.round(totalConfidence),
      qualityAssessment,
      methods: [...new Set(ocrResults.map(r => r.method))],
      improvements: [...new Set(allImprovements)],
      processingTime: Date.now(),
      chunksCreated: chunksCreated
    });

  } catch (error) {
    console.error('Enhanced OCR processing error:', error);
    res.status(500).json({ error: 'Failed to process document with enhanced OCR' });
  }
});

// Batch OCR processing for multiple documents
router.post('/api/admin/ocr/batch-process', async (req, res) => {
  try {
    const { documentIds, forceReprocess = false } = req.body;

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ error: 'Document IDs array required' });
    }

    const results = [];
    let processed = 0;
    let failed = 0;

    for (const documentId of documentIds) {
      try {
        // Process each document individually
        const response = await fetch(`http://localhost:5000/api/admin/ocr/process-document/${documentId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forceReprocess })
        });

        const result = await response.json();
        
        if (response.ok) {
          results.push({ documentId, status: 'success', ...result });
          processed++;
        } else {
          results.push({ documentId, status: 'error', error: result.error });
          failed++;
        }

      } catch (error) {
        results.push({ documentId, status: 'error', error: error.message });
        failed++;
      }
    }

    res.json({
      summary: {
        total: documentIds.length,
        processed,
        failed,
        successRate: Math.round((processed / documentIds.length) * 100)
      },
      results
    });

  } catch (error) {
    console.error('Batch OCR processing error:', error);
    res.status(500).json({ error: 'Failed to process batch OCR request' });
  }
});

// OCR quality analysis endpoint
router.get('/api/admin/ocr/quality-analysis/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get document chunks with OCR metadata
    const chunks = await db
      .select()
      .from(documentChunks)
      .where(eq(documentChunks.documentId, id));

    if (chunks.length === 0) {
      return res.status(404).json({ error: 'No OCR data found for this document' });
    }

    const ocrChunks = chunks.filter(chunk => {
      try {
        const metadata = JSON.parse(chunk.metadata || '{}');
        return metadata.isOCRProcessed;
      } catch {
        return false;
      }
    });

    if (ocrChunks.length === 0) {
      return res.json({ 
        hasOCRData: false,
        message: 'Document not processed with OCR' 
      });
    }

    // Analyze OCR quality
    const analysis = ocrChunks.map(chunk => {
      const metadata = JSON.parse(chunk.metadata || '{}');
      return {
        chunkId: chunk.id,
        confidence: metadata.confidence,
        method: metadata.ocrMethod,
        wordCount: metadata.processedWords,
        characterCount: chunk.content.length,
        improvements: metadata.improvements,
        qualityAssessment: metadata.qualityAssessment
      };
    });

    const averageConfidence = analysis.reduce((sum, item) => sum + item.confidence, 0) / analysis.length;
    const totalCharacters = analysis.reduce((sum, item) => sum + item.characterCount, 0);
    const totalWords = analysis.reduce((sum, item) => sum + item.wordCount, 0);
    const methods = [...new Set(analysis.map(item => item.method))];
    const allImprovements = [...new Set(analysis.flatMap(item => item.improvements))];

    res.json({
      hasOCRData: true,
      documentId: id,
      summary: {
        chunks: ocrChunks.length,
        averageConfidence: Math.round(averageConfidence),
        totalCharacters,
        totalWords,
        methods,
        improvements: allImprovements
      },
      chunkAnalysis: analysis,
      recommendations: averageConfidence < 70 ? 
        ['Consider reprocessing with higher resolution', 'Manual review recommended'] :
        ['OCR quality is acceptable', 'Content ready for use']
    });

  } catch (error) {
    console.error('OCR quality analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze OCR quality' });
  }
});

// Re-OCR specific document with different settings
router.post('/api/admin/ocr/reprocess-with-settings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { settings = {} } = req.body;

    // Get document
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const filePath = document.path;

    // Process with custom settings
    const result = await advancedOCR.extractWithMultipleEngines(filePath);

    // Save improved result
    await db
      .delete(documentChunks)
      .where(eq(documentChunks.documentId, id));

    await db.insert(documentChunks).values({
      id: `${id}-reprocessed-chunk-0`,
      documentId: id,
      content: result.text,
      chunkIndex: 0,
      metadata: JSON.stringify({
        ocrMethod: result.method,
        confidence: result.confidence,
        processedWords: result.processedWords,
        improvements: result.improvements,
        isOCRProcessed: true,
        reprocessedAt: new Date().toISOString(),
        customSettings: settings
      }),
      createdAt: new Date(),
    });

    res.json({
      success: true,
      documentId: id,
      method: result.method,
      confidence: result.confidence,
      characterCount: result.text.length,
      wordCount: result.processedWords,
      improvements: result.improvements
    });

  } catch (error) {
    console.error('OCR reprocess error:', error);
    res.status(500).json({ error: 'Failed to reprocess document with OCR' });
  }
});

export default router;