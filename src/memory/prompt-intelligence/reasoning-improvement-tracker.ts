/**
 * @fileoverview Reasoning Improvement Tracker
 *
 * Tracks and measures reasoning improvement by comparing prompt responses
 * across similar contexts and measuring quality improvements over time.
 */

export interface ReasoningMetrics {
  clarity_score: number;
  logic_coherence: number;
  completeness_score: number;
  accuracy_score: number;
  creativity_score: number;
}

export interface ReasoningComparison {
  improvement_percentage: number;
  metrics_comparison: {
    before: ReasoningMetrics;
    after: ReasoningMetrics;
  };
  confidence: number;
}

export class ReasoningImprovementTracker {
  /**
   * Calculate reasoning improvement for a prompt by comparing it with similar previous prompts
   */
  async calculateReasoningImprovement(
    currentPrompt: string,
    previousSimilarPrompts: Array<{
      prompt: string;
      response?: string;
      created_at: Date;
    }>
  ): Promise<number> {
    if (previousSimilarPrompts.length === 0) {
      return 0; // No baseline to compare against
    }

    // Sort by creation time to get progression
    const sortedPrompts = previousSimilarPrompts.sort(
      (a, b) => a.created_at.getTime() - b.created_at.getTime()
    );

    // Compare current prompt with the most recent similar prompt
    const mostRecentSimilar = sortedPrompts[sortedPrompts.length - 1];
    const comparison = this.comparePromptQuality(currentPrompt, mostRecentSimilar.prompt);

    // Calculate improvement trend across the timeline
    const trendImprovement = this.calculateTrendImprovement(sortedPrompts, currentPrompt);

    // Weight recent comparison more heavily than trend
    const weightedImprovement = comparison.improvement_percentage * 0.7 + trendImprovement * 0.3;

    return Math.max(-1, Math.min(1, weightedImprovement)); // Clamp to [-1, 1]
  }

  /**
   * Compare quality between two prompts
   */
  private comparePromptQuality(currentPrompt: string, previousPrompt: string): ReasoningComparison {
    const currentMetrics = this.analyzePromptQuality(currentPrompt);
    const previousMetrics = this.analyzePromptQuality(previousPrompt);

    // Calculate overall improvement
    const improvements = [
      (currentMetrics.clarity_score - previousMetrics.clarity_score) /
        previousMetrics.clarity_score,
      (currentMetrics.logic_coherence - previousMetrics.logic_coherence) /
        previousMetrics.logic_coherence,
      (currentMetrics.completeness_score - previousMetrics.completeness_score) /
        previousMetrics.completeness_score,
      (currentMetrics.accuracy_score - previousMetrics.accuracy_score) /
        previousMetrics.accuracy_score,
      (currentMetrics.creativity_score - previousMetrics.creativity_score) /
        previousMetrics.creativity_score,
    ].filter(imp => !isNaN(imp) && isFinite(imp));

    const avgImprovement =
      improvements.length > 0
        ? improvements.reduce((sum, imp) => sum + imp, 0) / improvements.length
        : 0;

    return {
      improvement_percentage: avgImprovement,
      metrics_comparison: {
        before: previousMetrics,
        after: currentMetrics,
      },
      confidence: this.calculateConfidence(currentPrompt, previousPrompt),
    };
  }

  /**
   * Analyze the quality of a single prompt
   */
  private analyzePromptQuality(prompt: string): ReasoningMetrics {
    const words = prompt.split(/\s+/).filter(w => w.length > 0);
    const sentences = prompt.split(/[.!?]+/).filter(s => s.trim().length > 0);

    // Clarity score based on readability and structure
    const clarity_score = this.calculateClarityScore(prompt, words, sentences);

    // Logic coherence based on logical connectors and flow
    const logic_coherence = this.calculateLogicCoherence(prompt);

    // Completeness based on coverage of key elements
    const completeness_score = this.calculateCompletenessScore(prompt);

    // Accuracy based on technical terms and precision
    const accuracy_score = this.calculateAccuracyScore(prompt);

    // Creativity based on variety and novel approaches
    const creativity_score = this.calculateCreativityScore(prompt, words);

    return {
      clarity_score,
      logic_coherence,
      completeness_score,
      accuracy_score,
      creativity_score,
    };
  }

  private calculateClarityScore(prompt: string, words: string[], sentences: string[]): number {
    let score = 0.5; // Base score

    // Reward appropriate length
    const wordCount = words.length;
    if (wordCount >= 10 && wordCount <= 100) score += 0.2;
    else if (wordCount > 100 && wordCount <= 200) score += 0.1;

    // Reward sentence structure
    const avgWordsPerSentence = sentences.length > 0 ? wordCount / sentences.length : 0;
    if (avgWordsPerSentence >= 8 && avgWordsPerSentence <= 25) score += 0.15;

    // Reward clear action words
    const actionWords =
      /\b(implement|create|fix|analyze|optimize|design|build|test|debug|refactor)\b/gi;
    const actionMatches = (prompt.match(actionWords) || []).length;
    score += Math.min(actionMatches * 0.05, 0.15);

    return Math.min(score, 1.0);
  }

