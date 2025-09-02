/**
 * Phoenix Phase 2 Components Simple Test Suite
 *
 * Tests the core components implemented in Phase 2 without Jest dependencies
 */

import { SpanHierarchyManager } from '../../src/telemetry/span-hierarchy-manager.js';
import { OpenInferenceAdapter } from '../../src/telemetry/openinference-adapter.js';
import { EventManager } from '../../src/telemetry/event-manager.js';
import { StatusMapper, MCPStatusCode } from '../../src/telemetry/status-mapper.js';

// Mock OpenTelemetry for testing
const createMockSpan = () => ({
  spanContext: () => ({ spanId: 'test-span-id', traceId: 'test-trace-id' }),
  setAttribute: (key: string, value: any) => console.log(`  setAttribute: ${key} = ${value}`),
  addEvent: (name: string, attributes: any) => console.log(`  addEvent: ${name}`, attributes),
  setStatus: (status: any) => console.log(`  setStatus:`, status),
  end: () => console.log(`  span ended`),
  startTime: Date.now(),
  attributes: {},
});

const mockTracer = {
  startSpan: (name: string) => {
    console.log(`  startSpan: ${name}`);
    return createMockSpan();
  },
};

// Mock the trace module
const originalTrace = (global as any).trace;
(global as any).trace = {
  getTracer: () => mockTracer,
  setSpan: (ctx: any) => ctx,
};

// Mock context module
const originalContext = (global as any).context;
(global as any).context = {
  active: () => ({}),
};

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export async function runPhoenixPhase2Tests(): Promise<void> {
  console.log('🧪 Testing Phoenix Phase 2 Components...\n');

  const results: TestResult[] = [];

  // Test SpanHierarchyManager
  console.log('📊 Testing SpanHierarchyManager...');
  try {
    const manager = new SpanHierarchyManager();

    // Test root span creation
    const rootSpan = manager.createRootSpan('test-request-1', 'test.operation');
    if (!rootSpan) {
      throw new Error('Root span creation failed');
    }

    // Test cleanup
    manager.cleanupRequest('test-request-1');

    results.push({ name: 'SpanHierarchyManager basic operations', passed: true });
  } catch (error) {
    results.push({
      name: 'SpanHierarchyManager basic operations',
      passed: false,
      error: String(error),
    });
  }

  // Test OpenInferenceAdapter
  console.log('📊 Testing OpenInferenceAdapter...');
  try {
    const adapter = new OpenInferenceAdapter();
    const mockSpan = createMockSpan();

    // Test basic convention application
    adapter.applyConventions(mockSpan as any, {
      spanKind: 'REQUEST',
      model: 'claude-3-sonnet',
      prompts: [{ role: 'user', content: 'test prompt', tokens: 10 }],
      completions: [
        { role: 'assistant', content: 'test response', tokens: 15, finish_reason: 'stop' },
      ],
    });

    results.push({ name: 'OpenInferenceAdapter convention application', passed: true });
  } catch (error) {
    results.push({
      name: 'OpenInferenceAdapter convention application',
      passed: false,
      error: String(error),
    });
  }

  // Test StatusMapper
  console.log('📊 Testing StatusMapper...');
  try {
    const mapper = new StatusMapper();

    // Test status mapping
    const cognitiveStatus = mapper.mapCognitiveStatus({ success: true });
    if (cognitiveStatus !== MCPStatusCode.OK) {
      throw new Error(`Expected OK status, got ${cognitiveStatus}`);
    }

    const errorStatus = mapper.mapCognitiveStatus({ success: false, error: new Error('test') });
    if (errorStatus !== MCPStatusCode.ERROR) {
      throw new Error(`Expected ERROR status, got ${errorStatus}`);
    }

    results.push({ name: 'StatusMapper status mapping', passed: true });
  } catch (error) {
    results.push({ name: 'StatusMapper status mapping', passed: false, error: String(error) });
  }

  // Test EventManager
  console.log('📊 Testing EventManager...');
  try {
    const eventManager = new EventManager();
    const mockSpan = createMockSpan();

    // Test event recording
    eventManager.recordCognitiveEvent(mockSpan as any, {
      phase: 'start',
      thoughtNumber: 1,
      duration: 100,
      success: true,
    });

    eventManager.recordToolEvent(mockSpan as any, {
      toolName: 'test-tool',
      startTime: Date.now() - 100,
      endTime: Date.now(),
      success: true,
    });

    results.push({ name: 'EventManager event recording', passed: true });
  } catch (error) {
    results.push({ name: 'EventManager event recording', passed: false, error: String(error) });
  }

  // Print results
  console.log('\n📊 Phoenix Phase 2 Test Results:');
  console.log('============================================================');

  const passedTests = results.filter(r => r.passed);
  const failedTests = results.filter(r => !r.passed);

  passedTests.forEach(test => {
    console.log(`✅ ${test.name}`);
  });

  if (failedTests.length > 0) {
    failedTests.forEach(test => {
      console.log(`❌ ${test.name}: ${test.error}`);
    });
  }

  console.log('============================================================');
  console.log(
    `Total: ${results.length} | Passed: ${passedTests.length} | Failed: ${failedTests.length}`
  );

  if (failedTests.length === 0) {
    console.log('🎉 All Phoenix Phase 2 component tests passed!');
  } else {
    throw new Error(`${failedTests.length} tests failed`);
  }

  // Restore globals
  (global as any).trace = originalTrace;
  (global as any).context = originalContext;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPhoenixPhase2Tests().catch(console.error);
}
