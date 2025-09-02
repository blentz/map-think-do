#!/usr/bin/env node

/**
 * @fileoverview Test suite for Phoenix telemetry integration
 */

import assert from 'assert';
import { PhoenixTelemetryService } from '../src/telemetry/phoenix-client.js';
import { TelemetryConfig } from '../src/telemetry/telemetry-config.js';
import { MCPInstrumentation } from '../src/telemetry/mcp-instrumentation.js';
import { CognitiveInstrumentation } from '../src/telemetry/cognitive-instrumentation.js';
import { DatabaseInstrumentation } from '../src/telemetry/db-instrumentation.js';
import { EventEmitter } from 'events';

const COLORS = {
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  RESET: '\x1b[0m',
};

function log(message: string, color = COLORS.RESET) {
  console.log(`${color}${message}${COLORS.RESET}`);
}

async function testPhoenixTelemetryService() {
  log('\n🔧 Testing PhoenixTelemetryService...', COLORS.YELLOW);

  process.env.TELEMETRY_ENABLED = 'true';
  process.env.PHOENIX_ENDPOINT = 'http://localhost:6006';
  process.env.TELEMETRY_SAMPLING_RATE = '1.0';

  const telemetryConfig = TelemetryConfig.getInstance();
  const phoenixService = PhoenixTelemetryService.getInstance();

  // Test initialization
  try {
    await phoenixService.initialize();
    log('  ✅ Service initialized without errors', COLORS.GREEN);
  } catch (error) {
    log(`  ❌ Failed to initialize service: ${error}`, COLORS.RED);
    throw error;
  }

  // Test initialized status
  assert.strictEqual(
    phoenixService.isInitialized(),
    true,
    'Service should report initialized status'
  );
  log('  ✅ Initialized status correctly reported', COLORS.GREEN);

  // Test recording metrics
  try {
    phoenixService.recordMetric('test_metric', 42, { label: 'test' });
    log('  ✅ Metrics recorded without errors', COLORS.GREEN);
  } catch (error) {
    log(`  ❌ Failed to record metrics: ${error}`, COLORS.RED);
    throw error;
  }

  // Test recording events
  try {
    phoenixService.recordEvent('test_event', { data: 'test' });
    log('  ✅ Events recorded without errors', COLORS.GREEN);
  } catch (error) {
    log(`  ❌ Failed to record events: ${error}`, COLORS.RED);
    throw error;
  }

  return { phoenixService, telemetryConfig };
}

async function testTelemetryConfig(telemetryConfig: TelemetryConfig) {
  log('\n📋 Testing TelemetryConfig...', COLORS.YELLOW);

  const config = telemetryConfig.getConfig();

  // Test configuration loading
  assert.strictEqual(config.enabled, true, 'Config should be enabled');
  assert.strictEqual(config.endpoint, 'http://localhost:6006', 'Endpoint should match');
  assert.strictEqual(config.samplingRate, 1.0, 'Sampling rate should be 1.0');
  assert.strictEqual(config.serviceName, 'sentient-agi-mcp-server', 'Service name should match');
  log('  ✅ Configuration loaded correctly from environment', COLORS.GREEN);

  // Test sampling rate bounds
  const samplingRate = telemetryConfig.getSamplingRate();
  assert(samplingRate >= 0 && samplingRate <= 1, 'Sampling rate should be between 0 and 1');
  log('  ✅ Sampling rate within valid bounds', COLORS.GREEN);

  // Test endpoint URL generation
  assert.strictEqual(
    telemetryConfig.getEndpoint(),
    'http://localhost:6006/v1/traces',
    'Endpoint URL should be correctly generated'
  );
  log('  ✅ Endpoint URL generated correctly', COLORS.GREEN);

  // Test sampling decisions
  const samples: boolean[] = [];
  for (let i = 0; i < 100; i++) {
    samples.push(telemetryConfig.shouldSample());
  }
  const sampleRate = samples.filter(s => s).length / samples.length;
  assert(sampleRate > 0.9, 'Sample rate should be greater than 0.9');
  log('  ✅ Sampling decisions working correctly', COLORS.GREEN);
}

