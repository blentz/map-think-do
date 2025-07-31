/**
 * @fileoverview Prompt Intelligence Plugin for AGI-like Learning
 * 
 * This plugin integrates stored prompt patterns with the cognitive orchestrator
 * to enable pattern learning, cognitive priming, and adaptive reasoning based
 * on historical prompt success patterns. Achieves true AGI-like learning from experience.
 */

import {
  CognitivePlugin,
  CognitiveContext,
  PluginActivation,
  PluginIntervention,
} from '../plugin-system.js';
import { MemoryStore, StoredPrompt, PromptQuery } from '../../memory/memory-store.js';
import { PromptClassifier } from '../../memory/prompt-intelligence/prompt-classifier.js';
import { IntentExtractor } from '../../memory/prompt-intelligence/intent-extractor.js';
import { SimilarityDetector } from '../../memory/prompt-intelligence/similarity-detector.js';
import { ComplexityEstimator } from '../../memory/prompt-intelligence/complexity-estimator.js';

/**
 * Prompt pattern insights for cognitive enhancement
 */
interface PromptPatternInsight {
  pattern_type: string;
  success_rate: number;
  average_complexity: number;
  common_strategies: string[];
  failure_modes: string[];
  cognitive_load_impact: number;
  breakthrough_indicators: string[];
}

/**
 * Cognitive priming recommendations based on prompt analysis
 */
interface CognitivePrimingRecommendation {
  reasoning_approach: string;
  cognitive_focus_areas: string[];
  expected_challenges: string[];
  success_strategies: string[];
  cognitive_resources_needed: {
    analytical_thinking: number;
    creative_thinking: number;
    systematic_approach: number;
    pattern_recognition: number;
  };
}

export class PromptIntelligencePlugin extends CognitivePlugin {
  private memoryStore?: MemoryStore;
  private promptClassifier: PromptClassifier;
  private intentExtractor: IntentExtractor;
  private similarityDetector: SimilarityDetector;
  private complexityEstimator: ComplexityEstimator;
  private activationThreshold = 0.4;
  private patternCache = new Map<string, PromptPatternInsight>();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes

  constructor() {
    super(
      'prompt-intelligence',
      'Prompt Intelligence Plugin',
      'Leverages stored prompt patterns for AGI-like learning and cognitive enhancement',
      '1.0.0'
    );
    
    // Initialize prompt intelligence components
    this.promptClassifier = new PromptClassifier();
    this.intentExtractor = new IntentExtractor();
    this.similarityDetector = new SimilarityDetector();
    this.complexityEstimator = new ComplexityEstimator();
  }

  /**
   * Set memory store for accessing prompt patterns
   */
  setMemoryStore(memoryStore: MemoryStore): void {
    this.memoryStore = memoryStore;
  }

  async shouldActivate(context: CognitiveContext): Promise<PluginActivation> {
    // Always activate for prompt pattern learning - this is core to AGI
    const currentThought = context.current_thought || '';
    const thoughtNumber = context.thought_history.length + 1;
    
    // Higher activation for early thoughts (need more guidance)
    const earlyThoughtBonus = thoughtNumber <= 3 ? 0.3 : 0;
    
    // Higher activation for complex prompts
    const complexity = await this.assessPromptComplexity(currentThought);
    const complexityBonus = complexity > 5 ? 0.2 : 0;
    
    // Base activation for pattern learning
    const baseActivation = 0.5;
    const activationScore = Math.min(1.0, baseActivation + earlyThoughtBonus + complexityBonus);

    return {
      should_activate: activationScore >= this.activationThreshold,
      priority: activationScore * 100,
      confidence: activationScore,
      reason: 'Prompt pattern learning and cognitive priming available',
      estimated_impact: activationScore > 0.8 ? 'high' : activationScore > 0.6 ? 'medium' : 'low',
      resource_requirements: {
        cognitive_load: 0.2,
        time_cost: 1,
        creativity_required: false,
        analysis_required: true,
      },
    };
  }

