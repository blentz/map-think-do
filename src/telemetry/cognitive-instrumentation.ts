import { trace, Span, SpanKind, metrics, Histogram, Counter } from '@opentelemetry/api';
import { EventEmitter } from 'events';
import { TelemetryConfig } from './telemetry-config.js';

export class CognitiveInstrumentation {
  private static instance: CognitiveInstrumentation;
  private tracer = trace.getTracer('cognitive-system');
  private meter = metrics.getMeter('cognitive-system');
  private config = TelemetryConfig.getInstance();
  private orchestrator: EventEmitter | null = null;
  private activePluginSpans = new Map<string, { span: Span; startTime: number }>();
  private sessionStats = new Map<string, any>();

  // Semantic event counters
  private personaSwitchCounter: Counter;
  private breakthroughCounter: Counter;
  private insightCounter: Counter;
  private patternCounter: Counter;
  private deadlockCounter: Counter;

  // Plugin performance histograms
  private pluginLatencyHistogram: Histogram;
  private personaContributionHistogram: Histogram;

  private constructor() {
    // Initialize semantic counters
    this.personaSwitchCounter = this.meter.createCounter('cognitive.persona.switches', {
      description: 'Number of persona switches during reasoning',
    });

    this.breakthroughCounter = this.meter.createCounter('cognitive.breakthroughs', {
      description: 'Number of cognitive breakthroughs detected',
    });

    this.insightCounter = this.meter.createCounter('cognitive.insights', {
      description: 'Number of insights discovered',
    });

    this.patternCounter = this.meter.createCounter('cognitive.patterns', {
      description: 'Number of patterns recognized',
    });

    this.deadlockCounter = this.meter.createCounter('cognitive.deadlocks', {
      description: 'Number of cognitive deadlocks encountered',
    });

    // Initialize performance histograms
    this.pluginLatencyHistogram = this.meter.createHistogram('cognitive.plugin.latency', {
      description: 'Latency of cognitive plugin execution',
      unit: 'ms',
    });

    this.personaContributionHistogram = this.meter.createHistogram(
      'cognitive.persona.contribution',
      {
        description: 'Contribution score of each persona',
        unit: 'score',
      }
    );
  }

  public static getInstance(): CognitiveInstrumentation {
    if (!CognitiveInstrumentation.instance) {
      CognitiveInstrumentation.instance = new CognitiveInstrumentation();
    }
    return CognitiveInstrumentation.instance;
  }

  public attachToOrchestrator(orchestrator: EventEmitter): void {
    if (this.orchestrator) {
      // Already attached - skip duplicate attachment
      return;
    }

    this.orchestrator = orchestrator;
    this.attachListeners();
    // Cognitive instrumentation attached to orchestrator
  }

  private attachListeners(): void {
    if (!this.orchestrator) return;

    this.orchestrator.on('plugin:activated', (data: any) => {
      this.onPluginActivated(data);
    });

    this.orchestrator.on('plugin:completed', (data: any) => {
      this.onPluginCompleted(data);
    });

    this.orchestrator.on('breakthrough:detected', (data: any) => {
      this.onBreakthroughDetected(data);
    });

    this.orchestrator.on('metacognitive:reflection', (data: any) => {
      this.onMetacognitiveReflection(data);
    });

    this.orchestrator.on('persona:switched', (data: any) => {
      this.onPersonaSwitched(data);
    });

    this.orchestrator.on('thought:processed', (data: any) => {
      this.onThoughtProcessed(data);
    });

    this.orchestrator.on('insight:discovered', (data: any) => {
      this.onInsightDiscovered(data);
    });

    this.orchestrator.on('pattern:recognized', (data: any) => {
      this.onPatternRecognized(data);
    });

    // New semantic events
    this.orchestrator.on('cognitive:deadlock', (data: any) => {
      this.onCognitiveDeadlock(data);
    });

    this.orchestrator.on('decision:made', (data: any) => {
      this.onDecisionMade(data);
    });

    this.orchestrator.on('memory:accessed', (data: any) => {
      this.onMemoryAccessed(data);
    });
  }

