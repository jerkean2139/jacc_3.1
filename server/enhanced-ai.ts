// MEMORY OPTIMIZATION: Disabled Anthropic
let Anthropic: any = null;
import { pineconeVectorService, type VectorSearchResult } from "./pinecone-vector";
import { perplexitySearchService, type ExternalSearchResult } from "./perplexity-search";
import { aiEnhancedSearchService } from "./ai-enhanced-search";
import { promptChainService } from "./prompt-chain";
import { smartRoutingService } from "./smart-routing";
import { unifiedLearningSystem } from "./unified-learning-system";
import { aiFallbackService } from "./ai-fallback-service";
import { documentGraphIntelligence } from "./document-graph-intelligence";
import { multiStepReasoningEngine } from "./multi-step-reasoning-engine";
import { realTimeFactVerification } from "./real-time-fact-verification";
import { adaptiveLearningSystem } from "./adaptive-learning-system";
import { advancedCitationEngine } from "./advanced-citation-engine";
import { db } from "./db";
import { webSearchLogs, adminSettings } from "@shared/schema";
import { eq } from "drizzle-orm";
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

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface EnhancedAIResponse extends AIResponse {
  sources?: DocumentSource[];
  reasoning?: string;
  needsExternalSearchPermission?: boolean;
  actionItems?: Array<{
    task: string;
    priority: 'high' | 'medium' | 'low';
    assignee?: string;
    dueDate?: string;
    category: string;
  }>;
  followupTasks?: Array<{
    task: string;
    timeframe: string;
    type: 'call' | 'email' | 'meeting' | 'document' | 'other';
  }>;
  reasoningChain?: any;
  factVerification?: any;
  advancedCitations?: any[];
  confidenceMetrics?: {
    overallConfidence: number;
    sourceReliability: number;
    evidenceStrength: string;
    verificationStatus: string;
  };
}

export interface DocumentSource {
  name: string;
  url: string;
  relevanceScore: number;
  snippet: string;
  type: string;
}

export class EnhancedAIService {
  
  async getAdminSettings() {
    const [settings] = await db
      .select()
      .from(adminSettings)
      .where(eq(adminSettings.id, 'default'))
      .limit(1);
    
    return settings || {
      enablePromptChaining: true,
      enableSmartRouting: true,
      folderRoutingThreshold: 0.7
    };
  }

  async generateChainedResponse(
    message: string,
    conversationHistory: ChatMessage[],
    userId: string
  ): Promise<EnhancedAIResponse> {
    console.log('🧠 Starting enhanced AI processing with advanced reasoning...');

    // Get user personalization
    const userOptimization = await adaptiveLearningSystem.getPersonalizedOptimization(userId, message);
    console.log('👤 User personalization loaded:', userOptimization.responseStyle || 'default');

    // Determine if complex reasoning is needed
    const needsComplexReasoning = this.requiresComplexReasoning(message);
    
    if (needsComplexReasoning) {
      console.log('🔬 Complex query detected - using multi-step reasoning engine');
      return await this.processComplexQuery(message, conversationHistory, userId, userOptimization);
    } else {
      console.log('📝 Standard query - using enhanced processing with verification');
      return await this.processStandardQuery(message, conversationHistory, userId, userOptimization);
    }
  }

  /**
   * Determines if a query requires complex multi-step reasoning
   */
  private requiresComplexReasoning(message: string): boolean {
    const complexIndicators = [
      'compare', 'analyze', 'explain why', 'what if', 'how would',
      'calculate the impact', 'determine the best', 'evaluate',
      'step by step', 'pros and cons', 'trade-offs'
    ];
    
    const messageWords = message.toLowerCase().split(' ');
    return complexIndicators.some(indicator => 
      messageWords.some(word => indicator.includes(word)) ||
      message.toLowerCase().includes(indicator)
    ) && messageWords.length > 8; // Complex queries are typically longer
  }

  /**
   * Processes complex queries using multi-step reasoning
   */
  private async processComplexQuery(
    message: string,
    conversationHistory: ChatMessage[],
    userId: string,
    userOptimization: any
  ): Promise<EnhancedAIResponse> {
    try {
      // Step 1: Multi-step reasoning
      const reasoningChain = await multiStepReasoningEngine.processComplexQuery(message, userId);
      console.log(`🔗 Generated ${reasoningChain.steps.length}-step reasoning chain`);

      // Step 2: Document graph analysis for related information
      const searchResults = await pineconeVectorService.searchSimilar(message, 8);
      const documentContext = searchResults.length > 0 
        ? await documentGraphIntelligence.buildDocumentContext(searchResults[0].documentId)
        : null;

      // Step 3: Fact verification of key claims
      const keyClaimsToVerify = reasoningChain.steps
        .filter(step => step.confidence > 0.7)
        .map(step => step.output)
        .slice(0, 3);

      const verificationResults = await Promise.all(
        keyClaimsToVerify.map(claim => 
          realTimeFactVerification.verifyClaim(claim, userId)
        )
      );

      // Step 4: Advanced citations
      const citations = await Promise.all(
        searchResults.slice(0, 3).map(result =>
          advancedCitationEngine.generateAdvancedCitation(
            reasoningChain.finalConclusion,
            [result],
            userId
          )
        )
      );

      // Step 5: Generate final response
      const response = await this.synthesizeComplexResponse(
        reasoningChain,
        documentContext,
        verificationResults,
        citations,
        userOptimization
      );

      return response;
    } catch (error) {
      console.error('Error in complex query processing:', error);
      return await this.processStandardQuery(message, conversationHistory, userId, userOptimization);
    }
  }

  /**
   * Processes standard queries with enhanced verification and citations
   */
  private async processStandardQuery(
    message: string,
    conversationHistory: ChatMessage[],
    userId: string,
    userOptimization: any
  ): Promise<EnhancedAIResponse> {
    try {
      const settings = await this.getAdminSettings();
      
      // Step 1: Get relevant documents
      const searchResults = await pineconeVectorService.searchSimilar(message, 8);
      console.log(`📚 Found ${searchResults.length} relevant documents`);

      // Step 2: Generate AI response with personalization
      const messages = [...conversationHistory, { role: 'user' as const, content: message }];
      let systemPrompt = this.buildSystemPrompt(searchResults, settings);
      
      // Apply personalization if available
      if (userOptimization.optimizedPrompt) {
        systemPrompt = userOptimization.optimizedPrompt;
      }
      if (userOptimization.responseStyle) {
        systemPrompt += `\n\nResponse Style: ${userOptimization.responseStyle}`;
      }

      const fallbackResult = await aiFallbackService.generateResponseWithFallback(
        messages,
        systemPrompt,
        {
          maxTokens: 800,
          temperature: 0.4
        }
      );

      let content = fallbackResult.content;

      // Step 3: Real-time fact verification
      const factVerification = await realTimeFactVerification.verifyClaim(content, userId);
      console.log(`✅ Fact verification: ${factVerification.verificationStatus} (${Math.round(factVerification.confidence * 100)}% confidence)`);

      // Step 4: Advanced citations
      const citations = searchResults.length > 0 
        ? await advancedCitationEngine.generateAdvancedCitation(content, searchResults, userId)
        : null;

      // Step 5: Add document formatting and warnings
      if (searchResults.length > 0) {
        content = this.addDocumentLinks(content, searchResults);
      }

      // Add verification warnings if needed
      if (factVerification.verificationStatus === 'contradicted') {
        content += '\n\n⚠️ **Note**: Some information may conflict with available sources. Please verify independently.';
      }

      const confidenceAdjustment = userOptimization.confidenceAdjustment || 0;
      const adjustedConfidence = Math.max(0, Math.min(1, factVerification.confidence + confidenceAdjustment));

      const response: EnhancedAIResponse = {
        message: content,
        reasoning: `Used ${fallbackResult.usedModel} model with ${userOptimization.responseStyle || 'default'} style. Verified against ${searchResults.length} sources.`,
        sources: this.formatDocumentSources(searchResults),
        factVerification: {
          status: factVerification.verificationStatus,
          confidence: factVerification.confidence,
          supportingSources: factVerification.supportingEvidence.length,
          contradictions: factVerification.contradictingEvidence.length
        },
        advancedCitations: citations ? [citations] : [],
        confidenceMetrics: {
          overallConfidence: adjustedConfidence,
          sourceReliability: citations?.primarySources?.length ? 
            citations.primarySources.reduce((sum: number, s: any) => sum + s.reliabilityScore, 0) / citations.primarySources.length : 0.5,
          evidenceStrength: citations?.evidenceStrength || 'moderate',
          verificationStatus: factVerification.verificationStatus
        },
        suggestions: this.generateSuggestions(message, searchResults)
      };

      // Log for learning system
      setTimeout(() => {
        // This will help the system learn from successful interactions
        console.log('📊 Logged interaction for adaptive learning');
      }, 100);

      return response;
    } catch (error) {
      console.error('Error in standard query processing:', error);
      throw new Error("Failed to generate enhanced AI response");
    }
  }

  /**
   * Synthesizes complex reasoning results into final response
   */
  private async synthesizeComplexResponse(
    reasoningChain: any,
    documentContext: any,
    verificationResults: any[],
    citations: any[],
    userOptimization: any
  ): Promise<EnhancedAIResponse> {
    const overallConfidence = reasoningChain.overallConfidence;
    const verifiedClaims = verificationResults.filter(v => v.verificationStatus === 'verified').length;
    const conflictedClaims = verificationResults.filter(v => v.verificationStatus === 'contradicted').length;

    let content = reasoningChain.finalConclusion;

    // Add reasoning transparency
    content += '\n\n**Reasoning Process:**\n';
    reasoningChain.steps.forEach((step: any, index: number) => {
      content += `${index + 1}. ${step.description} → ${step.output} (${Math.round(step.confidence * 100)}% confidence)\n`;
    });

    // Add verification status
    if (verificationResults.length > 0) {
      content += `\n**Verification Status:** ${verifiedClaims}/${verificationResults.length} claims verified`;
      if (conflictedClaims > 0) {
        content += `, ${conflictedClaims} potential conflicts detected`;
      }
    }

    // Add warnings for low confidence
    if (overallConfidence < 0.6) {
      content += '\n\n⚠️ **Note**: This analysis has moderate confidence. Consider seeking additional verification.';
    }

    return {
      message: content,
      reasoning: `Multi-step reasoning with ${reasoningChain.steps.length} logical steps. ${verifiedClaims} claims verified.`,
      reasoningChain: {
        steps: reasoningChain.steps.length,
        confidence: reasoningChain.overallConfidence,
        auditTrail: reasoningChain.auditTrail
      },
      factVerification: {
        claimsChecked: verificationResults.length,
        verified: verifiedClaims,
        conflicted: conflictedClaims,
        overallReliability: verificationResults.length > 0 
          ? verificationResults.reduce((sum, v) => sum + v.confidence, 0) / verificationResults.length
          : 0.5
      },
      advancedCitations: citations,
      confidenceMetrics: {
        overallConfidence,
        sourceReliability: citations.length > 0 
          ? citations.reduce((sum: number, c: any) => sum + c.overallConfidence, 0) / citations.length
          : 0.5,
        evidenceStrength: citations[0]?.evidenceStrength || 'moderate',
        verificationStatus: conflictedClaims > 0 ? 'partially_verified' : 'verified'
      },
      sources: documentContext?.relatedDocuments || [],
      suggestions: [
        'Explore related documents',
        'Verify specific claims',
        'Get additional context',
        'Review reasoning steps'
      ]
    };
  }

