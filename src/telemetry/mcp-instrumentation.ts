import {
  trace,
  context,
  SpanStatusCode,
  Span,
  SpanKind,
  Histogram,
  metrics,
  Link,
} from '@opentelemetry/api';
import { TelemetryConfig } from './telemetry-config.js';
import {
  getPromptTemplate,
  getPromptVariables,
  PromptTemplate,
  PromptVariables,
} from './prompt-tracking.js';
import { extractSpanAttributes, getUserInfo, getSessionInfo } from './context-attributes.js';
import { SpanHierarchyManager } from './span-hierarchy-manager.js';
import { OpenInferenceAdapter } from './openinference-adapter.js';
import { EventManager, EventType } from './event-manager.js';
import { StatusMapper, MCPStatusCode } from './status-mapper.js';
import { randomBytes } from 'crypto';
import { performance } from 'perf_hooks';

export class MCPInstrumentation {
  private static instance: MCPInstrumentation;
  private tracer = trace.getTracer('mcp-server');
  private meter = metrics.getMeter('mcp-server');
  private config = TelemetryConfig.getInstance();
  private activeSpans = new Map<string, Span>();
  private sessionMetrics = new Map<string, any>();

  // Track span contexts for linking related thoughts
  private thoughtSpanContexts = new Map<string, any>();

  // Phoenix Phase 2 Components
  private hierarchyManager: SpanHierarchyManager;
  private openInferenceAdapter: OpenInferenceAdapter;
  private eventManager: EventManager;
  private statusMapper: StatusMapper;

  // Histogram metrics for latency distributions
  private thoughtLatencyHistogram: Histogram;
  private pluginLatencyHistogram: Histogram;
  private memoryOperationHistogram: Histogram;
  private toolExecutionHistogram: Histogram;

  // Counters for operational insights
  private thoughtCounter = this.meter.createCounter('mcp.thoughts.total');
  private branchCounter = this.meter.createCounter('mcp.branches.total');
  private revisionCounter = this.meter.createCounter('mcp.revisions.total');
  private errorCounter = this.meter.createCounter('mcp.errors.total');
  private breakthroughCounter = this.meter.createCounter('mcp.breakthroughs.total');

  private constructor() {
    // Initialize histograms for latency tracking
    this.thoughtLatencyHistogram = this.meter.createHistogram('mcp.thought.latency', {
      description: 'Latency of thought generation in milliseconds',
      unit: 'ms',
    });

    this.pluginLatencyHistogram = this.meter.createHistogram('mcp.plugin.latency', {
      description: 'Latency of cognitive plugin execution',
      unit: 'ms',
    });

    this.memoryOperationHistogram = this.meter.createHistogram('mcp.memory.operation.latency', {
      description: 'Latency of memory operations',
      unit: 'ms',
    });

    this.toolExecutionHistogram = this.meter.createHistogram('mcp.tool.execution.latency', {
      description: 'Latency of tool execution',
      unit: 'ms',
    });

    // Initialize Phoenix Phase 2 Components
    this.hierarchyManager = new SpanHierarchyManager();
    this.openInferenceAdapter = new OpenInferenceAdapter();
    this.eventManager = new EventManager();
    this.statusMapper = new StatusMapper();
  }

  public static getInstance(): MCPInstrumentation {
    if (!MCPInstrumentation.instance) {
      MCPInstrumentation.instance = new MCPInstrumentation();
    }
    return MCPInstrumentation.instance;
  }

  private generateRequestId(): string {
    return randomBytes(8).toString('hex');
  }

  /**
   * Estimate token count for text content
   * Uses approximation of 4 characters per token for English text
   */
  private estimateTokenCount(text: string): number {
    if (!text || typeof text !== 'string') {
      return 0;
    }
    // Rough approximation: 4 characters per token for English text
    // This is a conservative estimate for Claude/GPT models
    return Math.ceil(text.length / 4);
  }

