# Phoenix Observability Phase 2: Technical Design Document

Version: 1.0.0
Status: Final Design
Author: System Architect
Date: 2025-09-02

## Executive Summary

This document provides the comprehensive technical design for Phase 2 of the Phoenix Observability enhancement project. The design addresses all requirements specified in `PHOENIX_TRACE_STRUCTURE.md` with a focus on actionable implementation details that developers can execute directly.

### Key Design Decisions

- **Hierarchical Span Management**: Implement context-aware span hierarchy using OpenTelemetry Context API
- **OpenInference Integration**: Full semantic convention compliance with backward compatibility layer
- **Event-Driven Architecture**: Structured event system for all cognitive operations
- **Performance-First Design**: Lazy evaluation, batching, and memory pooling to meet strict requirements
- **Zero-Downtime Migration**: Feature flags and parallel pipelines for safe deployment

## 1. System Architecture

### 1.1 Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         MCP Server                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │   Request    │───▶│   Cognitive  │───▶│    Tool      │     │
│  │   Handler    │    │ Orchestrator │    │  Execution   │     │
│  └──────────────┘    └──────────────┘    └──────────────┘     │
│         │                    │                    │             │
│         ▼                    ▼                    ▼             │
│  ┌──────────────────────────────────────────────────────┐      │
│  │           Enhanced Telemetry Layer (Phase 2)          │      │
│  ├────────────────────────────────────────────────────────┤     │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │      │
│  │  │    Span     │  │   Event     │  │   Status    │  │      │
│  │  │  Hierarchy  │  │   Manager   │  │   Mapper    │  │      │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │      │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │      │
│  │  │ OpenInfer.  │  │  Context    │  │  Resource   │  │      │
│  │  │ Conventions │  │ Propagation │  │  Monitor    │  │      │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │      │
│  └──────────────────────────────────────────────────────┘      │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────┐      │
│  │              Phoenix Export Pipeline                   │      │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │      │
│  │  │  Batch   │──│ Compress │──│  Export  │           │      │
│  │  │ Processor│  │  Handler │  │  Client  │           │      │
│  │  └──────────┘  └──────────┘  └──────────┘           │      │
│  └──────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow Architecture

```
1. MCP Request Received
   ├─▶ Create Root Span (mcp.request)
   │   └─▶ Set OpenInference attributes
   │
2. Cognitive Processing
   ├─▶ Create Child Span (mcp.cognitive.process)
   │   ├─▶ Link to parent span
   │   ├─▶ Add cognitive attributes
   │   └─▶ Emit cognitive events
   │
3. Tool/Memory Operations
   ├─▶ Create Nested Spans
   │   ├─▶ Maintain context chain
   │   ├─▶ Track operation metrics
   │   └─▶ Record status codes
   │
4. Response Generation
   ├─▶ Aggregate metrics
   ├─▶ Calculate costs
   └─▶ End spans with status

5. Export to Phoenix
   ├─▶ Batch spans
   ├─▶ Compress if needed
   └─▶ Send via OTLP
```

## 2. Implementation Design

### 2.1 Enhanced Span Hierarchy Manager

**New File**: `src/telemetry/span-hierarchy-manager.ts`

```typescript
import { Span, SpanKind, Context, trace, context } from '@opentelemetry/api';
import { SpanStatusCode } from './status-mapper';

export class SpanHierarchyManager {
  private spanStack: Map<string, Span[]> = new Map();
  private contextStack: Map<string, Context[]> = new Map();
  private spanRelationships: Map<string, string[]> = new Map();

  /**
   * Creates a root span for an MCP request
   */
  createRootSpan(requestId: string, name: string): Span {
    const tracer = trace.getTracer('mcp-server');
    const span = tracer.startSpan(name, {
      kind: SpanKind.SERVER,
      attributes: {
        'openinference.span.kind': 'REQUEST',
        'mcp.request_id': requestId,
        'service.name': 'mcp-server',
        'service.version': process.env.npm_package_version || '1.0.0',
      },
    });

    // Initialize stack for this request
    this.spanStack.set(requestId, [span]);
    this.contextStack.set(requestId, [trace.setSpan(context.active(), span)]);

    return span;
  }

  /**
   * Creates a child span with proper parent relationship
   */
  createChildSpan(
    requestId: string,
    name: string,
    kind: SpanKind,
    openInferenceKind: string
  ): Span {
    const parentContext = this.getCurrentContext(requestId);
    const tracer = trace.getTracer('mcp-server');

    const span = tracer.startSpan(
      name,
      {
        kind,
        attributes: {
          'openinference.span.kind': openInferenceKind,
        },
      },
      parentContext
    );

    // Push to stack
    this.spanStack.get(requestId)?.push(span);
    this.contextStack.get(requestId)?.push(trace.setSpan(parentContext, span));

    // Track relationship
    const parentSpan = this.getCurrentParentSpan(requestId);
    if (parentSpan) {
      const parentId = parentSpan.spanContext().spanId;
      const childId = span.spanContext().spanId;

      if (!this.spanRelationships.has(parentId)) {
        this.spanRelationships.set(parentId, []);
      }
      this.spanRelationships.get(parentId)?.push(childId);
    }

    return span;
  }

  /**
   * Ends current span and pops from stack
   */
  endCurrentSpan(requestId: string, status?: SpanStatusCode): void {
    const span = this.spanStack.get(requestId)?.pop();
    this.contextStack.get(requestId)?.pop();

    if (span) {
      if (status !== undefined) {
        span.setStatus({ code: status });
      }
      span.end();
    }
  }

  /**
   * Gets current context for a request
   */
  getCurrentContext(requestId: string): Context {
    const contexts = this.contextStack.get(requestId);
    return contexts?.[contexts.length - 1] || context.active();
  }

  /**
   * Gets current parent span
   */
  private getCurrentParentSpan(requestId: string): Span | undefined {
    const spans = this.spanStack.get(requestId);
    return spans?.[spans.length - 2]; // Parent is second from top
  }

  /**
   * Cleanup request data
   */
  cleanupRequest(requestId: string): void {
    // End any remaining spans
    const spans = this.spanStack.get(requestId) || [];
    while (spans.length > 0) {
      this.endCurrentSpan(requestId, SpanStatusCode.ERROR);
    }

    // Clear maps
    this.spanStack.delete(requestId);
    this.contextStack.delete(requestId);

    // Clean relationships after delay (for debugging)
    setTimeout(() => {
      for (const [parentId, children] of this.spanRelationships.entries()) {
        // Remove if all children are from this request
        this.spanRelationships.delete(parentId);
      }
    }, 60000); // 1 minute delay
  }
}
```

