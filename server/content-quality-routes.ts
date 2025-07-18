import { Router } from 'express';
import { db } from './db.js';
import { contentQualityFlags, contentEnhancementSessions, documentChunks, documents } from '../shared/schema.js';
import { eq, and, desc, asc, count, sql } from 'drizzle-orm';
import { Pinecone } from '@pinecone-database/pinecone';
// import { OpenAI } from 'openai';
import fs from 'fs/promises';
import path from 'path';
// MEMORY OPTIMIZATION: Disabled pdf-parse (34MB)
// import pdfParse from 'pdf-parse';
let pdfParse: any = null;
// MEMORY OPTIMIZATION: Disabled tesseract.js (30MB)
// import { createWorker } from 'tesseract.js';
// import pdf2pic from 'pdf2pic';
let createWorker: any = null;
let pdf2pic: any = null;

const router = Router();

// Initialize Pinecone and OpenAI
let pinecone: Pinecone | null = null;
let openai: OpenAI | null = null;

if (process.env.PINECONE_API_KEY && process.env.OPENAI_API_KEY) {
  pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });
  
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// Get all content quality flags with prioritization
router.get('/api/admin/content-quality/flags', async (req, res) => {
  try {
    const { status = 'pending', priority, flagType, limit = '50' } = req.query;
    
    let query = db
      .select({
        id: contentQualityFlags.id,
        chunkId: contentQualityFlags.chunkId,
        documentId: contentQualityFlags.documentId,
        flagType: contentQualityFlags.flagType,
        flagReason: contentQualityFlags.flagReason,
        priority: contentQualityFlags.priority,
        status: contentQualityFlags.status,
        aiSuggestion: contentQualityFlags.aiSuggestion,
        humanNotes: contentQualityFlags.humanNotes,
        originalContent: contentQualityFlags.originalContent,
        enhancedContent: contentQualityFlags.enhancedContent,
        reviewCount: contentQualityFlags.reviewCount,
        lastReviewAt: contentQualityFlags.lastReviewAt,
        createdAt: contentQualityFlags.createdAt,
        // Join document info
        documentName: documents.originalName,
        documentType: documents.mimeType,
      })
      .from(contentQualityFlags)
      .leftJoin(documents, eq(contentQualityFlags.documentId, documents.id));

    // Apply filters
    if (status && status !== 'all') {
      query = query.where(eq(contentQualityFlags.status, status as string));
    }
    if (priority && priority !== 'all') {
      query = query.where(eq(contentQualityFlags.priority, priority as string));
    }
    if (flagType && flagType !== 'all') {
      query = query.where(eq(contentQualityFlags.flagType, flagType as string));
    }

    // Order by priority and creation date
    query = query
      .orderBy(
        sql`CASE ${contentQualityFlags.priority} 
            WHEN 'critical' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'medium' THEN 3 
            ELSE 4 
        END`,
        desc(contentQualityFlags.createdAt)
      )
      .limit(parseInt(limit as string));

    const flags = await query;
    
    console.log('Content quality flags query results:', flags.length, 'flags found');
    console.log('Query filters:', { status, priority, flagType, limit });
    
    res.json(flags);
  } catch (error) {
    console.error('Error fetching content quality flags:', error);
    res.status(500).json({ error: 'Failed to fetch content quality flags' });
  }
});

// Get content quality statistics
router.get('/api/admin/content-quality/stats', async (req, res) => {
  try {
    const stats = await db
      .select({
        flagType: contentQualityFlags.flagType,
        priority: contentQualityFlags.priority,
        status: contentQualityFlags.status,
        count: count(),
      })
      .from(contentQualityFlags)
      .groupBy(contentQualityFlags.flagType, contentQualityFlags.priority, contentQualityFlags.status);

    const summary = {
      totalFlags: 0,
      byPriority: { critical: 0, high: 0, medium: 0, low: 0 },
      byStatus: { pending: 0, in_review: 0, enhanced: 0, dismissed: 0 },
      byType: {},
    };

    stats.forEach(stat => {
      summary.totalFlags += stat.count;
      summary.byPriority[stat.priority as keyof typeof summary.byPriority] += stat.count;
      summary.byStatus[stat.status as keyof typeof summary.byStatus] += stat.count;
      
      if (!summary.byType[stat.flagType]) {
        summary.byType[stat.flagType] = 0;
      }
      summary.byType[stat.flagType] += stat.count;
    });

    res.json(summary);
  } catch (error) {
    console.error('Error fetching content quality stats:', error);
    res.status(500).json({ error: 'Failed to fetch content quality stats' });
  }
});

