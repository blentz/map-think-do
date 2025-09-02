/**
 * Simple Context Attributes Test Runner
 * Compatible with the existing test infrastructure (no Jest)
 */

import {
  createUserInfo,
  createSessionInfo,
  withFullContextReliable,
  extractSpanAttributes,
  validateUserInfo,
  validateSessionInfo,
  ContextMetadata,
} from '../../src/telemetry/context-attributes.js';
import { ROOT_CONTEXT } from '@opentelemetry/api';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

class SimpleAssertions {
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

  static assertMatches(actual: string, pattern: RegExp, message?: string): void {
    if (!pattern.test(actual)) {
      throw new Error(
        `Assertion failed: ${message || 'Pattern does not match'}. Pattern: ${pattern}, Actual: ${actual}`
      );
    }
  }
}

export async function runContextAttributesTests(): Promise<void> {
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

  console.log('🧪 Testing Context Attributes...');

  // Test 1: User Info Creation
  runTest('User Info Creation', () => {
    const userId = 'user123';
    const userAgent = 'test-agent/1.0';
    const projectId = 'project456';

    const userInfo = createUserInfo(userId, userAgent, projectId);

    SimpleAssertions.assertEqual(userInfo.userId, userId);
    SimpleAssertions.assertEqual(userInfo.userAgent, userAgent);
    SimpleAssertions.assertMatches(
      userInfo.sessionId,
      /^session_\d+_user123$/,
      'Session ID should follow expected pattern'
    );
    SimpleAssertions.assertEqual(userInfo.metadata?.projectId, projectId);
    SimpleAssertions.assert(
      typeof userInfo.metadata?.createdAt === 'number',
      'Created timestamp should be a number'
    );
  });

  // Test 2: Session Info Creation
  runTest('Session Info Creation', () => {
    const sessionId = 'session_123';
    const projectId = 'project_456';
    const additionalMetadata = { version: '1.0.0', environment: 'test' };

    const sessionInfo = createSessionInfo(sessionId, projectId, additionalMetadata);

    SimpleAssertions.assertEqual(sessionInfo.sessionId, sessionId);
    SimpleAssertions.assertEqual(sessionInfo.projectId, projectId);
    SimpleAssertions.assert(sessionInfo.startTime > 0, 'Start time should be positive');
    SimpleAssertions.assertEqual(sessionInfo.metadata?.version, '1.0.0');
    SimpleAssertions.assertEqual(sessionInfo.metadata?.environment, 'test');
  });

  // Test 3: User Info Validation
  runTest('User Info Validation', () => {
    const validUserInfo = {
      userId: 'user123',
      sessionId: 'session_456',
    };

    const invalidUserInfo = {
      userId: '',
      sessionId: 'session_456',
    };

    SimpleAssertions.assert(validateUserInfo(validUserInfo), 'Valid user info should validate');
    SimpleAssertions.assert(
      !validateUserInfo(invalidUserInfo),
      'Invalid user info should fail validation'
    );
  });

  // Test 4: Session Info Validation
  runTest('Session Info Validation', () => {
    const validSessionInfo = {
      sessionId: 'session_123',
      startTime: Date.now(),
    };

    const invalidSessionInfo = {
      sessionId: '',
      startTime: 0,
    };

    SimpleAssertions.assert(
      validateSessionInfo(validSessionInfo),
      'Valid session info should validate'
    );
    SimpleAssertions.assert(
      !validateSessionInfo(invalidSessionInfo),
      'Invalid session info should fail validation'
    );
  });

  // Test 5: Full Context Integration
  runTest('Full Context Integration', () => {
    const userInfo = createUserInfo('user123', 'test-agent/1.0', 'project789');
    const sessionInfo = createSessionInfo('session_456', 'project_789', {
      version: '1.0.0',
      environment: 'test',
    });
    const metadata: ContextMetadata = {
      tags: ['cognitive', 'analysis'],
      environment: 'test',
      version: '1.0.0',
      customField: 'customValue',
    };

    let contextCaptured = false;
    let capturedAttributes: Record<string, any> = {};

    // Use withFullContextReliable to work around context propagation issues
    withFullContextReliable(userInfo, sessionInfo, metadata, (ctx: any) => {
      contextCaptured = true;
      capturedAttributes = extractSpanAttributes(ctx);
    });

    SimpleAssertions.assert(contextCaptured, 'Context function should have been executed');

    // Verify user attributes
    SimpleAssertions.assertEqual(capturedAttributes['user.id'], 'user123');
    SimpleAssertions.assertEqual(capturedAttributes['user.agent'], 'test-agent/1.0');
    SimpleAssertions.assertEqual(capturedAttributes['session.id'], userInfo.sessionId);
    SimpleAssertions.assertDefined(capturedAttributes['user.metadata.projectId']);

    // Verify session attributes
    SimpleAssertions.assertEqual(capturedAttributes['session.start_time'], sessionInfo.startTime);
    SimpleAssertions.assertEqual(capturedAttributes['project.id'], 'project_789');

    // Verify context metadata
    SimpleAssertions.assertEqual(capturedAttributes['context.tags'], 'cognitive,analysis');
    SimpleAssertions.assertEqual(capturedAttributes['context.tags.count'], 2);
    SimpleAssertions.assertEqual(capturedAttributes['context.environment'], 'test');
    SimpleAssertions.assertEqual(capturedAttributes['context.version'], '1.0.0');
  });

  // Test 6: Empty Context Handling
  runTest('Empty Context Handling', () => {
    const attributes = extractSpanAttributes(ROOT_CONTEXT);
    SimpleAssertions.assertEqual(
      Object.keys(attributes).length,
      0,
      'Empty context should return no attributes'
    );
  });

  // Test 7: No Math.random() Usage Verification
  runTest('No Math.random() Usage', () => {
    // Mock Math.random to throw if called
    const originalRandom = Math.random;
    let randomCalled = false;
    Math.random = () => {
      randomCalled = true;
      throw new Error('Math.random() should not be used in context attributes');
    };

    try {
      const userInfo = createUserInfo('user123', 'agent/1.0', 'project456');
      const sessionInfo = createSessionInfo('session_789', 'project_123', { test: true });
      const metadata: ContextMetadata = {
        tags: ['test'],
        environment: 'test',
      };

      withFullContextReliable(userInfo, sessionInfo, metadata, (ctx: any) => {
        const attributes = extractSpanAttributes(ctx);
        SimpleAssertions.assertDefined(attributes['user.id']);
        SimpleAssertions.assertDefined(attributes['session.start_time']);
        SimpleAssertions.assertDefined(attributes['context.tags']);
      });

      SimpleAssertions.assert(!randomCalled, 'Math.random() should not have been called');
    } finally {
      Math.random = originalRandom;
    }
  });

  // Wait for async tests to complete
  await new Promise(resolve => setTimeout(resolve, 100));

  // Print results
  console.log('\n📊 Context Attributes Test Results:');
  console.log('='.repeat(50));

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

  console.log('='.repeat(50));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    throw new Error(`${failed} context attributes test(s) failed`);
  }

  console.log('🎉 All context attributes tests passed!');
}