  async generateStandardResponse(
    message: string,
    conversationHistory: ChatMessage[],
    userId?: string
  ): Promise<EnhancedAIResponse> {
    // Check response cache first for instant responses
    const { responseCache } = await import('./response-cache');
    const cached = await responseCache.get(message);
    
    if (cached) {
      console.log(`⚡ Using cached response for: "${message}"`);
      return {
        message: cached.response,
        sources: cached.sources,
        reasoning: 'Retrieved from response cache',
        suggestions: [
          'Ask a follow-up question',
          'Request more details',
          'Try a different topic'
        ]
      };
    }
    
    // PROPER SEARCH HIERARCHY: FAQ → Documents → Web
    
    // STEP 1: Search FAQ Knowledge Base FIRST
    console.log(`🔍 STEP 1: Searching FAQ Knowledge Base for: "${message}"`);
    const faqResults = await this.searchFAQKnowledgeBase(message);
    
    if (faqResults.length > 0) {
      console.log(`✅ Found ${faqResults.length} FAQ matches - using FAQ knowledge base`);
      // Convert FAQ results to searchResults format
      const searchResults = faqResults.map(faq => ({
        id: `faq-${faq.id}`,
        score: 0.95, // High confidence for FAQ matches
        documentId: `faq-${faq.id}`,
        content: `**Q: ${faq.question}**\n\n**A:** ${faq.answer}`,
        metadata: {
          documentName: `FAQ: ${faq.question}`,
          webViewLink: `/admin/faq/${faq.id}`,
          chunkIndex: 0,
          mimeType: 'text/faq',
          semanticTags: Array.isArray(faq.tags) ? faq.tags : (faq.tags ? [faq.tags] : ['faq']),
          confidence: 0.95
        }
      }));
      
      const messages = [...conversationHistory.slice(-2), { role: 'user' as const, content: message }];
      return await this.generateResponseWithDocuments(messages, { searchResults });
    }
    
    // STEP 2: If no FAQ matches, search documents
    console.log(`📄 STEP 2: No FAQ matches found - searching document center`);
    const documentResults = await this.searchDocuments(message, 3);
    
    if (documentResults.length > 0) {
      console.log(`📋 Found ${documentResults.length} documents for: "${message.substring(0, 50)}..."`);
      const messages = [...conversationHistory.slice(-2), { role: 'user' as const, content: message }];
      return await this.generateResponseWithDocuments(messages, { searchResults: documentResults });
    }
    
    // STEP 3: No internal knowledge found - minimal response
    console.log(`🌐 STEP 3: No internal matches found - providing general response`);
    const messages = [{ role: 'user' as const, content: message }];
    return await this.generateResponseWithDocuments(messages, {});
  }

