#!/usr/bin/env node

/**
 * @fileoverview Comprehensive Thought Analysis Test Suite
 *
 * Tests all tiers of the thought analysis system with proper argument handling
 */

import { PostgreSQLMemoryStore } from '../../src/memory/postgresql-memory-store.js';
import { PostgreSQLConfigs } from '../../src/memory/postgresql-config.js';
import {
  ThoughtQualityAnalyzer,
  ThoughtChainContext,
} from '../../src/memory/thought-intelligence/thought-quality-analyzer.js';
import { StoredThought, ReasoningSession } from '../../src/memory/memory-store.js';

/**
 * Comprehensive test runner for thought analysis system
 */
class ThoughtAnalysisTestRunner {
  private memoryStore: PostgreSQLMemoryStore;
  private analyzer: ThoughtQualityAnalyzer;

  constructor() {
    this.memoryStore = new PostgreSQLMemoryStore(PostgreSQLConfigs.fromEnvironment());
    this.analyzer = new ThoughtQualityAnalyzer(this.memoryStore);
  }

  /**
   * Run tests based on command line arguments
   */
  async runTests(targetTier?: string): Promise<void> {
    console.log('🧪 Starting Thought Analysis System Tests...');

    try {
      // Initialize the store
      await this.memoryStore.initialize();
      console.log('✅ Memory store initialized');

      // Test basic analysis functionality
      await this.testBasicAnalysis();

      // Run tier-specific tests based on arguments
      if (!targetTier || targetTier === 'tier1') {
        await this.testTier1Metrics();
      }

      if (!targetTier || targetTier === 'tier2') {
        await this.testTier2Metrics();
      }

      if (!targetTier || targetTier === 'tier3') {
        await this.testTier3Metrics();
      }

      // Only run additional tests if no specific tier requested
      if (!targetTier) {
        await this.testDatabaseIntegration();
        await this.testBatchAnalysis();
        await this.testPerformanceRequirements();
      }

      console.log('🎉 All thought analysis tests passed!');
    } catch (error) {
      console.error('❌ Thought analysis tests failed:', error);
      process.exit(1);
    } finally {
      await this.memoryStore.close();
    }
  }

  /**
   * Test basic analysis functionality
   */
  async testBasicAnalysis(): Promise<void> {
    console.log('📊 Testing basic analysis functionality...');

    const sessionId = `test_basic_${Date.now()}`;
    const thoughts: StoredThought[] = [
      {
        id: `thought_1_${Date.now()}`,
        session_id: sessionId,
        thought: 'I need to solve this problem step by step.',
        thought_number: 1,
        total_thoughts: 2,
        next_thought_needed: true,
        timestamp: new Date(Date.now() - 1000),
        confidence: 0.8,
        context: {},
      },
      {
        id: `thought_2_${Date.now()}`,
        session_id: sessionId,
        thought: 'Building on my previous analysis, I can now implement the solution.',
        thought_number: 2,
        total_thoughts: 2,
        next_thought_needed: false,
        timestamp: new Date(),
        confidence: 0.9,
        context: {},
      },
    ];

    const context: ThoughtChainContext = {
      session_id: sessionId,
      thoughts,
    };

    const startTime = Date.now();
    const result = await this.analyzer.analyzeThoughtChain(context);
    const processingTime = Date.now() - startTime;

    // Validate basic structure
    if (!result) throw new Error('Analysis result is null');
    if (result.session_id !== sessionId) throw new Error('Session ID mismatch');
    if (result.thought_chain_ids.length !== 2) throw new Error('Incorrect thought chain length');
    if (result.tier_scores.overall_score < 0 || result.tier_scores.overall_score > 1) {
      throw new Error('Overall score out of range');
    }

    console.log(
      `✅ Basic analysis test passed (${processingTime}ms, score: ${result.tier_scores.overall_score.toFixed(3)})`
    );
  }

  /**
   * Test Tier 1 metrics (technical quality)
   */
  async testTier1Metrics(): Promise<void> {
    console.log('📊 Testing Tier 1 metrics (technical quality)...');

    const sessionId = `test_tier1_${Date.now()}`;
    const thoughts: StoredThought[] = [
      {
        id: `thought_1_${Date.now()}`,
        session_id: sessionId,
        thought: 'This is the first thought in a well-structured sequence.',
        thought_number: 1,
        total_thoughts: 3,
        next_thought_needed: true,
        timestamp: new Date(Date.now() - 2000),
        confidence: 0.8,
        context: {},
      },
      {
        id: `thought_2_${Date.now()}`,
        session_id: sessionId,
        thought: 'This is the second thought that follows logically.',
        thought_number: 2,
        total_thoughts: 3,
        next_thought_needed: true,
        timestamp: new Date(Date.now() - 1000),
        confidence: 0.85,
        context: {},
      },
      {
        id: `thought_3_${Date.now()}`,
        session_id: sessionId,
        thought: 'This is the final thought that completes the sequence.',
        thought_number: 3,
        total_thoughts: 3,
        next_thought_needed: false,
        timestamp: new Date(),
        confidence: 0.9,
        context: {},
      },
    ];

    const context: ThoughtChainContext = {
      session_id: sessionId,
      thoughts,
    };

    const result = await this.analyzer.analyzeThoughtChain(context);

    // Validate Tier 1 metrics
    this.assertRange(
      result.metrics.parameter_adherence,
      0.8,
      1.0,
      'Parameter adherence should be high'
    );
    this.assertRange(
      result.metrics.sequential_integrity,
      0.8,
      1.0,
      'Sequential integrity should be high'
    );
    this.assertRange(
      result.tier_scores.tier1_score,
      0.8,
      1.0,
      'Tier 1 score should reflect technical quality'
    );

    console.log(
      `✅ Tier 1 metrics test passed (score: ${result.tier_scores.tier1_score.toFixed(3)})`
    );
  }