  async intervene(context: CognitiveContext): Promise<PluginIntervention> {
    const startTime = Date.now();
    const insights: any[] = [];
    const interventions: any[] = [];
    const recommendations: string[] = [];

    try {
      if (!this.memoryStore) {
        return this.createMinimalIntervention('Memory store not available for prompt intelligence');
      }

      const currentThought = context.current_thought || '';
      const sessionId = context.session?.id || 'unknown';

      // 1. Analyze current prompt characteristics
      const [classification, intent, complexity] = await Promise.all([
        this.promptClassifier.classifyPrompt(currentThought),
        this.intentExtractor.extractIntent(currentThought),
        this.complexityEstimator.estimateComplexity(currentThought)
      ]);

      insights.push({
        type: 'prompt_analysis',
        confidence: 0.9,
        description: `Current prompt classified as ${classification.type} with ${classification.confidence.toFixed(2)} confidence`,
        data: { classification, intent, complexity }
      });

      // 2. Find similar successful prompts for pattern learning
      const similarPrompts = await this.findSimilarSuccessfulPrompts(currentThought, classification.type);
      
      if (similarPrompts.length > 0) {
        const patternInsights = await this.analyzeSuccessPatterns(similarPrompts);
        insights.push({
          type: 'success_patterns',
          confidence: 0.8,
          description: `Found ${similarPrompts.length} similar successful prompts with patterns`,
          data: patternInsights
        });

        // 3. Generate cognitive priming recommendations
        const primingRecommendations = this.generateCognitivePriming(
          classification, 
          intent, 
          complexity, 
          patternInsights
        );

        interventions.push({
          type: 'context_enhancement',
          content: this.formatCognitivePrimingAdvice(primingRecommendations),
          metadata: {
            plugin_id: this.id,
            confidence: 0.8,
            expected_benefit: 'Cognitive priming from similar prompt patterns',
            priming_data: primingRecommendations,
            similar_prompts_count: similarPrompts.length
          }
        });

        recommendations.push(
          `Apply ${primingRecommendations.reasoning_approach} approach based on ${similarPrompts.length} similar successful prompts`
        );
      }

      // 4. Detect potential breakthrough opportunities
      const breakthroughPotential = this.assessBreakthroughPotential(classification, intent, complexity);
      if (breakthroughPotential.likelihood > 0.6) {
        interventions.push({
          type: 'meta_guidance',
          content: this.formatBreakthroughGuidance(breakthroughPotential),
          metadata: {
            plugin_id: this.id,
            confidence: breakthroughPotential.likelihood,
            expected_benefit: 'Breakthrough opportunity guidance',
            breakthrough_indicators: breakthroughPotential.indicators
          }
        });

        recommendations.push('High breakthrough potential detected - apply creative and systematic thinking');
      }

      // 5. Learning feedback for future pattern recognition
      const learningInsights = this.generateLearningInsights(classification, intent, complexity, similarPrompts);
      insights.push({
        type: 'pattern_learning',
        confidence: 0.7,
        description: 'Generated learning insights for future cognitive enhancement',
        data: learningInsights
      });

      // Combine all insights and interventions into a single comprehensive intervention
      const combinedContent = this.combineInterventionContent(interventions, insights, recommendations);
      
      return {
        type: 'context_enhancement',
        content: combinedContent,
        metadata: {
          plugin_id: this.id,
          confidence: insights.length > 0 ? insights[0].confidence : 0.7,
          expected_benefit: 'AGI-like cognitive priming and pattern learning enhancement',
          side_effects: ['increased processing complexity', 'potential cognitive bias from historical patterns'],
        },
        follow_up_needed: true,
        next_check_after: 2,
        success_metrics: ['improved reasoning quality', 'better pattern recognition', 'enhanced cognitive priming'],
        failure_indicators: ['pattern over-reliance', 'reduced flexibility', 'cognitive bias amplification'],
      };

    } catch (error) {
      console.error(`Error in ${this.id} intervention:`, error);
      return this.createMinimalIntervention(`Error during prompt intelligence analysis: ${error}`);
    }
  }