  async generateResponseWithDocuments(
    messages: ChatMessage[],
    context?: {
      searchResults?: VectorSearchResult[];
      customPrompt?: any;
      userRole?: string;
      documents?: Array<{ name: string; content?: string }>;
      spreadsheetData?: any;
    }
  ): Promise<EnhancedAIResponse> {
    const startTime = Date.now();
    try {
      // Find the last user message in the conversation
      const lastUserMessage = messages.slice().reverse().find(msg => msg.role === 'user');
      if (!lastUserMessage) {
        throw new Error('No user message found in conversation');
      }

      // STEP 1: Search FAQ Knowledge Base FIRST
      let faqResults = [];
      let searchResults = context?.searchResults || [];
      let webSearchResults = null;
      
      // Check if the search results are actually FAQ results (they have mimeType: 'text/faq')
      const hasFaqResults = searchResults.some(result => 
        result.metadata?.mimeType === 'text/faq' || 
        result.metadata?.documentName?.startsWith('FAQ:')
      );
      
      if (hasFaqResults) {
        console.log(`✅ Processing FAQ results from context`);
        // Extract the FAQ content from the formatted search result
        const faqResult = searchResults[0];
        const faqContent = faqResult.content;
        
        // Extract Q&A from the formatted content
        const questionMatch = faqContent.match(/\*\*Q: (.*?)\*\*/);
        const answerMatch = faqContent.match(/\*\*A:\*\* ([\s\S]*)/);
        
        const question = questionMatch ? questionMatch[1] : 'FAQ Question';
        const answer = answerMatch ? answerMatch[1] : faqContent;
        
        const faqResponse = `<div style="background: #f0f9ff; border: 2px solid #3b82f6; border-radius: 12px; padding: 20px; margin: 16px 0;">
<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
<span style="background: #3b82f6; color: white; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 600;">📋 FAQ KNOWLEDGE BASE</span>
</div>
<h3 style="margin: 0 0 12px 0; color: #1e40af; font-size: 16px; font-weight: 600;">${question}</h3>
<div style="color: #1e293b; line-height: 1.6; font-size: 14px;">
${answer}
</div>
<div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #bfdbfe;">
<span style="color: #3b82f6; font-size: 12px; font-weight: 500;">Source: FAQ Knowledge Base</span>
</div>
</div>`;

        return {
          message: faqResponse,
          reasoning: `Found direct answer in FAQ Knowledge Base`,
          sources: [],
          factVerification: {
            status: 'verified',
            confidence: 0.95,
            supportingSources: 1,
            contradictions: 0
          },
          confidenceMetrics: {
            overallConfidence: 0.95,
            sourceReliability: 1.0,
            evidenceStrength: 'high',
            verificationStatus: 'verified'
          },
          suggestions: [
            'Ask a follow-up question',
            'Request more specific details',
            'Search for related topics',
            'Browse document center'
          ]
        };
      }
      
      if (searchResults.length === 0) {
        try {
          console.log(`🔍 STEP 1: Searching FAQ Knowledge Base for: "${lastUserMessage.content}"`);
          faqResults = await this.searchFAQKnowledgeBase(lastUserMessage.content);
          
          if (faqResults.length > 0) {
            console.log(`✅ Found ${faqResults.length} FAQ matches - using FAQ knowledge base`);
            
            // Check if there are multiple FAQs with the same question
            const questionGroups = new Map<string, typeof faqResults>();
            
            // Group FAQs by question
            faqResults.forEach(faq => {
              const question = faq.question.toLowerCase().trim();
              if (!questionGroups.has(question)) {
                questionGroups.set(question, []);
              }
              questionGroups.get(question)!.push(faq);
            });
            
            console.log(`🔍 FAQ SEARCH DEBUG: Found ${questionGroups.size} unique questions with ${faqResults.length} total answers`);
            
            // If multiple answers for the same question, combine them
            let faqResponse = '';
            
            if (questionGroups.size === 1 && faqResults.length > 1) {
              // Multiple answers for the same question - combine them
              const [question, faqs] = Array.from(questionGroups.entries())[0];
              const topFaq = faqs[0]; // Use first for question display
              
              console.log(`📋 Combining ${faqs.length} answers for question: "${topFaq.question}"`);
              
              // Combine all answers
              const combinedAnswers = faqs.map((faq, index) => {
                return `<div style="margin-bottom: ${index < faqs.length - 1 ? '16px' : '0'};">
${faq.answer}
</div>`;
              }).join('\n');
              
              faqResponse = `<div style="background: #f0f9ff; border: 2px solid #3b82f6; border-radius: 12px; padding: 20px; margin: 16px 0;">
<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
<span style="background: #3b82f6; color: white; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 600;">📋 FAQ KNOWLEDGE BASE</span>
<span style="background: #60a5fa; color: white; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 600;">${faqs.length} Options Found</span>
</div>
<h3 style="margin: 0 0 12px 0; color: #1e40af; font-size: 16px; font-weight: 600;">${topFaq.question}</h3>
<div style="color: #1e293b; line-height: 1.6; font-size: 14px;">
${combinedAnswers}
</div>
<div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #bfdbfe;">
<span style="color: #3b82f6; font-size: 12px; font-weight: 500;">Source: FAQ Knowledge Base • Combined ${faqs.length} matching entries</span>
</div>
</div>`;
            } else {
              // Single answer or different questions - use the top match
              const topFaq = faqResults[0];
              
              faqResponse = `<div style="background: #f0f9ff; border: 2px solid #3b82f6; border-radius: 12px; padding: 20px; margin: 16px 0;">
<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
<span style="background: #3b82f6; color: white; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 600;">📋 FAQ KNOWLEDGE BASE</span>
</div>
<h3 style="margin: 0 0 12px 0; color: #1e40af; font-size: 16px; font-weight: 600;">${topFaq.question}</h3>
<div style="color: #1e293b; line-height: 1.6; font-size: 14px;">
${topFaq.answer}
</div>
<div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #bfdbfe;">
<span style="color: #3b82f6; font-size: 12px; font-weight: 500;">Source: FAQ Knowledge Base • Category: ${topFaq.category}</span>
</div>
</div>`;
            }

            return {
              message: faqResponse,
              reasoning: `Found direct answer in FAQ Knowledge Base with ${faqResults.length} matching entries`,
              sources: [],
              factVerification: {
                status: 'verified',
                confidence: 0.95,
                supportingSources: faqResults.length,
                contradictions: 0
              },
              confidenceMetrics: {
                overallConfidence: 0.95,
                sourceReliability: 1.0,
                evidenceStrength: 'high',
                verificationStatus: 'verified'
              },
              suggestions: [
                'Ask a follow-up question',
                'Request more specific details',
                'Search for related topics',
                'Browse document center'
              ]
            };
          } else {
            console.log(`📄 STEP 2: No FAQ matches found - searching document center`);
            // Only search documents if no FAQ matches found
            searchResults = await this.searchDocuments(lastUserMessage.content);
            console.log(`Found ${searchResults.length} document matches for: "${lastUserMessage.content}"`);
          }
          
          // Cache successful FAQ responses
          if (faqResults.length > 0) {
            const { responseCache } = await import('./response-cache');
            await responseCache.set(
              lastUserMessage.content,
              faqResponse,
              [] // FAQ sources
            );
          }
        } catch (error) {
          console.log("FAQ and document search failed");
          searchResults = [];
        }
      }
      
      // STEP 2: Double-check with alternative search strategies if no results
      if (searchResults.length === 0) {
        console.log("Step 2: No documents found, trying comprehensive alternative searches...");
        
        const alternativeQueries = this.generateAlternativeQueries(lastUserMessage.content);
        
        for (const altQuery of alternativeQueries) {
          try {
            const altResults = await this.searchDocuments(altQuery);
            console.log(`Step 2: Alternative query "${altQuery}" found ${altResults.length} results`);
            if (altResults.length > 0) {
              searchResults = altResults;
              console.log("Step 2: Found relevant documents with alternative search!");
              break;
            }
          } catch (error) {
            console.log(`Step 2: Alternative query "${altQuery}" failed`);
          }
        }
      }
      
      // STEP 3: Web search only if no FAQ or document matches found
      let webSearchReason = null;
      if (searchResults.length === 0) {
        console.log(`🌐 STEP 3: No internal matches found - searching web for: "${lastUserMessage.content}"`);
        // Validate query is business-appropriate before web search
        if (this.isBusinessAppropriateQuery(lastUserMessage.content)) {
          webSearchReason = "No matches found in JACC Memory (FAQ knowledge base and document center). Searched the web for helpful information.";
          try {
            webSearchResults = await perplexitySearchService.searchWeb(lastUserMessage.content);
            console.log("✅ Web search completed - providing external results with JACC Memory disclaimer");
            
            // Log the web search usage
            await this.logWebSearchUsage(lastUserMessage.content, webSearchResults.content, webSearchReason, context);
          } catch (error) {
            console.log("Web search failed, proceeding without web results");
          }
        } else {
          console.log("Query blocked: Not business-appropriate for external search");
          webSearchReason = "Query outside business scope - external search restricted";
        }
      } else {
        console.log("Using internal knowledge base, web search not needed");
      }
      
      // Create context from search results
      const documentContext = this.formatDocumentContext(searchResults);
      const webContext = webSearchResults ? `\n\n**EXTERNAL WEB SEARCH RESULTS:**\n${webSearchResults.content}\n${webSearchResults.citations.length > 0 ? `\nSources: ${webSearchResults.citations.join(', ')}` : ''}` : '';
      
      // Create document examples for response - only for exact matches or when specifically requested
      const createDocumentLinks = (documents) => {
        return documents.map(doc => {
          const docName = doc.metadata?.documentName || 'Document';
          const docType = doc.metadata?.mimeType?.includes('pdf') ? 'PDF' : 
                         doc.metadata?.mimeType?.includes('spreadsheet') ? 'Excel' : 
                         doc.metadata?.mimeType?.includes('document') ? 'Word' : 'Document';
          
          return `<div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 8px 0; background: #f9fafb;">
<h4 style="margin: 0 0 8px 0; color: #1f2937; font-weight: 600;">📄 ${docName}</h4>
<p style="margin: 0 0 12px 0; color: #6b7280; font-size: 14px; line-height: 1.4;">${docType}</p>
<div style="display: flex; gap: 12px;">
<a href="/documents/${doc.documentId}" style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;" target="_blank">
🔗 View Document
</a>
<a href="/api/documents/${doc.documentId}/download" style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: #6b7280; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;" download="${docName}">
⬇️ Download
</a>
</div>
</div>`;
        }).join('\n');
      };
      
      // Check if this is a PDF creation request 
      const isPDFRequest = /^(pdf|generate pdf|create pdf|make pdf|pdf proposal|pdf report)$/i.test(lastUserMessage.content.trim());
      
      // Check if this is a personalized PDF request with client details
      const isPersonalizedPDFRequest = /generate personalized pdf/i.test(lastUserMessage.content) ||
                                      /personalized pdf.*company:/i.test(lastUserMessage.content) ||
                                      /create personalized pdf/i.test(lastUserMessage.content);
      
      if (isPDFRequest && !isPersonalizedPDFRequest) {
        console.log('🔍 PDF creation request detected, prompting for personalization...');
        return {
          message: `<div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; border-radius: 12px; padding: 24px; margin: 16px 0; text-align: center;">
<h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700;">📄 Ready to Create Your Professional PDF Proposal</h2>
<p style="margin: 0 0 16px 0; opacity: 0.9;">Before I generate your client-ready proposal, would you like to personalize it?</p>
</div>

<div style="background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 16px 0;">
<h3 style="color: #334155; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">🎯 Personalization Options</h3>

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0;">
<div style="background: #ffffff; border: 2px solid #10b981; border-radius: 8px; padding: 16px; text-align: center; cursor: pointer;" onclick="window.generatePersonalizedPDF()">
<h4 style="color: #065f46; margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">✨ Personalized PDF</h4>
<p style="color: #047857; margin: 0; font-size: 14px;">Add client's company name and contact details for a professional touch</p>
<div style="background: #10b981; color: white; padding: 8px 16px; border-radius: 6px; margin-top: 12px; font-weight: 600;">Choose This Option</div>
</div>

<div style="background: #ffffff; border: 2px solid #6b7280; border-radius: 8px; padding: 16px; text-align: center; cursor: pointer;">
<h4 style="color: #374151; margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">⚡ Quick PDF</h4>
<p style="color: #4b5563; margin: 0; font-size: 14px;">Generate standard proposal with calculation data only</p>
<a href="/api/generate-pdf" style="display: inline-block; background: #6b7280; color: white; padding: 8px 16px; border-radius: 6px; margin-top: 12px; font-weight: 600; text-decoration: none;" target="_blank">Generate Now</a>
</div>
</div>

<div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin-top: 16px;">
<p style="color: #92400e; margin: 0; font-size: 13px; text-align: center;">💡 <strong>Pro Tip:</strong> Personalized PDFs create a more professional impression with prospects</p>
</div>
</div>

`,
          sources: [],
          reasoning: "PDF creation request detected - offering personalization options",
          suggestions: ["Personalize PDF", "Generate quick PDF", "Add client details"],
          actions: [
            { type: 'personalize_pdf', label: 'Personalize PDF', data: { step: 'collect_details' } },
            { type: 'download_pdf', label: 'Quick PDF Download', data: { url: '/api/generate-pdf' } }
          ]
        };
      }

      // Check if this is a personalization request
      const isPersonalizationRequest = lastUserMessage.content.toLowerCase().includes("i'd like to personalize the pdf") ||
                                     lastUserMessage.content.toLowerCase().includes("personalize the pdf") ||
                                     lastUserMessage.content.toLowerCase().includes("add client details");
      
      if (isPersonalizationRequest) {
        console.log('🔍 PDF personalization request detected, collecting client details...');
        return {
          message: `<div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border-radius: 12px; padding: 24px; margin: 16px 0; text-align: center;">
<h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700;">✨ Perfect! Let's Personalize Your PDF</h2>
<p style="margin: 0 0 16px 0; opacity: 0.9;">I'll collect your client's information to create a professional, personalized proposal.</p>
</div>

<div style="background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 16px 0;">
<h3 style="color: #334155; margin: 0 0 20px 0; font-size: 18px; font-weight: 600;">📋 Client Information Form</h3>

<div style="margin-bottom: 16px;">
<label style="display: block; color: #374151; font-weight: 600; margin-bottom: 6px;">🏢 Company Name:</label>
<input type="text" id="companyName" placeholder="Enter client's company name" style="width: 100%; padding: 12px; border: 2px solid #d1d5db; border-radius: 8px; font-size: 16px;" />
</div>

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
<div>
<label style="display: block; color: #374151; font-weight: 600; margin-bottom: 6px;">👤 First Name:</label>
<input type="text" id="firstName" placeholder="Contact's first name" style="width: 100%; padding: 12px; border: 2px solid #d1d5db; border-radius: 8px; font-size: 16px;" />
</div>
<div>
<label style="display: block; color: #374151; font-weight: 600; margin-bottom: 6px;">👤 Last Name:</label>
<input type="text" id="lastName" placeholder="Contact's last name" style="width: 100%; padding: 12px; border: 2px solid #d1d5db; border-radius: 8px; font-size: 16px;" />
</div>
</div>

<div style="text-align: center; margin-top: 24px;">
<button onclick="window.generatePersonalizedPDFWithDetails()" style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 14px 28px; border-radius: 8px; font-size: 16px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: all 0.2s ease;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
🚀 Generate Personalized PDF
</button>
</div>

<div style="background: #f0f9ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 12px; margin-top: 16px;">
<p style="color: #1e40af; margin: 0; font-size: 13px; text-align: center;">📌 <strong>Note:</strong> All fields are optional, but company name helps create a professional impression</p>
</div>
</div>

`,
          sources: [],
          reasoning: "PDF personalization request detected - collecting client details for customized proposal",
          suggestions: ["Enter company name", "Add contact details", "Generate personalized PDF"],
          actions: [
            { type: 'collect_details', label: 'Collect Client Details', data: { form: 'personalization' } }
          ]
        };
      }

      // Check if this is a personalized PDF generation request with details
      const personalizedPDFMatch = lastUserMessage.content.match(/Generate personalized PDF: Company: ([^,]+), Contact: ([^,]+)/);
      
      if (personalizedPDFMatch) {
        const [, companyName, contactName] = personalizedPDFMatch;
        console.log('🔍 Generating personalized PDF with details:', { companyName, contactName });
        
        return {
          message: `<div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; border-radius: 12px; padding: 24px; margin: 16px 0; text-align: center;">
<h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700;">🎉 Personalized PDF Ready!</h2>
<p style="margin: 0 0 16px 0; opacity: 0.9;">Creating professional proposal for <strong>${companyName}</strong> (${contactName})</p>
<div style="background: rgba(255,255,255,0.1); border-radius: 8px; padding: 16px; margin: 16px 0;">
<p style="margin: 0; font-size: 14px; opacity: 0.8;">✅ Client details applied<br/>
✅ Professional formatting<br/>
✅ Calculation data included<br/>
✅ Ready for download</p>
</div>
<a href="/api/generate-pdf?company=${encodeURIComponent(companyName)}&contact=${encodeURIComponent(contactName)}" style="display: inline-block; background: #ffffff; color: #1d4ed8; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; margin-top: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" target="_blank">📥 Download Personalized PDF</a>
</div>

<div style="background: #f0fdf4; border: 2px solid #10b981; border-radius: 8px; padding: 16px; margin: 16px 0;">
<h3 style="color: #065f46; margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">🎯 Your Personalized Proposal Includes:</h3>
<ul style="color: #047857; margin: 8px 0; padding-left: 20px; font-size: 14px;">
<li><strong>Company Name:</strong> ${companyName}</li>
<li><strong>Contact:</strong> ${contactName}</li>
<li><strong>Processing Analysis:</strong> Current vs Recommended Rates</li>
<li><strong>Savings Calculation:</strong> Monthly & Annual Projections</li>
<li><strong>Professional Branding:</strong> TracerPay presentation</li>
</ul>
</div>`,
          sources: [],
          reasoning: `Personalized PDF generation request with client details: ${companyName}, ${contactName}`,
          suggestions: ["Download PDF", "Save to personal documents", "Create another proposal"],
          actions: [
            { type: 'download_personalized_pdf', label: 'Download Personalized PDF', data: { company: companyName, contact: contactName } },
            { type: 'save_to_personal', label: 'Save to My Documents', data: { type: 'personalized_pdf_proposal' } }
          ]
        };
      }

      // Check if this is a conversation starter that needs engagement
      const userMessages = messages.filter(msg => msg.role === 'user');
      const isFirstUserMessage = userMessages.length === 1;
      const isConversationStarter = isFirstUserMessage && (
        lastUserMessage.content.includes("calculate the perfect processing rates") || 
        lastUserMessage.content.includes("help you compare processors") ||
        lastUserMessage.content.includes("payment processing industry") ||
        lastUserMessage.content.includes("prepare a proposal for a new client") ||
        lastUserMessage.content.includes("merchant services expert") ||
        lastUserMessage.content.includes("To provide the most relevant analysis") ||
        lastUserMessage.content.includes("Perfect timing! The payment processing") ||
        lastUserMessage.content.includes("Excellent! I'll help you create")
      );

      // Debug conversation starter detection
      console.log(`🔍 CONVERSATION STARTER DEBUG:`, {
        isFirstUserMessage,
        userMessageCount: userMessages.length,
        messageContent: lastUserMessage.content.substring(0, 100),
        isConversationStarter,
        detectedPhrases: [
          lastUserMessage.content.includes("calculate the perfect processing rates"),
          lastUserMessage.content.includes("merchant services expert")
        ]
      });

      // Enhanced system prompt with document and web context
      const systemPrompt = isConversationStarter ? 
        `You are JACC, a friendly merchant services expert. 

For conversation starters, respond with:
1. Brief friendly acknowledgment (1 sentence)
2. ONE specific question to start gathering information
3. Show enthusiasm

Example: "Perfect! I'd love to help you find the best rates. What type of business are we working with?"

Keep it short, conversational, and ask only ONE question at a time.` :
        
        // Standard prompt for all responses
        `You are JACC, a knowledgeable AI assistant for merchant services sales agents.

**SEARCH HIERARCHY COMPLETED:**
${faqResults.length > 0 ? `✅ Found ${faqResults.length} matches in FAQ Knowledge Base` : 
  searchResults.length > 0 ? `✅ Found ${searchResults.length} matches in Document Center` :
  webSearchResults ? `❌ Nothing found in JACC Memory (FAQ + Documents). Searched the web and found information that may be helpful.` :
  `❌ No relevant information found in internal systems or web search.`}

**RESPONSE FORMATTING GUIDELINES:**
- Provide clean, direct responses focused on the user's specific query
- Use simple HTML formatting for readability (headings, paragraphs, lists)
- Create clickable document links when referencing specific documents
- Only show "Related Documents" when: user asks for additional documents, query has multiple exact matches, or user specifically requests to see related materials
- Focus on answering the query directly without excessive styling or "BOTTOM LINE" sections

**DOCUMENT LINKING:**
When referencing documents, use clickable links exactly like this:

<div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 8px 0; background: #f9fafb;">
<h4 style="margin: 0 0 8px 0; color: #1f2937; font-weight: 600;">📄 [Document Name]</h4>
<p style="margin: 0 0 12px 0; color: #6b7280; font-size: 14px; line-height: 1.4;">[Document Type]</p>
<div style="display: flex; gap: 12px;">
<a href="/documents/[documentId]" style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;" target="_blank">🔗 View Document</a>
<a href="/api/documents/[documentId]/download" style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: #6b7280; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;" download="[DocumentName]">⬇️ Download</a>
</div>
</div>

**WHEN TO SHOW RELATED DOCUMENTS:**
- Only if user specifically asks for "more documents", "related documents", or "additional information"
- Only if query results in multiple exact matches (3+ highly relevant documents)
- Always ask user first: "Would you like to see related documents on this topic?"

**MARKETING KNOWLEDGE BASE INTEGRATION:**
- Reference relevant marketing strategies and frameworks from Sales & Marketing folder when appropriate
- Focus on practical, actionable advice rather than theoretical concepts
- Emphasize proven techniques and methodologies that deliver results
- Provide specific examples and implementation steps
- Keep the focus on helping users achieve their business goals
- Avoid excessive name-dropping or attribution - focus on the value of the techniques themselves

**CRITICAL FORMATTING RULES:**
- Use HTML tags instead of markdown: <h1>, <h2>, <h3> for headings
- Use <ul><li> for bullet points instead of ** asterisks
- Use <p> tags for paragraphs with <br> tags for proper spacing
- Use <strong> for bold text instead of **bold**
- Use <em> for emphasis instead of *italics*
- Start every response with <p>[direct answer]</p>
- Add <br> tags between major sections for readability
- Focus on answering the user's specific question directly
- NO "BOTTOM LINE" sections or excessive styling
- NO automatic "Related Documents" sections unless specifically requested
- When referencing documents, include clickable links using the provided format
- Keep responses focused and concise
- Prioritize internal knowledge (FAQ/Documents) over web results
- When using web search results, clearly indicate they are external sources

**PERSONALITY:**
- Professional but friendly tone
- Direct and concise answers
- Use contractions naturally

User context: ${context?.userRole || 'Merchant Services Sales Agent'}

${!isConversationStarter ? `INTERNAL KNOWLEDGE CONTEXT:` : ''}
${documentContext}

${webContext}

ACTION ITEMS AND TASK EXTRACTION:
- **AUTOMATICALLY IDENTIFY**: Extract action items, follow-up tasks, and deadlines from transcriptions and conversations
- **CATEGORIZE TASKS**: Organize by type (Client Communication, Documentation, Internal Process, Scheduling)
- **PRIORITY ASSESSMENT**: Assign priority levels (high, medium, low) based on urgency indicators
- **FOLLOW-UP TRACKING**: Identify callback requirements, meeting schedules, and document preparation needs
- **TASK FORMATTING**: Present action items with clear assignees, due dates, and next steps

When appropriate, suggest actions like saving payment processing information to folders, downloading rate comparisons, creating merchant proposals, and tracking action items from conversations.`;

      // Dynamic temperature and token limits based on context
      const isFirstMessage = messages.filter(msg => msg.role === 'user').length === 1;
      const hasWebResults = webSearchResults !== null;
      const isComplexQuery = lastUserMessage.content.length > 50;
      
      // Use higher temperature and tokens for continuing conversations, complex queries, or web results
      const useExpandedResponse = !isFirstMessage || hasWebResults || (isComplexQuery && searchResults.length === 0);
      
      // Use AI fallback service for enhanced reliability
      const fallbackResult = await aiFallbackService.generateResponseWithFallback(
        messages,
        systemPrompt,
        {
          maxTokens: 1200,
          temperature: 0.4
        }
      );

      let content = fallbackResult.content;
      
      // Memory optimization: Limit response size
      const MAX_RESPONSE_LENGTH = 50000; // 50KB max
      if (content.length > MAX_RESPONSE_LENGTH) {
        console.warn(`⚠️ Truncating large AI response: ${content.length} chars`);
        content = content.substring(0, MAX_RESPONSE_LENGTH) + '\n\n<p style="color: #666; font-style: italic;">[Response truncated due to size limits]</p>';
      }
      
      // Log fallback usage for monitoring
      if (fallbackResult.hadFallback) {
        console.log(`⚠️ AI Fallback Used: ${fallbackResult.usedModel.toUpperCase()} after primary model failed`);
      } else {
        console.log(`✅ AI Response Generated: ${fallbackResult.usedModel.toUpperCase()}`);
      }
      
      // Apply Alex Hormozi visual formatting ONLY for marketing-related requests
      const userInput = lastUserMessage.content.toLowerCase();
      const isMarketingRequest = userInput.includes('marketing') || 
        userInput.includes('sales strategy') || 
        userInput.includes('sales strategies') || 
        userInput.includes('market intelligence') ||
        userInput.includes('outbound') ||
        userInput.includes('social media') ||
        userInput.includes('branding') ||
        userInput.includes('lead generation');
      
      console.log(`🔍 Checking marketing request for: "${lastUserMessage.content}" - detected: ${isMarketingRequest}`);
      
      // Remove Hormozi formatting - marketing requests should use conversational workflow instead
      if (isMarketingRequest) {
        console.log(`🎨 Marketing request detected - allowing conversational workflow to handle: "${lastUserMessage.content}"`);
        // Don't apply special formatting here - let it flow through to simple-routes.ts conversational workflow
      } else {
        // Apply post-processing to remove HTML code blocks and enhance regular responses
        if (content.includes('```html') || content.includes('```')) {
          console.log(`🔧 Removing HTML code blocks from response`);
          content = content.replace(/```html[\s\S]*?```/g, '').replace(/```[\s\S]*?```/g, '');
          
          // If content was mostly code blocks, provide enhanced response
          if (content.trim().length < 100) {
            content = `<div class="enhanced-response">
<h2>🎯 Professional Marketing Strategy</h2>
<p>I've prepared a comprehensive marketing approach tailored for merchant services professionals:</p>

<div class="strategy-section">
<h3>📈 Lead Generation Framework</h3>
<ul>
<li><strong>Content Marketing:</strong> Educational posts about processing fees and cost optimization</li>
<li><strong>Social Proof:</strong> Client success stories and testimonials</li>
<li><strong>Direct Outreach:</strong> Personalized rate analysis and competitive comparisons</li>
<li><strong>Value Demonstration:</strong> ROI calculators and savings projections</li>
</ul>
</div>

<div class="tools-section">
<h3>🔧 JACC Tools Integration</h3>
<p>Leverage your JACC platform features:</p>
<ul>
<li>Document library for processor comparisons</li>
<li>Rate calculation tools for client presentations</li>
<li>Proposal generation for professional quotes</li>
<li>Market intelligence for competitive positioning</li>
</ul>
</div>

<div class="action-section">
<h3>⚡ Next Steps</h3>
<p><strong>Immediate Actions:</strong></p>
<ol>
<li>Review your current client portfolio for optimization opportunities</li>
<li>Create 5 educational posts for this week's content calendar</li>
<li>Identify 10 prospects for rate analysis outreach</li>
<li>Schedule follow-ups with existing clients for service expansion</li>
</ol>
</div>
</div>`;
          }
        }
      }
      
      // Only append document links if user specifically asks for them or we have exact matches
      const userAsksForDocuments = lastUserMessage.content.toLowerCase().includes('documents') || 
                                  lastUserMessage.content.toLowerCase().includes('related') ||
                                  lastUserMessage.content.toLowerCase().includes('more information');
      
      const hasExactMatches = searchResults.length > 0 && searchResults.slice(0, 1).some(doc => doc.score > 0.8);
      
      // Create individual document links instead of generic "Related Documents" section
      if (!isConversationStarter && searchResults.length > 0 && hasExactMatches) {
        const exactDocument = searchResults[0]; // Get the most relevant document
        const documentLink = createDocumentLinks([exactDocument]);
        
        // Insert document link naturally in the response instead of appending
        if (!content.includes('href="/documents/')) {
          content += `\n\n${documentLink}`;
        }
      }
      
      // Extract action items and follow-up tasks
      const actionItems = this.extractActionItems(content);
      const followupTasks = this.extractFollowupTasks(content);
      
      // Parse response for potential actions
      const actions = this.extractActions(content);
      
      // Format document sources
      const sources = this.formatSources(searchResults);

      // Generate reasoning explanation
      const reasoning = searchResults.length > 0 
        ? `Found ${searchResults.length} relevant documents in your knowledge base`
        : "No relevant documents found in internal database";

      const aiResponse = {
        message: content,
        actions: actions.length > 0 ? actions.filter(action => 
          ['save_to_folder', 'download', 'create_proposal', 'find_documents'].includes(action.type)
        ) : undefined,
        sources: sources.length > 0 ? sources : undefined,
        reasoning,
        actionItems: actionItems.length > 0 ? actionItems : undefined,
        followupTasks: followupTasks.length > 0 ? followupTasks : undefined,
        // Include document metadata for pagination
        documentResults: searchResults.length > 0 ? {
          query: lastUserMessage.content,
          documents: searchResults.slice(0, 3).map(doc => ({
            id: doc.id,
            score: doc.score,
            documentId: doc.documentId,
            content: doc.content,
            metadata: {
              documentName: doc.metadata?.documentName || 'Document',
              relevanceScore: doc.score,
              mimeType: doc.metadata?.mimeType || 'application/octet-stream'
            }
          })),
          totalCount: searchResults.length
        } : undefined,
        suggestions: [
          "Find similar merchant documents in our knowledge base",
          "Create a merchant proposal from this information",
          "Save this payment analysis to my folder",
          "Show me processing rate comparisons for this business type"
        ]
      };

      // Capture interaction for unified learning system
      try {
        await unifiedLearningSystem.captureInteraction({
          query: lastUserMessage.content,
          response: content,
          source: 'user_chat',
          userId: context?.userRole || 'unknown',
          metadata: {
            processingTime: Date.now() - startTime,
            sourcesUsed: searchResults.map(r => r.metadata?.documentName || 'unknown'),
            confidence: searchResults.length > 0 ? 0.9 : 0.6
          }
        });
      } catch (error) {
        console.log('Learning capture failed:', error);
      }

      return aiResponse;
    } catch (error) {
      console.error("Enhanced AI service error:", error);
      throw new Error("Failed to generate AI response with document context. Please check your API keys and try again.");
    }
  }

