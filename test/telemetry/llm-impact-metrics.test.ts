/**
 * Test suite for LLM Impact Metrics
 */

import {
  calculateCognitiveEfficiency,
  calculateThoughtQuality,
  calculateLearningVelocity,
  calculateConceptualDepth,
  calculateProblemSolvingEffectiveness,
  calculateConfidenceScore,
  calculateLLMImpactMetrics,
  createImpactMetricAttributes,
  createImpactMetricsEvent,
} from '../../src/telemetry/llm-impact-metrics.js';
import { CognitiveState, LLMImpactMetrics } from '../../src/telemetry/types.js';

describe('LLM Impact Metrics', () => {
  const mockCognitiveState: CognitiveState = {
    thought_count: 5,
    current_complexity: 7,
    confidence_trajectory: [0.5, 0.6, 0.7, 0.8, 0.9],
    metacognitive_awareness: 0.8,
    creative_pressure: 0.6,
    analytical_depth: 0.7,
    self_doubt_level: 0.2,
    curiosity_level: 0.9,
    frustration_level: 0.1,
    engagement_level: 0.95,
    cognitive_efficiency: 0.75,
    insight_potential: 0.85,
    breakthrough_likelihood: 0.8,
    recent_success_rate: 0.9,
    improvement_trajectory: 0.1,
  };

  describe('calculateCognitiveEfficiency', () => {
    it('should calculate efficiency based on insights and costs', () => {
      const efficiency = calculateCognitiveEfficiency(5, 1000, 0.001);
      expect(efficiency).toBeGreaterThan(0);
      expect(efficiency).toBeLessThanOrEqual(1);
    });

    it('should return 1 for high insights with zero cost', () => {
      const efficiency = calculateCognitiveEfficiency(5, 0, 0);
      expect(efficiency).toBe(1.0);
    });

    it('should return 0 for no insights with zero cost', () => {
      const efficiency = calculateCognitiveEfficiency(0, 0, 0);
      expect(efficiency).toBe(0.0);
    });

    it('should handle high latency correctly', () => {
      const efficiency = calculateCognitiveEfficiency(1, 15000, 0.001); // 15 seconds
      expect(efficiency).toBeGreaterThan(0);
      expect(efficiency).toBeLessThan(0.5); // Should be penalized for high latency
    });
  });

  describe('calculateThoughtQuality', () => {
    it('should calculate quality from cognitive state', () => {
      const quality = calculateThoughtQuality(mockCognitiveState);
      expect(quality).toBeGreaterThan(0.5); // Should be high with good mock data
      expect(quality).toBeLessThanOrEqual(1);
    });

    it('should handle empty cognitive state', () => {
      const quality = calculateThoughtQuality({});
      expect(quality).toBe(0);
    });

    it('should weight metacognitive awareness heavily', () => {
      const highMeta = calculateThoughtQuality({
        ...mockCognitiveState,
        metacognitive_awareness: 1.0,
      });
      const lowMeta = calculateThoughtQuality({
        ...mockCognitiveState,
        metacognitive_awareness: 0.1,
      });
      expect(highMeta).toBeGreaterThan(lowMeta);
    });
  });

  describe('calculateLearningVelocity', () => {
    it('should calculate positive velocity for improving trajectory', () => {
      const velocity = calculateLearningVelocity(mockCognitiveState);
      expect(velocity).toBeGreaterThan(0.5); // Improving trajectory should show positive velocity
      expect(velocity).toBeLessThanOrEqual(1);
    });

    it('should return 0 for insufficient trajectory length', () => {
      const shortState = {
        ...mockCognitiveState,
        confidence_trajectory: [0.5, 0.6], // Too short
      };
      const velocity = calculateLearningVelocity(shortState);
      expect(velocity).toBe(0);
    });

    it('should handle declining trajectory', () => {
      const decliningState = {
        ...mockCognitiveState,
        confidence_trajectory: [0.9, 0.8, 0.7, 0.6, 0.5], // Declining
      };
      const velocity = calculateLearningVelocity(decliningState);
      expect(velocity).toBeLessThan(0.5); // Should indicate negative learning
    });
  });

  describe('calculateConceptualDepth', () => {
    it('should calculate depth from complexity and insights', () => {
      const depth = calculateConceptualDepth(5, 3, mockCognitiveState);
      expect(depth).toBeGreaterThan(0);
      expect(depth).toBeLessThanOrEqual(1);
    });

    it('should increase with more insights', () => {
      const lowInsight = calculateConceptualDepth(1, 1, mockCognitiveState);
      const highInsight = calculateConceptualDepth(10, 1, mockCognitiveState);
      expect(highInsight).toBeGreaterThan(lowInsight);
    });

    it('should increase with higher complexity', () => {
      const lowComplexity = calculateConceptualDepth(5, 3, {
        ...mockCognitiveState,
        current_complexity: 2,
      });
      const highComplexity = calculateConceptualDepth(5, 3, {
        ...mockCognitiveState,
        current_complexity: 9,
      });
      expect(highComplexity).toBeGreaterThan(lowComplexity);
    });
  });

  describe('calculateProblemSolvingEffectiveness', () => {
    it('should calculate effectiveness from success rate and complexity', () => {
      const effectiveness = calculateProblemSolvingEffectiveness(mockCognitiveState, 5);
      expect(effectiveness).toBeGreaterThan(0.5); // Should be high with good success rate
      expect(effectiveness).toBeLessThanOrEqual(1);
    });

    it('should reward higher complexity problems', () => {
      const lowComplexity = calculateProblemSolvingEffectiveness(
        {
          ...mockCognitiveState,
          current_complexity: 2,
        },
        5
      );
      const highComplexity = calculateProblemSolvingEffectiveness(
        {
          ...mockCognitiveState,
          current_complexity: 9,
        },
        5
      );
      expect(highComplexity).toBeGreaterThan(lowComplexity);
    });
  });

  describe('calculateConfidenceScore', () => {
    it('should calculate composite confidence score', () => {
      const confidence = calculateConfidenceScore(mockCognitiveState);
      expect(confidence).toBeGreaterThan(0.5); // Should be high with good mock data
      expect(confidence).toBeLessThanOrEqual(1);
    });

    it('should be penalized by self doubt', () => {
      const lowDoubt = calculateConfidenceScore({
        ...mockCognitiveState,
        self_doubt_level: 0.1,
      });
      const highDoubt = calculateConfidenceScore({
        ...mockCognitiveState,
        self_doubt_level: 0.8,
      });
      expect(lowDoubt).toBeGreaterThan(highDoubt);
    });
  });

  describe('calculateLLMImpactMetrics', () => {
    it('should calculate complete impact metrics', () => {
      const input = {
        latencyMs: 1500,
        tokenCount: 250,
        cost: 0.0012,
        insightCount: 4,
        interventionCount: 2,
        cognitiveState: mockCognitiveState,
      };

      const metrics = calculateLLMImpactMetrics(input);

      expect(metrics.thoughtLatency).toBe(1500);
      expect(metrics.tokenCount).toBe(250);
      expect(metrics.cost).toBe(0.0012);
      expect(metrics.confidenceScore).toBeGreaterThan(0);
      expect(metrics.breakthroughLikelihood).toBe(0.8);
      expect(metrics.cognitiveEfficiency).toBeGreaterThan(0);
      expect(metrics.thoughtQuality).toBeGreaterThan(0);
      expect(metrics.learningVelocity).toBeGreaterThan(0);
      expect(metrics.conceptualDepth).toBeGreaterThan(0);
      expect(metrics.problemSolvingEffectiveness).toBeGreaterThan(0);
    });
  });

  describe('createImpactMetricAttributes', () => {
    it('should create Phoenix-compatible span attributes', () => {
      const mockMetrics: LLMImpactMetrics = {
        thoughtLatency: 1500,
        tokenCount: 250,
        cost: 0.0012,
        confidenceScore: 0.85,
        breakthroughLikelihood: 0.8,
        cognitiveEfficiency: 0.75,
        thoughtQuality: 0.82,
        learningVelocity: 0.65,
        conceptualDepth: 0.78,
        problemSolvingEffectiveness: 0.88,
      };

      const attributes = createImpactMetricAttributes(mockMetrics);

      expect(attributes['llm.impact.thought_latency_ms']).toBe(1500);
      expect(attributes['llm.impact.token_count']).toBe(250);
      expect(attributes['llm.impact.cost_usd']).toBe(0.0012);
      expect(attributes['llm.impact.confidence_score']).toBe(0.85);
      expect(attributes['llm.impact.breakthrough_likelihood']).toBe(0.8);
      expect(attributes['llm.impact.cognitive_efficiency']).toBe(0.75);
      expect(attributes['llm.impact.thought_quality']).toBe(0.82);
      expect(attributes['llm.impact.learning_velocity']).toBe(0.65);
      expect(attributes['llm.impact.conceptual_depth']).toBe(0.78);
      expect(attributes['llm.impact.problem_solving_effectiveness']).toBe(0.88);
    });
  });

  describe('createImpactMetricsEvent', () => {
    it('should create Phoenix-compatible event', () => {
      const mockMetrics: LLMImpactMetrics = {
        thoughtLatency: 1500,
        tokenCount: 250,
        cost: 0.0012,
        confidenceScore: 0.85,
        breakthroughLikelihood: 0.8,
        cognitiveEfficiency: 0.75,
        thoughtQuality: 0.82,
        learningVelocity: 0.65,
        conceptualDepth: 0.78,
        problemSolvingEffectiveness: 0.88,
      };

      const event = createImpactMetricsEvent(mockMetrics);

      expect(event.name).toBe('llm.impact_analysis');
      expect(event.attributes.overall_effectiveness).toBeGreaterThan(0);
      expect(event.attributes.efficiency).toBe(0.75);
      expect(event.attributes.quality).toBe(0.82);
      expect(event.attributes.learning).toBe(0.65);
      expect(event.attributes.depth).toBe(0.78);
      expect(event.attributes.effectiveness).toBe(0.88);
      expect(event.attributes.latency_ms).toBe(1500);
      expect(event.attributes.token_count).toBe(250);
      expect(event.attributes.cost_usd).toBe(0.0012);
    });
  });

  describe('Edge cases and robustness', () => {
    it('should handle extreme values gracefully', () => {
      const extremeInput = {
        latencyMs: 60000, // 1 minute
        tokenCount: 100000,
        cost: 10.0,
        insightCount: 0,
        interventionCount: 0,
        cognitiveState: {},
      };

      const metrics = calculateLLMImpactMetrics(extremeInput);

      // All metrics should be within valid ranges
      Object.values(metrics).forEach(value => {
        if (typeof value === 'number') {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(60000); // thoughtLatency can exceed 1
        }
      });
    });

    it('should be deterministic with same inputs', () => {
      const input = {
        latencyMs: 1500,
        tokenCount: 250,
        cost: 0.0012,
        insightCount: 4,
        interventionCount: 2,
        cognitiveState: mockCognitiveState,
      };

      const metrics1 = calculateLLMImpactMetrics(input);
      const metrics2 = calculateLLMImpactMetrics(input);

      expect(metrics1).toEqual(metrics2);
    });
  });
});