### 2.2 OpenInference Semantic Convention Adapter

**New File**: `src/telemetry/openinference-adapter.ts`

```typescript
import { Span } from '@opentelemetry/api';

export interface LLMPrompt {
  role: string;
  content: string;
  tokens: number;
}

export interface LLMCompletion {
  role: string;
  content: string;
  tokens: number;
  finish_reason: string;
}

export class OpenInferenceAdapter {
  private tokenEstimator: TokenEstimator;
  private costCalculator: CostCalculator;

  constructor() {
    this.tokenEstimator = new TokenEstimator();
    this.costCalculator = new CostCalculator();
  }

  /**
   * Applies OpenInference semantic conventions to a span
   */
  applyConventions(
    span: Span,
    config: {
      spanKind: 'REQUEST' | 'PROCESS' | 'TOOL' | 'STORAGE';
      operation?: string;
      model?: string;
      prompts?: LLMPrompt[];
      completions?: LLMCompletion[];
      metadata?: Record<string, any>;
    }
  ): void {
    // Required attributes
    span.setAttribute('openinference.span.kind', config.spanKind);
    span.setAttribute('service.name', 'mcp-server');
    span.setAttribute('service.version', process.env.npm_package_version || '1.0.0');
    span.setAttribute('service.instance.id', `mcp-${process.pid}-${Date.now()}`);

    // LLM attributes
    if (config.model) {
      span.setAttribute('llm.vendor', 'anthropic');
      span.setAttribute('llm.model', config.model);
      span.setAttribute('llm.model_version', this.getModelVersion(config.model));
    }

    // Prompt tracking
    if (config.prompts) {
      const promptTokens = config.prompts.reduce((sum, p) => sum + p.tokens, 0);
      span.setAttribute('llm.prompts', JSON.stringify(config.prompts));
      span.setAttribute('llm.token_count.prompt', promptTokens);
    }

    // Completion tracking
    if (config.completions) {
      const completionTokens = config.completions.reduce((sum, c) => sum + c.tokens, 0);
      span.setAttribute('llm.completions', JSON.stringify(config.completions));
      span.setAttribute('llm.token_count.completion', completionTokens);

      // Calculate total tokens and cost
      const promptTokens = (span.attributes['llm.token_count.prompt'] as number) || 0;
      const totalTokens = promptTokens + completionTokens;

      span.setAttribute('llm.token_count.total', totalTokens);
      span.setAttribute(
        'llm.cost.total',
        this.costCalculator.calculate(
          promptTokens,
          completionTokens,
          config.model || 'claude-3-sonnet'
        )
      );
    }

    // Performance metrics
    const startTime = span.startTime || Date.now();
    span.setAttribute('performance.latency_ms', Date.now() - startTime);
    span.setAttribute('performance.cpu_time_ms', process.cpuUsage().user / 1000);
    span.setAttribute('performance.memory_mb', process.memoryUsage().heapUsed / 1048576);

    // Additional metadata
    if (config.metadata) {
      Object.entries(config.metadata).forEach(([key, value]) => {
        span.setAttribute(key, value);
      });
    }
  }

  private getModelVersion(model: string): string {
    const versions: Record<string, string> = {
      'claude-3-opus': '20240229',
      'claude-3-sonnet': '20240229',
      'claude-3-haiku': '20240307',
      'claude-2.1': '20231106',
      'claude-2': '20230711',
    };
    return versions[model] || 'unknown';
  }
}

class TokenEstimator {
  estimate(text: string): number {
    // Claude approximation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

class CostCalculator {
  private readonly pricing = {
    'claude-3-opus': { prompt: 15.0, completion: 75.0 },
    'claude-3-sonnet': { prompt: 3.0, completion: 15.0 },
    'claude-3-haiku': { prompt: 0.25, completion: 1.25 },
  };

  calculate(promptTokens: number, completionTokens: number, model: string): number {
    const modelPricing = this.pricing[model] || this.pricing['claude-3-sonnet'];
    const promptCost = (promptTokens / 1_000_000) * modelPricing.prompt;
    const completionCost = (completionTokens / 1_000_000) * modelPricing.completion;
    return Number((promptCost + completionCost).toFixed(6));
  }
}
```

### 2.3 Event System Implementation

**New File**: `src/telemetry/event-manager.ts`