  private onPluginActivated(data: any): void {
    if (!this.config.isEnabled()) return;

    const { pluginName, persona, confidence, sessionId, context } = data;
    const spanName = `cognitive.plugin.${pluginName}`;
    const startTime = performance.now();

    const span = this.tracer.startSpan(spanName, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'cognitive.plugin': pluginName,
        'cognitive.persona': persona,
        'cognitive.event_type': 'plugin_activated',
        'cognitive.confidence': confidence,
        'cognitive.session_id': sessionId || 'unknown',
        'cognitive.activation_context': context || 'standard',
      },
    });

    this.activePluginSpans.set(pluginName, { span, startTime });
    this.updateSessionStats(sessionId, 'plugin_activation', pluginName);

    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.addEvent('cognitive.plugin.activated', {
        plugin: pluginName,
        persona,
        confidence,
        context,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private onPluginCompleted(data: any): void {
    if (!this.config.isEnabled()) return;

    const { pluginName, duration, success, result, metrics } = data;
    const spanData = this.activePluginSpans.get(pluginName);

    if (spanData) {
      const actualDuration = performance.now() - spanData.startTime;
      const memoryUsage = process.memoryUsage();

      spanData.span.setAttribute('cognitive.plugin.duration_ms', actualDuration);
      spanData.span.setAttribute('cognitive.plugin.success', success);
      spanData.span.setAttribute('resource.memory.heap_after_mb', memoryUsage.heapUsed / 1048576);

      if (result) {
        spanData.span.setAttribute('cognitive.plugin.result_size', JSON.stringify(result).length);
        spanData.span.setAttribute('cognitive.plugin.has_insights', !!result.insights);
        spanData.span.setAttribute('cognitive.plugin.insight_count', result.insights?.length || 0);
        spanData.span.setAttribute(
          'cognitive.plugin.intervention_count',
          result.interventions?.length || 0
        );

        // Add cognitive metrics from result
        if (result.cognitiveMetrics) {
          spanData.span.setAttribute(
            'cognitive.plugin.metacognitive_awareness',
            result.cognitiveMetrics.metacognitive_awareness || 0
          );
          spanData.span.setAttribute(
            'cognitive.plugin.creative_pressure',
            result.cognitiveMetrics.creative_pressure || 0
          );
          spanData.span.setAttribute(
            'cognitive.plugin.breakthrough_likelihood',
            result.cognitiveMetrics.breakthrough_likelihood || 0
          );
        }
      }

      // Add any additional metrics passed from the plugin
      if (metrics) {
        Object.entries(metrics).forEach(([key, value]) => {
          spanData.span.setAttribute(`cognitive.plugin.metric.${key}`, value as any);
        });
      }

      // Record histogram metric
      this.pluginLatencyHistogram.record(actualDuration, {
        plugin: pluginName,
        success: String(success),
      });

      spanData.span.end();
      this.activePluginSpans.delete(pluginName);
    }

    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.addEvent('cognitive.plugin.completed', {
        plugin: pluginName,
        duration,
        success,
        hasResult: !!result,
        insightCount: result?.insights?.length || 0,
        interventionCount: result?.interventions?.length || 0,
      });
    }
  }

  private onBreakthroughDetected(data: any): void {
    if (!this.config.isEnabled()) return;

    const { type, insightPotential, confidence, description, context, sessionId } = data;

    // Increment counter
    this.breakthroughCounter.add(1, {
      type,
      confidence_level: confidence > 0.8 ? 'high' : confidence > 0.5 ? 'medium' : 'low',
    });

    const span = this.tracer.startSpan('cognitive.breakthrough', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'cognitive.breakthrough_type': type,
        'cognitive.insight_potential': insightPotential,
        'cognitive.confidence': confidence,
        'cognitive.event_type': 'breakthrough_detected',
        'cognitive.session_id': sessionId || 'unknown',
      },
    });

    span.addEvent('breakthrough.details', {
      description,
      context: JSON.stringify(context || {}),
      timestamp: new Date().toISOString(),
      significance: this.calculateSignificance(insightPotential, confidence),
    });

    span.end();
    this.updateSessionStats(sessionId, 'breakthrough', type);

    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.addEvent('cognitive.breakthrough.detected', {
        type,
        insightPotential,
        confidence,
        context: context ? 'provided' : 'none',
      });
    }
  }

  private onMetacognitiveReflection(data: any): void {
    if (!this.config.isEnabled()) return;

    const {
      awareness,
      biasDetected,
      correctionApplied,
      reflectionDepth,
      sessionId,
      cognitiveMetrics,
      biasTypes,
      interventions,
      selfAssessment,
    } = data;

    const span = this.tracer.startSpan('cognitive.metacognitive.reflection', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'cognitive.metacognitive_awareness': awareness,
        'cognitive.bias_detected': biasDetected,
        'cognitive.correction_applied': correctionApplied,
        'cognitive.reflection_depth': reflectionDepth,
        'cognitive.event_type': 'metacognitive_reflection',
        'cognitive.session_id': sessionId || 'unknown',
        // Add cognitive metrics if available
        'cognitive.self_doubt_level': cognitiveMetrics?.self_doubt_level || 0,
        'cognitive.curiosity_level': cognitiveMetrics?.curiosity_level || 0,
        'cognitive.analytical_depth': cognitiveMetrics?.analytical_depth || 0,
        'cognitive.self_reflection_depth': cognitiveMetrics?.self_reflection_depth || 0,
        'cognitive.improvement_trajectory': cognitiveMetrics?.improvement_trajectory || 0,
      },
    });

    // Add detailed event about the reflection
    span.addEvent('metacognitive.analysis', {
      bias_types_detected: biasTypes?.join(', ') || 'none',
      intervention_count: interventions?.length || 0,
      self_assessment_score: selfAssessment?.score || 0,
      self_assessment_confidence: selfAssessment?.confidence || 0,
    });

    span.end();

    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.setAttribute('cognitive.metacognitive_awareness', awareness);
      currentSpan.setAttribute('cognitive.reflection_depth', reflectionDepth);
      currentSpan.setAttribute('cognitive.bias_correction_active', correctionApplied);

      currentSpan.addEvent('cognitive.metacognitive.reflection', {
        biasDetected,
        correctionApplied,
        reflectionDepth,
        biasCount: biasTypes?.length || 0,
        interventionApplied: interventions?.length > 0,
        awarenessLevel: awareness > 0.7 ? 'high' : awareness > 0.4 ? 'medium' : 'low',
      });
    }
  }

  private onPersonaSwitched(data: any): void {
    if (!this.config.isEnabled()) return;

    const {
      fromPersona,
      toPersona,
      reason,
      confidence,
      sessionId,
      complexity,
      domain,
      activePersonaCount,
      personaMetrics,
    } = data;

    // Increment counter
    this.personaSwitchCounter.add(1, {
      from: fromPersona,
      to: toPersona,
    });

    // Record persona contribution
    if (confidence !== undefined) {
      this.personaContributionHistogram.record(confidence * 100, {
        persona: toPersona,
      });
    }

    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.setAttribute('cognitive.persona', toPersona);
      currentSpan.setAttribute('cognitive.persona_confidence', confidence || 0);
      currentSpan.setAttribute('cognitive.persona_count', activePersonaCount || 1);
      currentSpan.setAttribute('cognitive.context_complexity', complexity || 0);
      currentSpan.setAttribute('cognitive.context_domain', domain || 'general');

      currentSpan.addEvent('cognitive.persona.switched', {
        from: fromPersona,
        to: toPersona,
        reason,
        confidence,
        transition_type: this.classifyTransition(fromPersona, toPersona),
        active_persona_count: activePersonaCount || 1,
        complexity_level: complexity || 0,
        domain_context: domain || 'general',
        persona_performance_score: personaMetrics?.performance || 0,
        persona_contribution_score: personaMetrics?.contribution || 0,
      });
    }

    this.updateSessionStats(sessionId, 'persona_switch', toPersona);
  }

  private onThoughtProcessed(data: any): void {
    if (!this.config.isEnabled()) return;

    const {
      thoughtNumber,
      totalThoughts,
      complexity,
      processingTime,
      sessionId,
      cognitiveState,
      memoryStats,
      activePlugins,
      insightCount,
    } = data;

    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.setAttribute('cognitive.thought_number', thoughtNumber);
      currentSpan.setAttribute('cognitive.total_thoughts', totalThoughts);
      currentSpan.setAttribute('cognitive.thought_complexity', complexity || 0);
      currentSpan.setAttribute('cognitive.processing_time_ms', processingTime || 0);

      // Include cognitive state metrics if available
      if (cognitiveState) {
        currentSpan.setAttribute(
          'cognitive.metacognitive_awareness',
          cognitiveState.metacognitive_awareness || 0
        );
        currentSpan.setAttribute(
          'cognitive.creative_pressure',
          cognitiveState.creative_pressure || 0
        );
        currentSpan.setAttribute(
          'cognitive.breakthrough_likelihood',
          cognitiveState.breakthrough_likelihood || 0
        );
        currentSpan.setAttribute(
          'cognitive.insight_potential',
          cognitiveState.insight_potential || 0
        );
        currentSpan.setAttribute(
          'cognitive.cognitive_flexibility',
          cognitiveState.cognitive_flexibility || 0
        );
        currentSpan.setAttribute(
          'cognitive.frustration_level',
          cognitiveState.frustration_level || 0
        );
        currentSpan.setAttribute(
          'cognitive.engagement_level',
          cognitiveState.engagement_level || 0
        );
        currentSpan.setAttribute(
          'cognitive.cognitive_efficiency',
          cognitiveState.cognitive_efficiency || 0
        );
      }

      // Include memory statistics if available
      if (memoryStats) {
        currentSpan.setAttribute('memory.total_thoughts_stored', memoryStats.totalThoughts || 0);
        currentSpan.setAttribute('memory.patterns_recognized', memoryStats.patternsRecognized || 0);
        currentSpan.setAttribute(
          'memory.insights_accumulated',
          memoryStats.insightsAccumulated || 0
        );
      }

      currentSpan.addEvent('cognitive.thought.processed', {
        thoughtNumber,
        totalThoughts,
        complexity,
        processingTime,
        progress_percentage: (thoughtNumber / totalThoughts) * 100,
        active_plugin_count: activePlugins?.length || 0,
        insight_count: insightCount || 0,
        session_id: sessionId || 'unknown',
      });
    }
  }

  private onInsightDiscovered(data: any): void {
    if (!this.config.isEnabled()) return;

    const { insightType, value, impact, context, sessionId } = data;

    // Increment counter
    this.insightCounter.add(1, {
      type: insightType,
      impact_level: impact > 0.7 ? 'high' : impact > 0.4 ? 'medium' : 'low',
    });

    const span = this.tracer.startSpan('cognitive.insight', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'cognitive.insight_type': insightType,
        'cognitive.insight_value': value,
        'cognitive.insight_impact': impact,
        'cognitive.event_type': 'insight_discovered',
        'cognitive.session_id': sessionId || 'unknown',
      },
    });

    span.addEvent('insight.analysis', {
      derived_from: context?.source || 'unknown',
      pattern_count: context?.patterns?.length || 0,
      cognitive_depth: context?.depth || 1,
    });

    span.end();
    this.updateSessionStats(sessionId, 'insight', insightType);

    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.addEvent('cognitive.insight.discovered', {
        type: insightType,
        value,
        impact,
        actionable: impact > 0.5,
      });
    }
  }

  private onPatternRecognized(data: any): void {
    if (!this.config.isEnabled()) return;

    const { patternType, confidence, occurrences, context, sessionId } = data;

    // Increment counter
    this.patternCounter.add(1, {
      type: patternType,
      frequency: occurrences > 10 ? 'high' : occurrences > 3 ? 'medium' : 'low',
    });

    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.addEvent('cognitive.pattern.recognized', {
        type: patternType,
        confidence,
        occurrences,
        significance: this.calculatePatternSignificance(occurrences, confidence),
        context_provided: !!context,
      });
    }

    this.updateSessionStats(sessionId, 'pattern', patternType);
  }

  public recordCognitiveMetrics(metrics: {
    metacognitiveAwareness?: number;
    creativePressure?: number;
    breakthroughLikelihood?: number;
    insightPotential?: number;
    cognitiveFlexibility?: number;
  }): void {
    if (!this.config.isEnabled()) return;

    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      if (metrics.metacognitiveAwareness !== undefined) {
        currentSpan.setAttribute(
          'cognitive.metacognitive_awareness',
          metrics.metacognitiveAwareness
        );
      }
      if (metrics.creativePressure !== undefined) {
        currentSpan.setAttribute('cognitive.creative_pressure', metrics.creativePressure);
      }
      if (metrics.breakthroughLikelihood !== undefined) {
        currentSpan.setAttribute(
          'cognitive.breakthrough_likelihood',
          metrics.breakthroughLikelihood
        );
      }
      if (metrics.insightPotential !== undefined) {
        currentSpan.setAttribute('cognitive.insight_potential', metrics.insightPotential);
      }
      if (metrics.cognitiveFlexibility !== undefined) {
        currentSpan.setAttribute('cognitive.cognitive_flexibility', metrics.cognitiveFlexibility);
      }
    }
  }

  private onCognitiveDeadlock(data: any): void {
    if (!this.config.isEnabled()) return;

    const { reason, attemptedRecovery, sessionId, context } = data;

    // Increment counter
    this.deadlockCounter.add(1, {
      reason: reason || 'unknown',
      recovered: String(attemptedRecovery || false),
    });

    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.addEvent('cognitive.deadlock.detected', {
        reason,
        attemptedRecovery,
        context: JSON.stringify(context || {}),
        severity: 'high',
      });
    }

    this.updateSessionStats(sessionId, 'deadlock', reason);
  }

  private onDecisionMade(data: any): void {
    if (!this.config.isEnabled()) return;

    const { decisionType, selected, alternatives, confidence, reasoning, sessionId } = data;

    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.addEvent('cognitive.decision.made', {
        type: decisionType,
        selected,
        alternatives_count: alternatives?.length || 0,
        confidence,
        has_reasoning: !!reasoning,
        decision_complexity: this.calculateDecisionComplexity(alternatives, confidence),
      });
    }

    this.updateSessionStats(sessionId, 'decision', decisionType);
  }

  private onMemoryAccessed(data: any): void {
    if (!this.config.isEnabled()) return;

    const { operation, key, found, latency, memoryStats, cacheStats, resultSize } = data;

    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      // Add memory operation metrics
      if (memoryStats) {
        currentSpan.setAttribute('memory.total_entries', memoryStats.totalEntries || 0);
        currentSpan.setAttribute('memory.cache_size', memoryStats.cacheSize || 0);
        currentSpan.setAttribute('memory.hit_rate', memoryStats.hitRate || 0);
      }

      currentSpan.addEvent('cognitive.memory.accessed', {
        operation,
        key,
        found,
        latency_ms: latency,
        cache_hit: found && latency < 5,
        result_size_bytes: resultSize || 0,
        cache_hit_rate: cacheStats?.hitRate || 0,
        cache_miss_rate: cacheStats?.missRate || 0,
        memory_pressure: memoryStats?.pressure || 'normal',
      });
    }
  }

  private calculateSignificance(potential: number, confidence: number): string {
    const score = potential * confidence;
    if (score > 0.7) return 'high';
    if (score > 0.4) return 'medium';
    return 'low';
  }

  private calculatePatternSignificance(occurrences: number, confidence: number): string {
    if (occurrences > 10 && confidence > 0.8) return 'very_high';
    if (occurrences > 5 && confidence > 0.6) return 'high';
    if (occurrences > 2 && confidence > 0.4) return 'medium';
    return 'low';
  }

  private classifyTransition(from: string, to: string): string {
    const analytical = ['Engineer', 'Analyst', 'Skeptic'];
    const creative = ['Creative', 'Philosopher', 'Synthesizer'];
    const practical = ['Pragmatist', 'Strategist'];

    const fromType = analytical.includes(from)
      ? 'analytical'
      : creative.includes(from)
        ? 'creative'
        : practical.includes(from)
          ? 'practical'
          : 'other';
    const toType = analytical.includes(to)
      ? 'analytical'
      : creative.includes(to)
        ? 'creative'
        : practical.includes(to)
          ? 'practical'
          : 'other';

    if (fromType === toType) return 'within_category';
    if (fromType === 'analytical' && toType === 'creative') return 'analytical_to_creative';
    if (fromType === 'creative' && toType === 'analytical') return 'creative_to_analytical';
    return 'mode_shift';
  }

  private calculateDecisionComplexity(alternatives: any[], confidence: number): string {
    if (!alternatives || alternatives.length === 0) return 'simple';
    if (alternatives.length > 5 && confidence < 0.5) return 'very_complex';
    if (alternatives.length > 3 && confidence < 0.7) return 'complex';
    if (alternatives.length > 1) return 'moderate';
    return 'simple';
  }

  private updateSessionStats(
    sessionId: string | undefined,
    eventType: string,
    detail: string
  ): void {
    if (!sessionId) return;

    if (!this.sessionStats.has(sessionId)) {
      this.sessionStats.set(sessionId, {
        startTime: Date.now(),
        events: {},
        personas: new Set(),
        insights: 0,
        breakthroughs: 0,
        patterns: 0,
      });
    }

    const stats = this.sessionStats.get(sessionId);
    stats.events[eventType] = (stats.events[eventType] || 0) + 1;

    if (eventType === 'persona_switch') stats.personas.add(detail);
    if (eventType === 'insight') stats.insights++;
    if (eventType === 'breakthrough') stats.breakthroughs++;
    if (eventType === 'pattern') stats.patterns++;
  }

  public createSessionSummary(sessionId: string): void {
    const stats = this.sessionStats.get(sessionId);
    if (!stats) return;

    const duration = Date.now() - stats.startTime;
    const memoryUsage = process.memoryUsage();

    const span = this.tracer.startSpan('cognitive.session.summary', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'cognitive.session_id': sessionId,
        'cognitive.session_duration_ms': duration,
        'cognitive.unique_personas': stats.personas.size,
        'cognitive.total_insights': stats.insights,
        'cognitive.total_breakthroughs': stats.breakthroughs,
        'cognitive.total_patterns': stats.patterns,
        'cognitive.total_deadlocks': stats.events.deadlock || 0,
        'cognitive.total_decisions': stats.events.decision || 0,
        'cognitive.event_types': Object.keys(stats.events).length,
        'cognitive.plugin_activations': stats.events.plugin_activation || 0,
        'cognitive.persona_switches': stats.events.persona_switch || 0,
        // Performance metrics
        'performance.thoughts_per_second': stats.events.thought_processed
          ? stats.events.thought_processed / (duration / 1000)
          : 0,
        'performance.insights_per_thought':
          stats.insights > 0 && stats.events.thought_processed > 0
            ? stats.insights / stats.events.thought_processed
            : 0,
        'performance.breakthrough_rate':
          stats.breakthroughs > 0 && stats.events.thought_processed > 0
            ? stats.breakthroughs / stats.events.thought_processed
            : 0,
        // Resource usage
        'resource.final_heap_mb': memoryUsage.heapUsed / 1048576,
        'resource.final_rss_mb': memoryUsage.rss / 1048576,
        'resource.final_external_mb': memoryUsage.external / 1048576,
        // Cognitive complexity metrics
        'cognitive.richness_score': this.calculateCognitiveRichness(stats),
        'cognitive.diversity_score': this.calculateDiversityScore(stats),
      },
    });

    span.addEvent('session.cognitive_summary', {
      personas_used: Array.from(stats.personas).join(', '),
      dominant_events: JSON.stringify(stats.events),
      cognitive_richness: this.calculateCognitiveRichness(stats),
      session_effectiveness: this.calculateSessionEffectiveness(stats, duration),
      total_events: Object.values(stats.events).reduce((sum: number, count: any) => sum + count, 0),
    });

    span.end();
    this.sessionStats.delete(sessionId);
  }

  private calculateDiversityScore(stats: any): number {
    // Calculate diversity based on number of different event types and personas used
    const eventDiversity = Object.keys(stats.events).length / 10; // Normalize by expected max types
    const personaDiversity = stats.personas.size / 8; // Normalize by total personas
    return Math.min((eventDiversity + personaDiversity) / 2, 1);
  }

  private calculateSessionEffectiveness(stats: any, duration: number): string {
    const score =
      (stats.insights * 2 + stats.breakthroughs * 3 + stats.patterns) / (duration / 60000); // per minute
    if (score > 5) return 'highly_effective';
    if (score > 2) return 'effective';
    if (score > 0.5) return 'moderate';
    return 'low';
  }

  private calculateCognitiveRichness(stats: any): string {
    const score =
      stats.insights * 2 + stats.breakthroughs * 3 + stats.patterns + stats.personas.size;
    if (score > 20) return 'very_rich';
    if (score > 10) return 'rich';
    if (score > 5) return 'moderate';
    return 'basic';
  }

  public detachFromOrchestrator(): void {
    if (this.orchestrator) {
      this.orchestrator.removeAllListeners();
      this.orchestrator = null;

      this.activePluginSpans.forEach(spanData => spanData.span.end());
      this.activePluginSpans.clear();

      // Create final summaries for all active sessions
      this.sessionStats.forEach((_, sessionId) => {
        this.createSessionSummary(sessionId);
      });

      // Cognitive instrumentation detached from orchestrator
    }
  }
}