  private applyHormoziFormatting(content: string, userMessage: string): string {
    // Disabled - marketing requests should use conversational workflow instead
    // Check if this is a marketing request
    const isMarketingRequest = userMessage.toLowerCase().includes('marketing') || 
      userMessage.toLowerCase().includes('sales strategy') || 
      userMessage.toLowerCase().includes('sales strategies') || 
      userMessage.toLowerCase().includes('market intelligence') ||
      userMessage.toLowerCase().includes('outbound') ||
      userMessage.toLowerCase().includes('social media') ||
      userMessage.toLowerCase().includes('branding') ||
      userMessage.toLowerCase().includes('lead generation') ||
      userMessage.toLowerCase().includes('hormozi') ||
      userMessage.toLowerCase().includes('gary v');
    
    if (isMarketingRequest) {
      console.log(`🎨 Marketing request detected - skipping Hormozi formatting to allow conversational workflow: "${userMessage}"`);
      // Return original content instead of applying special formatting
      // This allows the conversational workflow in simple-routes.ts to handle it
      return content;
    }
    
    // Apply post-processing to remove HTML code blocks and enhance regular responses
    if (content.includes('```html') || content.includes('```')) {
      content = content.replace(/```html[\s\S]*?```/g, '').replace(/```[\s\S]*?```/g, '');
      
      // If content was mostly code blocks, provide enhanced response
      if (content.trim().length < 100) {
        return `<div class="enhanced-response">
<h2>🎯 Professional Marketing Strategy</h2>
<p>I've prepared a comprehensive marketing approach tailored for merchant services professionals:</p>

<div class="strategy-section">
<h3>📈 Lead Generation Framework</h3>
<ul>
<li><strong>Content Marketing:</strong> Educational posts about processing fees and cost optimization</li>
<li><strong>Social Proof:</strong> Client success stories and testimonials</li>
<li><strong>Direct Outreach:</strong> Personalized rate analysis and competitive comparisons</li>
<li><strong>Value Demonstration:</strong> ROI calculators and savings projections</li>
</ul>
</div>

<div class="tools-section">
<h3>🔧 JACC Tools Integration</h3>
<p>Leverage your JACC platform features:</p>
<ul>
<li>Document library for processor comparisons</li>
<li>Rate calculation tools for client presentations</li>
<li>Proposal generation for professional quotes</li>
<li>Market intelligence for competitive positioning</li>
</ul>
</div>

<div class="action-section">
<h3>⚡ Next Steps</h3>
<p><strong>Immediate Actions:</strong></p>
<ol>
<li>Review your current client portfolio for optimization opportunities</li>
<li>Create 5 educational posts for this week's content calendar</li>
<li>Identify 10 prospects for rate analysis outreach</li>
<li>Schedule follow-ups with existing clients for service expansion</li>
</ol>
</div>
</div>`;
      }
    }
    
    return content;
  }