  /**
   * Estimate cost based on token counts
   * Uses approximate pricing for MCP operations
   */
  private estimateCost(promptTokens: number, completionTokens: number): number {
    // Approximate cost per 1M tokens in USD
    // Using conservative estimates for cognitive operations
    const promptCostPer1M = 3.0; // $3 per 1M prompt tokens
    const completionCostPer1M = 15.0; // $15 per 1M completion tokens

    const promptCost = (promptTokens / 1000000) * promptCostPer1M;
    const completionCost = (completionTokens / 1000000) * completionCostPer1M;

    return Number((promptCost + completionCost).toFixed(6));
  }

  /**
   * Enhanced MCP handler instrumentation with Phoenix Phase 2 components
   */
  public instrumentMCPHandler<T extends (...args: any[]) => any>(handler: T, toolName: string): T {
    const instrumented = async (...args: any[]): Promise<any> => {
      const requestId = this.generateRequestId();
      if (!this.config.isEnabled() || !this.config.shouldSample(requestId)) {
        return handler.apply(this, args);
      }
      const spanName = `mcp.tool.${toolName}`;

      // Capture initial resource state
      const memoryBefore = process.memoryUsage();
      const cpuBefore = process.cpuUsage();

      // Create links for related thoughts (branches and revisions)
      const thoughtLinks =
        args[0] && typeof args[0] === 'object' ? this.getLinksForThought(args[0]) : [];

      const span = this.tracer.startSpan(spanName, {
        kind: SpanKind.SERVER,
        attributes: {
          // Required OpenInference semantic convention
          'openinference.span.kind': 'TOOL',

          // OpenInference tool attributes
          'tool.name': toolName,
          'tool.description': `MCP ${toolName} tool execution`,

          // MCP-specific attributes (keep for compatibility)
          'mcp.tool': toolName,
          'mcp.request_id': requestId,
          'mcp.timestamp': new Date().toISOString(),
          'mcp.node_version': process.version,
          'mcp.pid': process.pid,

          // Resource attributes following OpenTelemetry conventions
          'resource.memory.heap_used_mb': memoryBefore.heapUsed / 1048576,
          'resource.memory.heap_total_mb': memoryBefore.heapTotal / 1048576,
          'resource.memory.external_mb': memoryBefore.external / 1048576,
          'resource.memory.rss_mb': memoryBefore.rss / 1048576,
        },
        links: thoughtLinks,
      });

      this.activeSpans.set(requestId, span);

      return context.with(trace.setSpan(context.active(), span), async () => {
        const startTime = performance.now();

        try {
          // Declare inputValue at higher scope for cost tracking
          let inputValue = '';

          if (args[0] && typeof args[0] === 'object') {
            const argKeys = Object.keys(args[0]);
            const requestSizeBytes = JSON.stringify(args[0]).length;
            inputValue = JSON.stringify(args[0]);

            // OpenInference input conventions
            span.setAttribute('input.value', inputValue);
            span.setAttribute('input.mime_type', 'application/json');

            // MCP-specific attributes (keep for compatibility)
            span.setAttribute('mcp.args.count', argKeys.length);
            span.setAttribute('mcp.request.size_bytes', requestSizeBytes);

            // Enhanced thought tracking
            if (args[0].thought_number !== undefined) {
              span.setAttribute('cognitive.thought_number', args[0].thought_number);
              span.setAttribute('cognitive.thought_chain_position', args[0].thought_number);
              this.thoughtCounter.add(1, { tool: toolName });
            }
            if (args[0].total_thoughts !== undefined) {
              span.setAttribute('cognitive.total_thoughts', args[0].total_thoughts);
              span.setAttribute('cognitive.thoughts_planned', args[0].total_thoughts);
            }
            if (args[0].next_thought_needed !== undefined) {
              span.setAttribute('cognitive.next_thought_needed', args[0].next_thought_needed);
              span.setAttribute('cognitive.chain_complete', !args[0].next_thought_needed);
            }

            // Track branching and revisions with span links
            if (args[0].branch_from_thought !== undefined) {
              span.setAttribute('cognitive.is_branch', true);
              span.setAttribute('cognitive.branch_from', args[0].branch_from_thought);
              span.setAttribute('cognitive.branch_id', args[0].branch_id || 'unknown');
              this.branchCounter.add(1, { tool: toolName });

              // Add span event for branch creation
              span.addEvent('cognitive.branch.created', {
                branch_from_thought: args[0].branch_from_thought,
                branch_id: args[0].branch_id || 'unknown',
                branch_reason: 'Alternative exploration path',
              });
            }
            if (args[0].is_revision !== undefined && args[0].is_revision) {
              span.setAttribute('cognitive.is_revision', true);
              span.setAttribute('cognitive.revises_thought', args[0].revises_thought);
              this.revisionCounter.add(1, { tool: toolName });

              // Add span event for revision
              span.addEvent('cognitive.revision.created', {
                revises_thought: args[0].revises_thought,
                revision_reason: 'Thought improvement iteration',
              });
            }

            // Store span context for potential linking in future thoughts
            if (args[0].thought_number !== undefined) {
              const thoughtKey = `thought_${args[0].thought_number}`;
              this.thoughtSpanContexts.set(thoughtKey, {
                spanContext: span.spanContext(),
                thoughtNumber: args[0].thought_number,
                sessionId: args[0].session_id,
                timestamp: Date.now(),
              });
            }

            // Track session context using OpenInference conventions
            if (args[0].session_id) {
              span.setAttribute('session.id', args[0].session_id);
              // Keep MCP compatibility attribute
              span.setAttribute('mcp.session_id', args[0].session_id);
              this.updateSessionMetrics(args[0].session_id, args[0]);
            }

            // Track thought complexity
            if (args[0].thought) {
              const thoughtLength = args[0].thought.length;
              span.setAttribute('cognitive.thought_length', thoughtLength);
              span.setAttribute(
                'cognitive.thought_complexity',
                this.calculateComplexity(args[0].thought)
              );
            }

            // Track prompt template and variables from context
            const currentContext = context.active();
            const promptTemplate = getPromptTemplate(currentContext);
            const promptVariables = getPromptVariables(currentContext);

            if (promptTemplate) {
              span.setAttribute('llm.prompt_template.template', promptTemplate.template);
              span.setAttribute('llm.prompt_template.version', promptTemplate.version);
              span.setAttribute(
                'llm.prompt_template.variables',
                JSON.stringify(promptTemplate.variables)
              );
              span.addEvent('prompt.template.applied', {
                template_version: promptTemplate.version,
                variable_count: Object.keys(promptTemplate.variables).length,
              });
            }

            if (promptVariables) {
              span.setAttribute('llm.prompt_variables', JSON.stringify(promptVariables));
              span.setAttribute('llm.prompt_variables.count', Object.keys(promptVariables).length);
              span.addEvent('prompt.variables.applied', {
                variable_names: Object.keys(promptVariables).join(', '),
                variable_count: Object.keys(promptVariables).length,
              });
            }

            // Add user, session, and context attributes from OpenTelemetry context
            const contextAttributes = extractSpanAttributes(currentContext);
            Object.entries(contextAttributes).forEach(([key, value]) => {
              span.setAttribute(key, value);
            });

            // Add events for user and session tracking
            const userInfo = getUserInfo(currentContext);
            const sessionInfo = getSessionInfo(currentContext);
            if (userInfo) {
              span.addEvent('user.identified', {
                user_id: userInfo.userId,
                session_id: userInfo.sessionId,
              });
            }
            if (sessionInfo) {
              span.addEvent('session.tracked', {
                session_id: sessionInfo.sessionId,
                session_duration_ms: Date.now() - sessionInfo.startTime,
              });
            }
          }

          const result = await handler.apply(this, args);

          const duration = performance.now() - startTime;
          const memoryAfter = process.memoryUsage();
          const cpuAfter = process.cpuUsage(cpuBefore);

          // Core performance metrics
          span.setAttribute('mcp.duration_ms', duration);
          span.setAttribute('performance.latency_ms', duration);
          span.setAttribute('performance.cpu_user_ms', cpuAfter.user / 1000);
          span.setAttribute('performance.cpu_system_ms', cpuAfter.system / 1000);

          // Memory delta tracking
          const memoryDelta = {
            heap: (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1048576,
            external: (memoryAfter.external - memoryBefore.external) / 1048576,
            rss: (memoryAfter.rss - memoryBefore.rss) / 1048576,
          };
          span.setAttribute('resource.memory.delta_heap_mb', memoryDelta.heap);
          span.setAttribute('resource.memory.delta_external_mb', memoryDelta.external);
          span.setAttribute('resource.memory.delta_rss_mb', memoryDelta.rss);
          span.setAttribute('resource.memory.after_heap_mb', memoryAfter.heapUsed / 1048576);

          // Record histogram metrics
          this.toolExecutionHistogram.record(duration, { tool: toolName });
          if (toolName === 'code-reasoning') {
            this.thoughtLatencyHistogram.record(duration, {
              session_id: args[0]?.session_id || 'unknown',
              thought_number: args[0]?.thought_number || 0,
            });
          }

          if (result && typeof result === 'object') {
            const responseSizeBytes = JSON.stringify(result).length;
            const outputValue = JSON.stringify(result);

            // OpenInference output conventions
            span.setAttribute('output.value', outputValue);
            span.setAttribute('output.mime_type', 'application/json');

            // MCP-specific attributes (keep for compatibility)
            span.setAttribute('mcp.response.size_bytes', responseSizeBytes);

            // Phoenix cost tracking - Token count estimation
            // Estimate token counts based on input/output text for MCP operations
            const inputTokenCount = this.estimateTokenCount(inputValue);
            const outputTokenCount = this.estimateTokenCount(outputValue);
            const totalTokens = inputTokenCount + outputTokenCount;

            // Required Phoenix cost tracking attributes
            span.setAttribute('llm.token_count.prompt', inputTokenCount);
            span.setAttribute('llm.token_count.completion', outputTokenCount);
            span.setAttribute('llm.token_count.total', totalTokens);
            span.setAttribute('llm.model_name', 'mcp-sentient-agi');
            span.setAttribute('llm.provider', 'anthropic-mcp');

            // Add cost tracking event
            span.addEvent('cost.token_usage', {
              prompt_tokens: inputTokenCount,
              completion_tokens: outputTokenCount,
              total_tokens: totalTokens,
              estimated_cost_usd: this.estimateCost(inputTokenCount, outputTokenCount),
            });

            // Enhanced cognitive metrics
            if (result.metacognitive_awareness !== undefined) {
              span.setAttribute(
                'cognitive.metacognitive_awareness',
                result.metacognitive_awareness
              );
              span.addEvent('cognitive.metric', {
                metric: 'metacognitive_awareness',
                value: result.metacognitive_awareness,
                interpretation: this.interpretMetric(
                  'metacognitive_awareness',
                  result.metacognitive_awareness
                ),
              });
            }
            if (result.creative_pressure !== undefined) {
              span.setAttribute('cognitive.creative_pressure', result.creative_pressure);
            }
            if (result.breakthrough_likelihood !== undefined) {
              span.setAttribute(
                'cognitive.breakthrough_likelihood',
                result.breakthrough_likelihood
              );
              if (result.breakthrough_likelihood > 0.8) {
                span.addEvent('cognitive.breakthrough_imminent', {
                  likelihood: result.breakthrough_likelihood,
                  context: 'High breakthrough probability detected',
                });
                this.breakthroughCounter.add(1, { type: 'imminent' });
              }
            }
            if (result.insight_potential !== undefined) {
              span.setAttribute('cognitive.insight_potential', result.insight_potential);
            }
            if (result.cognitive_flexibility !== undefined) {
              span.setAttribute('cognitive.cognitive_flexibility', result.cognitive_flexibility);
            }

            // Track cognitive state
            if (result.cognitive_state) {
              const state = result.cognitive_state;
              span.setAttribute('cognitive.session_thought_count', state.thought_count || 0);
              span.setAttribute('cognitive.current_complexity', state.current_complexity || 0);
              span.setAttribute('cognitive.frustration_level', state.frustration_level || 0);
              span.setAttribute('cognitive.engagement_level', state.engagement_level || 0);
              span.setAttribute('cognitive.recent_success_rate', state.recent_success_rate || 0);

              // Track confidence trajectory
              if (state.confidence_trajectory && Array.isArray(state.confidence_trajectory)) {
                span.setAttribute(
                  'cognitive.confidence_current',
                  state.confidence_trajectory[state.confidence_trajectory.length - 1] || 0
                );
                span.setAttribute(
                  'cognitive.confidence_trend',
                  this.calculateTrend(state.confidence_trajectory)
                );
                span.addEvent('cognitive.confidence_trajectory', {
                  values: JSON.stringify(state.confidence_trajectory),
                  trend: this.calculateTrend(state.confidence_trajectory),
                });
              }
            }

            // Track cognitive insights
            if (result.cognitive_insights && Array.isArray(result.cognitive_insights)) {
              span.setAttribute('cognitive.insights_count', result.cognitive_insights.length);
              span.addEvent('cognitive.insights_detected', {
                count: result.cognitive_insights.length,
                types: JSON.stringify(this.categorizeInsights(result.cognitive_insights)),
              });
            }

            // Track AI recommendations
            if (result.ai_recommendations && Array.isArray(result.ai_recommendations)) {
              span.setAttribute(
                'cognitive.recommendations_count',
                result.ai_recommendations.length
              );
              span.addEvent('cognitive.recommendations', {
                count: result.ai_recommendations.length,
                summary: result.ai_recommendations[0] || 'No recommendations',
              });
            }
          }

          span.setStatus({ code: SpanStatusCode.OK });
          span.addEvent('mcp.tool.completed', {
            duration_ms: duration,
            success: true,
          });

          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorName = error instanceof Error ? error.name : 'UnknownError';

          span.recordException(error as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: errorMessage,
          });
          span.addEvent('mcp.tool.error', {
            error: errorMessage,
            error_type: errorName,
          });

          throw error;
        } finally {
          span.end();
          this.activeSpans.delete(requestId);
        }
      });
    };

    return instrumented as T;
  }

