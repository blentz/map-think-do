import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { SpanHierarchyManager } from '../../src/telemetry/span-hierarchy-manager.js';
import {
  OpenInferenceAdapter,
  LLMPrompt,
  LLMCompletion,
} from '../../src/telemetry/openinference-adapter.js';
import { EventManager, EventType } from '../../src/telemetry/event-manager.js';

// Mock OpenTelemetry
const mockSpan = {
  spanContext: jest.fn(() => ({ spanId: 'test-span-id', traceId: 'test-trace-id' })),
  setAttribute: jest.fn(),
  addEvent: jest.fn(),
  setStatus: jest.fn(),
  end: jest.fn(),
  startTime: Date.now(),
  attributes: {},
};

jest.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: jest.fn(() => ({
      startSpan: jest.fn(() => mockSpan),
    })),
    setSpan: jest.fn((ctx, _span) => ctx),
  },
  context: {
    active: jest.fn(() => ({})),
  },
  SpanKind: {
    SERVER: 1,
    INTERNAL: 2,
  },
  SpanStatusCode: {
    OK: 1,
    ERROR: 2,
  },
}));

describe('Phoenix Phase 2 Components', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SpanHierarchyManager', () => {
    let manager: SpanHierarchyManager;

    beforeEach(() => {
      manager = new SpanHierarchyManager();
    });

    it('should create root span with proper attributes', () => {
      const requestId = 'test-request-123';
      const spanName = 'test.root';

      const span = manager.createRootSpan(requestId, spanName);

      expect(span).toBe(mockSpan);
    });

    it('should create child span with parent relationship', () => {
      const requestId = 'test-request-123';

      // Create root first
      manager.createRootSpan(requestId, 'test.root');

      // Create child
      const childSpan = manager.createChildSpan(
        requestId,
        'test.child',
        SpanKind.INTERNAL,
        'PROCESS'
      );

      // Both spans should be the same mock span
      expect(childSpan).toBe(mockSpan);
    });

    it('should end spans and cleanup request', () => {
      const requestId = 'test-request-123';

      manager.createRootSpan(requestId, 'test.root');
      manager.endCurrentSpan(requestId, SpanStatusCode.OK);

      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
      expect(mockSpan.end).toHaveBeenCalled();

      // Cleanup should not throw
      manager.cleanupRequest(requestId);
    });
  });

  describe('OpenInferenceAdapter', () => {
    let adapter: OpenInferenceAdapter;

    beforeEach(() => {
      adapter = new OpenInferenceAdapter();
    });

    it('should apply basic conventions to span', () => {
      const config = {
        spanKind: 'REQUEST' as const,
        operation: 'test-operation',
      };

      adapter.applyConventions(mockSpan as any, config);

      expect(mockSpan.setAttribute).toHaveBeenCalledWith('openinference.span.kind', 'REQUEST');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('service.name', 'mcp-server');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        'service.version',
        process.env.npm_package_version || '1.0.0'
      );
    });

    it('should apply LLM attributes when model is provided', () => {
      const config = {
        spanKind: 'PROCESS' as const,
        model: 'claude-3-sonnet',
      };

      adapter.applyConventions(mockSpan as any, config);

      expect(mockSpan.setAttribute).toHaveBeenCalledWith('llm.vendor', 'anthropic');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('llm.model', 'claude-3-sonnet');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('llm.model_version', '20240229');
    });

    it('should calculate token counts and costs', () => {
      const prompts: LLMPrompt[] = [{ role: 'user', content: 'Hello', tokens: 2 }];
      const completions: LLMCompletion[] = [
        { role: 'assistant', content: 'Hi there!', tokens: 3, finish_reason: 'complete' },
      ];

      const config = {
        spanKind: 'PROCESS' as const,
        model: 'claude-3-sonnet',
        prompts,
        completions,
      };

      adapter.applyConventions(mockSpan as any, config);

      expect(mockSpan.setAttribute).toHaveBeenCalledWith('llm.token_count.prompt', 2);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('llm.token_count.completion', 3);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('llm.token_count.total', 5);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('llm.cost.total', expect.any(Number));
    });
  });

  describe('EventManager', () => {
    let eventManager: EventManager;

    beforeEach(() => {
      eventManager = new EventManager();
    });

    it('should record basic event to span', () => {
      const event = {
        name: EventType.COGNITIVE_PROCESS,
        attributes: { test: 'value' },
        timestamp: Date.now(),
      };

      eventManager.recordEvent(mockSpan as any, event);

      expect(mockSpan.addEvent).toHaveBeenCalledWith(event.name, event.attributes, event.timestamp);
    });

    it('should record cognitive event with proper attributes', () => {
      const data = {
        phase: 'start' as const,
        thoughtNumber: 1,
        duration: 100,
        success: true,
        insights: ['test insight'],
      };

      eventManager.recordCognitiveEvent(mockSpan as any, data);

      expect(mockSpan.addEvent).toHaveBeenCalledWith(
        EventType.COGNITIVE_PROCESS,
        expect.objectContaining({
          phase: 'start',
          thought_number: 1,
          duration_ms: 100,
          success: true,
          insights: 'test insight',
        }),
        expect.any(Number)
      );
    });

    it('should record tool execution event', () => {
      const data = {
        toolName: 'test-tool',
        startTime: 1000,
        endTime: 1100,
        success: true,
      };

      eventManager.recordToolEvent(mockSpan as any, data);

      expect(mockSpan.addEvent).toHaveBeenCalledWith(
        EventType.TOOL_EXECUTION,
        expect.objectContaining({
          tool_name: 'test-tool',
          start_time: 1000,
          end_time: 1100,
          duration_ms: 100,
          success: true,
          error: undefined,
          retry_count: 0,
        }),
        expect.any(Number)
      );
    });

    it('should record memory operation event', () => {
      const data = {
        operation: 'read' as const,
        patternCount: 5,
        duration: 50,
        success: true,
        bytesProcessed: 1024,
      };

      eventManager.recordMemoryEvent(mockSpan as any, data);

      expect(mockSpan.addEvent).toHaveBeenCalledWith(
        EventType.MEMORY_OPERATION,
        expect.objectContaining({
          operation: 'read',
          pattern_count: 5,
          duration_ms: 50,
          success: true,
          bytes_processed: 1024,
        }),
        expect.any(Number)
      );
    });

    it('should record error event', () => {
      const error = new Error('Test error');

      eventManager.recordErrorEvent(mockSpan as any, error, 'error');

      expect(mockSpan.addEvent).toHaveBeenCalledWith(
        EventType.ERROR,
        expect.objectContaining({
          error_type: 'Error',
          error_message: 'Test error',
          severity: 'error',
        }),
        expect.any(Number)
      );
    });

    it('should register and trigger event handlers', () => {
      const handler = jest.fn();
      eventManager.onEvent(EventType.COGNITIVE_PROCESS, handler);

      const event = {
        name: EventType.COGNITIVE_PROCESS,
        attributes: { test: 'value' },
      };

      eventManager.recordEvent(mockSpan as any, event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should flush events for a span', () => {
      const spanId = 'test-span-id';
      const event = {
        name: EventType.COGNITIVE_PROCESS,
        attributes: { test: 'value' },
      };

      // Mock spanContext to return our test span ID
      mockSpan.spanContext.mockReturnValue({ spanId, traceId: 'test-trace-id' });

      eventManager.recordEvent(mockSpan as any, event);
      const flushedEvents = eventManager.flushEvents(spanId);

      expect(flushedEvents).toHaveLength(1);
      expect(flushedEvents[0]).toEqual(event);

      // Second flush should return empty array
      const secondFlush = eventManager.flushEvents(spanId);
      expect(secondFlush).toHaveLength(0);
    });
  });
});