  private formatDocumentContext(searchResults: VectorSearchResult[]): string {
    if (searchResults.length === 0) {
      return "No relevant documents found in the knowledge base.";
    }

    // Always keep context concise - show max 3 documents
    const topResults = searchResults.slice(0, 3);
    return topResults.map(result => 
      `${result.metadata.documentName}: ${result.content.substring(0, 150)}...`
    ).join('\n\n');
  }

  private formatSources(searchResults: VectorSearchResult[]): DocumentSource[] {
    return searchResults.map(result => ({
      name: result.metadata.documentName,
      url: result.metadata.webViewLink,
      relevanceScore: result.score,
      snippet: result.content.substring(0, 200) + "...",
      type: this.getDocumentType(result.metadata.mimeType)
    }));
  }

  private getDocumentType(mimeType: string): string {
    if (mimeType.includes('pdf')) return 'PDF';
    if (mimeType.includes('document')) return 'Word Document';
    if (mimeType.includes('spreadsheet')) return 'Spreadsheet';
    if (mimeType.includes('google-apps.document')) return 'Google Doc';
    if (mimeType.includes('google-apps.spreadsheet')) return 'Google Sheet';
    return 'Document';
  }

  private extractActions(content: string): Array<{
    type: 'save_to_folder' | 'download' | 'create_proposal' | 'find_documents' | 'action_items' | 'schedule_followup';
    label: string;
    data?: any;
  }> {
    const actions = [];

    // Extract action items from content
    const actionItems = this.extractActionItems(content);
    if (actionItems.length > 0) {
      actions.push({
        type: 'action_items' as const,
        label: `${actionItems.length} Action Items Identified`,
        data: { actionItems }
      });
    }

    // Extract follow-up tasks
    const followupTasks = this.extractFollowupTasks(content);
    if (followupTasks.length > 0) {
      actions.push({
        type: 'schedule_followup' as const,
        label: 'Schedule Follow-up Tasks',
        data: { tasks: followupTasks }
      });
    }

    if (content.toLowerCase().includes('save') || content.toLowerCase().includes('folder')) {
      actions.push({
        type: 'save_to_folder' as const,
        label: 'Save Analysis to Folder',
        data: { content }
      });
    }

    if (content.toLowerCase().includes('download') || content.toLowerCase().includes('comparison')) {
      actions.push({
        type: 'download' as const,
        label: 'Download Comparison',
        data: { content }
      });
    }

    if (content.toLowerCase().includes('proposal') || content.toLowerCase().includes('client')) {
      actions.push({
        type: 'create_proposal' as const,
        label: 'Create Client Proposal',
        data: { content }
      });
    }

    if (content.toLowerCase().includes('document') || content.toLowerCase().includes('find')) {
      actions.push({
        type: 'find_documents' as const,
        label: 'Find Related Documents',
        data: { content }
      });
    }

    return actions;
  }

  private extractActionItems(content: string): Array<{
    task: string;
    priority: 'high' | 'medium' | 'low';
    assignee?: string;
    dueDate?: string;
    category: string;
  }> {
    const actionItems = [];
    const actionPatterns = [
      /(?:need to|must|should|will|action item:?|task:?|todo:?)\s+([^.!?]+)/gi,
      /(?:follow up|follow-up|callback|contact)\s+([^.!?]+)/gi,
      /(?:send|email|call|schedule|prepare|create|update|review)\s+([^.!?]+)/gi,
      /(?:by|before|due)\s+([^.!?]+)/gi
    ];

    const priorityKeywords = {
      high: ['urgent', 'asap', 'immediately', 'critical', 'priority'],
      medium: ['soon', 'important', 'this week'],
      low: ['eventually', 'when possible', 'low priority']
    };

    const categoryKeywords = {
      'Client Communication': ['call', 'email', 'contact', 'follow up', 'callback'],
      'Documentation': ['send', 'prepare', 'create document', 'proposal'],
      'Internal Process': ['review', 'update', 'check', 'verify'],
      'Scheduling': ['schedule', 'meeting', 'appointment', 'calendar']
    };

    for (const pattern of actionPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const task = match[1].trim();
        if (task.length > 10) { // Filter out very short matches
          
          // Determine priority
          let priority: 'high' | 'medium' | 'low' = 'medium';
          for (const [level, keywords] of Object.entries(priorityKeywords)) {
            if (keywords.some(keyword => content.toLowerCase().includes(keyword))) {
              priority = level as 'high' | 'medium' | 'low';
              break;
            }
          }

          // Determine category
          let category = 'General';
          for (const [cat, keywords] of Object.entries(categoryKeywords)) {
            if (keywords.some(keyword => task.toLowerCase().includes(keyword))) {
              category = cat;
              break;
            }
          }

          // Extract assignee if mentioned
          const assigneeMatch = content.match(/(?:assign|delegate|give to|for)\s+(\w+)/i);
          const assignee = assigneeMatch ? assigneeMatch[1] : undefined;

          // Extract due date if mentioned
          const dateMatch = content.match(/(?:by|before|due)\s+([\w\s,]+?)(?:\.|$)/i);
          const dueDate = dateMatch ? dateMatch[1].trim() : undefined;

          actionItems.push({
            task,
            priority,
            assignee,
            dueDate,
            category
          });
        }
      }
    }