// Update a content quality flag (enhance content)
router.put('/api/admin/content-quality/flags/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { enhancedContent, humanNotes, status, assignedTo } = req.body;

    const updated = await db
      .update(contentQualityFlags)
      .set({
        enhancedContent,
        humanNotes,
        status: status || 'enhanced',
        assignedTo,
        reviewCount: sql`${contentQualityFlags.reviewCount} + 1`,
        lastReviewAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(contentQualityFlags.id, id))
      .returning();

    if (updated.length === 0) {
      return res.status(404).json({ error: 'Content quality flag not found' });
    }

    // If content was enhanced, update the actual document chunk
    if (enhancedContent && status === 'enhanced') {
      const flag = updated[0];
      await db
        .update(documentChunks)
        .set({
          content: enhancedContent,
          metadata: sql`${documentChunks.metadata} || '{"enhanced": true, "enhanced_at": "${new Date().toISOString()}"}'`,
        })
        .where(eq(documentChunks.id, flag.chunkId));
      
      // Update vector in Pinecone if available
      if (pinecone && openai) {
        try {
          // Generate new embedding for the enhanced content
          const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: enhancedContent,
          });
          
          const embedding = embeddingResponse.data[0].embedding;
          
          // Update vector in Pinecone
          const index = pinecone.index('jacc-knowledge-base');
          await index.upsert([{
            id: flag.chunkId,
            values: embedding,
            metadata: {
              documentId: flag.documentId,
              content: enhancedContent,
              contentType: 'document',
              enhanced: true,
              enhancedAt: new Date().toISOString(),
            },
          }]);
          
          console.log(`Updated vector for chunk ${flag.chunkId} with enhanced content`);
        } catch (error) {
          console.error('Error updating vector database:', error);
          // Don't fail the whole request if vector update fails
        }
      }
    }

    res.json(updated[0]);
  } catch (error) {
    console.error('Error updating content quality flag:', error);
    res.status(500).json({ error: 'Failed to update content quality flag' });
  }
});

// Create a new content enhancement session
router.post('/api/admin/content-quality/sessions', async (req, res) => {
  try {
    const { userId, sessionName, description } = req.body;

    const session = await db
      .insert(contentEnhancementSessions)
      .values({
        userId,
        sessionName,
        description,
      })
      .returning();

    res.json(session[0]);
  } catch (error) {
    console.error('Error creating enhancement session:', error);
    res.status(500).json({ error: 'Failed to create enhancement session' });
  }
});

// Get enhancement sessions
router.get('/api/admin/content-quality/sessions', async (req, res) => {
  try {
    const sessions = await db
      .select()
      .from(contentEnhancementSessions)
      .orderBy(desc(contentEnhancementSessions.createdAt));

    res.json(sessions);
  } catch (error) {
    console.error('Error fetching enhancement sessions:', error);
    res.status(500).json({ error: 'Failed to fetch enhancement sessions' });
  }
});

// Bulk update multiple flags
router.put('/api/admin/content-quality/bulk-update', async (req, res) => {
  try {
    const { flagIds, updates } = req.body;

    const results = await Promise.all(
      flagIds.map(async (id: string) => {
        return await db
          .update(contentQualityFlags)
          .set({
            ...updates,
            reviewCount: sql`${contentQualityFlags.reviewCount} + 1`,
            lastReviewAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(contentQualityFlags.id, id))
          .returning();
      })
    );

    res.json({ updated: results.flat().length });
  } catch (error) {
    console.error('Error bulk updating flags:', error);
    res.status(500).json({ error: 'Failed to bulk update flags' });
  }
});

// Auto-suggest improvements using AI
router.post('/api/admin/content-quality/suggest/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const flag = await db
      .select()
      .from(contentQualityFlags)
      .where(eq(contentQualityFlags.id, id))
      .limit(1);

    if (flag.length === 0) {
      return res.status(404).json({ error: 'Flag not found' });
    }

    // Generate enhanced AI suggestion based on flag type
    let enhancedSuggestion = '';
    const flagData = flag[0];
    
    switch (flagData.flagType) {
      case 'generic_template':
        enhancedSuggestion = `Replace this generic template with specific information. Consider adding:\n• Exact pricing details (rates, fees, minimums)\n• Technical specifications or features\n• Implementation requirements or steps\n• Contact information or support details\n• Compliance or regulatory information`;
        break;
      case 'too_short':
        enhancedSuggestion = `Expand this content with detailed information such as:\n• Purpose and benefits of this document\n• Key features or capabilities described\n• Step-by-step procedures or workflows\n• Requirements or prerequisites\n• Examples or use cases`;
        break;
      case 'generic_description':
        enhancedSuggestion = `Make this description more specific by including:\n• Exact business types or industries served\n• Specific merchant services covered\n• Processing capabilities and limits\n• Integration requirements\n• Pricing or cost structure`;
        break;
      default:
        enhancedSuggestion = 'Review and enhance with specific, actionable information that helps sales agents answer customer questions accurately.';
    }

    await db
      .update(contentQualityFlags)
      .set({
        aiSuggestion: enhancedSuggestion,
        updatedAt: new Date(),
      })
      .where(eq(contentQualityFlags.id, id));

    res.json({ suggestion: enhancedSuggestion });
  } catch (error) {
    console.error('Error generating AI suggestion:', error);
    res.status(500).json({ error: 'Failed to generate AI suggestion' });
  }
});

