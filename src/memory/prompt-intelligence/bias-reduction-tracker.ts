/**
 * @fileoverview Bias Reduction Tracker
 * 
 * Tracks and measures bias reduction in AI responses by analyzing
 * confidence calibration, prediction accuracy, and systematic biases.
 */

export interface BiasMetrics {
  confidence_calibration: number;
  overconfidence_bias: number;
  underconfidence_bias: number;
  prediction_accuracy: number;
  systematic_error_rate: number;
}

export interface BiasReduction {
  reduction_percentage: number;
  bias_metrics: BiasMetrics;
  confidence: number;
  improvement_areas: string[];
}

export class BiasReductionTracker {
  
  /**
   * Calculate bias reduction for prompts by analyzing confidence vs success patterns
   */
  async calculateBiasReduction(
    prompts: Array<{
      id: string;
      original_prompt: string;
      classification_confidence?: number;
      processing_success?: boolean;
      created_at: Date;
      session_id: string;
    }>
  ): Promise<number> {
    if (prompts.length < 5) {
      return 0; // Need sufficient data for bias analysis
    }

    // Filter prompts with both confidence and success data
    const validPrompts = prompts.filter(p => 
      p.classification_confidence !== null && 
      p.classification_confidence !== undefined &&
      p.processing_success !== null &&
      p.processing_success !== undefined
    );

    if (validPrompts.length < 5) {
      return 0;
    }

    // Sort by creation time to analyze bias reduction over time
    const sortedPrompts = validPrompts.sort(
      (a, b) => a.created_at.getTime() - b.created_at.getTime()
    );

    // Calculate bias metrics for first half vs second half
    const midpoint = Math.floor(sortedPrompts.length / 2);
    const earlierPrompts = sortedPrompts.slice(0, midpoint);
    const laterPrompts = sortedPrompts.slice(midpoint);

    if (earlierPrompts.length < 3 || laterPrompts.length < 3) {
      return 0;
    }

    const earlierBias = this.calculateBiasMetrics(
      earlierPrompts.filter(p => p.classification_confidence !== undefined && p.processing_success !== undefined) as Array<{
        classification_confidence: number;
        processing_success: boolean;
      }>
    );
    const laterBias = this.calculateBiasMetrics(
      laterPrompts.filter(p => p.classification_confidence !== undefined && p.processing_success !== undefined) as Array<{
        classification_confidence: number;
        processing_success: boolean;
      }>
    );

    // Calculate overall bias reduction
    const biasReduction = this.calculateBiasImprovement(earlierBias, laterBias);

    return Math.max(-1, Math.min(1, biasReduction)); // Clamp to [-1, 1]
  }

  /**
   * Calculate comprehensive bias metrics for a set of prompts
   */
  private calculateBiasMetrics(
    prompts: Array<{
      classification_confidence: number;
      processing_success: boolean;
    }>
  ): BiasMetrics {
    // Confidence calibration: how well confidence matches actual success
    const confidenceCalibration = this.calculateConfidenceCalibration(prompts);
    
    // Overconfidence bias: tendency to be too confident
    const overconfidenceBias = this.calculateOverconfidenceBias(prompts);
    
    // Underconfidence bias: tendency to be too conservative
    const underconfidenceBias = this.calculateUnderconfidenceBias(prompts);
    
    // Prediction accuracy: how often predictions match reality
    const predictionAccuracy = this.calculatePredictionAccuracy(prompts);
    
    // Systematic error rate: consistent patterns of error
    const systematicErrorRate = this.calculateSystematicErrorRate(prompts);

    return {
      confidence_calibration: confidenceCalibration,
      overconfidence_bias: overconfidenceBias,
      underconfidence_bias: underconfidenceBias,
      prediction_accuracy: predictionAccuracy,
      systematic_error_rate: systematicErrorRate
    };
  }

  private calculateConfidenceCalibration(
    prompts: Array<{ classification_confidence: number; processing_success: boolean }>
  ): number {
    // Group prompts into confidence bins
    const bins = [
      { min: 0.0, max: 0.2, prompts: [] as typeof prompts },
      { min: 0.2, max: 0.4, prompts: [] as typeof prompts },
      { min: 0.4, max: 0.6, prompts: [] as typeof prompts },
      { min: 0.6, max: 0.8, prompts: [] as typeof prompts },
      { min: 0.8, max: 1.0, prompts: [] as typeof prompts }
    ];

    // Assign prompts to bins
    prompts.forEach(prompt => {
      const confidence = prompt.classification_confidence;
      const bin = bins.find(b => confidence >= b.min && confidence < b.max) || bins[bins.length - 1];
      bin.prompts.push(prompt);
    });

    // Calculate calibration error
    let totalCalibrationError = 0;
    let validBins = 0;

    for (const bin of bins) {
      if (bin.prompts.length > 0) {
        const avgConfidence = (bin.min + bin.max) / 2;
        const actualSuccessRate = bin.prompts.filter(p => p.processing_success).length / bin.prompts.length;
        const calibrationError = Math.abs(avgConfidence - actualSuccessRate);
        
        totalCalibrationError += calibrationError;
        validBins++;
      }
    }

    // Return 1 - average calibration error (higher is better)
    return validBins > 0 ? Math.max(0, 1 - (totalCalibrationError / validBins)) : 0;
  }