  /**
   * Test Tier 2 metrics (cognitive quality)
   */
  async testTier2Metrics(): Promise<void> {
    console.log('📊 Testing Tier 2 metrics (cognitive quality)...');

    // Create test data with sophisticated reasoning
    const sessionId = `test_tier2_${Date.now()}`;
    const thoughts: StoredThought[] = [
      {
        id: `thought_1_${Date.now()}`,
        session_id: sessionId,
        thought:
          'I need to analyze this problem systematically. First, I will examine the core requirements.',
        thought_number: 1,
        total_thoughts: 3,
        next_thought_needed: true,
        timestamp: new Date(Date.now() - 2000),
        complexity: 4.0,
        context: {},
      },
      {
        id: `thought_2_${Date.now()}`,
        session_id: sessionId,
        thought:
          'Building on my previous analysis, I realize that this problem requires a more sophisticated approach. Therefore, I will implement a multi-layered solution that considers both technical and user experience factors.',
        thought_number: 2,
        total_thoughts: 3,
        next_thought_needed: true,
        timestamp: new Date(Date.now() - 1000),
        complexity: 6.5,
        context: {},
      },
      {
        id: `thought_3_${Date.now()}`,
        session_id: sessionId,
        thought:
          'Reflecting on my reasoning process, I can see that my approach has evolved from simple to complex. This metacognitive awareness helps me recognize that the creative synthesis of technical and UX considerations represents a novel approach to this type of problem.',
        thought_number: 3,
        total_thoughts: 3,
        next_thought_needed: false,
        timestamp: new Date(),
        complexity: 8.0,
        context: {},
      },
    ];

    const context: ThoughtChainContext = {
      session_id: sessionId,
      thoughts,
    };

    const result = await this.analyzer.analyzeThoughtChain(context);

    // Validate Tier 2 metrics
    this.assertRange(
      result.metrics.logical_coherence,
      0.7,
      1.0,
      'Logical coherence should be high for well-reasoned thoughts'
    );
    this.assertRange(
      result.metrics.depth_progression,
      0.6,
      1.0,
      'Depth progression should be high for increasing complexity'
    );
    this.assertRange(
      result.metrics.metacognitive_awareness,
      0.6,
      1.0,
      'Metacognitive awareness should be detected'
    );
    this.assertRange(
      result.metrics.creative_synthesis,
      0.5,
      1.0,
      'Creative synthesis should be detected'
    );
    this.assertRange(
      result.tier_scores.tier2_score,
      0.6,
      1.0,
      'Tier 2 score should reflect cognitive quality'
    );

    console.log(
      `✅ Tier 2 metrics test passed (score: ${result.tier_scores.tier2_score.toFixed(3)})`
    );
  }

  /**
   * Test Tier 3 metrics (learning effectiveness)
   */
  async testTier3Metrics(): Promise<void> {
    console.log('📊 Testing Tier 3 metrics (learning effectiveness)...');

    // Create test data with learning characteristics
    const sessionId = `test_tier3_${Date.now()}`;
    const thoughts: StoredThought[] = [
      {
        id: `thought_1_${Date.now()}`,
        session_id: sessionId,
        thought: 'I will apply the systematic approach I learned from previous similar problems.',
        thought_number: 1,
        total_thoughts: 3,
        next_thought_needed: true,
        timestamp: new Date(Date.now() - 2000),
        confidence: 0.8,
        context: {},
      },
      {
        id: `thought_2_${Date.now()}`,
        session_id: sessionId,
        thought:
          'This approach approach approach is working well. I can see the same patterns emerging as in my previous successful solutions.',
        thought_number: 2,
        total_thoughts: 3,
        next_thought_needed: true,
        timestamp: new Date(Date.now() - 1000),
        confidence: 0.85,
        context: {},
      },
      {
        id: `thought_3_${Date.now()}`,
        session_id: sessionId,
        thought:
          'I have successfully avoided the mistake I made last time by using this improved approach approach methodology.',
        thought_number: 3,
        total_thoughts: 3,
        next_thought_needed: false,
        timestamp: new Date(),
        confidence: 0.9,
        context: {},
      },
    ];

    const context: ThoughtChainContext = {
      session_id: sessionId,
      thoughts,
      similar_sessions: [
        {
          id: 'similar_1',
          thoughts: [
            { thought: 'I used a systematic approach approach to solve this.' },
            { thought: 'The approach approach worked well in this context.' },
          ],
        },
      ],
    };

    const result = await this.analyzer.analyzeThoughtChain(context);

    // Validate Tier 3 metrics
    this.assertRange(
      result.metrics.pattern_recognition,
      0.3,
      1.0,
      'Pattern recognition should be detected'
    );
    this.assertRange(
      result.metrics.cross_session_transfer,
      0.4,
      1.0,
      'Cross-session transfer should be detected'
    );
    this.assertRange(
      result.metrics.failure_mode_avoidance,
      0.5,
      1.0,
      'Failure mode avoidance should be detected'
    );
    this.assertRange(
      result.tier_scores.tier3_score,
      0.4,
      1.0,
      'Tier 3 score should reflect learning effectiveness'
    );

    console.log(
      `✅ Tier 3 metrics test passed (score: ${result.tier_scores.tier3_score.toFixed(3)})`
    );
  }