  /**
   * Assess prompt complexity quickly
   */
  private async assessPromptComplexity(prompt: string): Promise<number> {
    try {
      const complexity = await this.complexityEstimator.estimateComplexity(prompt);
      return complexity.complexity;
    } catch (error) {
      return 3; // Default medium complexity
    }
  }

  /**
   * Find similar successful prompts for pattern learning
   */
  private async findSimilarSuccessfulPrompts(
    currentPrompt: string, 
    promptType: string
  ): Promise<StoredPrompt[]> {
    try {
      // Query for recent successful prompts of similar type
      const recentPrompts = await this.memoryStore!.queryPrompts({
        prompt_type: promptType,
        processing_success: true,
        limit: 50
      });

      // Use similarity detector to find most relevant prompts
      const similarPrompts = await this.similarityDetector.findSimilarPrompts(
        currentPrompt,
        recentPrompts,
        10,
        0.4
      );

      return recentPrompts.filter(p => 
        similarPrompts.some(s => s.prompt_id === p.id)
      );
    } catch (error) {
      console.error('Error finding similar prompts:', error);
      return [];
    }
  }

  /**
   * Analyze success patterns from similar prompts
   */
  private async analyzeSuccessPatterns(prompts: StoredPrompt[]): Promise<PromptPatternInsight> {
    const successfulPrompts = prompts.filter(p => p.processing_success === true);
    const successRate = successfulPrompts.length / prompts.length;
    
    const avgComplexity = prompts.reduce((sum, p) => sum + (p.complexity_estimate || 0), 0) / prompts.length;
    
    // Extract common strategies from successful prompts
    const strategies = new Set<string>();
    const failures = new Set<string>();
    let totalCognitiveLoad = 0;
    
    for (const prompt of prompts) {
      if (prompt.processing_success) {
        // Extract successful strategies from objectives and requirements
        prompt.extracted_intent?.objectives?.forEach((obj: string) => {
          if (obj.includes('step') || obj.includes('systematic')) strategies.add('systematic_approach');
          if (obj.includes('creative') || obj.includes('innovative')) strategies.add('creative_thinking');
          if (obj.includes('analyze') || obj.includes('examine')) strategies.add('analytical_thinking');
        });
      } else {
        // Extract failure modes
        if (prompt.complexity_estimate && prompt.complexity_estimate > 7) failures.add('high_complexity');
        if ((prompt.extracted_intent?.constraints?.length || 0) > 3) failures.add('over_constrained');
      }
      
      totalCognitiveLoad += prompt.estimated_cognitive_load || 0;
    }

    return {
      pattern_type: prompts[0]?.prompt_type || 'unknown',
      success_rate: successRate,
      average_complexity: avgComplexity,
      common_strategies: Array.from(strategies),
      failure_modes: Array.from(failures),
      cognitive_load_impact: totalCognitiveLoad / prompts.length,
      breakthrough_indicators: ['systematic_approach', 'creative_synthesis', 'pattern_recognition']
    };
  }

  /**
   * Generate cognitive priming recommendations
   */
  private generateCognitivePriming(
    classification: any,
    intent: any,
    complexity: any,
    patterns: PromptPatternInsight
  ): CognitivePrimingRecommendation {
    // Determine reasoning approach based on classification and patterns
    let reasoningApproach = 'balanced_reasoning';
    if (classification.type === 'debugging') reasoningApproach = 'systematic_debugging';
    else if (classification.type === 'architecture') reasoningApproach = 'architectural_thinking';
    else if (classification.type === 'feature-request') reasoningApproach = 'user_centered_design';
    else if (classification.type === 'optimization') reasoningApproach = 'performance_analysis';
    else if (patterns.success_rate > 0.8) reasoningApproach = 'proven_approach';

    // Determine cognitive focus areas
    const focusAreas: string[] = [];
    if (complexity.complexity > 6) focusAreas.push('complexity_management');
    if (intent.constraints.length > 0) focusAreas.push('constraint_satisfaction');
    if (intent.objectives.length > 2) focusAreas.push('multi_objective_optimization');
    if (patterns.common_strategies.includes('creative_thinking')) focusAreas.push('creative_synthesis');
    if (patterns.common_strategies.includes('systematic_approach')) focusAreas.push('systematic_analysis');

    // Predict challenges based on pattern analysis
    const expectedChallenges = [...patterns.failure_modes];
    if (complexity.complexity > 7) expectedChallenges.push('cognitive_overload');
    if (intent.ambiguity_score > 0.5) expectedChallenges.push('ambiguity_resolution');

    return {
      reasoning_approach: reasoningApproach,
      cognitive_focus_areas: focusAreas,
      expected_challenges: expectedChallenges,
      success_strategies: patterns.common_strategies,
      cognitive_resources_needed: {
        analytical_thinking: Math.min(1, complexity.complexity / 10),
        creative_thinking: patterns.common_strategies.includes('creative_thinking') ? 0.8 : 0.3,
        systematic_approach: patterns.common_strategies.includes('systematic_approach') ? 0.9 : 0.5,
        pattern_recognition: patterns.success_rate
      }
    };
  }

