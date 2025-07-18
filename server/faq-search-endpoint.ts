import { Request, Response } from 'express';

// FAQ search endpoint with proper response format
export function setupFAQSearchEndpoint(app: any) {
  app.post('/api/chat/faq-search', async (req: Request, res: Response) => {
    try {
      const { query } = req.body;
      
      // Sanitize input to prevent SQL injection
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.json({ results: [], query: '', message: 'No query provided' });
      }

      // Sanitize query - remove potential SQL injection attempts
      const sanitizedQuery = query.replace(/[';\-\-]/g, '').trim();
      
      const { db } = await import('./db');
      const { faqKnowledgeBase } = await import('../shared/schema');
      const { sql, or, ilike } = await import('drizzle-orm');
      
      // Search FAQ knowledge base with sanitized query
      const results = await db
        .select()
        .from(faqKnowledgeBase)
        .where(
          or(
            ilike(faqKnowledgeBase.question, `%${sanitizedQuery}%`),
            ilike(faqKnowledgeBase.answer, `%${sanitizedQuery}%`),
            sql`${faqKnowledgeBase.tags}::text ILIKE ${`%${sanitizedQuery}%`}`
          )
        )
        .limit(10);
      
      // Return in expected format
      res.json({
        results: results.map(faq => ({
          id: faq.id,
          question: faq.question,
          answer: faq.answer,
          category: faq.category,
          confidence: calculateConfidence(faq, sanitizedQuery),
          source: 'faq_knowledge_base'
        })),
        query: sanitizedQuery,
        count: results.length
      });
      
    } catch (error) {
      console.error('FAQ search error:', error);
      res.json({ 
        results: [], 
        query: req.body.query || '', 
        error: 'Search failed',
        message: error.message 
      });
    }
  });

  // Also support GET method for testing
  app.get('/api/chat/faq-search', (req: Request, res: Response) => {
    const query = req.query.query as string || '';
    req.body = { query };
    app._router.handle(Object.assign(req, { method: 'POST' }), res);
  });
}

function calculateConfidence(faq: any, query: string): number {
  const queryLower = query.toLowerCase();
  const questionLower = faq.question.toLowerCase();
  const answerLower = faq.answer.toLowerCase();
  
  // Exact match in question
  if (questionLower.includes(queryLower)) {
    return 0.9;
  }
  
  // Match in answer
  if (answerLower.includes(queryLower)) {
    return 0.7;
  }
  
  // Partial match
  const queryWords = queryLower.split(/\s+/);
  const matchedWords = queryWords.filter(word => 
    questionLower.includes(word) || answerLower.includes(word)
  );
  
  return Math.min(0.6, matchedWords.length / queryWords.length);
}