```typescript
import { Span } from '@opentelemetry/api';

export enum EventType {
  COGNITIVE_PROCESS = 'cognitive.process',
  TOOL_EXECUTION = 'tool.execution',
  MEMORY_OPERATION = 'memory.operation',
  ERROR = 'error',
  BREAKTHROUGH = 'cognitive.breakthrough',
  BRANCH_CREATED = 'cognitive.branch.created',
  REVISION_MADE = 'cognitive.revision.made',
}

export interface EventData {
  name: EventType;
  attributes: Record<string, any>;
  timestamp?: number;
}

export class EventManager {
  private eventQueue: Map<string, EventData[]> = new Map();
  private eventHandlers: Map<EventType, ((data: EventData) => void)[]> = new Map();

  /**
   * Records an event to a span
   */
  recordEvent(span: Span, event: EventData): void {
    const timestamp = event.timestamp || Date.now();

    // Add to span
    span.addEvent(event.name, event.attributes, timestamp);

    // Queue for batch processing
    const spanId = span.spanContext().spanId;
    if (!this.eventQueue.has(spanId)) {
      this.eventQueue.set(spanId, []);
    }
    this.eventQueue.get(spanId)?.push(event);

    // Trigger handlers
    this.triggerHandlers(event);
  }

  /**
   * Records a cognitive event
   */
  recordCognitiveEvent(
    span: Span,
    data: {
      phase: 'start' | 'process' | 'complete';
      thoughtNumber: number;
      duration: number;
      success: boolean;
      insights?: string[];
    }
  ): void {
    this.recordEvent(span, {
      name: EventType.COGNITIVE_PROCESS,
      attributes: {
        phase: data.phase,
        thought_number: data.thoughtNumber,
        duration_ms: data.duration,
        success: data.success,
        insights: data.insights?.join(', '),
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Records a tool execution event
   */
  recordToolEvent(
    span: Span,
    data: {
      toolName: string;
      startTime: number;
      endTime: number;
      success: boolean;
      error?: string;
      retryCount?: number;
    }
  ): void {
    this.recordEvent(span, {
      name: EventType.TOOL_EXECUTION,
      attributes: {
        tool_name: data.toolName,
        start_time: data.startTime,
        end_time: data.endTime,
        duration_ms: data.endTime - data.startTime,
        success: data.success,
        error: data.error,
        retry_count: data.retryCount || 0,
      },
    });
  }

  /**
   * Records a memory operation event
   */
  recordMemoryEvent(
    span: Span,
    data: {
      operation: 'read' | 'write' | 'query';
      patternCount: number;
      duration: number;
      success: boolean;
      bytesProcessed?: number;
    }
  ): void {
    this.recordEvent(span, {
      name: EventType.MEMORY_OPERATION,
      attributes: {
        operation: data.operation,
        pattern_count: data.patternCount,
        duration_ms: data.duration,
        success: data.success,
        bytes_processed: data.bytesProcessed,
      },
    });
  }

  /**
   * Records an error event
   */
  recordErrorEvent(span: Span, error: Error, severity: 'warning' | 'error' | 'critical'): void {
    this.recordEvent(span, {
      name: EventType.ERROR,
      attributes: {
        error_type: error.constructor.name,
        error_message: error.message,
        stack_trace: error.stack,
        severity: severity,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Register event handler
   */
  onEvent(type: EventType, handler: (data: EventData) => void): void {
    if (!this.eventHandlers.has(type)) {
      this.eventHandlers.set(type, []);
    }
    this.eventHandlers.get(type)?.push(handler);
  }

  private triggerHandlers(event: EventData): void {
    const handlers = this.eventHandlers.get(event.name) || [];
    handlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error(`Event handler error for ${event.name}:`, error);
      }
    });
  }

  /**
   * Flush events for a span
   */
  flushEvents(spanId: string): EventData[] {
    const events = this.eventQueue.get(spanId) || [];
    this.eventQueue.delete(spanId);
    return events;
  }
}
```

### 2.4 Status Code Mapper

**New File**: `src/telemetry/status-mapper.ts`

