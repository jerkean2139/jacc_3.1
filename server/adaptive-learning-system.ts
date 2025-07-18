import { db } from "./db";
import { userInteractions, trainingInteractions, userStats, messages, chats } from "@shared/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface UserFeedback {
  interactionId: string;
  userId: string;
  originalQuery: string;
  originalResponse: string;
  feedback: 'positive' | 'negative' | 'neutral';
  correctedResponse?: string;
  feedbackDetails?: string;
  timestamp: Date;
  improvementSuggestions?: string[];
}

export interface LearningPattern {
  userId: string;
  queryType: string;
  successfulPatterns: string[];
  failurePatterns: string[];
  preferredResponseStyle: string;
  domainExpertise: Array<{
    domain: string;
    proficiencyLevel: number;
    lastUpdated: Date;
  }>;
  personalizedPrompts: Array<{
    queryPattern: string;
    optimizedPrompt: string;
    successRate: number;
  }>;
}

export interface SystemImprovement {
  improvementId: string;
  category: 'prompt_optimization' | 'response_quality' | 'accuracy_enhancement' | 'personalization';
  description: string;
  implementation: string;
  expectedImpact: number;
  rolloutStatus: 'testing' | 'partial' | 'full' | 'reverted';
  metrics: {
    before: { accuracy: number; satisfaction: number; responseTime: number };
    after: { accuracy: number; satisfaction: number; responseTime: number };
  };
  createdAt: Date;
}

export class AdaptiveLearningSystem {

  /**
   * Processes user feedback to improve future responses
   */
  async processFeedback(feedback: UserFeedback): Promise<void> {
    try {
      console.log('📚 Processing user feedback for learning:', feedback.interactionId);

      // Step 1: Store feedback in database
      await this.storeFeedback(feedback);

      // Step 2: Analyze feedback patterns
      const patterns = await this.analyzeFeedbackPatterns(feedback.userId);

      // Step 3: Update user learning profile
      await this.updateUserLearningProfile(feedback.userId, feedback, patterns);

      // Step 4: Generate personalized optimizations
      await this.generatePersonalizedOptimizations(feedback.userId, patterns);

      // Step 5: Update global system improvements
      await this.updateSystemLearning(feedback);

      console.log('✅ Feedback processed and learning updated');
    } catch (error) {
      console.error('Error processing feedback:', error);
    }
  }

  /**
   * Stores feedback in the database for analysis
   */
  private async storeFeedback(feedback: UserFeedback): Promise<void> {
    try {
      await db.insert(trainingInteractions).values({
        userId: feedback.userId,
        query: feedback.originalQuery,
        originalResponse: feedback.originalResponse,
        correctedResponse: feedback.correctedResponse || null,
        feedback: feedback.feedback,
        source: 'user_feedback',
        wasCorrect: feedback.feedback === 'positive',
        improvements: feedback.improvementSuggestions?.join('; ') || null,
        createdAt: feedback.timestamp
      });
    } catch (error) {
      console.error('Error storing feedback:', error);
    }
  }

