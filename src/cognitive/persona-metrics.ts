/**
 * @fileoverview Persona Performance Metrics System
 * 
 * Tracks and analyzes the performance of persona-based reasoning to optimize
 * the adaptive threshold system and validate decision quality.
 */

export interface PersonaMetrics {
  // Decision Quality Metrics
  synthesis_coherence: number; // 0-1: How well multiple personas integrate
  decision_confidence: number; // 0-1: Final confidence in synthesized output
  perspective_diversity: number; // 0-1: Measure of viewpoint variety
  conflict_resolution_time: number; // ms: Time to reconcile disagreements
  
  // Efficiency Metrics
  response_time: number; // ms: Total processing time
  tokens_generated: number; // Count of tokens in response
  persona_activation_rate: Record<number, number>; // How often each count is used
  adaptive_accuracy: number; // 0-1: How well system predicts optimal count
  
  // Outcome Metrics
  user_satisfaction: number; // 0-1: Inferred from follow-up patterns
  revision_rate: number; // 0-1: How often responses need correction
  breakthrough_achievement: boolean; // Did multi-persona lead to insights?
  error_prevention: boolean; // Caught issues via additional perspectives
  
  // Context Metadata
  complexity_score: number; // Input complexity that triggered persona count
  domain: string; // Problem domain
  persona_count_used: number; // Actual number of personas activated
  timestamp: number; // When this metric was recorded
}

export interface PersonaPreferences {
  // User configurable preferences
  persona_bias: 'efficiency' | 'balanced' | 'thorough'; // Default: 'balanced'
  persona_threshold_modifier: number; // 0.5-2.0, default: 1.0
  preferred_personas?: string[]; // Optional list of favored persona IDs
  complexity_override?: boolean; // Always use max personas for user's domain
  
  // Advanced preferences
  min_personas?: number; // Minimum personas to activate (default: 1)
  max_personas?: number; // Maximum personas to activate (default: 3)
  diversity_weight?: number; // 0-1: How much to prioritize diverse perspectives
  synthesis_strategy?: 'consensus' | 'weighted' | 'dialectic'; // How to combine views
}

export class PersonaMetricsCollector {
  private metrics: PersonaMetrics[] = [];
  private readonly MAX_METRICS_STORED = 1000;
  private readonly METRIC_AGGREGATION_WINDOW = 100; // Aggregate every 100 metrics
  
  constructor(private preferences: PersonaPreferences = { 
    persona_bias: 'balanced',
    persona_threshold_modifier: 1.0 
  }) {}
  
  /**
   * Record a new metric entry
   */
  recordMetric(metric: Partial<PersonaMetrics>): void {
    const fullMetric: PersonaMetrics = {
      synthesis_coherence: metric.synthesis_coherence ?? 0.5,
      decision_confidence: metric.decision_confidence ?? 0.5,
      perspective_diversity: metric.perspective_diversity ?? 0.5,
      conflict_resolution_time: metric.conflict_resolution_time ?? 0,
      response_time: metric.response_time ?? 0,
      tokens_generated: metric.tokens_generated ?? 0,
      persona_activation_rate: metric.persona_activation_rate ?? {},
      adaptive_accuracy: metric.adaptive_accuracy ?? 0.5,
      user_satisfaction: metric.user_satisfaction ?? 0.5,
      revision_rate: metric.revision_rate ?? 0,
      breakthrough_achievement: metric.breakthrough_achievement ?? false,
      error_prevention: metric.error_prevention ?? false,
      complexity_score: metric.complexity_score ?? 5,
      domain: metric.domain ?? 'general',
      persona_count_used: metric.persona_count_used ?? 2,
      timestamp: Date.now()
    };
    
    this.metrics.push(fullMetric);
    
    // Maintain sliding window
    if (this.metrics.length > this.MAX_METRICS_STORED) {
      this.metrics.shift();
    }
    
    // Trigger analysis if we hit the aggregation window
    if (this.metrics.length % this.METRIC_AGGREGATION_WINDOW === 0) {
      this.analyzeAndOptimize();
    }
  }
  
  /**
   * Get adjusted thresholds based on user preferences
   */
  getAdjustedThresholds(): {
    complexityThreshold: number;
    breakthroughThreshold: number;
    metacognitiveThreshold: number;
  } {
    const baseThresholds = {
      complexityThreshold: 7,
      breakthroughThreshold: 0.8,
      metacognitiveThreshold: 0.85
    };
    
    // Apply user preference bias
    let modifier = this.preferences.persona_threshold_modifier;
    
    switch (this.preferences.persona_bias) {
      case 'efficiency':
        // Increase thresholds to reduce 3-persona activation
        modifier *= 1.3;
        break;
      case 'thorough':
        // Decrease thresholds to increase 3-persona activation
        modifier *= 0.7;
        break;
      case 'balanced':
      default:
        // Use modifier as-is
        break;
    }
    
    return {
      complexityThreshold: baseThresholds.complexityThreshold * modifier,
      breakthroughThreshold: Math.min(0.95, baseThresholds.breakthroughThreshold * modifier),
      metacognitiveThreshold: Math.min(0.95, baseThresholds.metacognitiveThreshold * modifier)
    };
  }
  