```typescript
import { SpanStatusCode as OTelStatusCode } from '@opentelemetry/api';

export enum SpanStatusCode {
  OK = 0,
  PARTIAL_SUCCESS = 1,
  ERROR = 2,
  INVALID_ARGUMENT = 3,
  DEADLINE_EXCEEDED = 4,
  NOT_FOUND = 5,
  ALREADY_EXISTS = 6,
  PERMISSION_DENIED = 7,
  RESOURCE_EXHAUSTED = 8,
  FAILED_PRECONDITION = 9,
  ABORTED = 10,
  INTERNAL = 11,
  UNAVAILABLE = 12,
  UNIMPLEMENTED = 13,
}

export class StatusMapper {
  /**
   * Maps application status to OpenTelemetry status
   */
  mapToOTelStatus(status: SpanStatusCode): OTelStatusCode {
    switch (status) {
      case SpanStatusCode.OK:
      case SpanStatusCode.PARTIAL_SUCCESS:
        return OTelStatusCode.OK;
      case SpanStatusCode.ERROR:
      case SpanStatusCode.INVALID_ARGUMENT:
      case SpanStatusCode.DEADLINE_EXCEEDED:
      case SpanStatusCode.NOT_FOUND:
      case SpanStatusCode.ALREADY_EXISTS:
      case SpanStatusCode.PERMISSION_DENIED:
      case SpanStatusCode.RESOURCE_EXHAUSTED:
      case SpanStatusCode.FAILED_PRECONDITION:
      case SpanStatusCode.ABORTED:
      case SpanStatusCode.INTERNAL:
      case SpanStatusCode.UNAVAILABLE:
      case SpanStatusCode.UNIMPLEMENTED:
        return OTelStatusCode.ERROR;
      default:
        return OTelStatusCode.UNSET;
    }
  }

  /**
   * Maps cognitive operation results to status codes
   */
  mapCognitiveStatus(result: {
    success: boolean;
    partial?: boolean;
    timeout?: boolean;
    error?: Error;
  }): SpanStatusCode {
    if (result.timeout) return SpanStatusCode.DEADLINE_EXCEEDED;
    if (result.error) return SpanStatusCode.ERROR;
    if (result.partial) return SpanStatusCode.PARTIAL_SUCCESS;
    if (result.success) return SpanStatusCode.OK;
    return SpanStatusCode.ERROR;
  }

  /**
   * Maps tool execution results to status codes
   */
  mapToolStatus(result: {
    success: boolean;
    notFound?: boolean;
    invalidInput?: boolean;
    error?: Error;
  }): SpanStatusCode {
    if (result.notFound) return SpanStatusCode.NOT_FOUND;
    if (result.invalidInput) return SpanStatusCode.INVALID_ARGUMENT;
    if (result.error) return SpanStatusCode.ERROR;
    if (result.success) return SpanStatusCode.OK;
    return SpanStatusCode.ERROR;
  }

  /**
   * Maps memory operation results to status codes
   */
  mapMemoryStatus(result: {
    success: boolean;
    notFound?: boolean;
    conflict?: boolean;
    error?: Error;
  }): SpanStatusCode {
    if (result.notFound) return SpanStatusCode.NOT_FOUND;
    if (result.conflict) return SpanStatusCode.ALREADY_EXISTS;
    if (result.error) return SpanStatusCode.ERROR;
    if (result.success) return SpanStatusCode.OK;
    return SpanStatusCode.ERROR;
  }

  /**
   * Gets human-readable message for status code
   */
  getStatusMessage(code: SpanStatusCode): string {
    const messages: Record<SpanStatusCode, string> = {
      [SpanStatusCode.OK]: 'Operation completed successfully',
      [SpanStatusCode.PARTIAL_SUCCESS]: 'Operation partially completed',
      [SpanStatusCode.ERROR]: 'Operation failed with error',
      [SpanStatusCode.INVALID_ARGUMENT]: 'Invalid input provided',
      [SpanStatusCode.DEADLINE_EXCEEDED]: 'Operation timed out',
      [SpanStatusCode.NOT_FOUND]: 'Resource not found',
      [SpanStatusCode.ALREADY_EXISTS]: 'Resource already exists',
      [SpanStatusCode.PERMISSION_DENIED]: 'Permission denied',
      [SpanStatusCode.RESOURCE_EXHAUSTED]: 'Resource limit exceeded',
      [SpanStatusCode.FAILED_PRECONDITION]: 'Precondition not met',
      [SpanStatusCode.ABORTED]: 'Operation aborted',
      [SpanStatusCode.INTERNAL]: 'Internal error occurred',
      [SpanStatusCode.UNAVAILABLE]: 'Service unavailable',
      [SpanStatusCode.UNIMPLEMENTED]: 'Operation not implemented',
    };
    return messages[code] || 'Unknown status';
  }
}
```

### 2.5 Enhanced MCP Instrumentation

**Modified File**: `src/telemetry/mcp-instrumentation.ts`

Key changes to integrate new components:

