import { SpanHierarchyManager } from '../../src/telemetry/span-hierarchy-manager.js';
import { OpenInferenceAdapter } from '../../src/telemetry/openinference-adapter.js';
import { EventManager, EventType } from '../../src/telemetry/event-manager.js';
import { StatusMapper, MCPStatusCode } from '../../src/telemetry/status-mapper.js';
import { trace, SpanKind } from '@opentelemetry/api';

describe('Telemetry Component Performance Tests', () => {
  let spanHierarchyManager: SpanHierarchyManager;
  let openInferenceAdapter: OpenInferenceAdapter;
  let eventManager: EventManager;
  let statusMapper: StatusMapper;

  beforeEach(() => {
    spanHierarchyManager = new SpanHierarchyManager();
    openInferenceAdapter = new OpenInferenceAdapter();
    eventManager = new EventManager();
    statusMapper = new StatusMapper();
  });

  describe('SpanHierarchyManager Performance', () => {
    it('should handle high-volume span creation efficiently', async () => {
      const startTime = process.hrtime();
      const startMemory = process.memoryUsage().heapUsed;

      // Create 1000 spans with parent-child relationships
      const requestId = 'perf-test-1';
      const root = spanHierarchyManager.createRootSpan(requestId, 'root');

      for (let i = 0; i < 1000; i++) {
        const child = spanHierarchyManager.createChildSpan(
          requestId,
          `child-${i}`,
          SpanKind.INTERNAL,
          'PROCESS'
        );
        spanHierarchyManager.endCurrentSpan(requestId);
      }

      spanHierarchyManager.endCurrentSpan(requestId);
      spanHierarchyManager.cleanupRequest(requestId);

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1_000_000;
      const memoryUsed = (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024;

      // Validate performance targets
      expect(duration).toBeLessThan(1000); // Less than 1 second
      expect(memoryUsed).toBeLessThan(50); // Less than 50MB
    });
  });

  describe('OpenInferenceAdapter Performance', () => {
    it('should efficiently handle token counting and attribute caching', () => {
      const startTime = process.hrtime();
      const startMemory = process.memoryUsage().heapUsed;

      // Create test data
      const longText = 'a'.repeat(100000); // 100KB text
      const span = trace.getTracer('test').startSpan('test');

      // Perform repeated operations
      for (let i = 0; i < 1000; i++) {
        openInferenceAdapter.applyConventions(span, {
          spanKind: 'PROCESS',
          model: 'claude-3-sonnet',
          prompts: [{ role: 'user', content: longText, tokens: 0 }],
          completions: [{ role: 'assistant', content: longText, tokens: 0, finish_reason: 'stop' }],
        });
      }

      span.end();

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1_000_000;
      const memoryUsed = (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024;

      // Validate performance targets
      expect(duration).toBeLessThan(2000); // Less than 2 seconds
      expect(memoryUsed).toBeLessThan(100); // Less than 100MB
    });
  });

  describe('EventManager Performance', () => {
    it('should efficiently handle high-volume event batching and compression', async () => {
      const startTime = process.hrtime();
      const startMemory = process.memoryUsage().heapUsed;

      const span = trace.getTracer('test').startSpan('test');

      // Generate 10000 events
      for (let i = 0; i < 10000; i++) {
        eventManager.recordEvent(span, {
          name: EventType.COGNITIVE_PROCESS,
          attributes: {
            phase: 'process',
            thought_number: i,
            duration_ms: 100,
            success: true,
          },
        });
      }
      eventManager.flushEvents(span.spanContext().spanId);
      span.end();

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1_000_000;
      const memoryUsed = (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024;

      // Validate performance targets
      expect(duration).toBeLessThan(5000); // Less than 5 seconds
      expect(memoryUsed).toBeLessThan(200); // Less than 200MB
    });
  });

  describe('StatusMapper Performance', () => {
    it('should efficiently handle repeated status mapping operations', () => {
      const startTime = process.hrtime();
      const startMemory = process.memoryUsage().heapUsed;

      // Perform 1M status mappings
      for (let i = 0; i < 1_000_000; i++) {
        statusMapper.mapCognitiveStatus({
          success: true,
          partial: i % 2 === 0,
          timeout: i % 3 === 0,
          error: i % 4 === 0 ? new Error('test') : undefined,
        });

        statusMapper.mapToolStatus({
          success: true,
          notFound: i % 2 === 0,
          invalidInput: i % 3 === 0,
          error: i % 4 === 0 ? new Error('test') : undefined,
        });

        statusMapper.mapMemoryStatus({
          success: true,
          notFound: i % 2 === 0,
          conflict: i % 3 === 0,
          error: i % 4 === 0 ? new Error('test') : undefined,
        });

        statusMapper.mapToOTelStatus(MCPStatusCode.OK);
        statusMapper.getStatusMessage(MCPStatusCode.ERROR);
      }

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1_000_000;
      const memoryUsed = (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024;

      // Validate performance targets
      expect(duration).toBeLessThan(1000); // Less than 1 second
      expect(memoryUsed).toBeLessThan(10); // Less than 10MB
    });
  });

  describe('Integration Performance', () => {
    it('should maintain performance under concurrent load', async () => {
      const startTime = process.hrtime();
      const startMemory = process.memoryUsage().heapUsed;

      // Simulate 100 concurrent requests
      const requests = Array.from({ length: 100 }, async (_, i) => {
        const requestId = `concurrent-${i}`;
        const root = spanHierarchyManager.createRootSpan(requestId, 'root');

        openInferenceAdapter.applyConventions(root, {
          spanKind: 'REQUEST',
          model: 'claude-3-sonnet',
          prompts: [{ role: 'user', content: 'test', tokens: 0 }],
        });

        // Create child spans
        for (let j = 0; j < 10; j++) {
          const child = spanHierarchyManager.createChildSpan(
            requestId,
            `child-${j}`,
            SpanKind.INTERNAL,
            'PROCESS'
          );

          // Record events
          eventManager.recordCognitiveEvent(child, {
            phase: 'process',
            thoughtNumber: j,
            duration: 100,
            success: true,
          });

          spanHierarchyManager.endCurrentSpan(requestId);
        }

        // End root span
        spanHierarchyManager.endCurrentSpan(requestId);
        spanHierarchyManager.cleanupRequest(requestId);
      });

      await Promise.all(requests);

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1_000_000;
      const memoryUsed = (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024;

      // Validate performance targets
      expect(duration).toBeLessThan(10000); // Less than 10 seconds
      expect(memoryUsed).toBeLessThan(500); // Less than 500MB
    });
  });
});
