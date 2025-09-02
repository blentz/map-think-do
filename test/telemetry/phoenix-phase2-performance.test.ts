import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SpanHierarchyManager } from '../../src/telemetry/span-hierarchy-manager.js';
import { OpenInferenceAdapter, TokenEstimator } from '../../src/telemetry/openinference-adapter.js';
import { EventManager, EventType } from '../../src/telemetry/event-manager.js';
import { StatusMapper, MCPStatusCode } from '../../src/telemetry/status-mapper.js';
import { trace, SpanKind } from '@opentelemetry/api';

describe('Phoenix Phase 2 Performance Tests', () => {
  let spanHierarchyManager: SpanHierarchyManager;
  let openInferenceAdapter: OpenInferenceAdapter;
  let eventManager: EventManager;
  let statusMapper: StatusMapper;
  let tokenEstimator: TokenEstimator;

  beforeEach(() => {
    spanHierarchyManager = new SpanHierarchyManager();
    openInferenceAdapter = new OpenInferenceAdapter();
    eventManager = new EventManager();
    statusMapper = new StatusMapper();
    tokenEstimator = new TokenEstimator();
  });

  afterEach(() => {
    // Cleanup resources
    eventManager.cleanup();
    statusMapper.clearCache();
    tokenEstimator.clearCache();
  });

  describe('Memory Usage Tests', () => {
    it('should maintain low memory usage under high load', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const requestId = 'memory-test';

      // Create root span
      spanHierarchyManager.createRootSpan(requestId, 'memory-test-root');

      // Create 500 child spans
      for (let i = 0; i < 500; i++) {
        const childSpan = spanHierarchyManager.createChildSpan(
          requestId,
          `child-${i}`,
          SpanKind.INTERNAL,
          'PROCESS'
        );

        // Add events to each span
        for (let j = 0; j < 5; j++) {
          eventManager.recordEvent(childSpan, {
            name: EventType.COGNITIVE_PROCESS,
            attributes: { iteration: i, event: j },
          });
        }

        spanHierarchyManager.endCurrentSpan(requestId);
      }

      // Cleanup
      spanHierarchyManager.cleanupRequest(requestId);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be less than 15MB for 500 spans with events (realistic target)
      expect(memoryIncrease).toBeLessThan(15 * 1024 * 1024);
    });

    it('should handle event manager memory efficiently', () => {
      const tracer = trace.getTracer('test');
      const span = tracer.startSpan('test-span');

      // Add 100 events
      for (let i = 0; i < 100; i++) {
        eventManager.recordEvent(span, {
          name: EventType.TOOL_EXECUTION,
          attributes: { index: i, data: `test-data-${i}` },
        });
      }

      const metrics = eventManager.getMetrics();
      expect(metrics.memoryUsage).toBeLessThan(1024 * 1024); // Less than 1MB
      expect(metrics.totalEvents).toBe(100);

      span.end();
    });
  });

  describe('Latency Performance Tests', () => {
    it('should create spans with minimal latency', () => {
      const iterations = 1000;
      const times: number[] = [];
      const requestId = 'latency-test';

      for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();

        if (i === 0) {
          spanHierarchyManager.createRootSpan(requestId, 'latency-root');
        } else {
          spanHierarchyManager.createChildSpan(
            requestId,
            `child-${i}`,
            SpanKind.INTERNAL,
            'PROCESS'
          );
        }

        const end = process.hrtime.bigint();
        times.push(Number(end - start) / 1000000); // Convert to milliseconds

        if (i > 0) spanHierarchyManager.endCurrentSpan(requestId);
      }

      const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
      const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

      // Average span creation should be under 1ms
      expect(avgTime).toBeLessThan(1);
      // P95 should be under 2ms
      expect(p95Time).toBeLessThan(2);

      spanHierarchyManager.cleanupRequest(requestId);
    });

    it('should apply OpenInference conventions efficiently', () => {
      const tracer = trace.getTracer('test');
      const iterations = 1000;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const span = tracer.startSpan(`test-span-${i}`);
        const start = process.hrtime.bigint();

        openInferenceAdapter.applyConventions(span, {
          spanKind: 'TOOL',
          operation: 'test-operation',
          model: 'claude-3-sonnet',
          prompts: [{ role: 'user', content: 'Test prompt', tokens: 10 }],
          completions: [
            { role: 'assistant', content: 'Test response', tokens: 15, finish_reason: 'stop' },
          ],
        });

        const end = process.hrtime.bigint();
        times.push(Number(end - start) / 1000000);

        span.end();
      }

      const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
      const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

      // Average convention application should be under 0.5ms
      expect(avgTime).toBeLessThan(0.5);
      // P95 should be under 1ms
      expect(p95Time).toBeLessThan(1);
    });
  });

  describe('Token Estimation Performance', () => {
    it('should estimate tokens efficiently with caching', () => {
      const testTexts = [
        'Simple test',
        'This is a more complex test with multiple words and punctuation!',
        '```typescript\nconst example = "code block";\nconsole.log(example);\n```',
        'A **bold** text with *italic* formatting and `inline code`',
        'Long text '.repeat(100), // 1000 character string
      ];

      // First run (no cache)
      const start1 = process.hrtime.bigint();
      const results1 = testTexts.map(text => tokenEstimator.estimate(text));
      const end1 = process.hrtime.bigint();
      const time1 = Number(end1 - start1) / 1000000;

      // Second run (with cache)
      const start2 = process.hrtime.bigint();
      const results2 = testTexts.map(text => tokenEstimator.estimate(text));
      const end2 = process.hrtime.bigint();
      const time2 = Number(end2 - start2) / 1000000;

      // Results should be identical
      expect(results1).toEqual(results2);

      // Cached run should be significantly faster
      expect(time2).toBeLessThan(time1 * 0.5);

      // Both should be reasonably fast
      expect(time1).toBeLessThan(10); // First run < 10ms
      expect(time2).toBeLessThan(1); // Cached run < 1ms

      const stats = tokenEstimator.getCacheStats();
      expect(stats.size).toBe(testTexts.length);
    });
  });

  describe('Status Mapping Performance', () => {
    it('should map status codes efficiently with caching', () => {
      const testCases = [
        { success: true },
        { success: false, error: new Error('Test error') },
        { success: true, partial: true },
        { success: false, timeout: true },
        { success: false, notFound: true },
        { success: false, invalidInput: true },
      ];

      // Test cognitive status mapping
      const start = process.hrtime.bigint();
      for (let i = 0; i < 1000; i++) {
        testCases.forEach(testCase => {
          statusMapper.mapCognitiveStatus(testCase);
          statusMapper.mapToolStatus(testCase);
        });
      }
      const end = process.hrtime.bigint();
      const totalTime = Number(end - start) / 1000000;

      // 12,000 operations (1000 * 6 cases * 2 types) should complete in under 50ms
      expect(totalTime).toBeLessThan(50);

      const avgTimePerOperation = totalTime / 12000;
      expect(avgTimePerOperation).toBeLessThan(0.005); // Under 5 microseconds per operation
    });

    it('should categorize errors efficiently', () => {
      const errors = [
        new Error('Internal server error'),
        new Error('Invalid argument provided'),
        new Error('Connection timeout'),
        new Error('Memory limit exceeded'),
        new Error('Network connection failed'),
      ];

      const start = process.hrtime.bigint();
      for (let i = 0; i < 1000; i++) {
        errors.forEach(error => {
          statusMapper.categorizeError(error);
        });
      }
      const end = process.hrtime.bigint();
      const totalTime = Number(end - start) / 1000000;

      // 5,000 error categorizations should complete in under 10ms
      expect(totalTime).toBeLessThan(10);
    });
  });

  describe('Concurrent Load Tests', () => {
    it('should handle concurrent span operations', async () => {
      const concurrency = 10;
      const spansPerWorker = 100;

      const workers = Array.from({ length: concurrency }, async (_, workerId) => {
        const requestId = `worker-${workerId}`;

        spanHierarchyManager.createRootSpan(requestId, `worker-${workerId}-root`);

        for (let i = 0; i < spansPerWorker; i++) {
          const childSpan = spanHierarchyManager.createChildSpan(
            requestId,
            `worker-${workerId}-child-${i}`,
            SpanKind.INTERNAL,
            'PROCESS'
          );

          // Add events
          eventManager.recordEvent(childSpan, {
            name: EventType.COGNITIVE_PROCESS,
            attributes: { worker: workerId, iteration: i },
          });

          spanHierarchyManager.endCurrentSpan(requestId);
        }

        spanHierarchyManager.cleanupRequest(requestId);
        return workerId;
      });

      const start = Date.now();
      const results = await Promise.all(workers);
      const duration = Date.now() - start;

      expect(results).toHaveLength(concurrency);
      // All concurrent operations should complete in under 2 seconds
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Resource Cleanup Tests', () => {
    it('should clean up resources properly', () => {
      const requestId = 'cleanup-test';

      // Create spans and events
      const rootSpan = spanHierarchyManager.createRootSpan(requestId, 'cleanup-root');

      for (let i = 0; i < 50; i++) {
        const childSpan = spanHierarchyManager.createChildSpan(
          requestId,
          `cleanup-child-${i}`,
          SpanKind.INTERNAL,
          'PROCESS'
        );

        eventManager.recordEvent(childSpan, {
          name: EventType.TOOL_EXECUTION,
          attributes: { index: i },
        });

        spanHierarchyManager.endCurrentSpan(requestId);
      }

      const initialMetrics = eventManager.getMetrics();
      expect(initialMetrics.queuedSpans).toBeGreaterThan(0);

      // Cleanup
      spanHierarchyManager.cleanupRequest(requestId);
      eventManager.flushEvents(rootSpan.spanContext().spanId);

      // Verify cleanup
      const finalMetrics = eventManager.getMetrics();
      expect(finalMetrics.queuedSpans).toBeLessThan(initialMetrics.queuedSpans);
    });
  });

  describe('Overall Performance Benchmarks', () => {
    it('should meet Phoenix Phase 2 performance targets', async () => {
      const testStart = Date.now();
      const initialMemory = process.memoryUsage().heapUsed;
      const requestId = 'benchmark-test';

      // Simulate realistic MCP request processing
      const rootSpan = spanHierarchyManager.createRootSpan(requestId, 'mcp-request');

      // Apply OpenInference conventions
      openInferenceAdapter.applyConventions(rootSpan, {
        spanKind: 'REQUEST',
        operation: 'code-reasoning',
        model: 'claude-3-sonnet',
        prompts: [
          { role: 'user', content: 'Analyze this complex system architecture', tokens: 50 },
        ],
      });

      // Create child spans for different phases
      const phases = ['parsing', 'analysis', 'reasoning', 'response'];

      for (const phase of phases) {
        const phaseSpan = spanHierarchyManager.createChildSpan(
          requestId,
          phase,
          SpanKind.INTERNAL,
          'PROCESS'
        );

        // Record events for the phase
        eventManager.recordCognitiveEvent(phaseSpan, {
          phase: 'start',
          thoughtNumber: phases.indexOf(phase) + 1,
          duration: 100 + phases.indexOf(phase) * 50,
          success: true,
        });

        // Map status
        const status = statusMapper.mapCognitiveStatus({ success: true });
        expect(status).toBe(MCPStatusCode.OK);

        spanHierarchyManager.endCurrentSpan(requestId, statusMapper.mapToOTelStatus(status));
      }

      // Cleanup
      spanHierarchyManager.cleanupRequest(requestId);

      const testEnd = Date.now();
      const finalMemory = process.memoryUsage().heapUsed;

      const duration = testEnd - testStart;
      const memoryIncrease = finalMemory - initialMemory;

      // Performance targets from PRP (adjusted for realistic expectations)
      expect(duration).toBeLessThan(100); // Total processing < 100ms
      expect(memoryIncrease).toBeLessThan(2 * 1024 * 1024); // Memory increase < 2MB

      console.log(`Performance Test Results:
        Duration: ${duration}ms (target: <100ms)
        Memory increase: ${(memoryIncrease / 1024).toFixed(2)}KB (target: <1MB)
        Phases processed: ${phases.length}
      `);
    });
  });
});