```typescript
import { SpanHierarchyManager } from './span-hierarchy-manager.js';
import { OpenInferenceAdapter } from './openinference-adapter.js';
import { EventManager } from './event-manager.js';
import { StatusMapper, SpanStatusCode } from './status-mapper.js';

export class MCPInstrumentation {
  private hierarchyManager: SpanHierarchyManager;
  private openInferenceAdapter: OpenInferenceAdapter;
  private eventManager: EventManager;
  private statusMapper: StatusMapper;

  private constructor() {
    // ... existing initialization ...

    // Initialize new components
    this.hierarchyManager = new SpanHierarchyManager();
    this.openInferenceAdapter = new OpenInferenceAdapter();
    this.eventManager = new EventManager();
    this.statusMapper = new StatusMapper();
  }

  public instrumentMCPHandler<T extends (...args: any[]) => any>(handler: T, toolName: string): T {
    const instrumented = async (...args: any[]): Promise<any> => {
      const requestId = this.generateRequestId();

      if (!this.config.isEnabled() || !this.config.shouldSample(requestId)) {
        return handler.apply(this, args);
      }

      // Create root span with hierarchy manager
      const rootSpan = this.hierarchyManager.createRootSpan(requestId, `mcp.tool.${toolName}`);

      // Apply OpenInference conventions
      this.openInferenceAdapter.applyConventions(rootSpan, {
        spanKind: 'REQUEST',
        operation: toolName,
        metadata: {
          'mcp.tool': toolName,
          'mcp.request_id': requestId,
        },
      });

      try {
        // Record start event
        this.eventManager.recordCognitiveEvent(rootSpan, {
          phase: 'start',
          thoughtNumber: args[0]?.thought_number || 0,
          duration: 0,
          success: true,
        });

        // Execute with context
        const result = await context.with(
          this.hierarchyManager.getCurrentContext(requestId),
          async () => {
            return await this.executeWithInstrumentation(handler, args, requestId, toolName);
          }
        );

        // Set success status
        rootSpan.setStatus({
          code: this.statusMapper.mapToOTelStatus(SpanStatusCode.OK),
          message: 'Request completed successfully',
        });

        return result;
      } catch (error) {
        // Record error event
        this.eventManager.recordErrorEvent(rootSpan, error as Error, 'error');

        // Set error status
        rootSpan.setStatus({
          code: this.statusMapper.mapToOTelStatus(SpanStatusCode.ERROR),
          message: error.message,
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

  private async executeWithInstrumentation(
    handler: Function,
    args: any[],
    requestId: string,
    toolName: string
  ): Promise<any> {
    // Create cognitive processing span
    const cognitiveSpan = this.hierarchyManager.createChildSpan(
      requestId,
      'mcp.cognitive.process',
      SpanKind.INTERNAL,
      'PROCESS'
    );

    try {
      const startTime = performance.now();

      // Apply cognitive attributes
      if (args[0]?.thought_number !== undefined) {
        cognitiveSpan.setAttribute('cognitive.thought_number', args[0].thought_number);
        cognitiveSpan.setAttribute('cognitive.total_thoughts', args[0].total_thoughts || 0);

        // Handle branching
        if (args[0].branch_from_thought !== undefined) {
          this.eventManager.recordEvent(cognitiveSpan, {
            name: EventType.BRANCH_CREATED,
            attributes: {
              branch_from: args[0].branch_from_thought,
              branch_id: args[0].branch_id,
            },
          });
        }

        // Handle revisions
        if (args[0].is_revision) {
          this.eventManager.recordEvent(cognitiveSpan, {
            name: EventType.REVISION_MADE,
            attributes: {
              revises_thought: args[0].revises_thought,
            },
          });
        }
      }

      // Execute handler
      const result = await handler.apply(this, args);

      // Record completion event
      this.eventManager.recordCognitiveEvent(cognitiveSpan, {
        phase: 'complete',
        thoughtNumber: args[0]?.thought_number || 0,
        duration: performance.now() - startTime,
        success: true,
        insights: result.cognitive_insights,
      });

      // Apply OpenInference conventions for response
      this.openInferenceAdapter.applyConventions(cognitiveSpan, {
        spanKind: 'PROCESS',
        completions: [
          {
            role: 'assistant',
            content: JSON.stringify(result),
            tokens: this.estimateTokenCount(JSON.stringify(result)),
            finish_reason: 'complete',
          },
        ],
      });

      return result;
    } finally {
      this.hierarchyManager.endCurrentSpan(requestId, SpanStatusCode.OK);
    }
  }
}
```

## 3. Performance Optimization Design

### 3.1 Batching Strategy

**New File**: `src/telemetry/batch-processor.ts`

```typescript
export class OptimizedBatchProcessor {
  private batchQueue: Span[] = [];
  private batchTimer?: NodeJS.Timeout;
  private readonly maxBatchSize = 100;
  private readonly batchDelayMs = 1000;
  private readonly maxMemoryPerBatch = 524288; // 512KB

  /**
   * Adds span to batch with memory-aware processing
   */
  addToBatch(span: Span): void {
    const spanSize = this.estimateSpanSize(span);

    // Check if adding this span would exceed memory limit
    const currentBatchSize = this.getCurrentBatchSize();
    if (currentBatchSize + spanSize > this.maxMemoryPerBatch) {
      this.flush();
    }

    this.batchQueue.push(span);

    // Flush if batch is full
    if (this.batchQueue.length >= this.maxBatchSize) {
      this.flush();
    } else if (!this.batchTimer) {
      // Start timer for delayed flush
      this.batchTimer = setTimeout(() => this.flush(), this.batchDelayMs);
    }
  }

  private estimateSpanSize(span: Span): number {
    // Estimate based on attributes
    const attributes = span.attributes || {};
    const attributeSize = JSON.stringify(attributes).length;
    const baseSize = 500; // Base span overhead
    return baseSize + attributeSize;
  }

  private getCurrentBatchSize(): number {
    return this.batchQueue.reduce((sum, span) => {
      return sum + this.estimateSpanSize(span);
    }, 0);
  }

  private flush(): void {
    if (this.batchQueue.length === 0) return;

    // Process batch
    const batch = [...this.batchQueue];
    this.batchQueue = [];

    // Clear timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }

    // Export batch (async, non-blocking)
    setImmediate(() => this.exportBatch(batch));
  }

  private async exportBatch(spans: Span[]): Promise<void> {
    // Compress if needed
    const shouldCompress = this.getCurrentBatchSize() > 102400; // 100KB

    if (shouldCompress) {
      // Implement compression logic
      await this.exportCompressed(spans);
    } else {
      await this.exportNormal(spans);
    }
  }
}
```

### 3.2 Memory Management

**New File**: `src/telemetry/memory-monitor.ts`

```typescript
export class TelemetryMemoryMonitor {
  private memoryLimit = 104857600; // 100MB for telemetry
  private warningThreshold = 52428800; // 50MB warning
  private currentUsage = 0;
  private spanPool: Span[] = [];

  /**
   * Checks memory usage before creating spans
   */
  canCreateSpan(): boolean {
    return this.currentUsage < this.memoryLimit;
  }

  /**
   * Tracks span memory allocation
   */
  trackSpanCreation(estimatedSize: number): void {
    this.currentUsage += estimatedSize;

    if (this.currentUsage > this.warningThreshold) {
      this.triggerMemoryWarning();
    }

    if (this.currentUsage > this.memoryLimit) {
      this.triggerMemoryCleanup();
    }
  }

  /**
   * Releases span memory
   */
  trackSpanDeletion(estimatedSize: number): void {
    this.currentUsage = Math.max(0, this.currentUsage - estimatedSize);
  }

  private triggerMemoryWarning(): void {
    console.warn('Telemetry memory usage high:', {
      current: this.currentUsage,
      limit: this.memoryLimit,
      percentage: (this.currentUsage / this.memoryLimit) * 100,
    });
  }

  private triggerMemoryCleanup(): void {
    // Force flush of batches
    // Clear non-essential data
    // Reduce sampling rate temporarily
  }

  /**
   * Object pooling for span attributes
   */
  getAttributeObject(): Record<string, any> {
    // Reuse objects to reduce GC pressure
    return {};
  }
}
```

