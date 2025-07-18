// MEMORY OPTIMIZATION: Disable AI imports
// import OpenAI from "openai";
// import Anthropic from '@anthropic-ai/sdk';
let OpenAI: any = null;
let Anthropic: any = null;
import type { ChatMessage, AIResponse } from "./openai";

/*
<important_code_snippet_instructions>
User has specifically requested using Claude 3.7 and GPT-4.1 mini models.
Updated from previous claude-3-7-sonnet-20250219 and gpt-4.1-mini configuration per user request.
</important_code_snippet_instructions>
*/

// <important_do_not_delete>
const DEFAULT_MODEL_STR = "claude-sonnet-4-20250514";
// </important_do_not_delete>

// MEMORY OPTIMIZATION: Disabled constructors
let openai: any = null;
let anthropic: any = null;
// const openai = new OpenAI({ 
//   apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
// });

// const anthropic = new Anthropic({
//   apiKey: process.env.ANTHROPIC_API_KEY,
// });

export interface AIModelPreferences {
  requestType: 'document_analysis' | 'calculation' | 'conversation' | 'marketing' | 'general';
  preferredModel: 'openai' | 'claude';
  fallbackModel: 'openai' | 'claude';
}

// Model optimization based on request type
export const MODEL_PREFERENCES: Record<string, AIModelPreferences> = {
  document_analysis: {
    requestType: 'document_analysis',
    preferredModel: 'claude',        // Claude excels at document analysis
    fallbackModel: 'openai'
  },
  calculation: {
    requestType: 'calculation',
    preferredModel: 'openai',        // GPT-4.1 mini excellent for logical reasoning and calculations
    fallbackModel: 'claude'
  },
  conversation: {
    requestType: 'conversation',
    preferredModel: 'claude',        // Claude better at conversational flow
    fallbackModel: 'openai'
  },
  marketing: {
    requestType: 'marketing',
    preferredModel: 'claude',        // Claude better at creative marketing content
    fallbackModel: 'openai'
  },
  general: {
    requestType: 'general',
    preferredModel: 'openai',        // GPT-4.1 mini as default primary model for logic
    fallbackModel: 'openai'
  }
};

export class AIFallbackService {
  
  /**
   * Determines the request type based on message content
   */
  private determineRequestType(messages: ChatMessage[]): keyof typeof MODEL_PREFERENCES {
    const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
    
    // Document analysis keywords
    if (lastMessage.includes('document') || lastMessage.includes('analysis') || 
        lastMessage.includes('statement') || lastMessage.includes('contract') ||
        lastMessage.includes('agreement') || lastMessage.includes('form')) {
      return 'document_analysis';
    }
    
    // Calculation keywords
    if (lastMessage.includes('calculate') || lastMessage.includes('rate') || 
        lastMessage.includes('cost') || lastMessage.includes('savings') ||
        lastMessage.includes('percentage') || lastMessage.includes('fee')) {
      return 'calculation';
    }
    
    // Marketing keywords
    if (lastMessage.includes('marketing') || lastMessage.includes('sales strategy') ||
        lastMessage.includes('outbound') || lastMessage.includes('social media') ||
        lastMessage.includes('branding') || lastMessage.includes('lead generation') ||
        lastMessage.includes('hormozi') || lastMessage.includes('gary v')) {
      return 'marketing';
    }
    
    // Conversation starters
    if (messages.filter(m => m.role === 'user').length <= 1) {
      return 'conversation';
    }
    
    return 'general';
  }

  /**
   * Attempts to generate response with OpenAI
   */
  private async generateOpenAIResponse(
    messages: ChatMessage[],
    systemPrompt: string,
    maxTokens: number = 300,
    temperature: number = 0.3
  ): Promise<string> {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages
      ],
      temperature,
      max_tokens: maxTokens,
    });

    return response.choices[0].message.content || "";
  }

  /**
   * Attempts to generate response with Claude
   */
  private async generateClaudeResponse(
    messages: ChatMessage[],
    systemPrompt: string,
    maxTokens: number = 1200,
    temperature: number = 0.4
  ): Promise<string> {
    const response = await anthropic.messages.create({
      // "claude-3-7-sonnet-20250219"
      model: DEFAULT_MODEL_STR,
      system: systemPrompt,
      messages: messages.map(msg => ({
        role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      })),
      temperature,
      max_tokens: maxTokens,
    });

    return response.content[0].type === 'text' ? response.content[0].text : "";
  }

  /**
   * Generates response with automatic fallback between OpenAI and Claude
   */
  async generateResponseWithFallback(
    messages: ChatMessage[],
    systemPrompt: string,
    context?: {
      maxTokens?: number;
      temperature?: number;
      forceModel?: 'openai' | 'claude';
    }
  ): Promise<{ content: string; usedModel: 'openai' | 'claude'; hadFallback: boolean }> {
    const requestType = this.determineRequestType(messages);
    const preferences = MODEL_PREFERENCES[requestType];
    
    const maxTokens = context?.maxTokens || (preferences.preferredModel === 'claude' ? 1200 : 300);
    const temperature = context?.temperature || (preferences.preferredModel === 'claude' ? 0.4 : 0.3);
    
    // Force specific model if requested
    if (context?.forceModel) {
      try {
        if (context.forceModel === 'openai') {
          const content = await this.generateOpenAIResponse(messages, systemPrompt, maxTokens, temperature);
          return { content, usedModel: 'openai', hadFallback: false };
        } else {
          const content = await this.generateClaudeResponse(messages, systemPrompt, maxTokens, temperature);
          return { content, usedModel: 'claude', hadFallback: false };
        }
      } catch (error) {
        console.error(`❌ Forced ${context.forceModel} model failed:`, error);
        throw error;
      }
    }

    // Try preferred model first
    try {
      console.log(`🤖 Using ${preferences.preferredModel.toUpperCase()} for ${requestType} request`);
      
      if (preferences.preferredModel === 'openai') {
        const content = await this.generateOpenAIResponse(messages, systemPrompt, maxTokens, temperature);
        return { content, usedModel: 'openai', hadFallback: false };
      } else {
        const content = await this.generateClaudeResponse(messages, systemPrompt, maxTokens, temperature);
        return { content, usedModel: 'claude', hadFallback: false };
      }
    } catch (primaryError) {
      console.warn(`⚠️ ${preferences.preferredModel.toUpperCase()} failed, falling back to ${preferences.fallbackModel.toUpperCase()}:`, primaryError);
      
      // Try fallback model
      try {
        if (preferences.fallbackModel === 'openai') {
          const content = await this.generateOpenAIResponse(messages, systemPrompt, maxTokens, temperature);
          return { content, usedModel: 'openai', hadFallback: true };
        } else {
          const content = await this.generateClaudeResponse(messages, systemPrompt, maxTokens, temperature);
          return { content, usedModel: 'claude', hadFallback: true };
        }
      } catch (fallbackError) {
        console.error(`❌ Both AI models failed:`, { primaryError, fallbackError });
        throw new Error(`Both AI services are experiencing difficulties. Primary (${preferences.preferredModel}): ${primaryError.message}. Fallback (${preferences.fallbackModel}): ${fallbackError.message}`);
      }
    }
  }

  /**
   * Get current model configuration summary
   */
  getModelConfiguration(): Record<string, any> {
    return {
      openai_model: "gpt-4.1-mini",
      claude_model: DEFAULT_MODEL_STR,
      preferences: MODEL_PREFERENCES,
      fallback_enabled: true
    };
  }
}

export const aiFallbackService = new AIFallbackService();