  private calculateOverconfidenceBias(
    prompts: Array<{ classification_confidence: number; processing_success: boolean }>
  ): number {
    // Calculate how often high confidence (>0.8) leads to failure
    const highConfidencePrompts = prompts.filter(p => p.classification_confidence > 0.8);
    
    if (highConfidencePrompts.length === 0) {
      return 0;
    }

    const highConfidenceFailures = highConfidencePrompts.filter(p => !p.processing_success).length;
    const overconfidenceRate = highConfidenceFailures / highConfidencePrompts.length;

    // Higher overconfidence rate = more bias (return as positive value)
    return overconfidenceRate;
  }

  private calculateUnderconfidenceBias(
    prompts: Array<{ classification_confidence: number; processing_success: boolean }>
  ): number {
    // Calculate how often low confidence (<0.5) leads to success
    const lowConfidencePrompts = prompts.filter(p => p.classification_confidence < 0.5);
    
    if (lowConfidencePrompts.length === 0) {
      return 0;
    }

    const lowConfidenceSuccesses = lowConfidencePrompts.filter(p => p.processing_success).length;
    const underconfidenceRate = lowConfidenceSuccesses / lowConfidencePrompts.length;

    // Higher underconfidence rate = more bias (return as positive value)
    return underconfidenceRate;
  }

  private calculatePredictionAccuracy(
    prompts: Array<{ classification_confidence: number; processing_success: boolean }>
  ): number {
    // Calculate how often confidence > 0.5 predicts success correctly
    let correctPredictions = 0;

    for (const prompt of prompts) {
      const predictedSuccess = prompt.classification_confidence > 0.5;
      const actualSuccess = prompt.processing_success;
      
      if (predictedSuccess === actualSuccess) {
        correctPredictions++;
      }
    }

    return prompts.length > 0 ? correctPredictions / prompts.length : 0;
  }

  private calculateSystematicErrorRate(
    prompts: Array<{ classification_confidence: number; processing_success: boolean }>
  ): number {
    // Look for systematic patterns in errors
    if (prompts.length < 10) {
      return 0;
    }

    // Check for clustering of errors (consecutive failures)
    let consecutiveErrors = 0;
    let maxConsecutiveErrors = 0;
    let totalErrors = 0;

    for (let i = 0; i < prompts.length; i++) {
      if (!prompts[i].processing_success) {
        consecutiveErrors++;
        totalErrors++;
        maxConsecutiveErrors = Math.max(maxConsecutiveErrors, consecutiveErrors);
      } else {
        consecutiveErrors = 0;
      }
    }

    if (totalErrors === 0) {
      return 0;
    }

    // Systematic error rate based on clustering vs random distribution
    const expectedMaxConsecutive = Math.ceil(Math.sqrt(totalErrors));
    const clusteringRatio = maxConsecutiveErrors / expectedMaxConsecutive;
    
    // Higher clustering suggests systematic bias
    return Math.min(clusteringRatio, 1.0);
  }

  private calculateBiasImprovement(earlier: BiasMetrics, later: BiasMetrics): number {
    // Calculate improvement in each bias metric
    const calibrationImprovement = later.confidence_calibration - earlier.confidence_calibration;
    const overconfidenceReduction = earlier.overconfidence_bias - later.overconfidence_bias;
    const underconfidenceReduction = earlier.underconfidence_bias - later.underconfidence_bias;
    const accuracyImprovement = later.prediction_accuracy - earlier.prediction_accuracy;
    const systematicErrorReduction = earlier.systematic_error_rate - later.systematic_error_rate;

    // Weight the improvements
    const weightedImprovement = (
      calibrationImprovement * 0.3 +
      overconfidenceReduction * 0.2 +
      underconfidenceReduction * 0.2 +
      accuracyImprovement * 0.2 +
      systematicErrorReduction * 0.1
    );

    return weightedImprovement;
  }