  private calculateLogicCoherence(prompt: string): number {
    let score = 0.4; // Base score

    // Reward logical connectors
    const logicalConnectors =
      /\b(because|therefore|however|although|while|since|if|then|so|thus|consequently)\b/gi;
    const connectorMatches = (prompt.match(logicalConnectors) || []).length;
    score += Math.min(connectorMatches * 0.1, 0.3);

    // Reward structured thinking
    const structureIndicators =
      /\b(first|second|third|finally|also|additionally|furthermore|moreover|in conclusion)\b/gi;
    const structureMatches = (prompt.match(structureIndicators) || []).length;
    score += Math.min(structureMatches * 0.08, 0.2);

    // Reward conditional reasoning
    const conditionalPatterns = /\b(if\s+\w+.*then|when\s+\w+.*should|unless\s+\w+.*will)\b/gi;
    const conditionalMatches = (prompt.match(conditionalPatterns) || []).length;
    score += Math.min(conditionalMatches * 0.1, 0.1);

    return Math.min(score, 1.0);
  }

  private calculateCompletenessScore(prompt: string): number {
    let score = 0.3; // Base score

    // Check for problem identification
    const problemPatterns = /\b(problem|issue|bug|error|challenge|difficulty)\b/gi;
    if (problemPatterns.test(prompt)) score += 0.15;

    // Check for solution approach
    const solutionPatterns = /\b(solution|approach|method|strategy|plan|implement)\b/gi;
    if (solutionPatterns.test(prompt)) score += 0.15;

    // Check for context/requirements
    const contextPatterns = /\b(requirement|need|should|must|context|environment)\b/gi;
    if (contextPatterns.test(prompt)) score += 0.1;

    // Check for expected outcomes
    const outcomePatterns = /\b(result|output|outcome|goal|objective|expect)\b/gi;
    if (outcomePatterns.test(prompt)) score += 0.1;

    // Check for constraints/considerations
    const constraintPatterns = /\b(constraint|limitation|consider|careful|ensure|avoid)\b/gi;
    if (constraintPatterns.test(prompt)) score += 0.1;

    // Check for specificity (technical terms, numbers, specific names)
    const specificityPatterns = /\b(\d+\.\d+|\d+%|v\d+\.\d+|[A-Z][a-z]*[A-Z][a-zA-Z]*)\b/g;
    const specificityMatches = (prompt.match(specificityPatterns) || []).length;
    score += Math.min(specificityMatches * 0.02, 0.1);

    return Math.min(score, 1.0);
  }

  private calculateAccuracyScore(prompt: string): number {
    let score = 0.4; // Base score

    // Reward technical terminology
    const techTerms =
      /\b(API|database|algorithm|function|class|method|variable|array|object|interface|server|client|framework|library|package|module)\b/gi;
    const techMatches = (prompt.match(techTerms) || []).length;
    score += Math.min(techMatches * 0.03, 0.2);

    // Reward precise language
    const preciseLanguage =
      /\b(specifically|exactly|precisely|particular|explicit|detailed|comprehensive)\b/gi;
    const preciseMatches = (prompt.match(preciseLanguage) || []).length;
    score += Math.min(preciseMatches * 0.05, 0.15);

    // Reward measurable criteria
    const measurablePatterns =
      /\b(\d+\s*(ms|seconds?|minutes?|hours?|MB|GB|KB|bytes?|percent|%|times?))\b/gi;
    const measurableMatches = (prompt.match(measurablePatterns) || []).length;
    score += Math.min(measurableMatches * 0.05, 0.15);

    // Penalize vague language
    const vagueLanguage = /\b(somehow|maybe|probably|might|could|perhaps|sort of|kind of)\b/gi;
    const vagueMatches = (prompt.match(vagueLanguage) || []).length;
    score -= Math.min(vagueMatches * 0.05, 0.1);

    return Math.max(0.1, Math.min(score, 1.0));
  }

