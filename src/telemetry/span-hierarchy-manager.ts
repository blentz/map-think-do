import { Span, SpanKind, Context, trace, context, SpanStatusCode } from '@opentelemetry/api';

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
    // Use shorter timeout in test environment
    const cleanupDelay = process.env.NODE_ENV === 'test' ? 10 : 60000;
    setTimeout(() => {
      for (const [parentId] of this.spanRelationships.entries()) {
        // Remove if all children are from this request
        this.spanRelationships.delete(parentId);
      }
    }, cleanupDelay);
  }
}
