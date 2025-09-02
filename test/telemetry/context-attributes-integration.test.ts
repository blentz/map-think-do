import { performance } from 'perf_hooks';
import {
  createUserInfo,
  createSessionInfo,
  withFullContext,
  extractSpanAttributes,
  ContextMetadata,
} from '../../src/telemetry/context-attributes.js';
import { context, ROOT_CONTEXT } from '@opentelemetry/api';

/**
 * Integration test for context attributes functionality
 * Tests the real functionality without Jest dependencies
 */

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

class ContextAttributesIntegrationTest {
  private results: TestResult[] = [];

  private runTest(name: string, testFn: () => void | Promise<void>): void {
    const start = performance.now();
    try {
      const result = testFn();
      if (result instanceof Promise) {
        result
          .then(() => {
            const duration = performance.now() - start;
            this.results.push({ name, passed: true, duration });
          })
          .catch(error => {
            const duration = performance.now() - start;
            this.results.push({ name, passed: false, error: error.message, duration });
          });
      } else {
        const duration = performance.now() - start;
        this.results.push({ name, passed: true, duration });
      }
    } catch (error: any) {
      const duration = performance.now() - start;
      this.results.push({ name, passed: false, error: error.message, duration });
    }
  }

  private assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  private assertEqual<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
      throw new Error(
        `Assertion failed: ${message || 'Values not equal'}. Expected: ${expected}, Actual: ${actual}`
      );
    }
  }

  private assertDefined<T>(value: T | undefined, message?: string): asserts value is T {
    if (value === undefined) {
      throw new Error(`Assertion failed: ${message || 'Value is undefined'}`);
    }
  }

  public runAllTests(): void {
    console.log('🧪 Running Context Attributes Integration Tests...');

    this.runTest('User Info Creation and Deterministic Session IDs', () => {
      const userId = 'user123';
      const userAgent = 'test-agent/1.0';
      const projectId = 'project456';

      // Mock Date.now for consistent testing
      const originalNow = Date.now;
      const mockTime = 1234567890000;
      Date.now = jest.fn ? jest.fn(() => mockTime) : () => mockTime;

      const userInfo1 = createUserInfo(userId, userAgent, projectId);
      const userInfo2 = createUserInfo(userId, userAgent, projectId);

      this.assertEqual(userInfo1.userId, userId);
      this.assertEqual(userInfo1.userAgent, userAgent);
      this.assert(
        userInfo1.sessionId.includes(userId.substring(0, 8)),
        'Session ID should contain user ID'
      );
      this.assertEqual(
        userInfo1.sessionId,
        userInfo2.sessionId,
        'Session IDs should be deterministic'
      );
      this.assertEqual(userInfo1.metadata?.projectId, projectId);

      Date.now = originalNow;
    });

    this.runTest('Session Info Creation', () => {
      const sessionId = 'session_123';
      const projectId = 'project_456';
      const additionalMetadata = { version: '1.0.0', environment: 'test' };

      const sessionInfo = createSessionInfo(sessionId, projectId, additionalMetadata);

      this.assertEqual(sessionInfo.sessionId, sessionId);
      this.assertEqual(sessionInfo.projectId, projectId);
      this.assert(sessionInfo.startTime > 0, 'Start time should be positive');
      this.assertEqual(sessionInfo.metadata?.version, '1.0.0');
      this.assertEqual(sessionInfo.metadata?.environment, 'test');
    });

    this.runTest('Full Context Integration', () => {
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

      withFullContext(userInfo, sessionInfo, metadata, () => {
        contextCaptured = true;
        capturedAttributes = extractSpanAttributes(context.active());
      });

      this.assert(contextCaptured, 'Context function should have been executed');

      // Verify user attributes
      this.assertEqual(capturedAttributes['user.id'], 'user123');
      this.assertEqual(capturedAttributes['user.agent'], 'test-agent/1.0');
      this.assertEqual(capturedAttributes['session.id'], userInfo.sessionId);
      this.assertEqual(capturedAttributes['user.metadata.projectId'], 'project789');
      this.assertDefined(capturedAttributes['user.metadata.createdAt']);

      // Verify session attributes
      this.assertEqual(capturedAttributes['session.start_time'], sessionInfo.startTime);
      this.assertEqual(capturedAttributes['project.id'], 'project_789');
      this.assertEqual(capturedAttributes['session.metadata.version'], '1.0.0');
      this.assertEqual(capturedAttributes['session.metadata.environment'], 'test');

      // Verify context metadata
      this.assertEqual(capturedAttributes['context.tags'], 'cognitive,analysis');
      this.assertEqual(capturedAttributes['context.tags.count'], 2);
      this.assertEqual(capturedAttributes['context.environment'], 'test');
      this.assertEqual(capturedAttributes['context.version'], '1.0.0');
      this.assertEqual(capturedAttributes['context.metadata.customField'], 'customValue');
    });

    this.runTest('Empty Context Handling', () => {
      const attributes = extractSpanAttributes(ROOT_CONTEXT);
      this.assertEqual(
        Object.keys(attributes).length,
        0,
        'Empty context should return no attributes'
      );
    });

    this.runTest('Null/Undefined Value Filtering', () => {
      const userInfo = {
        userId: 'user123',
        sessionId: 'session_456',
        metadata: {
          validField: 'value',
          nullField: null,
          undefinedField: undefined,
          emptyString: '',
          zeroValue: 0,
        },
      };

      let ctx = ROOT_CONTEXT;

      // Manually set user info context using setValue (simulating setUserInfo)
      const USER_INFO_KEY = Symbol('user_info');
      ctx = ctx.setValue(USER_INFO_KEY, userInfo);

      const attributes = extractSpanAttributes(ctx);

      this.assertDefined(attributes['user.metadata.validField']);
      this.assertEqual(attributes['user.metadata.validField'], 'value');
      this.assertEqual(attributes['user.metadata.emptyString'], '');
      this.assertEqual(attributes['user.metadata.zeroValue'], '0');
      this.assert(
        attributes['user.metadata.nullField'] === undefined,
        'Null values should be filtered out'
      );
      this.assert(
        attributes['user.metadata.undefinedField'] === undefined,
        'Undefined values should be filtered out'
      );
    });

    this.runTest('No Math.random Usage Verification', () => {
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

        withFullContext(userInfo, sessionInfo, metadata, () => {
          const attributes = extractSpanAttributes(context.active());
          this.assertDefined(attributes['user.id']);
          this.assertDefined(attributes['session.start_time']);
          this.assertDefined(attributes['context.tags']);
        });

        this.assert(!randomCalled, 'Math.random() should not have been called');
      } finally {
        Math.random = originalRandom;
      }
    });
  }

  public printResults(): void {
    console.log('\n📊 Context Attributes Integration Test Results:');
    console.log('='.repeat(60));

    let passed = 0;
    let failed = 0;

    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const duration = result.duration ? ` (${result.duration.toFixed(2)}ms)` : '';
      console.log(`${status} ${result.name}${duration}`);

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
    console.log(`Total: ${this.results.length} | Passed: ${passed} | Failed: ${failed}`);

    if (failed === 0) {
      console.log('🎉 All context attributes tests passed!');
    } else {
      console.log(`❌ ${failed} test(s) failed`);
    }
  }
}

// Run the tests if this file is executed directly
if (require.main === module) {
  const test = new ContextAttributesIntegrationTest();
  test.runAllTests();

  // Allow time for async operations to complete
  setTimeout(() => {
    test.printResults();
  }, 100);
}

export { ContextAttributesIntegrationTest };