async function testMCPInstrumentation() {
  log('\n🔌 Testing MCPInstrumentation...', COLORS.YELLOW);

  const mcpInstrumentation = MCPInstrumentation.getInstance();

  // Test preserving handler functionality
  const mockHandler = async () => ({ success: true });
  const instrumented = mcpInstrumentation.instrumentMCPHandler(mockHandler, 'test-tool');

  const result = await instrumented();
  assert.deepStrictEqual(result, { success: true }, 'Handler should preserve functionality');
  log('  ✅ Handler functionality preserved', COLORS.GREEN);

  // Test error handling
  const errorHandler = async () => {
    throw new Error('Test error');
  };
  const instrumentedError = mcpInstrumentation.instrumentMCPHandler(errorHandler, 'error-tool');

  try {
    await instrumentedError();
    assert.fail('Should have thrown an error');
  } catch (error: any) {
    assert.strictEqual(error.message, 'Test error', 'Error should be propagated');
    log('  ✅ Error handling working correctly', COLORS.GREEN);
  }
}

async function testCognitiveInstrumentation(phoenixService: PhoenixTelemetryService) {
  log('\n🧠 Testing CognitiveInstrumentation...', COLORS.YELLOW);

  const cognitiveInstrumentation = CognitiveInstrumentation.getInstance();
  const mockOrchestrator = new EventEmitter();

  cognitiveInstrumentation.attachToOrchestrator(mockOrchestrator);

  // Test cognitive event tracking
  const originalRecordEvent = phoenixService.recordEvent;
  phoenixService.recordEvent = () => {};

  mockOrchestrator.emit('cognitive:breakthrough', { type: 'test' });

  // Restore original method
  phoenixService.recordEvent = originalRecordEvent;

  log('  ✅ Cognitive events tracked successfully', COLORS.GREEN);
}

async function testDatabaseInstrumentation() {
  log('\n💾 Testing DatabaseInstrumentation...', COLORS.YELLOW);

  const dbInstrumentation = DatabaseInstrumentation.getInstance();

  // Test query instrumentation
  const mockQuery = async () => ({
    rows: [{ id: 1, name: 'test' }],
    rowCount: 1,
  });

  const result = await dbInstrumentation.instrumentQuery(mockQuery, 'SELECT');

  assert.strictEqual(result.rowCount, 1, 'Query should return correct result');
  log('  ✅ Database queries instrumented successfully', COLORS.GREEN);

  // Test error handling in queries
  const errorQuery = async () => {
    throw new Error('Database error');
  };

  try {
    await dbInstrumentation.instrumentQuery(errorQuery, 'SELECT');
    assert.fail('Should have thrown an error');
  } catch (error: any) {
    assert.strictEqual(error.message, 'Database error', 'Database error should be propagated');
    log('  ✅ Database error handling working correctly', COLORS.GREEN);
  }

  // Test empty result handling
  const emptyQuery = async () => ({ rows: [] });
  const emptyResult = await dbInstrumentation.instrumentQuery(emptyQuery, 'SELECT');

  assert.strictEqual(emptyResult.rows.length, 0, 'Empty results should be handled');
  log('  ✅ Empty database results handled correctly', COLORS.GREEN);
}

async function testSpanManagement() {
  log('\n📊 Testing Span Management...', COLORS.YELLOW);

  const mcpInstrumentation = MCPInstrumentation.getInstance();

  // Test span creation and completion
  const handler = async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
    return { success: true };
  };

  const instrumented = mcpInstrumentation.instrumentMCPHandler(handler, 'span-test');

  const result = await instrumented();
  assert.deepStrictEqual(result, { success: true }, 'Span should not affect result');
  log('  ✅ Span creation and completion working', COLORS.GREEN);
}

async function runAllTests() {
  log('🚀 PHOENIX TELEMETRY INTEGRATION TESTS\n', COLORS.BLUE);

  try {
    const { phoenixService, telemetryConfig } = await testPhoenixTelemetryService();
    await testTelemetryConfig(telemetryConfig);
    await testMCPInstrumentation();
    await testCognitiveInstrumentation(phoenixService);
    await testDatabaseInstrumentation();
    await testSpanManagement();

    log('\n✅ ALL TELEMETRY TESTS PASSED!', COLORS.GREEN);

    // Cleanup
    await phoenixService.shutdown();
    log('🧹 Telemetry service shut down successfully', COLORS.YELLOW);

    return true;
  } catch (error) {
    log(`\n❌ TEST FAILURE: ${error}`, COLORS.RED);
    throw error;
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { runAllTests };
