/**
 * LLM Impact Metrics - Measures cognitive effectiveness and performance
 *
 * This module provides metrics to analyze the impact and effectiveness of LLM operations
 * in the Sentient AGI reasoning system. Focus is on quality and effectiveness, not just performance.
 */

import { LLMImpactMetrics, CognitiveState } from './types.js';

/**
 * Configuration for impact metrics calculation
 */
export interface ImpactMetricsConfig {
  /** Weight for latency in efficiency calculations (0-1) */
  latencyWeight: number;
  /** Weight for cost in efficiency calculations (0-1) */
  costWeight: number;
  /** Weight for insight count in efficiency calculations (0-1) */
  insightWeight: number;
  /** Minimum session length for learning velocity calculation */
  minSessionLength: number;
}

/**
 * Default configuration for impact metrics
 */
export const DEFAULT_CONFIG: ImpactMetricsConfig = {
  latencyWeight: 0.4,
  costWeight: 0.3,
  insightWeight: 0.3,
  minSessionLength: 3,
};

/**
 * Input data for calculating LLM impact metrics
 */
export interface MetricsInput {
  /** Latency in milliseconds */
  latencyMs: number;
  /** Total token count */
  tokenCount: number;
  /** Cost in USD */
  cost: number;
  /** Number of insights generated */
  insightCount: number;
  /** Number of cognitive interventions applied */
  interventionCount: number;
  /** Current cognitive state */
  cognitiveState: CognitiveState;
  /** Historical cognitive states for trend analysis */
  historicalStates?: CognitiveState[];
}

/**
 * Calculate cognitive efficiency score
 * Measures insights generated per unit of computational cost
 */
export function calculateCognitiveEfficiency(
  insightCount: number,
  latencyMs: number,
  cost: number,
  config: ImpactMetricsConfig = DEFAULT_CONFIG
): number {
  if (latencyMs <= 0 && cost <= 0) {
    return insightCount > 0 ? 1.0 : 0.0;
  }

  // Normalize latency to seconds for calculation
  const latencySec = latencyMs / 1000;

  // Calculate weighted cost (latency + financial cost)
  const normalizedLatency = Math.min(latencySec / 10, 1.0); // Cap at 10 seconds
  const normalizedCost = Math.min(cost * 10000, 1.0); // Scale cost (assuming micro-dollars)

  const weightedCost =
    normalizedLatency * config.latencyWeight + normalizedCost * config.costWeight;

  if (weightedCost === 0) {
    return insightCount > 0 ? 1.0 : 0.0;
  }

  // Efficiency = insights per unit of weighted cost
  const efficiency = insightCount / weightedCost;

  // Normalize to 0-1 range with logarithmic scaling
  return Math.min(Math.log(efficiency + 1) / Math.log(11), 1.0);
}

/**
 * Calculate thought quality score
 * Based on metacognitive awareness and confidence trajectory
 */
export function calculateThoughtQuality(cognitiveState: CognitiveState): number {
  const metacognitive = cognitiveState.metacognitive_awareness || 0;
  const confidence = calculateAverageConfidence(cognitiveState.confidence_trajectory || []);
  const engagement = cognitiveState.engagement_level || 0;
  const analyticalDepth = cognitiveState.analytical_depth || 0;

  // Weighted combination of quality indicators
  const qualityScore =
    metacognitive * 0.3 + confidence * 0.25 + engagement * 0.25 + analyticalDepth * 0.2;

  return Math.min(Math.max(qualityScore, 0), 1);
}

/**
 * Calculate learning velocity
 * Measures rate of improvement over session
 */
export function calculateLearningVelocity(
  cognitiveState: CognitiveState,
  config: ImpactMetricsConfig = DEFAULT_CONFIG
): number {
  const trajectory = cognitiveState.confidence_trajectory || [];

  if (trajectory.length < config.minSessionLength) {
    return 0;
  }

  // Calculate improvement trajectory using linear regression
  const improvements = [];
  for (let i = 1; i < trajectory.length; i++) {
    improvements.push(trajectory[i] - trajectory[i - 1]);
  }

  if (improvements.length === 0) {
    return 0;
  }

  // Average improvement per step
  const avgImprovement = improvements.reduce((sum, imp) => sum + imp, 0) / improvements.length;

  // Normalize to 0-1 range (assuming max improvement of 0.1 per step)
  return Math.min(Math.max((avgImprovement + 0.1) / 0.2, 0), 1);
}

/**
 * Calculate conceptual depth
 * Based on complexity of insights and analytical depth
 */
export function calculateConceptualDepth(
  insightCount: number,
  interventionCount: number,
  cognitiveState: CognitiveState
): number {
  const currentComplexity = cognitiveState.current_complexity || 0;
  const analyticalDepth = cognitiveState.analytical_depth || 0;
  const curiosityLevel = cognitiveState.curiosity_level || 0;

  // Base depth from complexity and analytical depth
  const baseDepth = (currentComplexity / 10) * 0.5 + analyticalDepth * 0.3;

  // Enhancement from insights and interventions
  const insightBonus = Math.min(insightCount / 10, 0.15);
  const interventionBonus = Math.min(interventionCount / 5, 0.05);

  const depth = baseDepth + insightBonus + interventionBonus + curiosityLevel * 0.1;

  return Math.min(Math.max(depth, 0), 1);
}

/**
 * Calculate problem-solving effectiveness
 * Success rate weighted by problem complexity
 */
