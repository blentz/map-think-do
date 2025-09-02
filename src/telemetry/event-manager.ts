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

interface EventBatch {
  events: EventData[];
  lastFlush: number;
  size: number;
}

export class EventManager {
  private eventQueue: Map<string, EventData[]> = new Map();
  private eventHandlers: Map<EventType, ((data: EventData) => void)[]> = new Map();
  private batchedEvents: Map<string, EventBatch> = new Map();
  private batchFlushInterval: NodeJS.Timeout | null = null;

  // Configuration for batching
  private readonly MAX_BATCH_SIZE = 50;
  private readonly BATCH_TIMEOUT = 1000; // 1 second
  private readonly MAX_QUEUE_SIZE = 1000;

  constructor() {
    // Periodic batch flushing to prevent memory buildup
    this.batchFlushInterval = setInterval(() => this.flushOldBatches(), this.BATCH_TIMEOUT);
  }

  /**
   * Records an event to a span with batching optimization
   */
  recordEvent(span: Span, event: EventData): void {
    const timestamp = event.timestamp || Date.now();
    const spanId = span.spanContext().spanId;

    // Add to span immediately for real-time observability
    span.addEvent(event.name, event.attributes, timestamp);

    // Queue for batch processing with size limits
    this.addToQueue(spanId, { ...event, timestamp });

    // Trigger handlers asynchronously
    setImmediate(() => this.triggerHandlers(event));
  }

  private addToQueue(spanId: string, event: EventData): void {
    if (!this.eventQueue.has(spanId)) {
      this.eventQueue.set(spanId, []);
    }

    const queue = this.eventQueue.get(spanId)!;

    // Prevent unbounded queue growth
    if (queue.length >= this.MAX_QUEUE_SIZE) {
      queue.shift(); // Remove oldest event
    }

    queue.push(event);

    // Add to batch for processing
    this.addToBatch(spanId, event);
  }

  private addToBatch(spanId: string, event: EventData): void {
    if (!this.batchedEvents.has(spanId)) {
      this.batchedEvents.set(spanId, {
        events: [],
        lastFlush: Date.now(),
        size: 0,
      });
    }

    const batch = this.batchedEvents.get(spanId)!;
    batch.events.push(event);
    batch.size += JSON.stringify(event).length; // Approximate size

    // Flush batch if it's large enough
    if (batch.events.length >= this.MAX_BATCH_SIZE || batch.size > 10000) {
      this.processBatch(spanId, batch);
    }
  }

  private processBatch(_spanId: string, batch: EventBatch): void {
    // Compress events with similar patterns
    const compressedEvents = this.compressEvents(batch.events);

    // Update batch
    batch.events = compressedEvents;
    batch.lastFlush = Date.now();
    batch.size = compressedEvents.reduce((sum, e) => sum + JSON.stringify(e).length, 0);
  }

  private compressEvents(events: EventData[]): EventData[] {
    // Group similar events by type and attributes
    const eventGroups = new Map<string, EventData[]>();

    events.forEach(event => {
      const key = `${event.name}:${JSON.stringify(event.attributes)}`;
      if (!eventGroups.has(key)) {
        eventGroups.set(key, []);
      }
      eventGroups.get(key)!.push(event);
    });

    const compressed: EventData[] = [];

    eventGroups.forEach((groupEvents, _key) => {
      if (groupEvents.length === 1) {
        compressed.push(groupEvents[0]);
      } else {
        // Compress multiple similar events into one with count
        const firstEvent = groupEvents[0];
        compressed.push({
          ...firstEvent,
          attributes: {
            ...firstEvent.attributes,
            event_count: groupEvents.length,
            first_timestamp: groupEvents[0].timestamp,
            last_timestamp: groupEvents[groupEvents.length - 1].timestamp,
            compressed: true,
          },
        });
      }
    });

    return compressed;
  }

  private flushOldBatches(): void {
    const now = Date.now();

    for (const [spanId, batch] of this.batchedEvents.entries()) {
      if (now - batch.lastFlush > this.BATCH_TIMEOUT) {
        this.processBatch(spanId, batch);
      }
    }
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
   * Flush events for a span with batching cleanup
   */
  flushEvents(spanId: string): EventData[] {
    const events = this.eventQueue.get(spanId) || [];
    this.eventQueue.delete(spanId);

    // Also clean up batched events
    this.batchedEvents.delete(spanId);

    return events;
  }

  /**
   * Get performance metrics for monitoring
   */
  getMetrics(): {
    queuedSpans: number;
    totalEvents: number;
    batchedSpans: number;
    memoryUsage: number;
  } {
    const totalEvents = Array.from(this.eventQueue.values()).reduce(
      (sum, queue) => sum + queue.length,
      0
    );

    const memoryUsage = Array.from(this.batchedEvents.values()).reduce(
      (sum, batch) => sum + batch.size,
      0
    );

    return {
      queuedSpans: this.eventQueue.size,
      totalEvents,
      batchedSpans: this.batchedEvents.size,
      memoryUsage,
    };
  }

  /**
   * Cleanup method for graceful shutdown
   */
  cleanup(): void {
    // Clear interval to prevent Jest hanging
    if (this.batchFlushInterval) {
      clearInterval(this.batchFlushInterval);
      this.batchFlushInterval = null;
    }

    // Flush all remaining batches
    for (const [spanId, batch] of this.batchedEvents.entries()) {
      this.processBatch(spanId, batch);
    }

    this.eventQueue.clear();
    this.batchedEvents.clear();
    this.eventHandlers.clear();
  }
}