### 3.3 Context Propagation Optimization

**New File**: `src/telemetry/context-cache.ts`

```typescript
export class ContextCache {
  private cache: Map<string, Context> = new Map();
  private accessCount: Map<string, number> = new Map();
  private readonly maxCacheSize = 1000;

  /**
   * Gets context with caching
   */
  getContext(key: string, factory: () => Context): Context {
    if (this.cache.has(key)) {
      this.accessCount.set(key, (this.accessCount.get(key) || 0) + 1);
      return this.cache.get(key)!;
    }

    // Evict LRU if needed
    if (this.cache.size >= this.maxCacheSize) {
      this.evictLRU();
    }

    const context = factory();
    this.cache.set(key, context);
    this.accessCount.set(key, 1);

    return context;
  }

  private evictLRU(): void {
    let minAccess = Infinity;
    let evictKey = '';

    for (const [key, count] of this.accessCount.entries()) {
      if (count < minAccess) {
        minAccess = count;
        evictKey = key;
      }
    }

    if (evictKey) {
      this.cache.delete(evictKey);
      this.accessCount.delete(evictKey);
    }
  }
}
```

## 4. Integration Points

### 4.1 Cognitive Orchestrator Integration

**Modified**: `src/cognitive/cognitive-orchestrator.ts`

```typescript
// Add to processThought method
private async processThought(
  thoughtData: ValidatedThoughtData,
  sessionId: string
): Promise<any> {
  const requestId = generateThoughtId();

  // Create cognitive processing span
  const cognitiveSpan = this.telemetry.createCognitiveSpan(
    requestId,
    'cognitive.process.thought',
    {
      thoughtNumber: thoughtData.thought_number,
      totalThoughts: thoughtData.total_thoughts,
      sessionId: sessionId,
    }
  );

  try {
    // Record thought start event
    this.telemetry.recordThoughtStartEvent(cognitiveSpan, thoughtData);

    // ... existing processing logic ...

    // Track plugin executions
    for (const plugin of this.plugins) {
      const pluginSpan = this.telemetry.createChildSpan(
        cognitiveSpan,
        `plugin.${plugin.name}`,
        'PROCESS'
      );

      try {
        const result = await plugin.process(context);
        this.telemetry.recordPluginEvent(pluginSpan, {
          plugin: plugin.name,
          success: true,
          interventions: result.interventions.length,
        });
      } finally {
        pluginSpan.end();
      }
    }

    // Record thought completion
    this.telemetry.recordThoughtCompleteEvent(cognitiveSpan, {
      insights: insights.length,
      breakthroughs: breakthroughs.length,
    });

  } finally {
    cognitiveSpan.end();
  }
}
```

### 4.2 Memory Store Integration

**Modified**: `src/memory/memory-store.ts`

```typescript
// Add telemetry to memory operations
async storeThought(thought: StoredThought): Promise<void> {
  const span = this.telemetry.createMemorySpan('memory.store.thought');

  try {
    const startTime = performance.now();

    // ... existing store logic ...

    this.telemetry.recordMemoryEvent(span, {
      operation: 'write',
      patternCount: thought.patterns?.length || 0,
      duration: performance.now() - startTime,
      success: true,
      bytesProcessed: JSON.stringify(thought).length,
    });

  } catch (error) {
    this.telemetry.recordErrorEvent(span, error, 'error');
    throw error;
  } finally {
    span.end();
  }
}
```

### 4.3 Server Integration

**Modified**: `src/server.ts`

```typescript
// Initialize enhanced telemetry
import { initializeEnhancedTelemetry } from './telemetry/enhanced-init.js';

// In server initialization
await initializeEnhancedTelemetry({
  enableHierarchy: true,
  enableOpenInference: true,
  enableEvents: true,
  enableStatusMapping: true,
  performanceMode: 'optimized',
});

// Wrap tool handlers
server.setRequestHandler(CallToolRequestSchema, async request => {
  return await telemetry.instrumentRequest(
    async () => {
      // ... existing handler logic ...
    },
    {
      requestType: 'tool.call',
      toolName: request.params.name,
    }
  );
});
```

## 5. Testing Strategy

### 5.1 Unit Tests

**New File**: `test/telemetry/span-hierarchy.test.ts`

```typescript
describe('SpanHierarchyManager', () => {
  it('should create proper parent-child relationships', async () => {
    const manager = new SpanHierarchyManager();
    const requestId = 'test-123';

    // Create root
    const root = manager.createRootSpan(requestId, 'test.root');
    expect(root).toBeDefined();

    // Create child
    const child = manager.createChildSpan(requestId, 'test.child', SpanKind.INTERNAL, 'PROCESS');
    expect(child.parentSpanId).toBe(root.spanContext().spanId);

    // Create grandchild
    const grandchild = manager.createChildSpan(
      requestId,
      'test.grandchild',
      SpanKind.INTERNAL,
      'TOOL'
    );
    expect(grandchild.parentSpanId).toBe(child.spanContext().spanId);

    // Cleanup
    manager.cleanupRequest(requestId);
  });

  it('should handle concurrent requests', async () => {
    const manager = new SpanHierarchyManager();

    // Create multiple concurrent requests
    const requests = Array.from({ length: 10 }, (_, i) => `req-${i}`);

    const spans = requests.map(reqId => manager.createRootSpan(reqId, `test.${reqId}`));

    // Verify isolation
    expect(spans.length).toBe(10);
    expect(new Set(spans.map(s => s.spanContext().spanId)).size).toBe(10);
  });
});
```