// Helper function to extract PDF content with OCR fallback
async function extractPDFContent(filePath: string): Promise<string> {
  try {
    console.log('Document path:', filePath);
    console.log('Document MIME type: application/pdf');
    
    const absolutePath = path.resolve(filePath);
    const pdfBuffer = await fs.readFile(absolutePath);
    const pdfData = await pdfParse(pdfBuffer);
    const content = pdfData.text?.trim() || '';
    
    console.log('PDF content length:', content.length);
    
    if (!content || content.length < 10) {
      console.log('PDF extraction returned empty or minimal content - attempting OCR...');
      
      try {
        // Convert PDF to images and run OCR
        const ocrText = await extractPDFWithOCR(absolutePath);
        if (ocrText && ocrText.length > 50) {
          console.log('OCR extraction successful, content length:', ocrText.length);
          return ocrText;
        }
      } catch (ocrError) {
        console.error('OCR extraction failed:', ocrError);
      }
      
      return 'This PDF appears to be image-based and contains no extractable text content. The document likely contains scanned images or photos instead of searchable text. OCR (Optical Character Recognition) would be needed to extract text from this type of PDF.';
    }
    
    return content;
  } catch (error) {
    console.error('Error extracting PDF content:', error);
    return `Error extracting PDF content: ${error.message}`;
  }
}

// Helper function to extract text from image-based PDFs using OCR
async function extractPDFWithOCR(filePath: string): Promise<string> {
  let worker: any = null;
  
  try {
    console.log('Starting OCR extraction for PDF:', filePath);
    
    // Convert PDF to images
    const convert = pdf2pic.fromPath(filePath, {
      density: 300,           // High DPI for better OCR accuracy
      saveFilename: "page",
      savePath: "/tmp",
      format: "png",
      width: 2048,           // High resolution
      height: 2048
    });
    
    // Convert first 5 pages maximum to avoid excessive processing
    const results = await convert.bulk(-1, { responseType: "buffer" });
    
    if (!results || results.length === 0) {
      console.log('No images generated from PDF');
      return '';
    }
    
    console.log(`Generated ${results.length} images from PDF`);
    
    // Initialize Tesseract worker with optimizations
    worker = await createWorker('eng');
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;:!?@#$%^&*()_+-=[]{}|\\`~" \n\t',
      tessedit_pageseg_mode: '6', // Assume single uniform block of text
      preserve_interword_spaces: '1'
    });
    
    let extractedText = '';
    
    // Process each page image with OCR
    for (let i = 0; i < Math.min(results.length, 5); i++) {
      const result = results[i];
      if (result.buffer) {
        console.log(`Processing page ${i + 1} with OCR...`);
        
        const { data: { text, confidence } } = await worker.recognize(result.buffer);
        
        if (text && text.trim().length > 10) {
          // Clean up OCR text - remove excessive whitespace and fix common OCR errors
          const cleanedText = text
            .replace(/\s+/g, ' ')           // Replace multiple spaces with single space
            .replace(/([a-z])([A-Z])/g, '$1 $2')  // Add spaces between camelCase
            .replace(/(\d)([A-Z])/g, '$1 $2')     // Add spaces between numbers and letters
            .replace(/\n\s*\n/g, '\n')           // Remove extra line breaks
            .trim();
          
          extractedText += `\n\n--- Page ${i + 1} (Confidence: ${Math.round(confidence)}%) ---\n${cleanedText}`;
          console.log(`Page ${i + 1} OCR completed, extracted ${cleanedText.length} characters (${Math.round(confidence)}% confidence)`);
        }
      }
    }
    
    await worker.terminate();
    
    if (extractedText.length > 50) {
      console.log('OCR extraction successful, total length:', extractedText.length);
      return extractedText.trim();
    } else {
      console.log('OCR extraction yielded minimal content');
      return '';
    }
    
  } catch (error) {
    console.error('OCR extraction error:', error);
    if (worker) {
      try {
        await worker.terminate();
      } catch (terminateError) {
        console.error('Error terminating OCR worker:', terminateError);
      }
    }
    throw error;
  }
}