  /**
   * Analyze metrics and suggest optimizations
   */
  private analyzeAndOptimize(): void {
    if (this.metrics.length < this.METRIC_AGGREGATION_WINDOW) return;
    
    const recentMetrics = this.metrics.slice(-this.METRIC_AGGREGATION_WINDOW);
    
    // Calculate averages
    const avgResponseTime = this.calculateAverage(recentMetrics, 'response_time');
    const avgCoherence = this.calculateAverage(recentMetrics, 'synthesis_coherence');
    const avgConfidence = this.calculateAverage(recentMetrics, 'decision_confidence');
    const avgDiversity = this.calculateAverage(recentMetrics, 'perspective_diversity');
    
    // Count persona usage patterns
    const personaCountUsage: Record<number, number> = {};
    recentMetrics.forEach(m => {
      const count = m.persona_count_used;
      personaCountUsage[count] = (personaCountUsage[count] || 0) + 1;
    });
    
    // Calculate breakthrough rate for different persona counts
    const breakthroughsByCount: Record<number, number> = {};
    const errorPreventionByCount: Record<number, number> = {};
    
    recentMetrics.forEach(m => {
      if (m.breakthrough_achievement) {
        breakthroughsByCount[m.persona_count_used] = (breakthroughsByCount[m.persona_count_used] || 0) + 1;
      }
      if (m.error_prevention) {
        errorPreventionByCount[m.persona_count_used] = (errorPreventionByCount[m.persona_count_used] || 0) + 1;
      }
    });
    
    // Log performance insights (disabled in MCP server context)
    // console.error('📊 Persona Performance Analysis:');
    // console.error(`  Avg Response Time: ${avgResponseTime.toFixed(0)}ms`);
    // console.error(`  Avg Coherence: ${avgCoherence.toFixed(2)}`);
    // console.error(`  Avg Confidence: ${avgConfidence.toFixed(2)}`);
    // console.error(`  Avg Diversity: ${avgDiversity.toFixed(2)}`);
    // console.error(`  Persona Count Usage:`, Object.entries(personaCountUsage));
    // console.error(`  Breakthroughs by Count:`, Object.entries(breakthroughsByCount));
    // console.error(`  Error Prevention by Count:`, Object.entries(errorPreventionByCount));
    
    // Auto-adjust preferences if patterns emerge
    this.suggestOptimizations(recentMetrics);
  }
  
  /**
   * Suggest optimizations based on metrics
   */
  private suggestOptimizations(metrics: PersonaMetrics[]): void {
    const avgResponseTime = this.calculateAverage(metrics, 'response_time');
    const avgCoherence = this.calculateAverage(metrics, 'synthesis_coherence');
    
    // If response times are too high and coherence is good, suggest efficiency mode
    if (avgResponseTime > 2000 && avgCoherence > 0.7) {
      // console.error('💡 Suggestion: Consider "efficiency" bias - response times are high but quality is good');
    }
    
    // If coherence is low, suggest thorough mode
    if (avgCoherence < 0.5) {
      // console.error('💡 Suggestion: Consider "thorough" bias - coherence could be improved with more perspectives');
    }
    
    // Check if 3-persona mode consistently produces breakthroughs
    const threePersonaMetrics = metrics.filter(m => m.persona_count_used === 3);
    if (threePersonaMetrics.length > 10) {
      const breakthroughRate = threePersonaMetrics.filter(m => m.breakthrough_achievement).length / threePersonaMetrics.length;
      if (breakthroughRate > 0.3) {
        // console.error(`💡 Insight: 3-persona mode achieving ${(breakthroughRate * 100).toFixed(0)}% breakthrough rate`);
      }
    }
  }
  
  /**
   * Calculate average for a numeric field
   */
  private calculateAverage(metrics: PersonaMetrics[], field: keyof PersonaMetrics): number {
    const values = metrics.map(m => m[field]).filter(v => typeof v === 'number') as number[];
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    totalMetrics: number;
    avgResponseTime: number;
    avgCoherence: number;
    personaCountDistribution: Record<number, number>;
    breakthroughRate: number;
    errorPreventionRate: number;
  } {
    if (this.metrics.length === 0) {
      return {
        totalMetrics: 0,
        avgResponseTime: 0,
        avgCoherence: 0,
        personaCountDistribution: {},
        breakthroughRate: 0,
        errorPreventionRate: 0
      };
    }
    
    const distribution: Record<number, number> = {};
    this.metrics.forEach(m => {
      distribution[m.persona_count_used] = (distribution[m.persona_count_used] || 0) + 1;
    });
    
    return {
      totalMetrics: this.metrics.length,
      avgResponseTime: this.calculateAverage(this.metrics, 'response_time'),
      avgCoherence: this.calculateAverage(this.metrics, 'synthesis_coherence'),
      personaCountDistribution: distribution,
      breakthroughRate: this.metrics.filter(m => m.breakthrough_achievement).length / this.metrics.length,
      errorPreventionRate: this.metrics.filter(m => m.error_prevention).length / this.metrics.length
    };
  }
  
  /**
   * Update user preferences
   */
  updatePreferences(newPreferences: Partial<PersonaPreferences>): void {
    this.preferences = { ...this.preferences, ...newPreferences };
    // console.error('🎯 Persona preferences updated:', this.preferences);
  }
  
  /**
   * Get current preferences
   */
  getPreferences(): PersonaPreferences {
    return { ...this.preferences };
  }
  
  /**
   * Export metrics for analysis
   */
  exportMetrics(): PersonaMetrics[] {
    return [...this.metrics];
  }
  
  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    // console.error('🧹 Persona metrics cleared');
  }
}

// Singleton instance for global access
export const personaMetrics = new PersonaMetricsCollector();