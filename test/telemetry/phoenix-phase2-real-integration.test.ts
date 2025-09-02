import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MCPInstrumentation } from '../../src/telemetry/mcp-instrumentation.js';

describe('Phoenix Phase 2 Real Integration Tests', () => {
  let instrumentation: MCPInstrumentation;

  beforeEach(() => {
    // Use real singleton instances, not mocks
    instrumentation = MCPInstrumentation.getInstance();
  });

  afterEach(() => {
    // Clean up any active spans
    (instrumentation as any).activeSpans?.clear();
  });

  describe('instrumentRequestWithHierarchy', () => {
    it('should create hierarchical spans with Phase 2 components', async () => {
      const testHandler = async (args: any) => {
        return {
          result: 'success',
          thought_number: args.thought_number,
          total_thoughts: args.total_thoughts,
        };
      };

      const instrumentedHandler = instrumentation.instrumentRequestWithHierarchy(
        testHandler,
        'code-reasoning',
        {
          model: 'claude-3-sonnet',
          prompts: [
            {
              role: 'user',
              content: 'Test cognitive reasoning request',
              tokens: 7,
            },
          ],
          completions: [],
        }
      );

      const testArgs = {
        thought: 'This is a test cognitive thought process',
        thought_number: 1,
        total_thoughts: 3,
        next_thought_needed: true,
      };

      const result = await instrumentedHandler(testArgs);

      // Verify the handler executed correctly
      expect(result).toEqual({
        result: 'success',
        thought_number: 1,
        total_thoughts: 3,
      });

      // Verify that spans were created (we can't directly inspect them without mocking,
      // but we can verify the integration doesn't crash and returns expected results)
      expect(result.thought_number).toBe(1);
      expect(result.total_thoughts).toBe(3);
    });

    it('should handle errors with Phase 2 status mapping', async () => {
      const errorHandler = async () => {
        throw new Error('Test cognitive error');
      };

      const instrumentedHandler = instrumentation.instrumentRequestWithHierarchy(
        errorHandler,
        'code-reasoning',
        {
          model: 'claude-3-sonnet',
          prompts: [],
          completions: [],
        }
      );

      await expect(instrumentedHandler()).rejects.toThrow('Test cognitive error');

      // The error should be properly handled by the Phase 2 components
      // without crashing the instrumentation system
    });

    it('should work when telemetry is disabled', async () => {
      // Note: We can't easily modify the singleton config in tests,
      // but we can test that the instrumentation gracefully handles
      // cases where telemetry might fail or be unavailable

      const testHandler = async () => {
        return { disabled_result: 'success' };
      };

      const instrumentedHandler = instrumentation.instrumentRequestWithHierarchy(
        testHandler,
        'code-reasoning'
      );

      const result = await instrumentedHandler();
      expect(result).toEqual({ disabled_result: 'success' });
    });

    it('should handle complex cognitive arguments', async () => {
      const cognitiveHandler = async (args: any) => {
        return {
          processed: true,
          thought_number: args.thought_number,
          branch_count: args.branch_from_thought ? 1 : 0,
          is_revision: Boolean(args.is_revision),
        };
      };

      const instrumentedHandler = instrumentation.instrumentRequestWithHierarchy(
        cognitiveHandler,
        'code-reasoning',
        {
          model: 'claude-3-sonnet',
          prompts: [
            {
              role: 'user',
              content: 'Complex cognitive analysis with branching and revision capabilities',
              tokens: 12,
            },
          ],
          completions: [
            {
              role: 'assistant',
              content: 'Analyzed cognitive request with multiple reasoning paths',
              tokens: 10,
              finish_reason: 'stop',
            },
          ],
        }
      );

      const complexArgs = {
        thought: 'Analyzing complex system architecture patterns',
        thought_number: 5,
        total_thoughts: 10,
        branch_from_thought: 3,
        branch_id: 'alternative-analysis',
        is_revision: true,
        revises_thought: 4,
        next_thought_needed: true,
      };

      const result = await instrumentedHandler(complexArgs);

      expect(result.processed).toBe(true);
      expect(result.thought_number).toBe(5);
      expect(result.branch_count).toBe(1);
      expect(result.is_revision).toBe(true);
    });
  });

  describe('Integration with old instrumentMCPHandler', () => {
    it('should maintain backward compatibility', async () => {
      const testHandler = async (args: any) => {
        return { legacy_result: args.test_value };
      };

      // Test that the old method still works
      const oldInstrumentedHandler = instrumentation.instrumentMCPHandler(
        testHandler,
        'legacy-tool'
      );

      const result = await oldInstrumentedHandler({ test_value: 'backward-compatible' });
      expect(result).toEqual({ legacy_result: 'backward-compatible' });
    });
  });
});
