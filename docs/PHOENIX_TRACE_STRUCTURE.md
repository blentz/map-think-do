# Phoenix Trace Structure Enhancement (Phase 2)

Version: 1.0.0
Status: Draft
Author: Requirements Team
Date: 2025-09-02

## 1. Overview

This document specifies the technical requirements for Phase 2 of the Phoenix Observability enhancement project, focusing on improving trace structure and implementing OpenInference semantic conventions.

### 1.1 Context

The MCP (Model Context Protocol) server currently has basic telemetry implementation with:

- Prompt tracking
- User/session tracking
- Context attributes
- Basic span creation

### 1.2 Goals

1. Enhance parent-child span relationships to accurately reflect MCP operation hierarchy
2. Implement OpenInference semantic conventions for standardized telemetry
3. Add structured events and status codes for improved trace information
4. Meet strict performance targets for production deployment

### 1.3 Success Metrics

1. Trace Structure Quality:
   - 100% of operations have correct parent-child relationships
   - All spans follow OpenInference conventions
   - Zero orphaned spans in traces

2. Performance Targets:
   - Instrumentation overhead: < 2% CPU
   - Span creation latency: < 100ms
   - Memory per trace: < 1MB
   - Trace export success rate: > 99.9%

## 2. Technical Specifications

### 2.1 Trace Hierarchy Model

```typescript
interface TraceHierarchy {
  // Root span for MCP request
  rootSpan: {
    name: 'mcp.request';
    kind: SpanKind.SERVER;
    attributes: {
      'openinference.span.kind': 'REQUEST';
      'service.name': 'mcp-server';
      'service.version': string;
    };
  };

  // Cognitive processing span
  cognitiveSpan: {
    name: 'mcp.cognitive.process';
    kind: SpanKind.INTERNAL;
    parentSpan: 'mcp.request';
    attributes: {
      'openinference.span.kind': 'PROCESS';
      'cognitive.phase': string;
      'cognitive.thought_number': number;
    };
  };

  // Tool execution span
  toolSpan: {
    name: 'mcp.tool.execute';
    kind: SpanKind.INTERNAL;
    parentSpan: 'mcp.cognitive.process';
    attributes: {
      'openinference.span.kind': 'TOOL';
      'tool.name': string;
      'tool.version': string;
    };
  };

  // Memory operation span
  memorySpan: {
    name: 'mcp.memory.operation';
    kind: SpanKind.INTERNAL;
    parentSpan: 'mcp.cognitive.process';
    attributes: {
      'openinference.span.kind': 'STORAGE';
      'db.operation': string;
      'db.statement': string;
    };
  };
}
```

### 2.2 OpenInference Semantic Conventions

#### 2.2.1 Required Span Attributes

```typescript
interface SpanAttributes {
  // Core attributes (required)
  'openinference.span.kind': 'REQUEST' | 'PROCESS' | 'TOOL' | 'STORAGE';
  'service.name': string;
  'service.version': string;
  'service.instance.id': string;

  // LLM-specific attributes
  'llm.vendor': 'anthropic';
  'llm.model': string;
  'llm.model_version': string;
  'llm.max_tokens': number;
  'llm.temperature': number;
  'llm.top_p': number;

  // Prompt tracking
  'llm.prompts': Array<{
    role: string;
    content: string;
    tokens: number;
  }>;

  // Response tracking
  'llm.completions': Array<{
    role: string;
    content: string;
    tokens: number;
    finish_reason: string;
  }>;

  // Cost tracking
  'llm.token_count.prompt': number;
  'llm.token_count.completion': number;
  'llm.token_count.total': number;
  'llm.cost.total': number;

  // Performance metrics
  'performance.latency_ms': number;
  'performance.cpu_time_ms': number;
  'performance.memory_mb': number;
}
```

#### 2.2.2 Optional Span Attributes

