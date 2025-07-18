import { Router } from 'express';
import { db } from './db.js';
import { contentQualityFlags, documentChunks } from '../shared/schema.js';
import { eq } from 'drizzle-orm';
import { Pinecone } from '@pinecone-database/pinecone';
// import { OpenAI } from 'openai';
import { advancedOCR } from './advanced-ocr-service.js';

const router = Router();

// Initialize services
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

// Save enhanced content and update vector database
router.post('/api/admin/content-quality/save-enhancement/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { enhancedContent, humanNotes } = req.body;

    if (!enhancedContent || enhancedContent.trim().length < 50) {
      return res.status(400).json({ error: 'Enhanced content must be at least 50 characters long' });
    }

    // Get the content flag
    const [flag] = await db
      .select()
      .from(contentQualityFlags)
      .where(eq(contentQualityFlags.id, id))
      .limit(1);

    if (!flag) {
      return res.status(404).json({ error: 'Content flag not found' });
    }

    // Update the flag with enhanced content
    await db
      .update(contentQualityFlags)
      .set({
        enhancedContent: enhancedContent.trim(),
        humanNotes: humanNotes?.trim() || '',
        status: 'enhanced',
        updatedAt: new Date(),
      })
      .where(eq(contentQualityFlags.id, id));

    // Update document chunk if it exists
    if (flag.chunkId) {
      await db
        .update(documentChunks)
        .set({
          content: enhancedContent.trim(),
          updatedAt: new Date(),
        })
        .where(eq(documentChunks.id, flag.chunkId));
    }

    // Update vector database if available
    if (pinecone && openai) {
      try {
        // Generate new embedding for enhanced content
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: enhancedContent.trim(),
        });

        const embedding = embeddingResponse.data[0].embedding;

        // Update Pinecone vector
        const index = pinecone.index('merchant-docs-v2');
        await index.upsert([{
          id: flag.chunkId,
          values: embedding,
          metadata: {
            documentId: flag.documentId,
            content: enhancedContent.trim(),
            type: 'enhanced_document_chunk',
            enhanced: true,
            enhancementDate: new Date().toISOString()
          }
        }]);

        console.log(`Updated vector database for chunk ${flag.chunkId}`);
      } catch (vectorError) {
        console.error('Error updating vector database:', vectorError);
        // Don't fail the request if vector update fails
      }
    }

    res.json({ 
      success: true, 
      message: 'Content enhanced and saved successfully',
      chunkId: flag.chunkId 
    });

  } catch (error) {
    console.error('Error saving enhanced content:', error);
    res.status(500).json({ error: 'Failed to save enhanced content' });
  }
});

// Bulk process multiple flags for enhancement
router.post('/api/admin/content-quality/bulk-enhance', async (req, res) => {
  try {
    const { flagIds, enhancementType = 'auto' } = req.body;

    if (!flagIds || !Array.isArray(flagIds) || flagIds.length === 0) {
      return res.status(400).json({ error: 'Flag IDs array is required' });
    }

    const results = [];

    for (const flagId of flagIds) {
      try {
        // Get the flag
        const [flag] = await db
          .select()
          .from(contentQualityFlags)
          .where(eq(contentQualityFlags.id, flagId))
          .limit(1);

        if (!flag) {
          results.push({ flagId, status: 'error', message: 'Flag not found' });
          continue;
        }

        let enhancedContent = '';

        if (enhancementType === 'auto' && openai) {
          // Generate AI enhancement
          const prompt = `Enhance this content chunk to be more specific and useful for sales agents:

Original content: ${flag.originalContent}

Flag type: ${flag.flagType}
Flag reason: ${flag.flagReason}

Create enhanced content that:
1. Replaces generic templates with specific information
2. Adds relevant details like pricing, features, or procedures
3. Makes the content searchable and actionable
4. Maintains professional tone for merchant services context

Enhanced content:`;

          const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 500,
            temperature: 0.7,
          });

          enhancedContent = completion.choices[0].message.content?.trim() || flag.originalContent;
        } else {
          // Use AI suggestion as enhancement
          enhancedContent = flag.aiSuggestion || flag.originalContent;
        }

        // Save enhancement
        await db
          .update(contentQualityFlags)
          .set({
            enhancedContent,
            status: 'enhanced',
            humanNotes: `Bulk enhanced using ${enhancementType} method`,
            updatedAt: new Date(),
          })
          .where(eq(contentQualityFlags.id, flagId));

        results.push({ 
          flagId, 
          status: 'success', 
          message: 'Enhanced successfully',
          charactersAdded: enhancedContent.length - flag.originalContent.length
        });

      } catch (error) {
        console.error(`Error enhancing flag ${flagId}:`, error);
        results.push({ flagId, status: 'error', message: error.message });
      }
    }

    res.json({ 
      results,
      summary: {
        total: flagIds.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'error').length
      }
    });

  } catch (error) {
    console.error('Error in bulk enhancement:', error);
    res.status(500).json({ error: 'Failed to process bulk enhancement' });
  }
});

// Generate AI-powered content suggestions
router.post('/api/admin/content-quality/generate-suggestion/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!openai) {
      return res.status(500).json({ error: 'AI service not available' });
    }

    const [flag] = await db
      .select()
      .from(contentQualityFlags)
      .where(eq(contentQualityFlags.id, id))
      .limit(1);

    if (!flag) {
      return res.status(404).json({ error: 'Flag not found' });
    }

    const prompt = `As an expert in merchant services content, enhance this flagged content:

Current content: "${flag.originalContent}"
Issue: ${flag.flagReason}
Type: ${flag.flagType}

Create enhanced content that:
- Provides specific, actionable information
- Includes relevant details (rates, fees, requirements, procedures)
- Helps sales agents answer customer questions accurately
- Maintains professional merchant services industry tone
- Is searchable and well-structured

Enhanced version:`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0.7,
    });

    const suggestion = completion.choices[0].message.content?.trim() || '';

    // Update flag with AI suggestion
    await db
      .update(contentQualityFlags)
      .set({
        aiSuggestion: suggestion,
        updatedAt: new Date(),
      })
      .where(eq(contentQualityFlags.id, id));

    res.json({ suggestion });

  } catch (error) {
    console.error('Error generating AI suggestion:', error);
    res.status(500).json({ error: 'Failed to generate AI suggestion' });
  }
});

// Test Pinecone connection
router.get('/api/admin/test-pinecone', async (req, res) => {
  try {
    if (!pinecone) {
      return res.status(503).json({ 
        error: 'Pinecone not configured',
        message: 'PINECONE_API_KEY environment variable not set'
      });
    }

    // Test index access
    try {
      const index = pinecone.index('merchant-docs-v2');
      const stats = await index.describeIndexStats();
      
      res.json({
        success: true,
        indexName: 'merchant-docs-v2',
        stats: {
          dimension: stats.dimension,
          totalVectors: stats.totalRecordCount,
          namespaces: stats.namespaces
        }
      });
    } catch (indexError: any) {
      res.status(404).json({
        error: 'Index not found',
        message: indexError.message,
        suggestion: 'Index "merchant-docs-v2" may need to be created'
      });
    }
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to test Pinecone connection',
      message: error.message 
    });
  }
});

export default router;