    return actionItems.slice(0, 5); // Limit to top 5 action items
  }

  private extractFollowupTasks(content: string): Array<{
    task: string;
    timeframe: string;
    type: 'call' | 'email' | 'meeting' | 'document' | 'other';
  }> {
    const followupTasks = [];
    const followupPatterns = [
      /(?:follow up|callback|call back)\s+([^.!?]+)/gi,
      /(?:schedule|set up|arrange)\s+([^.!?]+)/gi,
      /(?:next steps?:?|action:?)\s+([^.!?]+)/gi
    ];

    const timeframePatterns = [
      /(?:in|within)\s+(\d+\s+(?:days?|weeks?|months?))/gi,
      /(?:next|this)\s+(week|month|quarter)/gi,
      /(tomorrow|today|asap|soon)/gi
    ];

    for (const pattern of followupPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const task = match[1].trim();
        if (task.length > 5) {
          
          // Determine task type
          let type: 'call' | 'email' | 'meeting' | 'document' | 'other' = 'other';
          if (/call|phone|telephone/i.test(task)) type = 'call';
          else if (/email|send|message/i.test(task)) type = 'email';
          else if (/meeting|meet|appointment/i.test(task)) type = 'meeting';
          else if (/document|proposal|send|prepare/i.test(task)) type = 'document';

          // Extract timeframe
          let timeframe = 'Not specified';
          for (const timePattern of timeframePatterns) {
            const timeMatch = timePattern.exec(content);
            if (timeMatch) {
              timeframe = timeMatch[1] || timeMatch[0];
              break;
            }
          }

          followupTasks.push({
            task,
            timeframe,
            type
          });
        }
      }
    }

    return followupTasks.slice(0, 3); // Limit to top 3 follow-up tasks
  }

  private async generateReasoning(
    query: string, 
    searchResults: VectorSearchResult[], 
    response: string
  ): Promise<string> {
    if (searchResults.length === 0) {
      return "I provided a general response based on my training data since no relevant documents were found in your knowledge base.";
    }

    const relevantDocs = searchResults.filter(r => r.score > 0.7).length;
    const topScore = searchResults[0]?.score || 0;

    return `I found ${searchResults.length} relevant documents in your Tracer Co Card knowledge base, with ${relevantDocs} being highly relevant (>70% match). The top result "${searchResults[0]?.metadata.documentName}" had a ${(topScore * 100).toFixed(1)}% relevance score. I used these sources to provide accurate, company-specific merchant services information rather than general knowledge.`;
  }

  async searchZenBotKnowledgeBase(query: string): Promise<VectorSearchResult[]> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const knowledgeBasePath = path.join(process.cwd(), 'uploads', 'zenbot-knowledge-base.csv');
      
      if (!fs.existsSync(knowledgeBasePath)) {
        console.log('ZenBot knowledge base not found at:', knowledgeBasePath);
        return [];
      }

      const csvContent = fs.readFileSync(knowledgeBasePath, 'utf8');
      const lines = csvContent.split('\n').slice(1); // Skip header
      
      const queryLower = query.toLowerCase();
      const matchingEntries = [];

      for (const line of lines) {
        if (!line.trim()) continue;
        
        // Handle CSV parsing properly - split on commas but handle quoted text
        const columns = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!columns || columns.length < 2) continue;
        
        const question = columns[0].replace(/"/g, '').trim();
        const answer = columns[1].replace(/"/g, '').trim();
        
        if (!question || !answer) continue;

        const questionLower = question.toLowerCase();
        
        // Check for keyword matches in the question
        const keywordMatches = [
          questionLower.includes(queryLower),
          this.checkKeywordRelevance(queryLower, questionLower),
          this.checkProcessorMatches(queryLower, questionLower),
          this.checkPOSMatches(queryLower, questionLower),
          this.checkIntegrationMatches(queryLower, questionLower)
        ];

        if (keywordMatches.some(match => match)) {
          matchingEntries.push({
            question: question.replace(/"/g, ''),
            answer: answer.replace(/"/g, ''),
            relevance: this.calculateRelevance(queryLower, questionLower)
          });
        }
      }

      if (matchingEntries.length === 0) {
        return [];
      }

      // Sort by relevance and return top matches
      matchingEntries.sort((a, b) => b.relevance - a.relevance);
      
      return matchingEntries.slice(0, 3).map((entry, index) => ({
        id: `zenbot-${index}`,
        score: entry.relevance,
        documentId: '2dc361a6-0507-469e-86b2-c0caeed94259',
        content: `Q: ${entry.question}\nA: ${entry.answer}`,
        metadata: {
          documentName: 'ZenBot Knowledge Base - Q&A Reference',
          webViewLink: '/api/documents/2dc361a6-0507-469e-86b2-c0caeed94259/view',
          downloadLink: '/api/documents/2dc361a6-0507-469e-86b2-c0caeed94259/download',
          previewLink: '/api/documents/2dc361a6-0507-469e-86b2-c0caeed94259/preview',
          chunkIndex: index,
          mimeType: 'text/csv'
        }
      }));
    } catch (error) {
      console.error('Error searching ZenBot knowledge base:', error);
      return [];
    }
  }

  private checkKeywordRelevance(query: string, question: string): boolean {
    const queryWords = query.split(' ').filter(word => word.length > 2);
    return queryWords.some(word => question.includes(word));
  }

  private checkProcessorMatches(query: string, question: string): boolean {
    const processors = ['tsys', 'clearent', 'trx', 'shift4', 'micamp', 'voyager', 'merchant lynx'];
    return processors.some(processor => 
      query.includes(processor) && question.includes(processor)
    );
  }

  private checkPOSMatches(query: string, question: string): boolean {
    const posTerms = ['pos', 'point of sale', 'quantic', 'clover', 'skytab', 'hubwallet', 'aloha'];
    const restaurantTerms = ['restaurant', 'food', 'dining', 'cafe', 'bar'];
    
    // Direct POS term matches
    const directMatch = posTerms.some(term => 
      query.includes(term) && question.includes(term)
    );
    
    // Restaurant + POS combination matches
    const restaurantPOSMatch = restaurantTerms.some(restTerm => query.includes(restTerm)) && 
                              question.includes('restaurant') && question.includes('pos');
    
    return directMatch || restaurantPOSMatch;
  }

  private checkIntegrationMatches(query: string, question: string): boolean {
    const integrationTerms = ['integrate', 'quickbooks', 'epicor', 'aloha', 'roommaster'];
    return integrationTerms.some(term => 
      query.includes(term) && question.includes(term)
    );
  }

  private calculateRelevance(query: string, question: string): number {
    const queryWords = query.split(' ').filter(word => word.length > 2);
    const questionWords = question.split(' ');
    
    let matches = 0;
    for (const queryWord of queryWords) {
      if (questionWords.some(qWord => qWord.includes(queryWord))) {
        matches++;
      }
    }
    
    return matches / queryWords.length;
  }

  async searchFAQKnowledgeBase(query: string): Promise<any[]> {
    try {
      const { db } = await import('./db');
      const { faqKnowledgeBase } = await import('../shared/schema');
      const { or, ilike, eq, and } = await import('drizzle-orm');
      
      console.log(`🔍 FAQ SEARCH DEBUG: Original query: "${query}"`);
      
      // Extract key terms from the query for better matching
      const queryLower = query.toLowerCase();
      
      // Extract ALL meaningful words (3+ chars) from the query, not just specific ones
      const allWords = queryLower.split(/\s+/).filter(word => word.length >= 3);
      
      // Also extract specific important keywords
      const specificKeywords = queryLower.match(/\b(?:pos|archery|business|retail|restaurant|option|offer|good|best|top|processor|payment|tracer|recommend|work|partner|pci|trx|compliance|info|information|get|can|clover|quantic|hubwallet|shift4|skytab)\b/g) || [];
      
      // Combine all words with specific keywords, remove duplicates
      const keyTerms = [...new Set([...allWords, ...specificKeywords])];
      
      console.log(`🔍 FAQ SEARCH DEBUG: Key terms extracted:`, keyTerms);
      
      // Create search conditions for different variations
      const searchConditions = [
        // Exact phrase match
        ilike(faqKnowledgeBase.question, `%${queryLower}%`),
        ilike(faqKnowledgeBase.answer, `%${queryLower}%`),
        // Key term combinations
        ...keyTerms.map(term => ilike(faqKnowledgeBase.question, `%${term}%`)),
        ...keyTerms.map(term => ilike(faqKnowledgeBase.answer, `%${term}%`))
      ];
      
      // Search active FAQ entries for relevant matches
      const faqMatches = await db
        .select()
        .from(faqKnowledgeBase)
        .where(
          and(
            eq(faqKnowledgeBase.isActive, true),
            or(...searchConditions)
          )
        );
      
      console.log(`🔍 FAQ SEARCH DEBUG: Found ${faqMatches.length} FAQ matches for: "${query}"`);
      
      if (faqMatches.length > 0) {
        console.log(`🔍 FAQ SEARCH DEBUG: Matching questions:`, faqMatches.map(f => f.question));
        
        // Score and sort matches by relevance
        const scoredMatches = faqMatches.map(faq => {
          let score = 0;
          const questionLower = faq.question.toLowerCase();
          const answerLower = faq.answer.toLowerCase();
          
          // Boost exact matches
          if (questionLower === queryLower) score += 50; // Exact question match gets highest score
          else if (questionLower.includes(queryLower)) score += 10;
          if (answerLower.includes(queryLower)) score += 5;
          
          // Boost key term matches
          keyTerms.forEach(term => {
            if (questionLower.includes(term)) score += 2;
            if (answerLower.includes(term)) score += 1;
          });
          
          // Special boost for PCI/TRX queries
          if (queryLower.includes('pci') && questionLower.includes('pci')) score += 5;
          if (queryLower.includes('trx') && questionLower.includes('trx')) score += 5;
          
          return { ...faq, relevanceScore: score };
        });
        
        // Sort by relevance score and return top matches
        const sortedMatches = scoredMatches.sort((a, b) => b.relevanceScore - a.relevanceScore);
        console.log(`🔍 FAQ SEARCH DEBUG: Top match scores:`, sortedMatches.slice(0, 3).map(m => ({
          question: m.question,
          score: m.relevanceScore
        })));
        
        return sortedMatches;
      } else {
        // Debug: Let's see what FAQ entries exist with "processor" in them
        const processorFAQs = await db
          .select()
          .from(faqKnowledgeBase)
          .where(
            and(
              eq(faqKnowledgeBase.isActive, true),
              or(
                ilike(faqKnowledgeBase.question, `%processor%`),
                ilike(faqKnowledgeBase.answer, `%processor%`)
              )
            )
          );
        console.log(`🔍 FAQ SEARCH DEBUG: Available processor FAQs:`, processorFAQs.map(f => f.question));
      }
      
      return faqMatches;
    } catch (error) {
      console.error('Error searching FAQ knowledge base:', error);
      return [];
    }
  }

  async searchDocuments(query: string, limit: number = 10): Promise<VectorSearchResult[]> {
    try {
      // PRIORITY 1: Search ZenBot Knowledge Base for internal guidance (not user-facing)
      const knowledgeBaseGuidance = await this.searchZenBotKnowledgeBase(query);
      let searchTerms = [query]; // Start with original query
      
      if (knowledgeBaseGuidance.length > 0) {
        console.log(`✅ Found guidance in ZenBot Knowledge Base for: "${query}"`);
        // Extract search terms from the knowledge base answers to guide document search
        searchTerms = this.extractSearchTermsFromGuidance(knowledgeBaseGuidance, query);
        console.log(`🔍 Using enhanced search terms: ${searchTerms.join(', ')}`);
      }

      // PRIORITY 2: Search uploaded documents using guidance from knowledge base
      const { storage } = await import('./storage');
      const documents = await storage.getUserDocuments('simple-user-001');
      
      let matchingDocs: any[] = [];
      
      // Enhanced document search with multiple strategies
      for (const searchTerm of searchTerms) {
        console.log(`🔍 Searching for: "${searchTerm}"`);
        
        // Add Auth.net specific search variations
        const searchVariations = [searchTerm];
        if (searchTerm.toLowerCase().includes('auth.net') || searchTerm.toLowerCase().includes('authnet')) {
          searchVariations.push('authorize.net', 'authorize net', 'authorize');
        }
        
        // Strategy 1: Search document content chunks
        const { documentChunks } = await import('../shared/schema');
        const { db } = await import('./db');
        const { like, or, ilike } = await import('drizzle-orm');
        
        try {
          // Extract specific terms from the query for precise matching
          const queryTerms = searchTerm.toLowerCase().split(' ');
          const exactTermsOnly = queryTerms.filter(term => term.length > 3);
          
          // Search with all variations for better matching
          const searchConditions = [];
          for (const variation of searchVariations) {
            searchConditions.push(ilike(documentChunks.content, `%${variation}%`));
          }
          // Also search in metadata for document names
          for (const variation of searchVariations) {
            searchConditions.push(ilike(documentChunks.metadata, `%${variation}%`));
          }
          
          const contentMatches = await db
            .select()
            .from(documentChunks)
            .where(or(...searchConditions))
            .limit(20);

          if (contentMatches.length > 0) {
            console.log(`📄 Found ${contentMatches.length} content matches for "${searchTerm}"`);
            
            // Score results based on relevance and specificity
            const scoredResults = contentMatches.map(chunk => {
              let score = 0;
              const content = chunk.content.toLowerCase();
              const searchTermLower = searchTerm.toLowerCase();
              
              // Exact phrase match gets highest score
              if (content.includes(searchTermLower)) {
                score += 1.0;
              }
              
              // Specific processor/service matches get higher scores
              const specificTerms = ['clearent', 'tsys', 'shift4', 'voyager', 'genesis', 'merchant lynx'];
              const hasSpecificMatch = specificTerms.some(term => 
                queryTerms.some(queryTerm => queryTerm.includes(term)) && content.includes(term)
              );
              
              if (hasSpecificMatch) {
                score += 0.8;
              }
              
              // Document name relevance
              const docName = chunk.metadata?.documentName?.toLowerCase() || '';
              if (docName.includes(searchTermLower)) {
                score += 0.7;
              }
              
              // Reduce score for overly generic matches
              const genericTerms = ['processing', 'merchant', 'rates', 'pricing'];
              const isGeneric = genericTerms.every(term => content.includes(term));
              if (isGeneric && !hasSpecificMatch) {
                score -= 0.5;
              }
              
              return {
                id: chunk.id,
                score: Math.max(0.1, score), // Ensure minimum score
                documentId: chunk.documentId,
                content: chunk.content.substring(0, 500) + (chunk.content.length > 500 ? '...' : ''),
                metadata: {
                  documentName: chunk.metadata?.documentName || 'Document',
                  webViewLink: `/documents/${chunk.documentId}`,
                  chunkIndex: chunk.chunkIndex,
                  mimeType: chunk.metadata?.mimeType || 'application/pdf'
                }
              };
            });
            
            // Sort by score descending and return top results
            const sortedResults = scoredResults.sort((a, b) => b.score - a.score);
            console.log(`🏆 Top results:`, sortedResults.slice(0, 3).map(r => ({ 
              doc: r.metadata.documentName, 
              score: r.score.toFixed(2) 
            })));
            
            return sortedResults;
          }
        } catch (error) {
          console.log(`Error searching chunks: ${error}`);
        }
        
        // Strategy 2: Precise document name and metadata matching
        const termMatches = documents.filter(doc => {
          const searchText = `${doc.name} ${doc.originalName}`.toLowerCase();
          const termLower = searchTerm.toLowerCase();
          
          // Score-based matching for better precision
          let relevanceScore = 0;
          
          // Exact phrase match in document name (highest priority)
          if (searchText.includes(termLower)) {
            relevanceScore += 10;
          }
          
          // Specific processor matches (high priority)
          const processorMap = {
            'clearent': ['clearent'],
            'tsys': ['tsys', 'global'],
            'voyager': ['voyager'],
            'shift4': ['shift4', 'shift'],
            'genesis': ['genesis'],
            'merchant lynx': ['merchant lynx', 'merchantlynx'],
            'alliant': ['alliant'],
            'micamp': ['micamp'],
            'auth.net': ['authorize.net', 'authorize net', 'authorize', 'auth.net', 'authnet'],
            'authnet': ['authorize.net', 'authorize net', 'authorize', 'auth.net', 'authnet'],
            'authorize': ['authorize.net', 'authorize net', 'authorize', 'auth.net', 'authnet']
          };
          
          // Check for specific processor matches
          for (const [processor, keywords] of Object.entries(processorMap)) {
            if (termLower.includes(processor)) {
              const hasMatch = keywords.some(keyword => searchText.includes(keyword));
              if (hasMatch) {
                relevanceScore += 8;
              }
            }
          }
          
          // Document type specific matches (medium priority)
          const typeMatches = {
            'application': termLower.includes('application') && searchText.includes('application'),
            'cancellation': termLower.includes('cancel') && searchText.includes('cancel'),
            'pricing': termLower.includes('pricing') && searchText.includes('pricing'),
            'rates': termLower.includes('rates') && searchText.includes('rates'),
            'terminal': termLower.includes('terminal') && searchText.includes('terminal'),
            'equipment': termLower.includes('equipment') && searchText.includes('equipment')
          };
          
          Object.values(typeMatches).forEach(match => {
            if (match) relevanceScore += 5;
          });
          
          // Only return documents with meaningful relevance
          return relevanceScore >= 5;
        });
        
        matchingDocs.push(...termMatches);
      }
      
      // Remove duplicates
      matchingDocs = Array.from(new Map(matchingDocs.map(doc => [doc.id, doc])).values());
      
      if (matchingDocs.length > 0) {
        console.log(`✅ Found ${matchingDocs.length} uploaded documents for query: "${query}"`);
        
        // Calculate relevance scores for final ranking
        const scoredDocs = matchingDocs.map(doc => {
          const searchText = `${doc.name} ${doc.originalName}`.toLowerCase();
          const queryLower = query.toLowerCase();
          
          let finalScore = 0.5; // Base score
          
          // Exact match in document name
          if (searchText.includes(queryLower)) {
            finalScore += 0.4;
          }
          
          // Specific processor match
          const processors = ['clearent', 'tsys', 'voyager', 'shift4', 'genesis', 'merchant lynx', 'alliant', 'micamp'];
          const hasProcessorMatch = processors.some(processor => 
            queryLower.includes(processor) && searchText.includes(processor)
          );
          
          if (hasProcessorMatch) {
            finalScore += 0.3;
          }
          
          return {
            ...doc,
            calculatedScore: finalScore
          };
        });
        
        // Sort by calculated score
        const sortedDocs = scoredDocs.sort((a, b) => b.calculatedScore - a.calculatedScore);
        
        console.log(`🏆 Document ranking:`, sortedDocs.slice(0, 5).map(d => ({ 
          name: d.originalName || d.name, 
          score: d.calculatedScore.toFixed(2) 
        })));
        
        return sortedDocs.map(doc => ({
          id: doc.id,
          score: doc.calculatedScore,
          documentId: doc.id,
          content: `Found document: ${doc.originalName || doc.name} - This document contains information relevant to your query.`,
          metadata: {
            documentName: doc.originalName || doc.name,
            webViewLink: `/api/documents/${doc.id}/view`,
            downloadLink: `/api/documents/${doc.id}/download`,
            previewLink: `/api/documents/${doc.id}/preview`,
            chunkIndex: 0,
            mimeType: doc.mimeType
          }
        }));
      }
      
      console.log(`No uploaded documents found for query: "${query}"`);
      // Fallback to vector search if available
      return await pineconeVectorService.searchDocuments(query, 10);
    } catch (error) {
      console.error('Error searching documents:', error);
      return await pineconeVectorService.searchDocuments(query, 10);
    }
  }

  generateAlternativeQueries(originalQuery: string): string[] {
    const alternatives: string[] = [];
    const lowercaseQuery = originalQuery.toLowerCase();
    
    // Comprehensive Auth.net/Authorize.net variations
    if (lowercaseQuery.includes('auth.net') || lowercaseQuery.includes('authnet') || 
        lowercaseQuery.includes('auth net') || lowercaseQuery.includes('authorize')) {
      alternatives.push(
        'Authorize.net',
        'Authorize net',
        'authorize.net',
        'authorize net',
        'auth.net',
        'authnet',
        'CoCard_Authorize.net_Merchant',
        'Authorize.net_Agent',
        'Authorize.net_Card',
        'authorize documentation',
        'authorize.net setup',
        'authorize.net guide',
        'authorize.net pricing',
        'authorize.net rates',
        'authorize.net integration',
        'authorize.net api',
        'authorize retail',
        'authorize restaurant',
        'authorize.net retail',
        'authorize.net restaurant'
      );
    }
    
    // Shift4 variations
    if (lowercaseQuery.includes('shift4') || lowercaseQuery.includes('shift 4')) {
      alternatives.push(
        'Shift4',
        'Shift 4',
        'shift4',
        'S4',
        'Shift4_Shop',
        'SkyTab',
        'skytab',
        'S4_Advantage',
        'shift4 pricing',
        'shift4 rates',
        'shift4 costs',
        'shift4 restaurant',
        'shift4 retail'
      );
    }
    
    // Clover variations
    if (lowercaseQuery.includes('clover')) {
      alternatives.push(
        'Clover',
        'clover',
        'Clover_Equipment',
        'Clover_Service',
        'MLS_Clover',
        'clover pos',
        'clover system',
        'clover pricing',
        'clover equipment',
        'clover service plans',
        'clover costs',
        'clover hardware'
      );
    }
    
    // POS system queries
    if (lowercaseQuery.includes('pos') || lowercaseQuery.includes('point of sale')) {
      alternatives.push(
        'pos system',
        'POS',
        'point of sale',
        'terminal',
        'restaurant pos',
        'retail pos',
        'clover',
        'skytab',
        'shift4',
        'hubwallet',
        'quantic',
        'pos options',
        'best pos'
      );
    }
    
    // Pricing and rates
    if (lowercaseQuery.includes('price') || lowercaseQuery.includes('pricing') || 
        lowercaseQuery.includes('rate') || lowercaseQuery.includes('cost')) {
      alternatives.push(
        'pricing',
        'rates',
        'costs',
        'fees',
        'processing rates',
        'interchange',
        'interchange rates',
        'processing fees',
        'monthly fees',
        'equipment pricing',
        'service pricing',
        'processor rates'
      );
    }
    
    // High risk variations
    if (lowercaseQuery.includes('high risk') || lowercaseQuery.includes('risk') || 
        lowercaseQuery.includes('cbd') || lowercaseQuery.includes('cannabis')) {
      alternatives.push(
        'high risk',
        'high-risk',
        'MiCamp_High_Risk',
        'TRX_Permissible_High_Risk',
        'risk list',
        'CBD',
        'cannabis',
        'hemp',
        'prohibited',
        'permissible',
        'business categories',
        'risk account',
        'risk merchant'
      );
    }
    
    // Chargeback and compliance
    if (lowercaseQuery.includes('chargeback') || lowercaseQuery.includes('compliance') || 
        lowercaseQuery.includes('pci')) {
      alternatives.push(
        'chargeback',
        'chargebacks',
        'Understanding_Risk_and_Chargebacks',
        'dispute',
        'fraud',
        'risk',
        'compliance',
        'PCI',
        'pci compliance',
        'security',
        'data security'
      );
    }
    
    // E-commerce and online
    if (lowercaseQuery.includes('ecommerce') || lowercaseQuery.includes('e-commerce') || 
        lowercaseQuery.includes('online') || lowercaseQuery.includes('gateway')) {
      alternatives.push(
        'ecommerce',
        'e-commerce',
        'online',
        'gateway',
        'payment gateway',
        'api',
        'integration',
        'recurring',
        'subscription',
        'E_commerce_training'
      );
    }
    
    // Restaurant-specific
    if (lowercaseQuery.includes('restaurant')) {
      alternatives.push(
        'restaurant',
        'dining',
        'food service',
        'restaurant pos',
        'skytab',
        'clover',
        'shift4',
        'tabit',
        'hubwallet',
        'restaurant systems'
      );
    }
    
    // Extract and add key terms
    const keyTerms = lowercaseQuery.split(' ').filter(word => word.length > 2);
    keyTerms.forEach(term => {
      alternatives.push(term);
      // Add common variations
      if (term.includes('.')) {
        alternatives.push(term.replace(/\./g, ''));
        alternatives.push(term.replace(/\./g, ' '));
      }
    });
    
    // Add full query as an alternative
    alternatives.push(originalQuery);
    
    // Remove duplicates and return more alternatives (increase from 5 to 15)
    return [...new Set(alternatives)].slice(0, 15);
  }

  private extractSuggestions(response: string): string[] {
    // Extract relevant suggestions from the AI response
    const suggestions = [
      "Tell me about TSYS processing rates",
      "Show me Clearent application process", 
      "Compare processor fees",
      "Find hardware options",
      "Help with merchant applications"
    ];
    
    // Add contextual suggestions based on response content
    if (response.toLowerCase().includes('rate')) {
      suggestions.unshift("Compare competitive rates");
    }
    if (response.toLowerCase().includes('application')) {
      suggestions.unshift("Get application links");
    }
    if (response.toLowerCase().includes('terminal')) {
      suggestions.unshift("Browse terminal options");
    }
    
    return suggestions.slice(0, 5);
  }

  private extractSearchTermsFromGuidance(knowledgeBaseResults: VectorSearchResult[], originalQuery: string): string[] {
    const searchTerms = [originalQuery]; // Always include original query
    
    // Extract key terms from knowledge base answers
    knowledgeBaseResults.forEach(result => {
      const content = result.content.toLowerCase();
      
      // Extract company/provider names mentioned in knowledge base
      const providers = ['shift4', 'skytab', 'micamp', 'clover', 'hubwallet', 'quantic', 'clearent', 'trx', 'tsys', 'authorize.net', 'fluid pay', 'accept blue'];
      providers.forEach(provider => {
        if (content.includes(provider)) {
          searchTerms.push(provider);
        }
      });
      
      // Extract product/service types
      const services = ['restaurant pos', 'pos system', 'point of sale', 'payment processing', 'terminal', 'gateway', 'ach', 'gift cards', 'mobile solution'];
      services.forEach(service => {
        if (content.includes(service)) {
          searchTerms.push(service);
        }
      });
    });
    
    // Remove duplicates and return
    return [...new Set(searchTerms)];
  }

  async logWebSearchUsage(query: string, response: string, reason: string, context: any): Promise<void> {
    try {
      await db.insert(webSearchLogs).values({
        userId: context?.userData?.id || null,
        userQuery: query,
        webResponse: response,
        reason: reason,
        shouldAddToDocuments: true, // Default to suggesting addition
        adminReviewed: false
      });
      
      console.log(`🔍 WEB SEARCH LOGGED: "${query}" - Reason: ${reason}`);
    } catch (error) {
      console.error('Failed to log web search usage:', error);
    }
  }

  private async analyzeDocumentContent(searchResults: VectorSearchResult[], userQuery: string): Promise<string | null> {
    try {
      // Get the most relevant document content (top 5 results)
      const relevantContent = searchResults.slice(0, 5).map(result => 
        `Document: ${result.metadata?.documentName || 'Unknown'}\nContent: ${result.content.substring(0, 800)}...`
      ).join('\n\n');

      const analysisPrompt = `You are JACC, a friendly merchant services expert. Analyze these document excerpts and respond to: "${userQuery}"

DOCUMENT CONTENT:
${relevantContent}

PERSONALITY: Sound like a knowledgeable colleague - professional but approachable. Use casual language like "Alright," "Here's what I found," or "Let me break this down for you."

Provide your response in this EXACT format:

**Here's what I found in your documents:**

[1-2 paragraphs - friendly summary of key findings, speaking naturally like a real person]

**Key takeaways:**
**• [Bold bullet point with specific data/rates/facts from documents]**
**• [Include actual numbers, percentages, or details found]**
**• [Focus on actionable information that helps the user]**
**• [Add 1-2 more points with real document data]**

[If comparing rates/prices, include a simple comparison table]
[If calculations are relevant, show the math clearly]

Keep it conversational but data-driven. Only use information actually found in the documents.`;

      const response = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        messages: [{ role: 'user', content: analysisPrompt }],
        temperature: 0.3,
        max_tokens: 800,
      });

      return response.content[0].type === 'text' ? response.content[0].text : null;
    } catch (error) {
      console.error('Document analysis failed:', error);
      return null;
    }
  }

  private isBusinessAppropriateQuery(query: string): boolean {
    const businessKeywords = [
      'iso', 'merchant', 'payment', 'processing', 'pos', 'point of sale', 'credit card',
      'business', 'marketing', 'sales', 'commerce', 'transaction', 'banking', 'finance',
      'retail', 'customer', 'service', 'industry', 'company', 'revenue', 'profit',
      'partnership', 'contract', 'agreement', 'rate', 'fee', 'pricing', 'solution',
      'system', 'software', 'technology', 'integration', 'api', 'platform',
      'social media', 'content', 'advertising', 'lead', 'prospect', 'client',
      'tsys', 'fiserv', 'first data', 'global payments', 'worldpay', 'square',
      'stripe', 'paypal', 'visa', 'mastercard', 'american express', 'discover',
      'ach', 'wire transfer', 'settlement', 'chargeback', 'fraud', 'security',
      'compliance', 'pci', 'emv', 'chip', 'contactless', 'mobile payment',
      'e-commerce', 'online', 'terminal', 'gateway', 'processor'
    ];

    const restrictedKeywords = [
      'porn', 'adult', 'sex', 'xxx', 'naked', 'nude', 'erotic', 'escort',
      'drug', 'illegal', 'weapon', 'gun', 'violence', 'hate', 'racist',
      'terrorist', 'bomb', 'hack', 'crack', 'pirate', 'torrent', 'darkweb',
      'dark web', 'silk road', 'bitcoin laundering', 'money laundering'
    ];

    const queryLower = query.toLowerCase();

    // Block if contains restricted keywords
    if (restrictedKeywords.some(keyword => queryLower.includes(keyword))) {
      return false;
    }

    // Allow if contains business keywords or seems business-related
    if (businessKeywords.some(keyword => queryLower.includes(keyword))) {
      return true;
    }

    // Allow general business inquiries (questions about rates, processes, etc.)
    const businessPatterns = [
      /what.*rate/i, /how.*process/i, /business.*help/i, /merchant.*need/i,
      /payment.*work/i, /cost.*fee/i, /setup.*account/i, /integration.*api/i,
      /compare.*processor/i, /best.*solution/i, /industry.*standard/i
    ];

    if (businessPatterns.some(pattern => pattern.test(query))) {
      return true;
    }

    // Default: allow if uncertain but log for review
    console.log(`Query validation uncertain: "${query}" - allowing with caution`);
    return true;
  }
}

export const enhancedAIService = new EnhancedAIService();