  /**
   * Test database integration
   */
  async testDatabaseIntegration(): Promise<void> {
    console.log('📊 Testing database integration...');

    const sessionId = `test_db_${Date.now()}`;
    const result = await this.memoryStore.analyzeAndStoreThoughtChain(sessionId);

    if (!result) {
      throw new Error('Database integration failed - no result returned');
    }

    const retrieved = await this.memoryStore.getThoughtAnalysis(sessionId);
    if (!retrieved) {
      throw new Error('Database integration failed - cannot retrieve stored analysis');
    }

    console.log('✅ Database integration test passed');
  }

  /**
   * Test batch analysis
   */
  async testBatchAnalysis(): Promise<void> {
    console.log('📊 Testing batch analysis...');

    const contexts: ThoughtChainContext[] = [
      {
        session_id: `batch_1_${Date.now()}`,
        thoughts: [
          {
            id: `batch_thought_1`,
            session_id: `batch_1_${Date.now()}`,
            thought: 'Batch test thought 1',
            thought_number: 1,
            total_thoughts: 1,
            next_thought_needed: false,
            timestamp: new Date(),
            confidence: 0.8,
            context: {},
          },
        ],
      },
      {
        session_id: `batch_2_${Date.now()}`,
        thoughts: [
          {
            id: `batch_thought_2`,
            session_id: `batch_2_${Date.now()}`,
            thought: 'Batch test thought 2',
            thought_number: 1,
            total_thoughts: 1,
            next_thought_needed: false,
            timestamp: new Date(),
            confidence: 0.8,
            context: {},
          },
        ],
      },
    ];

    const results = await this.analyzer.batchAnalyzeThoughtChains(contexts);

    if (results.length !== 2) {
      throw new Error('Batch analysis failed - incorrect result count');
    }

    console.log('✅ Batch analysis test passed');
  }

  /**
   * Test performance requirements
   */
  async testPerformanceRequirements(): Promise<void> {
    console.log('📊 Testing performance requirements...');

    const sessionId = `test_perf_${Date.now()}`;
    const thoughts: StoredThought[] = [
      {
        id: `perf_thought_${Date.now()}`,
        session_id: sessionId,
        thought: 'Performance test thought with moderate complexity for timing analysis.',
        thought_number: 1,
        total_thoughts: 1,
        next_thought_needed: false,
        timestamp: new Date(),
        confidence: 0.8,
        context: {},
      },
    ];

    const context: ThoughtChainContext = {
      session_id: sessionId,
      thoughts,
    };

    const startTime = Date.now();
    const result = await this.analyzer.analyzeThoughtChain(context);
    const processingTime = Date.now() - startTime;

    // Performance requirement: analysis should complete within 500ms per thought chain
    if (processingTime > 500) {
      throw new Error(`Performance requirement failed: ${processingTime}ms > 500ms`);
    }

    console.log(`✅ Performance test passed (${processingTime}ms)`);
  }

  /**
   * Helper method to assert value is within range
   */
  private assertRange(value: number, min: number, max: number, message: string): void {
    if (value < min || value > max) {
      throw new Error(
        `Assertion failed: ${message} (value ${value} not in range [${min}, ${max}])`
      );
    }
  }
}

/**
 * Parse command line arguments
 */
function parseArguments(): string | undefined {
  const args = process.argv.slice(2);

  for (const arg of args) {
    if (arg === '--tier1') return 'tier1';
    if (arg === '--tier2') return 'tier2';
    if (arg === '--tier3') return 'tier3';
  }

  return undefined;
}

/**
 * Main execution
 */
async function main() {
  const targetTier = parseArguments();
  const testRunner = new ThoughtAnalysisTestRunner();
  await testRunner.runTests(targetTier);
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

export { ThoughtAnalysisTestRunner };