```typescript
interface OptionalSpanAttributes {
  // Cognitive metrics
  'cognitive.thought_number': number;
  'cognitive.total_thoughts': number;
  'cognitive.branch_id': string;
  'cognitive.revision_id': string;

  // Memory metrics
  'memory.operation_type': string;
  'memory.pattern_count': number;
  'memory.embedding_dimensions': number;

  // Tool metrics
  'tool.execution_time_ms': number;
  'tool.error_count': number;
  'tool.retry_count': number;
}
```

### 2.3 Event Schema

```typescript
interface TraceEvents {
  // Cognitive events
  CognitiveEvent: {
    name: 'cognitive.process';
    attributes: {
      phase: 'start' | 'process' | 'complete';
      thought_number: number;
      duration_ms: number;
      success: boolean;
    };
  };

  // Tool events
  ToolEvent: {
    name: 'tool.execution';
    attributes: {
      tool_name: string;
      start_time: number;
      end_time: number;
      success: boolean;
      error?: string;
    };
  };

  // Memory events
  MemoryEvent: {
    name: 'memory.operation';
    attributes: {
      operation: 'read' | 'write' | 'query';
      pattern_count: number;
      duration_ms: number;
      success: boolean;
    };
  };

  // Error events
  ErrorEvent: {
    name: 'error';
    attributes: {
      error_type: string;
      error_message: string;
      stack_trace: string;
      severity: 'warning' | 'error' | 'critical';
    };
  };
}
```

### 2.4 Status Code Mappings

```typescript
enum SpanStatusCode {
  // Success codes
  OK = 0, // Operation completed successfully
  PARTIAL_SUCCESS = 1, // Operation completed with some issues

  // Error codes
  ERROR = 2, // Generic error
  INVALID_ARGUMENT = 3, // Invalid input
  DEADLINE_EXCEEDED = 4, // Operation timeout
  NOT_FOUND = 5, // Resource not found
  ALREADY_EXISTS = 6, // Resource conflict
  PERMISSION_DENIED = 7, // Authorization failure
  RESOURCE_EXHAUSTED = 8, // Rate limit or quota exceeded
  FAILED_PRECONDITION = 9, // Operation prerequisites not met
  ABORTED = 10, // Operation aborted
  INTERNAL = 11, // Internal error
  UNAVAILABLE = 12, // Service unavailable
  UNIMPLEMENTED = 13, // Operation not implemented
}

interface StatusMapping {
  // Cognitive operation status
  cognitive: {
    success: SpanStatusCode.OK;
    partial_completion: SpanStatusCode.PARTIAL_SUCCESS;
    timeout: SpanStatusCode.DEADLINE_EXCEEDED;
    error: SpanStatusCode.ERROR;
  };

  // Tool execution status
  tool: {
    success: SpanStatusCode.OK;
    invalid_input: SpanStatusCode.INVALID_ARGUMENT;
    execution_error: SpanStatusCode.ERROR;
    not_found: SpanStatusCode.NOT_FOUND;
  };

  // Memory operation status
  memory: {
    success: SpanStatusCode.OK;
    not_found: SpanStatusCode.NOT_FOUND;
    conflict: SpanStatusCode.ALREADY_EXISTS;
    error: SpanStatusCode.ERROR;
  };
}
```

## 3. Interface Definitions

### 3.1 Trace Creation API

```typescript
interface TraceAPI {
  // Start a new trace
  startTrace(options: { name: string; kind: SpanKind; attributes: Record<string, any> }): Span;

  // Create child span
  createChildSpan(options: {
    name: string;
    kind: SpanKind;
    parentSpan: Span;
    attributes: Record<string, any>;
  }): Span;

  // Add event to span
  addEvent(
    span: Span,
    event: {
      name: string;
      attributes: Record<string, any>;
    }
  ): void;

  // Set span status
  setStatus(
    span: Span,
    status: {
      code: SpanStatusCode;
      message?: string;
    }
  ): void;

  // End span
  endSpan(span: Span): void;
}
```

### 3.2 Context Propagation API

```typescript
interface ContextAPI {
  // Get current context
  getCurrentContext(): Context;

  // Create new context
  createContext(parent?: Context): Context;

  // Set context value
  setContextValue(context: Context, key: symbol, value: any): Context;

  // Get context value
  getContextValue(context: Context, key: symbol): any;

  // Execute with context
  withContext<T>(context: Context, fn: () => Promise<T>): Promise<T>;
}
```

