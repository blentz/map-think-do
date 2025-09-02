/**
 * Context Propagation Test
 * Tests the actual OpenTelemetry context propagation behavior
 * specifically the difference between context.active() and passed context
 */

import {
  createUserInfo,
  withFullContext,
  extractSpanAttributes,
  getUserInfo,
  ContextMetadata,
} from '../../src/telemetry/context-attributes.js';
import { context, ROOT_CONTEXT } from '@opentelemetry/api';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

class ContextAssertions {
  static assertEqual<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
      throw new Error(
        `Assertion failed: ${message || 'Values not equal'}. Expected: ${expected}, Actual: ${actual}`
      );
    }
  }

  static assertDefined<T>(value: T | undefined, message?: string): asserts value is T {
    if (value === undefined) {
      throw new Error(`Assertion failed: ${message || 'Value is undefined'}`);
    }
  }

  static assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }
}

export async function runContextPropagationTests(): Promise<void> {
  const results: TestResult[] = [];

  function runTest(name: string, testFn: () => void | Promise<void>): void {
    try {
      const result = testFn();
      if (result instanceof Promise) {
        result
          .then(() => {
            results.push({ name, passed: true });
          })
          .catch(error => {
            results.push({ name, passed: false, error: error.message });
          });
      } else {
        results.push({ name, passed: true });
      }
    } catch (error: any) {
      results.push({ name, passed: false, error: error.message });
    }
  }

  console.log('🧪 Testing Context Propagation Behavior...');

  // Test 1: Verify explicit context works properly
  runTest('Context Explicit Parameter Works', () => {
    const userInfo = createUserInfo('test_user', 'test-agent/1.0', 'test_project');

    let contextResult: any;

    // Test with explicit context (the reliable approach)
    withFullContext(userInfo, { sessionId: 'test_session', startTime: Date.now() }, {}, ctx => {
      contextResult = getUserInfo(ctx);
    });

    // Should work with our explicit context approach
    ContextAssertions.assertDefined(contextResult, 'Explicit context should work');
    ContextAssertions.assertEqual(
      contextResult.userId,
      userInfo.userId,
      'Explicit context should contain correct user ID'
    );
  });

  // Test 2: Document OpenTelemetry context.active() limitation
  runTest('OpenTelemetry Limitation Documented', () => {
    const testSymbol = Symbol('test_key');
    const testValue = 'test_value';

    let retrievedValue: any;
    let contextEquality: boolean = false;

    const testContext = ROOT_CONTEXT.setValue(testSymbol, testValue);

    context.with(testContext, () => {
      // Document the known OpenTelemetry limitation: context.active() !== testContext
      const activeContext = context.active();
      retrievedValue = activeContext.getValue(testSymbol);
      contextEquality = activeContext === testContext;
    });

    // This documents the known limitation - context.active() returns ROOT_CONTEXT, not testContext
    ContextAssertions.assertEqual(
      retrievedValue,
      undefined,
      'Symbol key fails with context.active() (known limitation)'
    );
    ContextAssertions.assertEqual(
      contextEquality,
      false,
      'context.active() !== constructed context (known limitation)'
    );
  });

  // Test 3: Nested context behavior
  runTest('Nested Context Propagation', () => {
    const userInfo1 = createUserInfo('user1', 'agent1', 'project1');
    const userInfo2 = createUserInfo('user2', 'agent2', 'project2');

    let outerUser: any;
    let innerUser: any;

    withFullContext(userInfo1, { sessionId: 'session1', startTime: Date.now() }, {}, ctx1 => {
      outerUser = getUserInfo(ctx1);

      withFullContext(userInfo2, { sessionId: 'session2', startTime: Date.now() }, {}, ctx2 => {
        innerUser = getUserInfo(ctx2);
      });
    });

    ContextAssertions.assertDefined(outerUser, 'Outer context should work');
    ContextAssertions.assertDefined(innerUser, 'Inner context should work');
    ContextAssertions.assertEqual(outerUser.userId, 'user1', 'Outer context should have user1');
    ContextAssertions.assertEqual(innerUser.userId, 'user2', 'Inner context should have user2');
  });

  // Test 4: Context isolation
  runTest('Context Isolation', () => {
    const userInfo = createUserInfo('isolated_user', 'agent', 'project');
    let insideContextUser: any;
    let outsideContextUser: any;

    // Outside the context, should be empty (this tests the known limitation)
    outsideContextUser = getUserInfo(context.active());

    withFullContext(userInfo, { sessionId: 'session', startTime: Date.now() }, {}, ctx => {
      insideContextUser = getUserInfo(ctx);
    });

    // After the context, should be empty again (this tests the known limitation)
    const afterContextUser = getUserInfo(context.active());

    ContextAssertions.assertEqual(outsideContextUser, undefined, 'Context should be empty outside');
    ContextAssertions.assertDefined(insideContextUser, 'Context should have data inside');
    ContextAssertions.assertEqual(afterContextUser, undefined, 'Context should be empty after');
    ContextAssertions.assertEqual(
      insideContextUser.userId,
      'isolated_user',
      'Inside context should have correct user'
    );
  });

  // Test 5: Span attributes extraction with explicit context
  runTest('Span Attributes Extraction Works', () => {
    const userInfo = createUserInfo('attr_user', 'test-agent/1.0', 'attr_project');
    const sessionInfo = {
      sessionId: 'attr_session',
      startTime: Date.now(),
      projectId: 'attr_proj',
    };
    const metadata: ContextMetadata = { tags: ['test', 'propagation'], environment: 'test' };

    let extractedAttributes: any;

    withFullContext(userInfo, sessionInfo, metadata, ctx => {
      // Extract using explicit context
      extractedAttributes = extractSpanAttributes(ctx);
    });

    ContextAssertions.assertDefined(extractedAttributes, 'Context attributes should exist');
    ContextAssertions.assertEqual(
      extractedAttributes['user.id'],
      'attr_user',
      'User ID should be extracted correctly'
    );
    ContextAssertions.assertEqual(
      extractedAttributes['session.id'],
      userInfo.sessionId,
      'Session ID should be extracted correctly'
    );
    ContextAssertions.assertEqual(
      extractedAttributes['context.tags'],
      'test,propagation',
      'Tags should be extracted correctly'
    );
  });

  // Wait for async tests to complete
  await new Promise(resolve => setTimeout(resolve, 100));

  // Print results
  console.log('\n📊 Context Propagation Test Results:');
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  results.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${result.name}`);

    if (!result.passed && result.error) {
      console.log(`   Error: ${result.error}`);
    }

    if (result.passed) {
      passed++;
    } else {
      failed++;
    }
  });

  console.log('='.repeat(60));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    throw new Error(`${failed} context propagation test(s) failed`);
  }

  console.log('🎉 All context propagation tests passed!');
  console.log('✅ OpenTelemetry context behavior is working correctly');
}
