import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MCPInstrumentation } from '../../src/telemetry/mcp-instrumentation.js';
import {
  withPromptTemplate,
  withPromptVariables,
  createPromptTemplate,
} from '../../src/telemetry/prompt-tracking.js';

describe('MCP Instrumentation with Prompt Tracking', () => {
  let instrumentation: MCPInstrumentation;

  beforeEach(() => {
    instrumentation = MCPInstrumentation.getInstance();
  });

  afterEach(() => {
    // Clean up any active spans
  });

  it('should integrate prompt template tracking with MCP instrumentation', async () => {
    // Create a mock handler that returns expected cognitive data
    const mockHandler = jest.fn().mockResolvedValue({
      status: 'processed',
      thought_number: 1,
      total_thoughts: 1,
      next_thought_needed: false,
      metacognitive_awareness: 0.7,
      creative_pressure: 0.5,
      breakthrough_likelihood: 0.6,
      cognitive_state: {
        session_id: 'test_session',
        thought_count: 1,
        current_complexity: 3,
      },
    });

    // Instrument the handler
    const instrumentedHandler = instrumentation.instrumentMCPHandler(mockHandler, 'code-reasoning');

    // Create a prompt template
    const template = createPromptTemplate(
      'Analyze this problem: {{problem}} with {{approach}} method',
      { problem: 'sorting algorithm', approach: 'recursive' },
      '1.2.0'
    );

    const variables = { problem: 'data structure optimization', approach: 'iterative' };

    // Execute within prompt template context
    const result = await withPromptTemplate(template, async () => {
      return withPromptVariables(variables, async () => {
        return instrumentedHandler({
          thought: 'Testing prompt template integration',
          thought_number: 1,
          total_thoughts: 1,
          next_thought_needed: false,
        });
      });
    });

    // Verify the handler was called
    expect(mockHandler).toHaveBeenCalledWith({
      thought: 'Testing prompt template integration',
      thought_number: 1,
      total_thoughts: 1,
      next_thought_needed: false,
    });

    // Verify the result
    expect(result).toEqual({
      status: 'processed',
      thought_number: 1,
      total_thoughts: 1,
      next_thought_needed: false,
      metacognitive_awareness: 0.7,
      creative_pressure: 0.5,
      breakthrough_likelihood: 0.6,
      cognitive_state: {
        session_id: 'test_session',
        thought_count: 1,
        current_complexity: 3,
      },
    });
  });

  it('should handle missing prompt context gracefully', async () => {
    const mockHandler = jest.fn().mockResolvedValue({
      status: 'processed',
      thought_number: 1,
      total_thoughts: 1,
      next_thought_needed: false,
    });

    const instrumentedHandler = instrumentation.instrumentMCPHandler(mockHandler, 'code-reasoning');

    // Execute without prompt context
    const result = await instrumentedHandler({
      thought: 'Testing without prompt context',
      thought_number: 1,
      total_thoughts: 1,
      next_thought_needed: false,
    });

    expect(mockHandler).toHaveBeenCalled();
    expect(result.status).toBe('processed');
  });

  it('should properly track thought complexity from templates', async () => {
    const mockHandler = jest.fn().mockResolvedValue({
      status: 'processed',
      thought_number: 1,
      total_thoughts: 1,
      next_thought_needed: false,
    });

    const instrumentedHandler = instrumentation.instrumentMCPHandler(mockHandler, 'code-reasoning');

    // Test with a complex template
    const complexTemplate = createPromptTemplate(
      'Analyze {{system}} using {{methodology}} approach considering {{constraints}} and {{requirements}}',
      {
        system: 'distributed microservices architecture',
        methodology: 'domain-driven design',
        constraints: 'performance and scalability',
        requirements: 'high availability and consistency',
      },
      '2.0.0'
    );

    await withPromptTemplate(complexTemplate, async () => {
      return instrumentedHandler({
        thought:
          'This is a complex thought involving recursive metacognitive analysis of distributed systems with multiple interconnected components requiring sophisticated algorithmic approaches.',
        thought_number: 1,
        total_thoughts: 5,
        next_thought_needed: true,
      });
    });

    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        thought: expect.stringContaining('recursive metacognitive analysis'),
        thought_number: 1,
        total_thoughts: 5,
      })
    );
  });
});