  /**
   * Assess breakthrough potential based on prompt characteristics
   */
  private assessBreakthroughPotential(classification: any, intent: any, complexity: any): {
    likelihood: number;
    indicators: string[];
    guidance: string[];
  } {
    const indicators: string[] = [];
    let likelihood = 0.3; // Base likelihood

    // High complexity often leads to breakthroughs
    if (complexity.complexity > 7) {
      likelihood += 0.2;
      indicators.push('high_complexity');
    }

    // Creative problem types have higher breakthrough potential
    if (classification.type === 'architecture' || classification.type === 'feature-request') {
      likelihood += 0.2;
      indicators.push('creative_problem_type');
    }

    // Multiple objectives increase breakthrough potential
    if (intent.objectives.length > 2) {
      likelihood += 0.15;
      indicators.push('multi_objective_problem');
    }

    // Novel combinations of constraints and requirements
    if (intent.constraints.length > 1 && intent.requirements.length > 1) {
      likelihood += 0.15;
      indicators.push('constraint_requirement_interaction');
    }

    const guidance: string[] = [];
    if (likelihood > 0.6) {
      guidance.push('Apply divergent thinking before convergent analysis');
      guidance.push('Consider unconventional approaches and analogies');
      guidance.push('Challenge assumptions and explore alternative framings');
    }

    return { likelihood: Math.min(likelihood, 1.0), indicators, guidance };
  }

  /**
   * Generate learning insights for future pattern recognition
   */
  private generateLearningInsights(
    classification: any,
    intent: any,
    complexity: any,
    similarPrompts: StoredPrompt[]
  ): any {
    return {
      prompt_characteristics: {
        type: classification.type,
        confidence: classification.confidence,
        complexity_level: complexity.complexity,
        intent_clarity: intent.extraction_confidence
      },
      historical_context: {
        similar_prompts_count: similarPrompts.length,
        average_success_rate: similarPrompts.filter(p => p.processing_success).length / Math.max(similarPrompts.length, 1),
        pattern_strength: similarPrompts.length > 5 ? 'strong' : similarPrompts.length > 2 ? 'moderate' : 'weak'
      },
      learning_opportunities: {
        pattern_reinforcement: similarPrompts.length > 0,
        novel_exploration: similarPrompts.length === 0,
        complexity_calibration: Math.abs(complexity.complexity - 5) > 2
      }
    };
  }

  /**
   * Format cognitive priming advice for output
   */
  private formatCognitivePrimingAdvice(priming: CognitivePrimingRecommendation): string {
    let advice = `**🧠 Cognitive Priming Based on Pattern Analysis**\n\n`;
    
    advice += `**Recommended Approach:** ${priming.reasoning_approach.replace(/_/g, ' ')}\n\n`;
    
    if (priming.cognitive_focus_areas.length > 0) {
      advice += `**Focus Areas:**\n`;
      priming.cognitive_focus_areas.forEach(area => {
        advice += `• ${area.replace(/_/g, ' ')}\n`;
      });
      advice += '\n';
    }

    if (priming.success_strategies.length > 0) {
      advice += `**Proven Success Strategies:**\n`;
      priming.success_strategies.forEach(strategy => {
        advice += `• ${strategy.replace(/_/g, ' ')}\n`;
      });
      advice += '\n';
    }

    if (priming.expected_challenges.length > 0) {
      advice += `**Potential Challenges to Watch:**\n`;
      priming.expected_challenges.forEach(challenge => {
        advice += `• ${challenge.replace(/_/g, ' ')}\n`;
      });
    }

    return advice;
  }