  public startToolSpan(toolName: string, attributes?: Record<string, any>): Span {
    const span = this.tracer.startSpan(`mcp.tool.${toolName}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        // Required OpenInference semantic convention
        'openinference.span.kind': 'TOOL',

        // OpenInference tool attributes
        'tool.name': toolName,
        'tool.description': `MCP ${toolName} internal tool operation`,

        // MCP-specific attributes (keep for compatibility)
        'mcp.tool': toolName,
        ...attributes,
      },
    });
    return span;
  }

  /**
   * Create links to related thought spans for branches and revisions
   */
  public getLinksForThought(thoughtData: {
    branch_from_thought?: number;
    revises_thought?: number;
    session_id?: string;
  }): Link[] {
    const links: Link[] = [];

    // Create link to parent thought for branches
    if (thoughtData.branch_from_thought !== undefined) {
      const parentKey = `thought_${thoughtData.branch_from_thought}`;
      const parentSpanData = this.thoughtSpanContexts.get(parentKey);
      if (parentSpanData) {
        links.push({
          context: parentSpanData.spanContext,
          attributes: {
            'link.type': 'branch_from',
            'link.relationship': 'parent_thought',
            'cognitive.branch.parent_thought': thoughtData.branch_from_thought,
          },
        });
      }
    }

    // Create link to original thought for revisions
    if (thoughtData.revises_thought !== undefined) {
      const originalKey = `thought_${thoughtData.revises_thought}`;
      const originalSpanData = this.thoughtSpanContexts.get(originalKey);
      if (originalSpanData) {
        links.push({
          context: originalSpanData.spanContext,
          attributes: {
            'link.type': 'revision_of',
            'link.relationship': 'original_thought',
            'cognitive.revision.original_thought': thoughtData.revises_thought,
          },
        });
      }
    }

    return links;
  }

  /**
   * Clean up old span contexts to prevent memory leaks
   */
  public cleanupOldSpanContexts(maxAgeMs: number = 300000): void {
    const now = Date.now();
    for (const [key, data] of this.thoughtSpanContexts.entries()) {
      if (now - data.timestamp > maxAgeMs) {
        this.thoughtSpanContexts.delete(key);
      }
    }
  }

  public addEventToCurrentSpan(eventName: string, attributes?: Record<string, any>): void {
    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.addEvent(eventName, attributes);
    }
  }

  public setAttributeOnCurrentSpan(key: string, value: any): void {
    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.setAttribute(key, value);
    }
  }

  public recordToolMetrics(toolName: string, metrics: Record<string, number>): void {
    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      Object.entries(metrics).forEach(([key, value]) => {
        currentSpan.setAttribute(`mcp.metrics.${key}`, value);
      });
    }
  }

  public getActiveSpanCount(): number {
    return this.activeSpans.size;
  }

  private calculateComplexity(thought: string): number {
    // Simple complexity heuristic based on length and structure
    const length = thought.length;
    const sentences = thought.split(/[.!?]+/).length;
    const words = thought.split(/\s+/).length;
    const avgWordsPerSentence = words / sentences;

    let complexity = 0;
    if (length > 1000) complexity += 3;
    else if (length > 500) complexity += 2;
    else complexity += 1;

    if (avgWordsPerSentence > 20) complexity += 2;
    else if (avgWordsPerSentence > 15) complexity += 1;

    // Check for technical terms or concepts
    const technicalTerms = thought.match(
      /\b(algorithm|recursive|metacognitive|quantum|emergence|complexity|paradox|consciousness)\b/gi
    );
    if (technicalTerms) complexity += Math.min(technicalTerms.length, 3);

    return Math.min(complexity, 10); // Cap at 10
  }

  private interpretMetric(metric: string, value: number): string {
    switch (metric) {
      case 'metacognitive_awareness':
        if (value > 0.8) return 'High self-reflection';
        if (value > 0.5) return 'Moderate self-awareness';
        return 'Low metacognitive activity';
      case 'breakthrough_likelihood':
        if (value > 0.8) return 'Breakthrough imminent';
        if (value > 0.5) return 'Potential insight forming';
        return 'Normal processing';
      default:
        return 'Unknown metric';
    }
  }

  private calculateTrend(values: number[]): string {
    if (values.length < 2) return 'stable';
    const recent = values.slice(-3);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const first = values[0];

    if (avg > first * 1.2) return 'increasing';
    if (avg < first * 0.8) return 'decreasing';
    return 'stable';
  }

  private categorizeInsights(insights: any[]): Record<string, number> {
    const categories: Record<string, number> = {};
    insights.forEach(insight => {
      const type = insight.type || 'unknown';
      categories[type] = (categories[type] || 0) + 1;
    });
    return categories;
  }

  private updateSessionMetrics(sessionId: string, args: any): void {
    if (!this.sessionMetrics.has(sessionId)) {
      this.sessionMetrics.set(sessionId, {
        startTime: Date.now(),
        thoughtCount: 0,
        branchCount: 0,
        revisionCount: 0,
        totalLatency: 0,
      });
    }

    const metrics = this.sessionMetrics.get(sessionId);
    metrics.thoughtCount++;
    if (args.branch_from_thought) metrics.branchCount++;
    if (args.is_revision) metrics.revisionCount++;
  }

  /**
   * Phoenix Phase 2: Enhanced request instrumentation with hierarchy management
   */
  public instrumentRequestWithHierarchy<T extends (...args: any[]) => any>(
    handler: T,
    requestType: string,
    options?: {
      model?: string;
      prompts?: Array<{ role: string; content: string; tokens: number }>;
      completions?: Array<{ role: string; content: string; tokens: number; finish_reason: string }>;
    }
  ): T {
    const instrumented = async (...args: any[]): Promise<any> => {
      const requestId = this.generateRequestId();

      if (!this.config.isEnabled() || !this.config.shouldSample(requestId)) {
        return handler.apply(this, args);
      }

      // Create root span with hierarchy manager
      const rootSpan = this.hierarchyManager.createRootSpan(
        requestId,
        `mcp.request.${requestType}`
      );

      // Apply OpenInference conventions
      this.openInferenceAdapter.applyConventions(rootSpan, {
        spanKind: 'REQUEST',
        operation: requestType,
        model: options?.model,
        prompts: options?.prompts,
        completions: options?.completions,
        metadata: {
          'mcp.request_type': requestType,
          'mcp.request_id': requestId,
        },
      });

      try {
        // Record start event
        this.eventManager.recordEvent(rootSpan, {
          name: EventType.COGNITIVE_PROCESS,
          attributes: {
            phase: 'start',
            request_type: requestType,
            request_id: requestId,
          },
        });

        // Execute with context
        const result = await context.with(
          this.hierarchyManager.getCurrentContext(requestId),
          async () => {
            return await handler.apply(this, args);
          }
        );

        // Set success status
        const status = this.statusMapper.mapCognitiveStatus({ success: true });
        rootSpan.setStatus({
          code: this.statusMapper.mapToOTelStatus(status),
          message: this.statusMapper.getStatusMessage(status),
        });

        // Record completion event
        this.eventManager.recordEvent(rootSpan, {
          name: EventType.COGNITIVE_PROCESS,
          attributes: {
            phase: 'complete',
            request_type: requestType,
            success: true,
          },
        });

        return result;
      } catch (error) {
        // Record error event
        this.eventManager.recordErrorEvent(rootSpan, error as Error, 'error');

        // Set error status
        const status = this.statusMapper.mapCognitiveStatus({
          success: false,
          error: error as Error,
        });
        rootSpan.setStatus({
          code: this.statusMapper.mapToOTelStatus(status),
          message: this.statusMapper.getStatusMessage(status),
        });

        throw error;
      } finally {
        // Cleanup
        this.hierarchyManager.cleanupRequest(requestId);
        rootSpan.end();
      }
    };

    return instrumented as T;
  }

  public createSessionSummarySpan(sessionId: string): void {
    const metrics = this.sessionMetrics.get(sessionId);
    if (!metrics) return;

    const duration = Date.now() - metrics.startTime;
    const span = this.tracer.startSpan('mcp.session.summary', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'session.id': sessionId,
        'session.duration_ms': duration,
        'session.thought_count': metrics.thoughtCount,
        'session.branch_count': metrics.branchCount,
        'session.revision_count': metrics.revisionCount,
        'session.avg_latency_ms': metrics.totalLatency / metrics.thoughtCount,
      },
    });

    span.addEvent('session.completed', {
      summary: `Session ${sessionId} completed with ${metrics.thoughtCount} thoughts`,
    });

    span.end();
    this.sessionMetrics.delete(sessionId);

    // Cleanup span contexts related to this session
    this.cleanupOldSpanContexts();
  }
}
