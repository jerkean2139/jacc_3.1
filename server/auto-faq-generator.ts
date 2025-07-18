// Automatic FAQ generation from chat history
import { db } from './db';
import { messages, chats, faqKnowledgeBase } from '../shared/schema';
import { desc, sql, eq, and, gte, notInArray } from 'drizzle-orm';
import { openai } from './openai';

interface PotentialFAQ {
  question: string;
  answer: string;
  frequency: number;
  confidence: number;
  category: string;
}

export class AutoFAQGenerator {
  // Analyze chat history to find FAQ candidates
  async analyzeChatHistory(daysBack: number = 30): Promise<PotentialFAQ[]> {
    try {
      // Get all Q&A pairs from recent chats
      const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
      
      const recentChats = await db
        .select({
          chatId: chats.id,
          title: chats.title,
          createdAt: chats.createdAt
        })
        .from(chats)
        .where(gte(chats.createdAt, cutoffDate))
        .orderBy(desc(chats.createdAt));

      const potentialFAQs: PotentialFAQ[] = [];
      
      // Process each chat
      for (const chat of recentChats) {
        const chatMessages = await db
          .select()
          .from(messages)
          .where(eq(messages.chatId, chat.chatId))
          .orderBy(messages.createdAt);

        // Find Q&A pairs
        for (let i = 0; i < chatMessages.length - 1; i++) {
          if (chatMessages[i].role === 'user' && chatMessages[i + 1].role === 'assistant') {
            const question = chatMessages[i].content;
            const answer = chatMessages[i + 1].content;
            
            // Skip if question is too short or generic
            if (question.length < 10 || this.isGenericGreeting(question)) {
              continue;
            }
            
            // Clean HTML from answer if present
            const cleanAnswer = this.cleanHTMLResponse(answer);
            
            potentialFAQs.push({
              question,
              answer: cleanAnswer,
              frequency: 1,
              confidence: 0.5,
              category: this.detectCategory(question)
            });
          }
        }
      }

      // Group similar questions
      const groupedFAQs = this.groupSimilarQuestions(potentialFAQs);
      
      // Filter out existing FAQs
      const existingFAQs = await db.select().from(faqKnowledgeBase);
      const existingQuestions = existingFAQs.map(faq => faq.question.toLowerCase());
      
      const newFAQs = groupedFAQs.filter(faq => 
        !existingQuestions.includes(faq.question.toLowerCase())
      );

      // Sort by frequency and confidence
      return newFAQs
        .sort((a, b) => (b.frequency * b.confidence) - (a.frequency * a.confidence))
        .slice(0, 20); // Top 20 candidates
        
    } catch (error) {
      console.error('Error analyzing chat history:', error);
      return [];
    }
  }

  // Group similar questions together
  private groupSimilarQuestions(faqs: PotentialFAQ[]): PotentialFAQ[] {
    const grouped = new Map<string, PotentialFAQ>();
    
    faqs.forEach(faq => {
      const normalized = this.normalizeQuestion(faq.question);
      
      if (grouped.has(normalized)) {
        const existing = grouped.get(normalized)!;
        existing.frequency++;
        // Keep the best answer (longest or highest quality)
        if (faq.answer.length > existing.answer.length) {
          existing.answer = faq.answer;
        }
      } else {
        grouped.set(normalized, { ...faq });
      }
    });

    return Array.from(grouped.values());
  }

  // Normalize question for comparison
  private normalizeQuestion(question: string): string {
    return question
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\b(what|how|when|where|why|which|who|can|do|does|is|are)\b/g, '') // Remove question words
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Check if message is generic greeting
  private isGenericGreeting(message: string): boolean {
    const greetings = ['hi', 'hello', 'hey', 'help', 'test', 'testing'];
    const lower = message.toLowerCase().trim();
    return greetings.includes(lower) || lower.length < 5;
  }

  // Clean HTML from AI responses
  private cleanHTMLResponse(answer: string): string {
    // Remove HTML tags but keep the content
    return answer
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Detect category from question content
  private detectCategory(question: string): string {
    const lower = question.toLowerCase();
    
    if (lower.includes('pos') || lower.includes('terminal') || lower.includes('equipment')) {
      return 'pos-systems';
    }
    if (lower.includes('rate') || lower.includes('fee') || lower.includes('cost') || lower.includes('price')) {
      return 'pricing';
    }
    if (lower.includes('setup') || lower.includes('start') || lower.includes('application')) {
      return 'onboarding';
    }
    if (lower.includes('support') || lower.includes('help') || lower.includes('contact')) {
      return 'support';
    }
    if (lower.includes('integrate') || lower.includes('api') || lower.includes('technical')) {
      return 'technical';
    }
    
    return 'general';
  }

  // Generate improved answer using AI
  async improveAnswer(question: string, originalAnswer: string): Promise<string> {
    try {
      const prompt = `
You are an expert in merchant services. Given this Q&A pair from our support chat, 
create a concise, professional FAQ answer that would be helpful for future users.

Question: ${question}

Original Answer: ${originalAnswer}

Please provide a clear, concise answer (2-3 sentences max) that:
1. Directly answers the question
2. Includes specific product names or details if mentioned
3. Is factual and helpful
4. Avoids HTML formatting

Improved Answer:`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a merchant services expert creating FAQ answers.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.3
      });

      return response.choices[0]?.message?.content || originalAnswer;
    } catch (error) {
      console.error('Error improving answer:', error);
      return originalAnswer;
    }
  }

  // Automatically add high-confidence FAQs
  async autoAddFAQs(minFrequency: number = 5, minConfidence: number = 0.7): Promise<number> {
    try {
      const candidates = await this.analyzeChatHistory(30);
      const qualified = candidates.filter(faq => 
        faq.frequency >= minFrequency && 
        faq.confidence >= minConfidence
      );

      let added = 0;
      for (const faq of qualified) {
        // Improve the answer before adding
        const improvedAnswer = await this.improveAnswer(faq.question, faq.answer);
        
        await db.insert(faqKnowledgeBase).values({
          question: faq.question,
          answer: improvedAnswer,
          category: faq.category,
          tags: [faq.category, 'auto-generated'],
          isActive: true,
          source: 'auto-generated',
          confidence: faq.confidence
        });
        
        added++;
        console.log(`✅ Auto-added FAQ: "${faq.question}"`);
      }

      return added;
    } catch (error) {
      console.error('Error auto-adding FAQs:', error);
      return 0;
    }
  }
}

export const autoFAQGenerator = new AutoFAQGenerator();