### 3.3 Metric Collection API

```typescript
interface MetricAPI {
  // Record value
  recordValue(name: string, value: number, attributes?: Record<string, any>): void;

  // Create histogram
  createHistogram(
    name: string,
    options: {
      description: string;
      unit: string;
      boundaries: number[];
    }
  ): Histogram;

  // Record histogram value
  recordHistogram(histogram: Histogram, value: number): void;

  // Create counter
  createCounter(
    name: string,
    options: {
      description: string;
      unit: string;
    }
  ): Counter;

  // Increment counter
  incrementCounter(counter: Counter, value?: number): void;
}
```

## 4. Performance Requirements

### 4.1 Latency Requirements

```typescript
interface LatencyRequirements {
  // Span creation
  spanCreation: {
    p50: 10; // 50th percentile in ms
    p95: 50; // 95th percentile in ms
    p99: 100; // 99th percentile in ms
  };

  // Event recording
  eventRecording: {
    p50: 5; // 50th percentile in ms
    p95: 20; // 95th percentile in ms
    p99: 50; // 99th percentile in ms
  };

  // Attribute updates
  attributeUpdates: {
    p50: 1; // 50th percentile in ms
    p95: 5; // 95th percentile in ms
    p99: 10; // 99th percentile in ms
  };

  // Context operations
  contextOperations: {
    p50: 0.1; // 50th percentile in ms
    p95: 0.5; // 95th percentile in ms
    p99: 1; // 99th percentile in ms
  };
}
```

### 4.2 Memory Requirements

```typescript
interface MemoryRequirements {
  // Per span memory limits
  spanMemory: {
    baseSize: 500; // Base size in bytes
    maxSize: 10000; // Maximum size in bytes
    attributeSize: 100; // Per attribute in bytes
  };

  // Per trace memory limits
  traceMemory: {
    maxSize: 1048576; // 1MB maximum
    warningThreshold: 524288; // 512KB warning
    spanLimit: 1000; // Maximum spans per trace
  };

  // Context memory limits
  contextMemory: {
    maxSize: 10000; // Maximum context size in bytes
    maxValues: 100; // Maximum values in context
  };
}
```

### 4.3 CPU Requirements

```typescript
interface CPURequirements {
  // CPU overhead limits
  cpuOverhead: {
    maxPercent: 2; // Maximum CPU overhead
    warningPercent: 1; // Warning threshold
  };

  // Batch processing limits
  batchProcessing: {
    maxBatchSize: 100; // Maximum items per batch
    processingTimeMs: 50; // Maximum processing time
  };

  // Concurrent operations
  concurrency: {
    maxSpans: 1000; // Maximum concurrent spans
    maxTraces: 100; // Maximum concurrent traces
  };
}
```

## 5. Test Scenarios

### 5.1 Trace Structure Tests

```typescript
interface TraceStructureTests {
  // Verify parent-child relationships
  testParentChild(): {
    description: 'Verify correct span hierarchy';
    steps: [
      'Create root span',
      'Create multiple child spans',
      'Verify parent references',
      'Verify span order',
      'Validate timing relationships',
    ];
    assertions: [
      'All spans have correct parent',
      'No orphaned spans exist',
      'Timing overlaps are valid',
      'Attributes inherited correctly',
    ];
  };

  // Test span attribute propagation
  testAttributePropagation(): {
    description: 'Verify attribute inheritance';
    steps: [
      'Set attributes on parent span',
      'Create child spans',
      'Add child-specific attributes',
      'Verify attribute presence',
    ];
    assertions: [
      'Parent attributes visible to children',
      "Child attributes don't affect parent",
      'No attribute name collisions',
      'Correct attribute types maintained',
    ];
  };

  // Test context propagation
  testContextPropagation(): {
    description: 'Verify context handling';
    steps: [
      'Create root context',
      'Add context values',
      'Create child contexts',
      'Verify value accessibility',
    ];
    assertions: [
      'Context properly propagated',
      'Values correctly scoped',
      'No context leakage',
      'Async operations maintain context',
    ];
  };
}
```