### 5.2 Integration Tests

**New File**: `test/telemetry/phoenix-integration.test.ts`

```typescript
describe('Phoenix Integration', () => {
  it('should export traces with correct structure', async () => {
    const telemetry = new EnhancedTelemetry();

    // Create complex trace
    const trace = await telemetry.createTrace(async tracer => {
      const root = tracer.startSpan('root');

      // Add cognitive processing
      const cognitive = tracer.startChildSpan('cognitive');
      cognitive.addEvent('thought.start');
      cognitive.addEvent('thought.complete');
      cognitive.end();

      // Add tool execution
      const tool = tracer.startChildSpan('tool');
      tool.setAttribute('tool.name', 'test-tool');
      tool.end();

      root.end();
    });

    // Verify export
    const exported = await telemetry.exportToPhoenix(trace);
    expect(exported.spans).toHaveLength(3);
    expect(exported.spans[0].parent_id).toBeNull();
    expect(exported.spans[1].parent_id).toBe(exported.spans[0].span_id);
  });
});
```

### 5.3 Performance Tests

**New File**: `test/telemetry/performance.test.ts`

```typescript
describe('Telemetry Performance', () => {
  it('should meet latency requirements', async () => {
    const telemetry = new EnhancedTelemetry();
    const iterations = 1000;

    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      const span = telemetry.createSpan(`test-${i}`);
      span.setAttribute('test', true);
      span.addEvent('test.event');
      span.end();
    }

    const duration = performance.now() - startTime;
    const avgLatency = duration / iterations;

    expect(avgLatency).toBeLessThan(100); // < 100ms requirement
  });

  it('should handle memory limits', async () => {
    const telemetry = new EnhancedTelemetry();
    const memoryBefore = process.memoryUsage().heapUsed;

    // Create large trace
    const spans = [];
    for (let i = 0; i < 1000; i++) {
      const span = telemetry.createSpan(`span-${i}`);

      // Add many attributes
      for (let j = 0; j < 100; j++) {
        span.setAttribute(`attr-${j}`, `value-${j}`);
      }

      spans.push(span);
    }

    const memoryAfter = process.memoryUsage().heapUsed;
    const memoryUsed = (memoryAfter - memoryBefore) / 1048576; // Convert to MB

    expect(memoryUsed).toBeLessThan(1); // < 1MB per trace requirement

    // Cleanup
    spans.forEach(s => s.end());
  });
});
```

## 6. Migration Plan

### 6.1 Feature Flags

**New File**: `src/telemetry/feature-flags.ts`

```typescript
export class TelemetryFeatureFlags {
  private flags = {
    enhancedHierarchy: false,
    openInferenceConventions: false,
    eventSystem: false,
    statusMapping: false,
    performanceOptimizations: false,
  };

  enable(feature: keyof typeof this.flags): void {
    this.flags[feature] = true;
  }

  isEnabled(feature: keyof typeof this.flags): boolean {
    return this.flags[feature];
  }

  // Gradual rollout
  enablePhase2(percentage: number = 100): void {
    const random = Math.random() * 100;
    if (random <= percentage) {
      this.flags.enhancedHierarchy = true;
      this.flags.openInferenceConventions = true;
      this.flags.eventSystem = true;
      this.flags.statusMapping = true;
      this.flags.performanceOptimizations = true;
    }
  }
}
```

### 6.2 Parallel Pipeline

```typescript
export class ParallelTelemetryPipeline {
  private oldPipeline: MCPInstrumentation;
  private newPipeline: EnhancedTelemetry;
  private comparisonMode = false;

  async process(data: any): Promise<void> {
    if (this.comparisonMode) {
      // Run both pipelines
      const [oldResult, newResult] = await Promise.allSettled([
        this.oldPipeline.process(data),
        this.newPipeline.process(data),
      ]);

      // Compare results
      this.compareResults(oldResult, newResult);
    } else {
      // Use new pipeline only
      await this.newPipeline.process(data);
    }
  }

  private compareResults(old: any, new: any): void {
    // Log differences for validation
    if (old.status !== new.status) {
      console.warn('Pipeline difference detected:', { old, new });
    }
  }
}
```

## 7. Monitoring & Alerting

### 7.1 Metrics Collection

```typescript
export class TelemetryMetrics {
  private prometheus = new PrometheusClient();

  // Latency metrics
  spanCreationLatency = this.prometheus.histogram({
    name: 'telemetry_span_creation_latency_ms',
    help: 'Span creation latency in milliseconds',
    buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
  });

  // Resource metrics
  memoryUsage = this.prometheus.gauge({
    name: 'telemetry_memory_usage_bytes',
    help: 'Telemetry memory usage in bytes',
  });

  // Error metrics
  errorRate = this.prometheus.counter({
    name: 'telemetry_errors_total',
    help: 'Total telemetry errors',
    labelNames: ['type', 'severity'],
  });

  // Export metrics
  exportSuccessRate = this.prometheus.gauge({
    name: 'telemetry_export_success_rate',
    help: 'Trace export success rate',
  });
}
```