  private calculateCreativityScore(prompt: string, words: string[]): number {
    let score = 0.3; // Base score

    // Reward vocabulary diversity
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const vocabularyDiversity = uniqueWords.size / words.length;
    score += vocabularyDiversity * 0.2;

    // Reward innovative approaches
    const innovativeTerms =
      /\b(innovative|creative|novel|unique|original|alternative|different|new\s+approach|breakthrough|cutting-edge)\b/gi;
    const innovativeMatches = (prompt.match(innovativeTerms) || []).length;
    score += Math.min(innovativeMatches * 0.08, 0.2);

    // Reward multiple solution considerations
    const alternativePatterns =
      /\b(alternatively|another\s+way|different\s+approach|consider|option|alternative)\b/gi;
    const alternativeMatches = (prompt.match(alternativePatterns) || []).length;
    score += Math.min(alternativeMatches * 0.06, 0.15);

    // Reward metaphors and analogies
    const metaphorPatterns =
      /\b(like|similar\s+to|analogous|resembles|as\s+if|metaphor|analogy)\b/gi;
    const metaphorMatches = (prompt.match(metaphorPatterns) || []).length;
    score += Math.min(metaphorMatches * 0.05, 0.1);

    return Math.min(score, 1.0);
  }

  private calculateTrendImprovement(
    sortedPrompts: Array<{ prompt: string; created_at: Date }>,
    currentPrompt: string
  ): number {
    if (sortedPrompts.length < 2) return 0;

    // Calculate quality scores for all prompts in chronological order
    const qualityScores = sortedPrompts.map(p => {
      const metrics = this.analyzePromptQuality(p.prompt);
      return (
        (metrics.clarity_score +
          metrics.logic_coherence +
          metrics.completeness_score +
          metrics.accuracy_score +
          metrics.creativity_score) /
        5
      );
    });

    // Add current prompt score
    const currentMetrics = this.analyzePromptQuality(currentPrompt);
    const currentScore =
      (currentMetrics.clarity_score +
        currentMetrics.logic_coherence +
        currentMetrics.completeness_score +
        currentMetrics.accuracy_score +
        currentMetrics.creativity_score) /
      5;
    qualityScores.push(currentScore);

    // Calculate linear regression slope to determine trend
    const n = qualityScores.length;
    const xValues = Array.from({ length: n }, (_, i) => i);
    const xMean = xValues.reduce((sum, x) => sum + x, 0) / n;
    const yMean = qualityScores.reduce((sum, y) => sum + y, 0) / n;

    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (xValues[i] - xMean) * (qualityScores[i] - yMean);
      denominator += (xValues[i] - xMean) ** 2;
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;

    // Normalize slope to reasonable range
    return Math.max(-0.5, Math.min(0.5, slope * 5)); // Scale and clamp
  }

  private calculateConfidence(currentPrompt: string, previousPrompt: string): number {
    // Base confidence on prompt length similarity and content overlap
    const currentWords = new Set(currentPrompt.toLowerCase().split(/\s+/));
    const previousWords = new Set(previousPrompt.toLowerCase().split(/\s+/));

    const intersection = new Set([...currentWords].filter(w => previousWords.has(w)));
    const union = new Set([...currentWords, ...previousWords]);

    const similarity = intersection.size / union.size;

    // Higher similarity = higher confidence in comparison
    const baseConfidence = 0.3 + similarity * 0.5;

    // Adjust based on prompt lengths (very different lengths = lower confidence)
    const lengthRatio =
      Math.min(currentPrompt.length, previousPrompt.length) /
      Math.max(currentPrompt.length, previousPrompt.length);

    const lengthAdjustment = lengthRatio * 0.2;

    return Math.min(baseConfidence + lengthAdjustment, 0.95);
  }

  /**
   * Batch calculate reasoning improvements for multiple prompts
   */
  async batchCalculateReasoningImprovement(
    prompts: Array<{
      id: string;
      prompt: string;
      created_at: Date;
      session_id: string;
    }>
  ): Promise<Map<string, number>> {
    const improvements = new Map<string, number>();

    // Group prompts by session for better comparison
    const promptsBySession = new Map<string, typeof prompts>();
    for (const prompt of prompts) {
      if (!promptsBySession.has(prompt.session_id)) {
        promptsBySession.set(prompt.session_id, []);
      }
      promptsBySession.get(prompt.session_id)!.push(prompt);
    }

    // Calculate improvements within each session
    for (const [sessionId, sessionPrompts] of promptsBySession) {
      const sortedPrompts = sessionPrompts.sort(
        (a, b) => a.created_at.getTime() - b.created_at.getTime()
      );

      for (let i = 0; i < sortedPrompts.length; i++) {
        const currentPrompt = sortedPrompts[i];
        const previousPrompts = sortedPrompts.slice(0, i);

        const improvement = await this.calculateReasoningImprovement(
          currentPrompt.prompt,
          previousPrompts.map(p => ({
            prompt: p.prompt,
            created_at: p.created_at,
          }))
        );

        improvements.set(currentPrompt.id, improvement);
      }
    }

    return improvements;
  }
}
