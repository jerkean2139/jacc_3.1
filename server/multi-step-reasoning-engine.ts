// MEMORY OPTIMIZATION: Disabled OpenAI
let OpenAI: any = null;
import { documentGraphIntelligence, type DocumentContext } from "./document-graph-intelligence";
import { pineconeVectorService } from "./pinecone-vector";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ReasoningStep {
  stepNumber: number;
  description: string;
  input: string;
  output: string;
  confidence: number;
  sources: string[];
  reasoning: string;
  verificationStatus: 'verified' | 'unverified' | 'conflicted';
}

export interface ReasoningChain {
  queryId: string;
  originalQuery: string;
  steps: ReasoningStep[];
  finalConclusion: string;
  overallConfidence: number;
  citedSources: string[];
  potentialIssues: string[];
  auditTrail: string[];
}

export interface LogicalInference {
  premise1: string;
  premise2: string;
  conclusion: string;
  inferenceType: 'deductive' | 'inductive' | 'abductive';
  validity: number; // 0-1 confidence in logical validity
  soundness: number; // 0-1 confidence in factual accuracy
}

export class MultiStepReasoningEngine {

  /**
   * Processes complex queries through multi-step logical reasoning
   */
  async processComplexQuery(
    query: string,
    userId: string,
    contextDocuments?: string[]
  ): Promise<ReasoningChain> {
    try {
      console.log('🧠 Starting multi-step reasoning for:', query);
      
      // Step 1: Break down the query into logical components
      const queryBreakdown = await this.decomposeQuery(query);
      
      // Step 2: Build reasoning chain step by step
      const reasoningSteps: ReasoningStep[] = [];
      
      for (let i = 0; i < queryBreakdown.subQueries.length; i++) {
        const subQuery = queryBreakdown.subQueries[i];
        const step = await this.executeReasoningStep(
          i + 1,
          subQuery,
          reasoningSteps,
          contextDocuments
        );
        reasoningSteps.push(step);
      }

      // Step 3: Synthesize final conclusion
      const finalConclusion = await this.synthesizeConclusion(query, reasoningSteps);
      
      // Step 4: Verify reasoning chain integrity
      const verification = await this.verifyReasoningChain(reasoningSteps, finalConclusion);

      return {
        queryId: `reasoning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        originalQuery: query,
        steps: reasoningSteps,
        finalConclusion: finalConclusion.conclusion,
        overallConfidence: this.calculateOverallConfidence(reasoningSteps),
        citedSources: this.extractAllSources(reasoningSteps),
        potentialIssues: verification.issues,
        auditTrail: this.generateAuditTrail(reasoningSteps)
      };
    } catch (error) {
      console.error('Error in multi-step reasoning:', error);
      return this.getFailsafeResponse(query);
    }
  }

  /**
   * Decomposes complex query into logical sub-components
   */
  private async decomposeQuery(query: string): Promise<{
    subQueries: string[];
    dependencies: Array<{from: number, to: number}>;
    queryType: 'analytical' | 'comparative' | 'procedural' | 'factual';
  }> {
    const prompt = `Break down this complex query into logical sub-components:

Query: "${query}"

Decompose into 3-5 sub-queries that build upon each other logically.
Identify dependencies between sub-queries.
Classify the overall query type.

Return JSON format:
{
  "subQueries": ["What is...", "How does...", "Why would..."],
  "dependencies": [{"from": 1, "to": 2}, {"from": 2, "to": 3}],
  "queryType": "analytical|comparative|procedural|factual"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      subQueries: result.subQueries || [query],
      dependencies: result.dependencies || [],
      queryType: result.queryType || 'factual'
    };
  }

  /**
   * Executes a single reasoning step with verification
   */
  private async executeReasoningStep(
    stepNumber: number,
    subQuery: string,
    previousSteps: ReasoningStep[],
    contextDocuments?: string[]
  ): Promise<ReasoningStep> {
    try {
      // Gather relevant documents
      const searchResults = await pineconeVectorService.searchSimilar(subQuery, 5);
      
      // Build context from previous steps
      const previousContext = previousSteps.map(step => 
        `Step ${step.stepNumber}: ${step.output}`
      ).join('\n');

      const prompt = `Execute this reasoning step systematically:

Sub-Query: "${subQuery}"
Step Number: ${stepNumber}

Previous Context:
${previousContext}

Available Information:
${searchResults.map(result => `- ${result.metadata.documentName}: ${result.content}`).join('\n')}

Provide:
1. Clear reasoning process
2. Specific conclusion for this step
3. Confidence level (0-100)
4. Sources used
5. Any assumptions made

Return JSON format:
{
  "reasoning": "step-by-step logical process",
  "conclusion": "specific answer to sub-query",
  "confidence": 85,
  "sources": ["document names used"],
  "assumptions": ["any assumptions made"]
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.2
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      // Verify this step against available evidence
      const verification = await this.verifyStep(result.conclusion, searchResults);

      return {
        stepNumber,
        description: subQuery,
        input: subQuery,
        output: result.conclusion,
        confidence: (result.confidence || 50) / 100,
        sources: result.sources || [],
        reasoning: result.reasoning || '',
        verificationStatus: verification.status
      };
    } catch (error) {
      console.error('Error executing reasoning step:', error);
      return this.getFailsafeStep(stepNumber, subQuery);
    }
  }

  /**
   * Verifies a reasoning step against available evidence
   */
  private async verifyStep(conclusion: string, evidence: any[]): Promise<{
    status: 'verified' | 'unverified' | 'conflicted';
    confidence: number;
  }> {
    if (evidence.length === 0) {
      return { status: 'unverified', confidence: 0.3 };
    }

    const prompt = `Verify this conclusion against the provided evidence:

Conclusion: "${conclusion}"

Evidence:
${evidence.map((item, i) => `${i+1}. ${item.content}`).join('\n')}

Determine:
- Does the evidence support this conclusion?
- Are there any contradictions?
- What's the confidence level?

Return JSON: {"supports": boolean, "contradicts": boolean, "confidence": 0-100}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      if (result.contradicts) {
        return { status: 'conflicted', confidence: 0.2 };
      } else if (result.supports && result.confidence > 70) {
        return { status: 'verified', confidence: result.confidence / 100 };
      } else {
        return { status: 'unverified', confidence: (result.confidence || 50) / 100 };
      }
    } catch (error) {
      return { status: 'unverified', confidence: 0.5 };
    }
  }

  /**
   * Synthesizes final conclusion from all reasoning steps
   */
  private async synthesizeConclusion(
    originalQuery: string,
    steps: ReasoningStep[]
  ): Promise<{ conclusion: string; confidence: number }> {
    const prompt = `Synthesize a final conclusion from these reasoning steps:

Original Query: "${originalQuery}"

Reasoning Steps:
${steps.map(step => 
  `Step ${step.stepNumber}: ${step.description}
  Conclusion: ${step.output}
  Confidence: ${Math.round(step.confidence * 100)}%
  Status: ${step.verificationStatus}`
).join('\n\n')}

Provide a comprehensive final answer that:
1. Directly addresses the original query
2. Integrates insights from all steps
3. Acknowledges any uncertainties or conflicts
4. Provides actionable information

Return JSON format:
{
  "conclusion": "comprehensive final answer",
  "confidence": 85,
  "keyInsights": ["main insights"],
  "caveats": ["important limitations or uncertainties"]
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return {
        conclusion: result.conclusion || 'Unable to reach definitive conclusion',
        confidence: (result.confidence || 50) / 100
      };
    } catch (error) {
      return {
        conclusion: 'Error synthesizing conclusion from reasoning steps',
        confidence: 0.3
      };
    }
  }

  /**
   * Verifies overall reasoning chain integrity
   */
  private async verifyReasoningChain(
    steps: ReasoningStep[],
    conclusion: string
  ): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check for logical gaps
    for (let i = 1; i < steps.length; i++) {
      if (steps[i].confidence < 0.5) {
        issues.push(`Step ${i + 1} has low confidence (${Math.round(steps[i].confidence * 100)}%)`);
      }
      if (steps[i].verificationStatus === 'conflicted') {
        issues.push(`Step ${i + 1} contains conflicting information`);
      }
    }

    // Check for unverified steps
    const unverifiedSteps = steps.filter(step => step.verificationStatus === 'unverified');
    if (unverifiedSteps.length > steps.length / 2) {
      issues.push(`${unverifiedSteps.length} steps lack proper verification`);
    }

    return {
      isValid: issues.length < 2,
      issues
    };
  }

  /**
   * Calculates overall confidence from individual step confidences
   */
  private calculateOverallConfidence(steps: ReasoningStep[]): number {
    if (steps.length === 0) return 0;
    
    const avgConfidence = steps.reduce((sum, step) => sum + step.confidence, 0) / steps.length;
    const verifiedSteps = steps.filter(step => step.verificationStatus === 'verified').length;
    const verificationBonus = (verifiedSteps / steps.length) * 0.2;
    
    return Math.min(avgConfidence + verificationBonus, 1.0);
  }

  /**
   * Extracts all sources cited across reasoning steps
   */
  private extractAllSources(steps: ReasoningStep[]): string[] {
    const allSources = new Set<string>();
    steps.forEach(step => {
      step.sources.forEach(source => allSources.add(source));
    });
    return Array.from(allSources);
  }

  /**
   * Generates audit trail for transparency
   */
  private generateAuditTrail(steps: ReasoningStep[]): string[] {
    return steps.map(step => 
      `Step ${step.stepNumber}: ${step.description} → ${step.output} (${Math.round(step.confidence * 100)}% confidence, ${step.verificationStatus})`
    );
  }

  /**
   * Failsafe response when reasoning fails
   */
  private getFailsafeResponse(query: string): ReasoningChain {
    return {
      queryId: `failsafe_${Date.now()}`,
      originalQuery: query,
      steps: [this.getFailsafeStep(1, query)],
      finalConclusion: 'Unable to process query through multi-step reasoning. Please try a simpler question or provide more specific context.',
      overallConfidence: 0.3,
      citedSources: [],
      potentialIssues: ['System error in reasoning engine'],
      auditTrail: ['Failsafe response due to processing error']
    };
  }

  /**
   * Failsafe step when individual step fails
   */
  private getFailsafeStep(stepNumber: number, query: string): ReasoningStep {
    return {
      stepNumber,
      description: query,
      input: query,
      output: 'Unable to process this step due to system error',
      confidence: 0.3,
      sources: [],
      reasoning: 'Error in reasoning process',
      verificationStatus: 'unverified'
    };
  }

  /**
   * Performs logical inference between facts
   */
  async performLogicalInference(
    premise1: string,
    premise2: string,
    inferenceType: 'deductive' | 'inductive' | 'abductive' = 'deductive'
  ): Promise<LogicalInference> {
    const prompt = `Perform ${inferenceType} logical inference:

Premise 1: "${premise1}"
Premise 2: "${premise2}"
Inference Type: ${inferenceType}

For ${inferenceType} inference:
- Deductive: If premises are true, conclusion must be true
- Inductive: Conclusion is probable based on premises  
- Abductive: Best explanation given the premises

Provide:
1. The logical conclusion
2. Validity of the logical structure (0-100)
3. Soundness based on factual accuracy (0-100)
4. Explanation of the inference

Return JSON format:
{
  "conclusion": "logical conclusion",
  "validity": 85,
  "soundness": 75,
  "explanation": "reasoning process"
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        premise1,
        premise2,
        conclusion: result.conclusion || 'No valid inference possible',
        inferenceType,
        validity: (result.validity || 50) / 100,
        soundness: (result.soundness || 50) / 100
      };
    } catch (error) {
      console.error('Error in logical inference:', error);
      return {
        premise1,
        premise2,
        conclusion: 'Error performing logical inference',
        inferenceType,
        validity: 0.3,
        soundness: 0.3
      };
    }
  }
}

export const multiStepReasoningEngine = new MultiStepReasoningEngine();