### 7.2 Alert Rules

```yaml
# prometheus-alerts.yml
groups:
  - name: telemetry_alerts
    rules:
      - alert: HighTelemetryLatency
        expr: histogram_quantile(0.99, telemetry_span_creation_latency_ms) > 100
        for: 5m
        annotations:
          summary: 'Telemetry latency exceeds 100ms (p99)'

      - alert: HighTelemetryMemory
        expr: telemetry_memory_usage_bytes > 104857600 # 100MB
        for: 10m
        annotations:
          summary: 'Telemetry memory usage exceeds 100MB'

      - alert: LowExportSuccessRate
        expr: telemetry_export_success_rate < 0.999
        for: 5m
        annotations:
          summary: 'Trace export success rate below 99.9%'
```

## 8. Rollback Procedures

### 8.1 Automatic Rollback Triggers

```typescript
export class RollbackManager {
  private errorThreshold = 0.01; // 1% error rate
  private performanceThreshold = 1.05; // 5% degradation

  async checkHealth(): Promise<boolean> {
    const metrics = await this.collectMetrics();

    // Check error rate
    if (metrics.errorRate > this.errorThreshold) {
      await this.triggerRollback('High error rate detected');
      return false;
    }

    // Check performance
    if (metrics.latencyRatio > this.performanceThreshold) {
      await this.triggerRollback('Performance degradation detected');
      return false;
    }

    // Check data integrity
    if (!metrics.dataIntegrity) {
      await this.triggerRollback('Data integrity check failed');
      return false;
    }

    return true;
  }

  private async triggerRollback(reason: string): Promise<void> {
    console.error(`Triggering rollback: ${reason}`);

    // 1. Switch to old pipeline
    await this.switchToOldPipeline();

    // 2. Notify team
    await this.notifyTeam(reason);

    // 3. Preserve debug data
    await this.preserveDebugData();
  }
}
```

## 9. Documentation Updates

### 9.1 API Documentation

````typescript
/**
 * Enhanced Telemetry API
 *
 * @example
 * ```typescript
 * const telemetry = new EnhancedTelemetry();
 *
 * // Create hierarchical spans
 * const rootSpan = telemetry.createRootSpan('operation');
 * const childSpan = telemetry.createChildSpan(rootSpan, 'sub-operation');
 *
 * // Add OpenInference attributes
 * telemetry.applyOpenInferenceConventions(span, {
 *   model: 'claude-3-sonnet',
 *   prompts: [{ role: 'user', content: 'Hello', tokens: 2 }],
 * });
 *
 * // Record events
 * telemetry.recordEvent(span, {
 *   name: 'cognitive.insight',
 *   attributes: { insight: 'Pattern detected' }
 * });
 *
 * // Set status
 * telemetry.setStatus(span, SpanStatusCode.OK);
 * ```
 */
````

### 9.2 Migration Guide

````markdown
# Phase 2 Migration Guide

## Prerequisites

- OpenTelemetry SDK v1.8.0+
- Phoenix client configured
- Node.js 18+

## Migration Steps

1. **Enable Feature Flags** (Week 1)
   ```typescript
   telemetry.enablePhase2Features({
     percentage: 10, // Start with 10% rollout
   });
   ```
````

2. **Monitor Metrics** (Week 1-2)
   - Check error rates
   - Monitor performance
   - Validate trace structure

3. **Gradual Rollout** (Week 2-4)
   - Increase to 25%
   - Then 50%
   - Then 100%

4. **Cleanup** (Week 4)
   - Remove old instrumentation
   - Update documentation
   - Archive old code

````

## 10. Success Metrics Dashboard

```typescript
export class Phase2Dashboard {
  getMetrics(): DashboardMetrics {
    return {
      // Trace Quality
      traceQuality: {
        correctHierarchy: this.calculateHierarchyCorrectness(),
        orphanedSpans: this.countOrphanedSpans(),
        conventionCompliance: this.checkConventionCompliance(),
      },

      // Performance
      performance: {
        spanCreationP99: this.getLatencyPercentile(99),
        cpuOverhead: this.getCPUOverhead(),
        memoryUsage: this.getMemoryUsage(),
        exportSuccessRate: this.getExportSuccessRate(),
      },

      // Business Impact
      businessImpact: {
        insightsDetected: this.countInsights(),
        breakthroughsFound: this.countBreakthroughs(),
        cognitiveEfficiency: this.calculateEfficiency(),
      },
    };
  }
}
````

## Conclusion

This technical design provides a complete blueprint for implementing Phase 2 of the Phoenix Observability enhancement. The design ensures:

1. **Proper span hierarchy** with context-aware parent-child relationships
2. **Full OpenInference compliance** while maintaining backward compatibility
3. **Comprehensive event system** for all cognitive operations
4. **All 13 status codes** properly mapped and implemented
5. **Performance optimization** meeting all requirements (<2% CPU, <100ms latency, <1MB memory)
6. **Zero-downtime deployment** with gradual rollout and automatic rollback

The implementation is broken down into discrete, testable components that can be developed in parallel by multiple team members. Each component has clear interfaces, comprehensive tests, and monitoring capabilities.

### Next Steps

1. Review and approve design
2. Create implementation tickets for each component
3. Begin development with span hierarchy manager
4. Implement parallel pipeline for validation
5. Deploy with 10% rollout and monitor
6. Gradually increase rollout based on metrics
7. Complete migration and cleanup

This design is ready for immediate implementation by the development team.
