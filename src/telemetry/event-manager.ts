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