### 5.2 Performance Tests

```typescript
interface PerformanceTests {
  // Measure span creation overhead
  testSpanCreation(): {
    description: 'Measure span creation performance';
    steps: [
      'Create spans in tight loop',
      'Measure creation time',
      'Monitor memory usage',
      'Check CPU utilization',
    ];
    assertions: ['Creation time < 100ms', 'Memory growth < 1MB', 'CPU overhead < 2%'];
  };

  // Test high concurrency
  testConcurrency(): {
    description: 'Verify concurrent operation handling';
    steps: [
      'Create multiple concurrent traces',
      'Add spans simultaneously',
      'Monitor system resources',
      'Verify trace consistency',
    ];
    assertions: [
      'No trace corruption',
      'Consistent performance',
      'Resource usage within limits',
      'Correct span relationships maintained',
    ];
  };

  // Test memory management
  testMemoryManagement(): {
    description: 'Verify memory usage patterns';
    steps: [
      'Create large traces',
      'Monitor memory allocation',
      'Check for leaks',
      'Verify cleanup',
    ];
    assertions: [
      'Memory usage < 1MB per trace',
      'No memory leaks',
      'Efficient cleanup',
      'Stable long-term usage',
    ];
  };
}
```

### 5.3 Integration Tests

```typescript
interface IntegrationTests {
  // Test Phoenix export
  testPhoenixExport(): {
    description: 'Verify Phoenix trace export';
    steps: ['Create complex traces', 'Export to Phoenix', 'Verify receipt', 'Check data integrity'];
    assertions: [
      'All spans exported',
      'Attributes preserved',
      'Relationships maintained',
      'Performance within bounds',
    ];
  };

  // Test error handling
  testErrorHandling(): {
    description: 'Verify error handling';
    steps: [
      'Simulate various errors',
      'Check error reporting',
      'Verify recovery',
      'Validate data integrity',
    ];
    assertions: [
      'Errors properly captured',
      'System remains stable',
      'Data consistency maintained',
      'Correct error attribution',
    ];
  };

  // Test backward compatibility
  testCompatibility(): {
    description: 'Verify backward compatibility';
    steps: [
      'Use old API patterns',
      'Check data translation',
      'Verify functionality',
      'Validate integrations',
    ];
    assertions: [
      'Old code still works',
      'Data properly converted',
      'No functionality loss',
      'Clean upgrade path',
    ];
  };
}
```

## 6. Implementation Constraints

### 6.1 Technical Constraints

1. Must maintain backward compatibility with existing telemetry
2. Zero downtime deployment requirement
3. No breaking changes to public APIs
4. Must support high-concurrency environments
5. Must handle network failures gracefully

### 6.2 Resource Constraints

1. Memory usage:
   - < 1MB per trace
   - < 100MB total telemetry overhead
   - No memory leaks

2. CPU usage:
   - < 2% overhead per core
   - No CPU spikes during export
   - Efficient batch processing

3. Network usage:
   - Batch exports to reduce calls
   - Compress traces > 100KB
   - Handle network timeouts

### 6.3 Operational Constraints

1. Logging:
   - Structured JSON format
   - Include trace IDs
   - Error correlation
   - Performance metrics

2. Monitoring:
   - Real-time performance metrics
   - Resource usage alerts
   - Error rate tracking
   - Trace export success rate

3. Debug Support:
   - Detailed error context
   - Span relationship visualization
   - Attribute search capability
   - Trace sampling controls

## 7. Dependencies

### 7.1 Internal Dependencies

1. Telemetry System:
   - mcp-instrumentation.ts
   - phoenix-client.ts
   - telemetry-config.ts

2. Memory System:
   - memory-store.ts
   - postgresql-memory-store.ts

3. Cognitive System:
   - cognitive-orchestrator.ts
   - plugin-system.ts

### 7.2 External Dependencies

1. OpenTelemetry:
   - @opentelemetry/api: ^1.4.0
   - @opentelemetry/sdk-trace-base: ^1.8.0
   - @opentelemetry/semantic-conventions: ^1.8.0