export function calculateProblemSolvingEffectiveness(
  cognitiveState: CognitiveState,
  insightCount: number
): number {
  const recentSuccessRate = cognitiveState.recent_success_rate || 0;
  const currentComplexity = cognitiveState.current_complexity || 0;
  const breakthroughLikelihood = cognitiveState.breakthrough_likelihood || 0;

  // Base effectiveness from success rate
  let effectiveness = recentSuccessRate;

  // Complexity bonus - harder problems are worth more
  const complexityBonus = (currentComplexity / 10) * 0.2;

  // Insight bonus - more insights indicate better problem solving
  const insightBonus = Math.min(insightCount / 10, 0.15);

  // Breakthrough potential bonus
  const breakthroughBonus = breakthroughLikelihood * 0.1;

  effectiveness = effectiveness + complexityBonus + insightBonus + breakthroughBonus;

  return Math.min(Math.max(effectiveness, 0), 1);
}

/**
 * Calculate composite confidence score
 * Combines metacognitive awareness with confidence trajectory analysis
 */
export function calculateConfidenceScore(cognitiveState: CognitiveState): number {
  const metacognitive = cognitiveState.metacognitive_awareness || 0;
  const avgConfidence = calculateAverageConfidence(cognitiveState.confidence_trajectory || []);
  const selfDoubt = cognitiveState.self_doubt_level || 0;

  // Composite confidence: metacognitive awareness + trajectory confidence - self doubt
  const composite = metacognitive * 0.4 + avgConfidence * 0.5 - selfDoubt * 0.1;

  return Math.min(Math.max(composite, 0), 1);
}

/**
 * Calculate all LLM impact metrics from input data
 */
export function calculateLLMImpactMetrics(
  input: MetricsInput,
  config: ImpactMetricsConfig = DEFAULT_CONFIG
): LLMImpactMetrics {
  return {
    thoughtLatency: input.latencyMs,
    tokenCount: input.tokenCount,
    cost: input.cost,
    confidenceScore: calculateConfidenceScore(input.cognitiveState),
    breakthroughLikelihood: input.cognitiveState.breakthrough_likelihood || 0,
    cognitiveEfficiency: calculateCognitiveEfficiency(
      input.insightCount,
      input.latencyMs,
      input.cost,
      config
    ),
    thoughtQuality: calculateThoughtQuality(input.cognitiveState),
    learningVelocity: calculateLearningVelocity(input.cognitiveState, config),
    conceptualDepth: calculateConceptualDepth(
      input.insightCount,
      input.interventionCount,
      input.cognitiveState
    ),
    problemSolvingEffectiveness: calculateProblemSolvingEffectiveness(
      input.cognitiveState,
      input.insightCount
    ),
  };
}

/**
 * Helper function to calculate average confidence from trajectory
 */
function calculateAverageConfidence(trajectory: number[]): number {
  if (trajectory.length === 0) {
    return 0;
  }

  const sum = trajectory.reduce((acc, val) => acc + val, 0);
  return sum / trajectory.length;
}

/**
 * Create standardized Phoenix span attributes from impact metrics
 */
export function createImpactMetricAttributes(metrics: LLMImpactMetrics): Record<string, any> {
  return {
    // Core metrics
    'llm.impact.thought_latency_ms': metrics.thoughtLatency,
    'llm.impact.token_count': metrics.tokenCount,
    'llm.impact.cost_usd': metrics.cost,

    // Quality metrics
    'llm.impact.confidence_score': Number(metrics.confidenceScore.toFixed(3)),
    'llm.impact.breakthrough_likelihood': Number(metrics.breakthroughLikelihood.toFixed(3)),
    'llm.impact.thought_quality': Number(metrics.thoughtQuality.toFixed(3)),

    // Efficiency metrics
    'llm.impact.cognitive_efficiency': Number(metrics.cognitiveEfficiency.toFixed(3)),
    'llm.impact.learning_velocity': Number(metrics.learningVelocity.toFixed(3)),
    'llm.impact.conceptual_depth': Number(metrics.conceptualDepth.toFixed(3)),
    'llm.impact.problem_solving_effectiveness': Number(
      metrics.problemSolvingEffectiveness.toFixed(3)
    ),
  };
}

/**
 * Create impact metrics event for Phoenix spans
 */
export function createImpactMetricsEvent(metrics: LLMImpactMetrics): {
  name: string;
  attributes: Record<string, any>;
} {
  return {
    name: 'llm.impact_analysis',
    attributes: {
      // Summary metrics
      overall_effectiveness: Number(
        (
          metrics.cognitiveEfficiency * 0.25 +
          metrics.thoughtQuality * 0.25 +
          metrics.learningVelocity * 0.2 +
          metrics.conceptualDepth * 0.15 +
          metrics.problemSolvingEffectiveness * 0.15
        ).toFixed(3)
      ),

      // Individual components
      efficiency: Number(metrics.cognitiveEfficiency.toFixed(3)),
      quality: Number(metrics.thoughtQuality.toFixed(3)),
      learning: Number(metrics.learningVelocity.toFixed(3)),
      depth: Number(metrics.conceptualDepth.toFixed(3)),
      effectiveness: Number(metrics.problemSolvingEffectiveness.toFixed(3)),

      // Context
      latency_ms: metrics.thoughtLatency,
      token_count: metrics.tokenCount,
      cost_usd: Number(metrics.cost.toFixed(6)),
    },
  };
}