// Get document content for a specific chunk
router.get('/api/admin/content-quality/document-content/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { chunkId } = req.query;
    
    console.log('Document content request:', { documentId, chunkId });
    
    // Get document info first
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);
    
    if (!document) {
      console.error('Document not found:', documentId);
      return res.status(404).json({ error: 'Document not found' });
    }
    
    console.log('Document found:', document.originalName, 'MIME:', document.mimeType);
    
    // Get the specific chunk
    const chunks = await db
      .select()
      .from(documentChunks)
      .where(eq(documentChunks.documentId, documentId))
      .orderBy(asc(documentChunks.chunkIndex));
    
    console.log('Chunks found:', chunks.length);
    if (chunks.length > 0) {
      console.log('First chunk content preview:', chunks[0].content.substring(0, 100));
    }
    
    // Check if chunks are just metadata (not real content)
    const hasOnlyMetadata = chunks.length > 0 && chunks.every(chunk => 
      chunk.content.includes('File Type:') && 
      chunk.content.includes('File Size:') &&
      chunk.content.length < 200
    );
    
    // If no chunks found OR only metadata chunks exist and it's a PDF, extract content on-demand
    if ((chunks.length === 0 || hasOnlyMetadata) && document.mimeType === 'application/pdf') {
      console.log('No chunks found for PDF, extracting content on-demand...');
      console.log('Document path:', document.path);
      console.log('Document MIME type:', document.mimeType);
      
      try {
        const pdfContent = await extractPDFContent(document.path);
        console.log('PDF content length:', pdfContent?.length || 0);
        
        if (pdfContent && pdfContent.trim().length > 10) {
          // Return the extracted content without creating chunks (for viewing only)
          return res.json({
            documentName: document.originalName,
            currentChunk: pdfContent.substring(0, 2000), // First 2000 chars
            surroundingChunks: {
              before: null,
              after: pdfContent.length > 2000 ? pdfContent.substring(2000, 4000) : null
            },
            fullContent: pdfContent.substring(0, 10000), // First 10k chars as preview
            isExtractedOnDemand: true
          });
        } else {
          console.error('PDF extraction returned empty or minimal content - likely an image-based PDF');
          return res.json({
            documentName: document.originalName,
            currentChunk: 'This PDF appears to be image-based and contains no extractable text content. The document likely contains scanned images or photos instead of searchable text. OCR (Optical Character Recognition) would be needed to extract text from this type of PDF.',
            surroundingChunks: {
              before: null,
              after: null
            },
            fullContent: 'Image-based PDF detected. Original flagged content: ' + (chunks[0]?.content || 'Document metadata only - no text content available'),
            isImageBasedPDF: true,
            requiresOCR: true
          });
        }
      } catch (extractError) {
        console.error('Error extracting PDF:', extractError);
        return res.status(500).json({ error: 'Failed to extract PDF content: ' + extractError.message });
      }
    }
    
    if (!chunks.length) {
      return res.status(404).json({ error: 'Document chunks not found and content could not be extracted' });
    }
    
    // Find current chunk index
    const currentChunkIndex = chunks.findIndex(c => c.id === chunkId);
    const currentChunk = chunks[currentChunkIndex];
    
    // Get surrounding chunks for context
    const surroundingChunks = {
      before: currentChunkIndex > 0 ? chunks[currentChunkIndex - 1].content : null,
      after: currentChunkIndex < chunks.length - 1 ? chunks[currentChunkIndex + 1].content : null,
    };
    
    res.json({
      documentName: document?.originalName || 'Unknown Document',
      currentChunk: currentChunk?.content || '',
      surroundingChunks,
      fullContent: chunks.slice(0, 5).map(c => c.content).join('\n\n'), // First 5 chunks as preview
    });
  } catch (error) {
    console.error('Error fetching document content:', error);
    res.status(500).json({ error: 'Failed to fetch document content' });
  }
});

export default router;