  /**
   * Format breakthrough guidance
   */
  private formatBreakthroughGuidance(breakthrough: any): string {
    let guidance = `**🚀 Breakthrough Opportunity Detected!**\n\n`;
    guidance += `**Likelihood:** ${(breakthrough.likelihood * 100).toFixed(0)}%\n\n`;
    
    if (breakthrough.indicators.length > 0) {
      guidance += `**Breakthrough Indicators:**\n`;
      breakthrough.indicators.forEach((indicator: string) => {
        guidance += `• ${indicator.replace(/_/g, ' ')}\n`;
      });
      guidance += '\n';
    }

    if (breakthrough.guidance.length > 0) {
      guidance += `**Breakthrough Strategies:**\n`;
      breakthrough.guidance.forEach((guide: string) => {
        guidance += `• ${guide}\n`;
      });
    }

    return guidance;
  }

  /**
   * Create minimal intervention for error cases
   */
  /**
   * Combine multiple intervention components into a single content string
   */
  private combineInterventionContent(interventions: any[], insights: any[], recommendations: string[]): string {
    let content = '';

    if (interventions.length > 0) {
      content += '## 🧠 AGI Cognitive Enhancement\n\n';
      interventions.forEach((intervention, index) => {
        if (intervention.content) {
          content += `### ${intervention.type || 'Enhancement'} ${index + 1}\n`;
          content += intervention.content + '\n\n';
        }
      });
    }

    if (insights.length > 0) {
      content += '## 📊 Pattern Intelligence Insights\n\n';
      insights.forEach((insight, index) => {
        content += `**${insight.type}:** ${insight.description}\n`;
        if (insight.confidence) {
          content += `*Confidence: ${(insight.confidence * 100).toFixed(0)}%*\n\n`;
        }
      });
    }

    if (recommendations.length > 0) {
      content += '## 💡 AGI Recommendations\n\n';
      recommendations.forEach(rec => {
        content += `• ${rec}\n`;
      });
    }

    return content || 'AGI prompt intelligence analysis completed with no specific recommendations.';
  }

  private createMinimalIntervention(message: string): PluginIntervention {
    return {
      type: 'context_enhancement',
      content: `⚠️ ${message}`,
      metadata: {
        plugin_id: this.id,
        confidence: 0.3,
        expected_benefit: 'Error recovery and graceful degradation',
      },
    };
  }

  /**
   * Receive feedback for adaptive learning (required by CognitivePlugin)
   */
  async receiveFeedback(
    intervention: PluginIntervention,
    outcome: 'success' | 'failure' | 'partial',
    impact_score: number,
    context: CognitiveContext
  ): Promise<void> {
    // Store feedback for pattern learning
    console.error(`📝 Prompt Intelligence Plugin received feedback: outcome=${outcome}, impact=${impact_score}`);
  }

  /**
   * Adapt plugin behavior based on feedback (required by CognitivePlugin)
   */
  async adapt(
    performanceMetrics: {
      success_rate: number;
      average_confidence: number;
      user_feedback_score: number;
    }
  ): Promise<void> {
    // Adjust activation threshold based on performance
    if (performanceMetrics.success_rate > 0.8) {
      this.activationThreshold = Math.max(0.3, this.activationThreshold - 0.05);
    } else if (performanceMetrics.success_rate < 0.6) {
      this.activationThreshold = Math.min(0.6, this.activationThreshold + 0.05);
    }
    console.error(`🎯 Prompt Intelligence Plugin adapted threshold to ${this.activationThreshold}`);
  }
}