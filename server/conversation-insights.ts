// Conversation insights and pattern detection
import { db } from './db';
import { messages, chats } from '../shared/schema';
import { desc, sql, eq, and, gte } from 'drizzle-orm';

interface ConversationPattern {
  pattern: string;
  frequency: number;
  avgResponseTime: number;
  satisfaction: number;
}

interface UserIntent {
  intent: string;
  confidence: number;
  suggestedActions: string[];
}

export class ConversationInsights {
  // Detect user intent from message
  async detectIntent(message: string, conversationHistory: any[]): Promise<UserIntent> {
    const lowerMessage = message.toLowerCase();
    
    // Intent patterns
    const intents = {
      pricing: {
        keywords: ['price', 'cost', 'rate', 'fee', 'pricing', 'how much', 'quote'],
        suggestedActions: [
          'Show pricing calculator',
          'Compare processor rates',
          'Generate custom quote',
          'View pricing documentation'
        ]
      },
      setup: {
        keywords: ['setup', 'start', 'begin', 'activate', 'new account', 'onboard'],
        suggestedActions: [
          'Start application process',
          'View setup checklist',
          'Schedule onboarding call',
          'Download setup guide'
        ]
      },
      technical: {
        keywords: ['integrate', 'api', 'technical', 'developer', 'code', 'plugin'],
        suggestedActions: [
          'View API documentation',
          'Download SDKs',
          'Contact technical support',
          'View integration guides'
        ]
      },
      support: {
        keywords: ['help', 'issue', 'problem', 'broken', 'not working', 'error'],
        suggestedActions: [
          'Create support ticket',
          'View troubleshooting guide',
          'Contact support team',
          'Check system status'
        ]
      },
      comparison: {
        keywords: ['compare', 'vs', 'versus', 'better', 'difference', 'which'],
        suggestedActions: [
          'Show comparison chart',
          'View feature matrix',
          'Calculate savings',
          'Request consultation'
        ]
      }
    };

    // Detect primary intent
    let detectedIntent = 'general';
    let maxScore = 0;
    let suggestedActions: string[] = [];

    for (const [intentName, config] of Object.entries(intents)) {
      const score = config.keywords.filter(keyword => 
        lowerMessage.includes(keyword)
      ).length;
      
      if (score > maxScore) {
        maxScore = score;
        detectedIntent = intentName;
        suggestedActions = config.suggestedActions;
      }
    }

    // Calculate confidence based on keyword matches
    const confidence = Math.min(maxScore * 0.3, 0.95);

    return {
      intent: detectedIntent,
      confidence,
      suggestedActions
    };
  }

  // Get conversation patterns
  async getConversationPatterns(userId?: string): Promise<ConversationPattern[]> {
    try {
      // Get recent messages
      const recentMessages = await db
        .select({
          content: messages.content,
          role: messages.role,
          createdAt: messages.createdAt,
          chatId: messages.chatId
        })
        .from(messages)
        .where(
          and(
            gte(messages.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)), // Last 30 days
            userId ? eq(messages.userId, userId) : undefined
          )
        )
        .orderBy(desc(messages.createdAt))
        .limit(1000);

      // Analyze patterns
      const patterns = new Map<string, ConversationPattern>();
      
      // Group messages by chat
      const chatGroups = new Map<string, typeof recentMessages>();
      recentMessages.forEach(msg => {
        const chatId = msg.chatId;
        if (!chatGroups.has(chatId)) {
          chatGroups.set(chatId, []);
        }
        chatGroups.get(chatId)!.push(msg);
      });

      // Extract patterns from each conversation
      chatGroups.forEach((messages) => {
        const userMessages = messages.filter(m => m.role === 'user');
        
        userMessages.forEach(msg => {
          // Extract key phrases (3-4 word combinations)
          const words = msg.content.toLowerCase().split(/\s+/);
          for (let i = 0; i < words.length - 2; i++) {
            const phrase = words.slice(i, i + 3).join(' ');
            
            if (!patterns.has(phrase)) {
              patterns.set(phrase, {
                pattern: phrase,
                frequency: 0,
                avgResponseTime: 0,
                satisfaction: 0.8 // Default satisfaction
              });
            }
            
            const pattern = patterns.get(phrase)!;
            pattern.frequency++;
          }
        });
      });

      // Sort by frequency and return top patterns
      return Array.from(patterns.values())
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 20);
        
    } catch (error) {
      console.error('Error analyzing conversation patterns:', error);
      return [];
    }
  }

  // Get suggested improvements based on patterns
  async getSuggestedImprovements(): Promise<string[]> {
    const patterns = await this.getConversationPatterns();
    const suggestions: string[] = [];

    // Analyze top patterns for improvement opportunities
    patterns.forEach(pattern => {
      if (pattern.frequency > 10) {
        suggestions.push(`Create FAQ for frequently asked: "${pattern.pattern}"`);
      }
      
      if (pattern.avgResponseTime > 5000) {
        suggestions.push(`Optimize response time for: "${pattern.pattern}"`);
      }
      
      if (pattern.satisfaction < 0.7) {
        suggestions.push(`Improve response quality for: "${pattern.pattern}"`);
      }
    });

    return suggestions;
  }

  // Predict next user question based on conversation flow
  async predictNextQuestions(conversationHistory: any[]): Promise<string[]> {
    if (conversationHistory.length < 2) {
      return [
        "What are your processing rates?",
        "How do I get started?",
        "Which POS system is best for my business?",
        "What documentation do I need?"
      ];
    }

    const lastUserMessage = conversationHistory
      .filter(m => m.role === 'user')
      .slice(-1)[0]?.content || '';

    const intent = await this.detectIntent(lastUserMessage, conversationHistory);
    
    // Context-aware predictions based on intent
    const predictions: Record<string, string[]> = {
      pricing: [
        "Can you break down the fees?",
        "Are there any hidden costs?",
        "How do you compare to competitors?",
        "Can I get a custom quote?"
      ],
      setup: [
        "What documents do I need?",
        "How long does approval take?",
        "Is there a setup fee?",
        "Can someone help me get started?"
      ],
      technical: [
        "Do you have API documentation?",
        "Which platforms do you integrate with?",
        "Is there a sandbox environment?",
        "What programming languages are supported?"
      ],
      support: [
        "What are your support hours?",
        "Can I speak to someone now?",
        "Where can I find troubleshooting guides?",
        "How do I check system status?"
      ],
      comparison: [
        "What makes you different?",
        "Can you show me a feature comparison?",
        "What are the pros and cons?",
        "Which option saves me the most?"
      ],
      general: [
        "Tell me more about your services",
        "What POS systems do you offer?",
        "How can you help my business?",
        "What are your most popular products?"
      ]
    };

    return predictions[intent.intent] || predictions.general;
  }
}

export const conversationInsights = new ConversationInsights();