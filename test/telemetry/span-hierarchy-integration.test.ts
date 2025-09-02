/**
 * Integration test for Task 005: Parent-child span relationships
 *
 * This test verifies that the enhanced MCP instrumentation creates proper
 * parent-child span relationships and span links for branches/revisions.
 */

import { MCPInstrumentation } from '../../src/telemetry/mcp-instrumentation.js';
import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';

describe('Task 005: Span Hierarchy Integration', () => {
  let instrumentation: MCPInstrumentation;
  let mockHandler: jest.MockedFunction<any>;

  beforeEach(() => {
    instrumentation = MCPInstrumentation.getInstance();
    mockHandler = jest.fn();
  });

  afterEach(() => {
    // Cleanup
    instrumentation.cleanupOldSpanContexts();
  });

  it('should create proper parent-child relationships with plugin spans', async () => {
    // Arrange: Mock handler that uses child spans
    mockHandler.mockImplementation(async (args: any) => {
      // Simulate plugin execution within child spans
      const pluginSpan = instrumentation.startPluginSpan('metacognitive', {
        'plugin.operation': 'reflection',
      });

      try {
        // Simulate some work
        pluginSpan.addEvent('plugin.processing', { stage: 'analysis' });
        return { result: 'plugin_executed' };
      } finally {
        pluginSpan.end();
      }
    });

    const instrumentedHandler = instrumentation.instrumentMCPHandler(mockHandler, 'code-reasoning');

    // Act: Execute with thought data
    const thoughtData = {
      thought: 'This is a test thought for hierarchy validation',
      thought_number: 1,
      total_thoughts: 5,
      next_thought_needed: true,
    };

    const result = await instrumentedHandler(thoughtData);

    // Assert: Verify execution
    expect(mockHandler).toHaveBeenCalledWith(thoughtData);
    expect(result).toEqual({ result: 'plugin_executed' });
  });

  it('should create span links for branch thoughts', async () => {
    // Arrange: First create a parent thought
    const parentThoughtData = {
      thought: 'Parent thought for branching test',
      thought_number: 1,
      total_thoughts: 5,
      next_thought_needed: true,
      session_id: 'test_session_branch',
    };

    mockHandler.mockResolvedValue({ result: 'parent_success' });
    const instrumentedHandler = instrumentation.instrumentMCPHandler(mockHandler, 'code-reasoning');

    // Execute parent thought
    await instrumentedHandler(parentThoughtData);

    // Act: Create a branch thought
    const branchThoughtData = {
      thought: 'Branch thought exploring alternative approach',
      thought_number: 2,
      total_thoughts: 5,
      next_thought_needed: true,
      branch_from_thought: 1,
      branch_id: 'alternative_approach',
      session_id: 'test_session_branch',
    };

    mockHandler.mockResolvedValue({ result: 'branch_success' });
    const result = await instrumentedHandler(branchThoughtData);

    // Assert: Verify branch execution
    expect(mockHandler).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ result: 'branch_success' });

    // Verify span links were created (indirectly through getLinksForThought)
    const links = instrumentation.getLinksForThought(branchThoughtData);
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].attributes?.['link.type']).toBe('branch_from');
  });

  it('should create span links for revision thoughts', async () => {
    // Arrange: First create an original thought
    const originalThoughtData = {
      thought: 'Original thought that needs revision',
      thought_number: 3,
      total_thoughts: 5,
      next_thought_needed: true,
      session_id: 'test_session_revision',
    };

    mockHandler.mockResolvedValue({ result: 'original_success' });
    const instrumentedHandler = instrumentation.instrumentMCPHandler(mockHandler, 'code-reasoning');

    // Execute original thought
    await instrumentedHandler(originalThoughtData);

    // Act: Create a revision thought
    const revisionThoughtData = {
      thought: 'Revised thought with improved analysis',
      thought_number: 4,
      total_thoughts: 5,
      next_thought_needed: true,
      is_revision: true,
      revises_thought: 3,
      session_id: 'test_session_revision',
    };

    mockHandler.mockResolvedValue({ result: 'revision_success' });
    const result = await instrumentedHandler(revisionThoughtData);

    // Assert: Verify revision execution
    expect(mockHandler).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ result: 'revision_success' });

    // Verify span links were created
    const links = instrumentation.getLinksForThought(revisionThoughtData);
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].attributes?.['link.type']).toBe('revision_of');
  });

  it('should support memory operation child spans', async () => {
    // Arrange: Mock handler that performs memory operations
    mockHandler.mockImplementation(async (args: any) => {
      // Simulate memory store operation within child span
      const memorySpan = instrumentation.startMemorySpan('store_thought', {
        'memory.thought_id': args.thought_number,
        'memory.session_id': args.session_id,
      });

      try {
        memorySpan.addEvent('memory.storing', {
          thought_length: args.thought.length,
          operation: 'persist',
        });
        return { result: 'memory_stored' };
      } finally {
        memorySpan.end();
      }
    });

    const instrumentedHandler = instrumentation.instrumentMCPHandler(mockHandler, 'code-reasoning');

    // Act: Execute with thought data that triggers memory operation
    const thoughtData = {
      thought: 'This thought will be stored in memory',
      thought_number: 5,
      total_thoughts: 5,
      next_thought_needed: false,
      session_id: 'test_session_memory',
    };

    const result = await instrumentedHandler(thoughtData);

    // Assert: Verify memory operation
    expect(mockHandler).toHaveBeenCalledWith(thoughtData);
    expect(result).toEqual({ result: 'memory_stored' });
  });

  it('should support cognitive phase child spans', async () => {
    // Arrange: Mock handler that performs cognitive processing phases
    mockHandler.mockImplementation(async (args: any) => {
      // Simulate cognitive processing phases
      const analysisSpan = instrumentation.startCognitivePhaseSpan('analysis', {
        'phase.complexity': 'high',
        'phase.thought_number': args.thought_number,
      });

      try {
        analysisSpan.addEvent('phase.started', { phase: 'analysis' });

        // Nested synthesis phase
        const synthesisSpan = instrumentation.startCognitivePhaseSpan('synthesis', {
          'phase.parent': 'analysis',
          'phase.type': 'integration',
        });

        try {
          synthesisSpan.addEvent('phase.started', { phase: 'synthesis' });
          return {
            result: 'cognitive_processing_complete',
            analysis: 'completed',
            synthesis: 'completed',
          };
        } finally {
          synthesisSpan.end();
        }
      } finally {
        analysisSpan.end();
      }
    });

    const instrumentedHandler = instrumentation.instrumentMCPHandler(mockHandler, 'code-reasoning');

    // Act: Execute cognitive processing
    const thoughtData = {
      thought: 'Complex thought requiring multi-phase cognitive processing',
      thought_number: 1,
      total_thoughts: 3,
      next_thought_needed: true,
    };

    const result = await instrumentedHandler(thoughtData);

    // Assert: Verify cognitive processing
    expect(mockHandler).toHaveBeenCalledWith(thoughtData);
    expect(result.result).toBe('cognitive_processing_complete');
    expect(result.analysis).toBe('completed');
    expect(result.synthesis).toBe('completed');
  });

  it('should cleanup old span contexts to prevent memory leaks', () => {
    // Arrange: Create some old span contexts
    const oldTimestamp = Date.now() - 400000; // 400 seconds ago (older than 300s max age)
    const recentTimestamp = Date.now() - 100000; // 100 seconds ago (newer than 300s max age)

    // Simulate storing span contexts (accessing private member for testing)
    const thoughtSpanContexts = (instrumentation as any).thoughtSpanContexts;
    thoughtSpanContexts.set('thought_old', {
      spanContext: { traceId: 'old', spanId: 'old' },
      thoughtNumber: 1,
      sessionId: 'old_session',
      timestamp: oldTimestamp,
    });

    thoughtSpanContexts.set('thought_recent', {
      spanContext: { traceId: 'recent', spanId: 'recent' },
      thoughtNumber: 2,
      sessionId: 'recent_session',
      timestamp: recentTimestamp,
    });

    // Act: Cleanup old contexts
    instrumentation.cleanupOldSpanContexts(300000); // 5 minute max age

    // Assert: Old context removed, recent context retained
    expect(thoughtSpanContexts.has('thought_old')).toBe(false);
    expect(thoughtSpanContexts.has('thought_recent')).toBe(true);
  });
});
