import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { PhoenixTelemetryService } from '../src/telemetry/phoenix-client.js';
import { TelemetryConfig } from '../src/telemetry/telemetry-config.js';
import { MCPInstrumentation } from '../src/telemetry/mcp-instrumentation.js';
import { CognitiveInstrumentation } from '../src/telemetry/cognitive-instrumentation.js';
import { DatabaseInstrumentation } from '../src/telemetry/db-instrumentation.js';
import { EventEmitter } from 'events';

describe('Phoenix Telemetry Integration', () => {
  let phoenixService: PhoenixTelemetryService;
  let telemetryConfig: TelemetryConfig;

  beforeAll(() => {
    process.env.TELEMETRY_ENABLED = 'true';
    process.env.PHOENIX_ENDPOINT = 'http://localhost:6006';
    process.env.TELEMETRY_SAMPLING_RATE = '1.0';
    
    telemetryConfig = TelemetryConfig.getInstance();
    phoenixService = PhoenixTelemetryService.getInstance();
  });

  afterAll(async () => {
    await phoenixService.shutdown();
  });

  describe('PhoenixTelemetryService', () => {
    test('should initialize without errors', async () => {
      await expect(phoenixService.initialize()).resolves.not.toThrow();
    });

    test('should report initialized status correctly', () => {
      expect(phoenixService.isInitialized()).toBe(true);
    });

    test('should record metrics', () => {
      expect(() => {
        phoenixService.recordMetric('test_metric', 42, { label: 'test' });
      }).not.toThrow();
    });

    test('should record events', () => {
      expect(() => {
        phoenixService.recordEvent('test_event', { data: 'test' });
      }).not.toThrow();
    });
  });

  describe('TelemetryConfig', () => {
    test('should load configuration from environment', () => {
      const config = telemetryConfig.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.endpoint).toBe('http://localhost:6006');
      expect(config.samplingRate).toBe(1.0);
      expect(config.serviceName).toBe('sentient-agi-mcp-server');
    });

    test('should validate sampling rate bounds', () => {
      expect(telemetryConfig.getSamplingRate()).toBeGreaterThanOrEqual(0);
      expect(telemetryConfig.getSamplingRate()).toBeLessThanOrEqual(1);
    });

    test('should generate correct endpoint URL', () => {
      expect(telemetryConfig.getEndpoint()).toBe('http://localhost:6006/v1/traces');
    });

    test('should handle sampling decisions', () => {
      const samples: boolean[] = [];
      for (let i = 0; i < 100; i++) {
        samples.push(telemetryConfig.shouldSample());
      }
      const sampleRate = samples.filter(s => s).length / samples.length;
      expect(sampleRate).toBeGreaterThan(0.9);
    });
  });

  describe('MCPInstrumentation', () => {
    test('should preserve handler functionality', async () => {
      const mcpInstrumentation = MCPInstrumentation.getInstance();
      const mockHandler = jest.fn().mockResolvedValue({ success: true });
      
      const instrumented = mcpInstrumentation.instrumentMCPHandler(
        mockHandler,
        'test-tool'
      );
      
      const result = await instrumented('test-arg');
      expect(result).toEqual({ success: true });
      expect(mockHandler).toHaveBeenCalledWith('test-arg');
    });

    test('should handle handler errors properly', async () => {
      const mcpInstrumentation = MCPInstrumentation.getInstance();
      const error = new Error('Test error');
      const mockHandler = jest.fn().mockRejectedValue(error);
      
      const instrumented = mcpInstrumentation.instrumentMCPHandler(
        mockHandler,
        'error-tool'
      );
      
      await expect(instrumented('test-arg')).rejects.toThrow('Test error');
    });

    test('should extract cognitive metrics from results', async () => {
      const mcpInstrumentation = MCPInstrumentation.getInstance();
      const mockHandler = jest.fn().mockResolvedValue({
        success: true,
        metacognitive_awareness: 0.8,
        creative_pressure: 0.6,
        breakthrough_likelihood: 0.4,
        insight_potential: 0.7,
        cognitive_flexibility: 0.5,
      });
      
      const instrumented = mcpInstrumentation.instrumentMCPHandler(
        mockHandler,
        'cognitive-tool'
      );
      
      const result = await instrumented({ thought_number: 1, total_thoughts: 5 });
      expect(result.metacognitive_awareness).toBe(0.8);
    });
  });

  describe('CognitiveInstrumentation', () => {
    test('should attach to orchestrator EventEmitter', () => {
      const cognitiveInstrumentation = CognitiveInstrumentation.getInstance();
      const mockOrchestrator = new EventEmitter();
      
      expect(() => {
        cognitiveInstrumentation.attachToOrchestrator(mockOrchestrator);
      }).not.toThrow();
      
      cognitiveInstrumentation.detachFromOrchestrator();
    });

    test('should handle plugin activation events', (done) => {
      const cognitiveInstrumentation = CognitiveInstrumentation.getInstance();
      const mockOrchestrator = new EventEmitter();
      
      cognitiveInstrumentation.attachToOrchestrator(mockOrchestrator);
      
      mockOrchestrator.emit('plugin:activated', {
        pluginName: 'test-plugin',
        persona: 'Engineer',
        confidence: 0.9,
      });
      
      setTimeout(() => {
        cognitiveInstrumentation.detachFromOrchestrator();
        done();
      }, 10);
    });

    test('should handle breakthrough detection events', (done) => {
      const cognitiveInstrumentation = CognitiveInstrumentation.getInstance();
      const mockOrchestrator = new EventEmitter();
      
      cognitiveInstrumentation.attachToOrchestrator(mockOrchestrator);
      
      mockOrchestrator.emit('breakthrough:detected', {
        type: 'insight',
        insightPotential: 0.95,
        confidence: 0.8,
        description: 'Test breakthrough',
      });
      
      setTimeout(() => {
        cognitiveInstrumentation.detachFromOrchestrator();
        done();
      }, 10);
    });

    test('should record cognitive metrics', () => {
      const cognitiveInstrumentation = CognitiveInstrumentation.getInstance();
      
      expect(() => {
        cognitiveInstrumentation.recordCognitiveMetrics({
          metacognitiveAwareness: 0.7,
          creativePressure: 0.5,
          breakthroughLikelihood: 0.3,
          insightPotential: 0.6,
          cognitiveFlexibility: 0.8,
        });
      }).not.toThrow();
    });
  });

  describe('DatabaseInstrumentation', () => {
    test('should instrument database queries', async () => {
      const dbInstrumentation = DatabaseInstrumentation.getInstance();
      const mockQuery = jest.fn().mockResolvedValue({
        rows: [{ id: 1, name: 'test' }],
        rowCount: 1,
      });
      
      const result = await dbInstrumentation.instrumentQuery(
        mockQuery,
        'select',
        'SELECT * FROM test'
      );
      
      expect(result.rows).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalled();
    });

    test('should handle query errors', async () => {
      const dbInstrumentation = DatabaseInstrumentation.getInstance();
      const error = new Error('Database error');
      const mockQuery = jest.fn().mockRejectedValue(error);
      
      await expect(
        dbInstrumentation.instrumentQuery(mockQuery, 'select', 'SELECT * FROM test')
      ).rejects.toThrow('Database error');
    });

    test('should sanitize SQL statements', async () => {
      const dbInstrumentation = DatabaseInstrumentation.getInstance();
      const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
      
      const longStatement = 'SELECT ' + 'x'.repeat(2000) + ' FROM test';
      await dbInstrumentation.instrumentQuery(mockQuery, 'select', longStatement);
      
      expect(mockQuery).toHaveBeenCalled();
    });
  });

  describe('Performance Tests', () => {
    test('telemetry overhead should be under 5ms', async () => {
      const mcpInstrumentation = MCPInstrumentation.getInstance();
      const handler = async () => ({ data: 'test' });
      const instrumented = mcpInstrumentation.instrumentMCPHandler(handler, 'perf-test');
      
      const iterations = 10;
      const durations: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await instrumented();
        const duration = performance.now() - start;
        durations.push(duration);
      }
      
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      expect(avgDuration).toBeLessThan(5);
    });

    test('should handle concurrent spans efficiently', async () => {
      const mcpInstrumentation = MCPInstrumentation.getInstance();
      const handler = async (delay: number) => {
        await new Promise(resolve => setTimeout(resolve, delay));
        return { success: true };
      };
      
      const instrumented = mcpInstrumentation.instrumentMCPHandler(handler, 'concurrent-test');
      
      const promises = [
        instrumented(10),
        instrumented(20),
        instrumented(15),
        instrumented(5),
        instrumented(25),
      ];
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    test('should integrate with disabled telemetry gracefully', async () => {
      const originalEnabled = process.env.TELEMETRY_ENABLED;
      process.env.TELEMETRY_ENABLED = 'false';
      
      const config = TelemetryConfig.getInstance();
      config.updateConfig({ enabled: false });
      
      const mcpInstrumentation = MCPInstrumentation.getInstance();
      const handler = jest.fn().mockResolvedValue({ success: true });
      const instrumented = mcpInstrumentation.instrumentMCPHandler(handler, 'disabled-test');
      
      const result = await instrumented();
      expect(result.success).toBe(true);
      expect(handler).toHaveBeenCalled();
      
      process.env.TELEMETRY_ENABLED = originalEnabled;
      config.updateConfig({ enabled: true });
    });

    test('should handle missing Phoenix endpoint gracefully', async () => {
      const config = TelemetryConfig.getInstance();
      const originalEndpoint = config.getEndpoint();
      
      config.updateConfig({ endpoint: 'http://invalid-endpoint:9999' });
      
      const phoenixService = PhoenixTelemetryService.getInstance();
      await phoenixService.shutdown();
      
      await expect(phoenixService.initialize()).resolves.not.toThrow();
      
      config.updateConfig({ endpoint: originalEndpoint });
    });
  });
});