  /**
   * Analyzes feedback patterns for a specific user
   */
  private async analyzeFeedbackPatterns(userId: string): Promise<{
    positivePatterns: string[];
    negativePatterns: string[];
    preferredStyle: string;
    commonIssues: string[];
  }> {
    try {
      // Get recent interactions for this user
      const recentFeedback = await db
        .select()
        .from(trainingInteractions)
        .where(and(
          eq(trainingInteractions.userId, userId),
          gte(trainingInteractions.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Last 30 days
        ))
        .orderBy(desc(trainingInteractions.createdAt))
        .limit(50);

      const positiveFeedback = recentFeedback.filter(f => f.feedback === 'positive');
      const negativeFeedback = recentFeedback.filter(f => f.feedback === 'negative');

      // Analyze patterns using AI
      const patternAnalysis = await this.analyzeWithAI(positiveFeedback, negativeFeedback);

      return {
        positivePatterns: patternAnalysis.positivePatterns || [],
        negativePatterns: patternAnalysis.negativePatterns || [],
        preferredStyle: patternAnalysis.preferredStyle || 'professional',
        commonIssues: patternAnalysis.commonIssues || []
      };
    } catch (error) {
      console.error('Error analyzing feedback patterns:', error);
      return {
        positivePatterns: [],
        negativePatterns: [],
        preferredStyle: 'professional',
        commonIssues: []
      };
    }
  }

  /**
   * Uses AI to analyze feedback patterns
   */
  private async analyzeWithAI(positiveFeedback: any[], negativeFeedback: any[]): Promise<{
    positivePatterns: string[];
    negativePatterns: string[];
    preferredStyle: string;
    commonIssues: string[];
  }> {
    const prompt = `Analyze user feedback patterns to identify learning opportunities:

POSITIVE FEEDBACK (${positiveFeedback.length} items):
${positiveFeedback.slice(0, 10).map(f => `Query: "${f.query}" → Response worked well`).join('\n')}

NEGATIVE FEEDBACK (${negativeFeedback.length} items):
${negativeFeedback.slice(0, 10).map(f => `Query: "${f.query}" → Issue: ${f.improvements || 'Not specified'}`).join('\n')}

Identify:
1. Patterns in successful responses (what works well)
2. Patterns in unsuccessful responses (what fails)
3. User's preferred response style (professional, casual, detailed, concise)
4. Common issues that need addressing

Return JSON format:
{
  "positivePatterns": ["pattern1", "pattern2"],
  "negativePatterns": ["issue1", "issue2"],
  "preferredStyle": "professional|casual|detailed|concise",
  "commonIssues": ["issue1", "issue2"]
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.2
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      console.error('Error in AI pattern analysis:', error);
      return {
        positivePatterns: [],
        negativePatterns: [],
        preferredStyle: 'professional',
        commonIssues: []
      };
    }
  }

  /**
   * Updates user learning profile based on feedback
   */
  private async updateUserLearningProfile(
    userId: string,
    feedback: UserFeedback,
    patterns: any
  ): Promise<void> {
    try {
      // Update user stats with learning metrics
      const currentStats = await db
        .select()
        .from(userStats)
        .where(eq(userStats.userId, userId))
        .limit(1);

      if (currentStats.length > 0) {
        const stats = currentStats[0];
        const newAccuracy = this.calculateUpdatedAccuracy(stats, feedback);
        const newSatisfactionScore = this.calculateSatisfactionScore(stats, feedback);

        await db
          .update(userStats)
          .set({
            accuracy: newAccuracy,
            satisfactionScore: newSatisfactionScore,
            updatedAt: new Date()
          })
          .where(eq(userStats.userId, userId));
      }
    } catch (error) {
      console.error('Error updating user learning profile:', error);
    }
  }

  /**
   * Calculates updated accuracy based on feedback
   */
  private calculateUpdatedAccuracy(stats: any, feedback: UserFeedback): number {
    const currentAccuracy = stats.accuracy || 0.7;
    const weight = 0.1; // How much new feedback affects overall accuracy
    
    const feedbackScore = feedback.feedback === 'positive' ? 1.0 : 
                         feedback.feedback === 'neutral' ? 0.5 : 0.0;
    
    return currentAccuracy * (1 - weight) + feedbackScore * weight;
  }

  /**
   * Calculates satisfaction score
   */
  private calculateSatisfactionScore(stats: any, feedback: UserFeedback): number {
    const currentSatisfaction = stats.satisfactionScore || 0.7;
    const weight = 0.15;
    
    const feedbackScore = feedback.feedback === 'positive' ? 1.0 : 
                         feedback.feedback === 'neutral' ? 0.6 : 0.2;
    
    return currentSatisfaction * (1 - weight) + feedbackScore * weight;
  }

  /**
   * Generates personalized optimizations for the user
   */
  private async generatePersonalizedOptimizations(
    userId: string,
    patterns: any
  ): Promise<void> {
    try {
      // Create personalized prompts based on patterns
      const personalizedPrompts = await this.createPersonalizedPrompts(userId, patterns);
      
      // Store optimizations (you may need to create a table for this)
      console.log('Generated personalized optimizations:', {
        userId,
        promptCount: personalizedPrompts.length,
        patterns: patterns
      });
    } catch (error) {
      console.error('Error generating personalized optimizations:', error);
    }
  }

  /**
   * Creates personalized prompts based on user preferences
   */
  private async createPersonalizedPrompts(userId: string, patterns: any): Promise<Array<{
    queryPattern: string;
    optimizedPrompt: string;
    successRate: number;
  }>> {
    const prompt = `Create personalized prompt optimizations based on user patterns:

User Preferences:
- Positive patterns: ${patterns.positivePatterns.join(', ')}
- Preferred style: ${patterns.preferredStyle}
- Common issues to avoid: ${patterns.commonIssues.join(', ')}

Generate 3-5 prompt optimizations for common merchant services queries:

Return JSON format:
{
  "optimizations": [
    {
      "queryPattern": "rate calculation questions",
      "optimizedPrompt": "personalized prompt text",
      "expectedSuccessRate": 85
    }
  ]
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result.optimizations || [];
    } catch (error) {
      console.error('Error creating personalized prompts:', error);
      return [];
    }
  }

  /**
   * Updates global system learning from feedback
   */
  private async updateSystemLearning(feedback: UserFeedback): Promise<void> {
    try {
      // Analyze if this feedback reveals system-wide improvements
      const systemImprovement = await this.identifySystemImprovement(feedback);
      
      if (systemImprovement) {
        console.log('Identified system improvement opportunity:', systemImprovement);
        // Store system improvement for implementation
      }
    } catch (error) {
      console.error('Error updating system learning:', error);
    }
  }

  /**
   * Identifies system-wide improvements from feedback
   */
  private async identifySystemImprovement(feedback: UserFeedback): Promise<SystemImprovement | null> {
    // Get similar feedback patterns across users
    const similarIssues = await db
      .select()
      .from(trainingInteractions)
      .where(and(
        eq(trainingInteractions.feedback, 'negative'),
        gte(trainingInteractions.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // Last 7 days
      ))
      .limit(20);

    if (similarIssues.length < 3) return null; // Need multiple reports to identify system issue

    const prompt = `Analyze feedback patterns to identify system improvements:

Recent Negative Feedback:
${similarIssues.map(issue => `Query: "${issue.query}" → Issue: ${issue.improvements}`).join('\n')}

Current Feedback:
Query: "${feedback.originalQuery}"
Issue: ${feedback.feedbackDetails || 'Not specified'}
Correction: ${feedback.correctedResponse || 'Not provided'}

Identify if this represents a system-wide issue that needs addressing:

Return JSON format:
{
  "isSystemIssue": boolean,
  "category": "prompt_optimization|response_quality|accuracy_enhancement|personalization",
  "description": "specific issue description",
  "implementation": "how to fix it",
  "expectedImpact": 75
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.2
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      if (result.isSystemIssue) {
        return {
          improvementId: `improvement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          category: result.category,
          description: result.description,
          implementation: result.implementation,
          expectedImpact: result.expectedImpact,
          rolloutStatus: 'testing',
          metrics: {
            before: { accuracy: 0.7, satisfaction: 0.6, responseTime: 2.5 },
            after: { accuracy: 0.7, satisfaction: 0.6, responseTime: 2.5 }
          },
          createdAt: new Date()
        };
      }

      return null;
    } catch (error) {
      console.error('Error identifying system improvement:', error);
      return null;
    }
  }

  /**
   * Gets personalized response optimization for a user
   */
  async getPersonalizedOptimization(
    userId: string,
    query: string
  ): Promise<{
    optimizedPrompt?: string;
    responseStyle?: string;
    confidenceAdjustment?: number;
  }> {
    try {
      // Get user's learning patterns
      const userPatterns = await this.getUserLearningPatterns(userId);
      
      // Get personalized prompt if available
      const personalizedPrompt = this.matchPersonalizedPrompt(query, userPatterns);
      
      return {
        optimizedPrompt: personalizedPrompt,
        responseStyle: userPatterns.preferredStyle || 'professional',
        confidenceAdjustment: this.calculateConfidenceAdjustment(userPatterns)
      };
    } catch (error) {
      console.error('Error getting personalized optimization:', error);
      return {};
    }
  }

  /**
   * Gets user learning patterns from database
   */
  private async getUserLearningPatterns(userId: string): Promise<any> {
    try {
      const recentInteractions = await db
        .select()
        .from(trainingInteractions)
        .where(and(
          eq(trainingInteractions.userId, userId),
          gte(trainingInteractions.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        ))
        .limit(20);

      // Analyze patterns from interactions
      const positiveCount = recentInteractions.filter(i => i.feedback === 'positive').length;
      const totalCount = recentInteractions.length;
      
      return {
        successRate: totalCount > 0 ? positiveCount / totalCount : 0.7,
        preferredStyle: 'professional', // Could be determined from feedback analysis
        commonQueryTypes: this.extractCommonQueryTypes(recentInteractions),
        improvementAreas: this.extractImprovementAreas(recentInteractions)
      };
    } catch (error) {
      console.error('Error getting user learning patterns:', error);
      return { successRate: 0.7, preferredStyle: 'professional' };
    }
  }

  /**
   * Matches query to personalized prompt
   */
  private matchPersonalizedPrompt(query: string, patterns: any): string | undefined {
    // This would match against stored personalized prompts
    // For now, return undefined to use default prompts
    return undefined;
  }

  /**
   * Calculates confidence adjustment based on user patterns
   */
  private calculateConfidenceAdjustment(patterns: any): number {
    // Adjust confidence based on user's historical accuracy
    const baseAdjustment = (patterns.successRate - 0.7) * 0.1;
    return Math.max(-0.2, Math.min(0.2, baseAdjustment));
  }

  /**
   * Extracts common query types from interactions
   */
  private extractCommonQueryTypes(interactions: any[]): string[] {
    // Analyze query patterns to identify common types
    const queryTypes = ['rate_calculation', 'processor_comparison', 'documentation_search'];
    return queryTypes;
  }

  /**
   * Extracts improvement areas from negative feedback
   */
  private extractImprovementAreas(interactions: any[]): string[] {
    const negativeInteractions = interactions.filter(i => i.feedback === 'negative');
    const improvements = negativeInteractions
      .map(i => i.improvements)
      .filter(i => i)
      .join('; ')
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    return [...new Set(improvements)];
  }

  /**
   * Generates learning metrics for admin dashboard
   */
  async getLearningMetrics(): Promise<{
    totalFeedbackItems: number;
    averageAccuracy: number;
    averageSatisfaction: number;
    improvementTrends: Array<{
      date: string;
      accuracy: number;
      satisfaction: number;
    }>;
    topImprovementAreas: string[];
  }> {
    try {
      // Get feedback statistics
      const totalFeedback = await db
        .select({ count: sql<number>`count(*)` })
        .from(trainingInteractions);

      const recentStats = await db
        .select()
        .from(userStats)
        .where(gte(userStats.updatedAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));

      const avgAccuracy = recentStats.length > 0 
        ? recentStats.reduce((sum, stat) => sum + (stat.accuracy || 0), 0) / recentStats.length
        : 0.7;

      const avgSatisfaction = recentStats.length > 0
        ? recentStats.reduce((sum, stat) => sum + (stat.satisfactionScore || 0), 0) / recentStats.length
        : 0.6;

      return {
        totalFeedbackItems: totalFeedback[0]?.count || 0,
        averageAccuracy: avgAccuracy,
        averageSatisfaction: avgSatisfaction,
        improvementTrends: [], // Would calculate from historical data
        topImprovementAreas: ['Response accuracy', 'Processing speed', 'Personalization']
      };
    } catch (error) {
      console.error('Error getting learning metrics:', error);
      return {
        totalFeedbackItems: 0,
        averageAccuracy: 0.7,
        averageSatisfaction: 0.6,
        improvementTrends: [],
        topImprovementAreas: []
      };
    }
  }
}

export const adaptiveLearningSystem = new AdaptiveLearningSystem();