  /**
   * Calculate bias reduction for prompts grouped by session
   */
  async calculateSessionBasedBiasReduction(
    prompts: Array<{
      id: string;
      original_prompt: string;
      classification_confidence?: number;
      processing_success?: boolean;
      created_at: Date;
      session_id: string;
    }>
  ): Promise<Map<string, number>> {
    const biasReductions = new Map<string, number>();

    // Group prompts by session
    const promptsBySession = new Map<string, typeof prompts>();
    for (const prompt of prompts) {
      if (!promptsBySession.has(prompt.session_id)) {
        promptsBySession.set(prompt.session_id, []);
      }
      promptsBySession.get(prompt.session_id)!.push(prompt);
    }

    // Calculate bias reduction for each session
    for (const [sessionId, sessionPrompts] of promptsBySession) {
      if (sessionPrompts.length >= 5) {
        const biasReduction = await this.calculateBiasReduction(sessionPrompts);
        biasReductions.set(sessionId, biasReduction);
      }
    }

    return biasReductions;
  }

  /**
   * Analyze bias patterns across different prompt types
   */
  async analyzeBiasByPromptType(
    prompts: Array<{
      id: string;
      original_prompt: string;
      prompt_type?: string;
      classification_confidence?: number;
      processing_success?: boolean;
      created_at: Date;
    }>
  ): Promise<Map<string, BiasMetrics>> {
    const biasMetricsByType = new Map<string, BiasMetrics>();

    // Group prompts by type
    const promptsByType = new Map<string, typeof prompts>();
    for (const prompt of prompts) {
      const type = prompt.prompt_type || 'unknown';
      if (!promptsByType.has(type)) {
        promptsByType.set(type, []);
      }
      promptsByType.get(type)!.push(prompt);
    }

    // Calculate bias metrics for each type
    for (const [type, typePrompts] of promptsByType) {
      const validPrompts = typePrompts.filter(p => 
        p.classification_confidence !== null && 
        p.classification_confidence !== undefined &&
        p.processing_success !== null &&
        p.processing_success !== undefined
      );

      if (validPrompts.length >= 3) {
        const biasMetrics = this.calculateBiasMetrics(
          validPrompts as Array<{
            classification_confidence: number;
            processing_success: boolean;
          }>
        );
        biasMetricsByType.set(type, biasMetrics);
      }
    }

    return biasMetricsByType;
  }

  /**
   * Calculate overall bias reduction percentage across all prompts
   */
  async calculateOverallBiasReduction(
    prompts: Array<{
      id: string;
      original_prompt: string;
      classification_confidence?: number;
      processing_success?: boolean;
      created_at: Date;
      session_id: string;
    }>
  ): Promise<number> {
    // Calculate session-based bias reductions
    const sessionBiasReductions = await this.calculateSessionBasedBiasReduction(prompts);
    
    if (sessionBiasReductions.size === 0) {
      return 0;
    }

    // Calculate average bias reduction across sessions
    const reductions = Array.from(sessionBiasReductions.values());
    const averageReduction = reductions.reduce((sum, reduction) => sum + reduction, 0) / reductions.length;

    // Convert to percentage and ensure positive values represent improvement
    return Math.max(0, averageReduction * 100);
  }

  /**
   * Generate bias reduction report with detailed analysis
   */
  async generateBiasReport(
    prompts: Array<{
      id: string;
      original_prompt: string;
      prompt_type?: string;
      classification_confidence?: number;
      processing_success?: boolean;
      created_at: Date;
      session_id: string;
    }>
  ): Promise<{
    overall_bias_reduction: number;
    session_bias_reductions: Map<string, number>;
    type_bias_metrics: Map<string, BiasMetrics>;
    recommendations: string[];
  }> {
    const overallBiasReduction = await this.calculateOverallBiasReduction(prompts);
    const sessionBiasReductions = await this.calculateSessionBasedBiasReduction(prompts);
    const typeBiasMetrics = await this.analyzeBiasByPromptType(prompts);

    // Generate recommendations based on analysis
    const recommendations: string[] = [];
    
    if (overallBiasReduction < 5) {
      recommendations.push('Consider implementing confidence calibration training');
    }
    
    // Analyze type-specific biases
    for (const [type, metrics] of typeBiasMetrics) {
      if (metrics.overconfidence_bias > 0.3) {
        recommendations.push(`Reduce overconfidence bias in ${type} prompts`);
      }
      if (metrics.underconfidence_bias > 0.3) {
        recommendations.push(`Address underconfidence bias in ${type} prompts`);
      }
      if (metrics.systematic_error_rate > 0.4) {
        recommendations.push(`Investigate systematic errors in ${type} prompts`);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Bias metrics are within acceptable ranges');
    }

    return {
      overall_bias_reduction: overallBiasReduction,
      session_bias_reductions: sessionBiasReductions,
      type_bias_metrics: typeBiasMetrics,
      recommendations
    };
  }
}