2. Phoenix:
   - Phoenix Trace API v1
   - Phoenix Export Protocol
   - Phoenix Query API

3. Monitoring:
   - Prometheus client
   - Metrics export protocol
   - Alert manager integration

## 8. Migration Plan

### 8.1 Phase 2 Migration Steps

1. Preparation:
   - Backup existing traces
   - Create parallel telemetry pipeline
   - Set up validation environment

2. Implementation:
   - Deploy new span processors
   - Update semantic conventions
   - Enhance trace hierarchy
   - Add new metrics

3. Validation:
   - Run parallel systems
   - Compare trace quality
   - Verify performance
   - Check data consistency

4. Cutover:
   - Gradual traffic shift
   - Monitor error rates
   - Verify trace export
   - Clean up old system

### 8.2 Rollback Plan

1. Trigger Conditions:
   - Error rate > 1%
   - Performance degradation > 5%
   - Data loss detected
   - Critical functionality broken

2. Rollback Steps:
   - Switch to backup pipeline
   - Restore original config
   - Verify system health
   - Notify stakeholders

## 9. Acceptance Criteria

### 9.1 Functional Criteria

1. Trace Structure:
   - All spans have correct parent-child relationships
   - OpenInference semantic conventions implemented
   - Events and status codes properly recorded
   - Context propagation working correctly

2. Data Quality:
   - No orphaned spans
   - All required attributes present
   - Correct timestamp ordering
   - Valid status codes

3. Integration:
   - Phoenix export successful
   - Backward compatibility maintained
   - Error handling working
   - Monitoring integrated

### 9.2 Performance Criteria

1. Latency:
   - Span creation < 100ms
   - Event recording < 50ms
   - Attribute updates < 10ms
   - Context operations < 1ms

2. Resource Usage:
   - Memory < 1MB per trace
   - CPU overhead < 2%
   - Network efficient
   - No resource leaks

3. Reliability:
   - 99.9% export success
   - Zero data loss
   - Clean error handling
   - Stable under load

### 9.3 Operational Criteria

1. Monitoring:
   - All metrics visible
   - Alerts functioning
   - Logs properly formatted
   - Traces searchable

2. Maintenance:
   - Easy configuration
   - Simple deployment
   - Clear documentation
   - Debug capabilities

## 10. Documentation Requirements

### 10.1 Technical Documentation

1. Architecture:
   - System design
   - Component interaction
   - Data flow
   - Error handling

2. API Reference:
   - Public interfaces
   - Method signatures
   - Type definitions
   - Usage examples

3. Performance Guide:
   - Optimization tips
   - Best practices
   - Anti-patterns
   - Troubleshooting

### 10.2 Operational Documentation

1. Deployment:
   - Setup instructions
   - Configuration guide
   - Migration steps
   - Rollback procedures

2. Monitoring:
   - Metrics reference
   - Alert rules
   - Dashboard setup
   - Log analysis

3. Troubleshooting:
   - Common issues
   - Debug procedures
   - Error codes
   - Support escalation

## 11. Timeline and Milestones

### 11.1 Development Phases

1. Phase 2.1 - Core Structure (Week 1-2):
   - Implement span hierarchy
   - Add semantic conventions
   - Update context propagation

2. Phase 2.2 - Events & Status (Week 3-4):
   - Add event system
   - Implement status codes
   - Enhance error handling

3. Phase 2.3 - Performance (Week 5-6):
   - Optimize span creation
   - Implement batching
   - Memory management

4. Phase 2.4 - Integration (Week 7-8):
   - Phoenix integration
   - Monitoring setup
   - Documentation
   - Testing

### 11.2 Deliverables

1. Week 2:
   - Basic trace hierarchy
   - Initial semantic conventions
   - Preliminary tests

2. Week 4:
   - Complete event system
   - Status code implementation
   - Integration tests

3. Week 6:
   - Performance optimizations
   - Resource management
   - Load tests

4. Week 8:
   - Full integration
   - Documentation
   - Production deployment
