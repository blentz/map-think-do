#!/usr/bin/env node

/**
 * @fileoverview Simple Thought Analysis Test
 *
 * Basic test for the thought analysis system functionality
 */

import { PostgreSQLMemoryStore } from '../../src/memory/postgresql-memory-store.js';
import { PostgreSQLConfigs } from '../../src/memory/postgresql-config.js';
import {
  ThoughtQualityAnalyzer,
  ThoughtChainContext,
} from '../../src/memory/thought-intelligence/thought-quality-analyzer.js';
import { StoredThought, ReasoningSession } from '../../src/memory/memory-store.js';

/**
 * Simple test runner
 */
class SimpleThoughtAnalysisTest {
  private memoryStore: PostgreSQLMemoryStore;
  private analyzer: ThoughtQualityAnalyzer;

  constructor() {
    this.memoryStore = new PostgreSQLMemoryStore(PostgreSQLConfigs.fromEnvironment());
    this.analyzer = new ThoughtQualityAnalyzer(this.memoryStore);
  }

  async runTest(): Promise<void> {
    console.log('🧪 Running simple thought analysis test...');

    try {
      await this.memoryStore.initialize();
      console.log('✅ Memory store initialized');

      // Create simple test data
      const sessionId = `test_simple_${Date.now()}`;

      const session: ReasoningSession = {
        id: sessionId,
        start_time: new Date(),
        objective: 'Simple test',
        domain: 'testing',
        goal_achieved: true,
        confidence_level: 0.8,
        total_thoughts: 2,
        revision_count: 0,
        branch_count: 0,
        cognitive_roles_used: ['Engineer'],
        metacognitive_interventions: 0,
        effectiveness_score: 0.7,
        lessons_learned: ['Test works'],
        successful_strategies: ['Simple approach'],
        failed_approaches: [],
        tags: ['test'],
      };

      const thoughts: StoredThought[] = [
        {
          id: `thought_1_${Date.now()}`,
          session_id: sessionId,
          thought: 'This is the first thought for testing.',
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
          thought: 'This is the second thought building on the first.',
          thought_number: 2,
          total_thoughts: 2,
          next_thought_needed: false,
          timestamp: new Date(),
          confidence: 0.9,
          context: {},
        },
      ];

      // Store test data
      await this.memoryStore.storeSession(session);
      for (const thought of thoughts) {
        await this.memoryStore.storeThought(thought);
      }

      // Test analysis
      const context: ThoughtChainContext = {
        session_id: sessionId,
        thoughts,
        session_data: session,
      };

      const startTime = Date.now();
      const result = await this.analyzer.analyzeThoughtChain(context);
      const processingTime = Date.now() - startTime;

      // Validate results
      if (!result) {
        throw new Error('Analysis result is null');
      }

      if (result.session_id !== sessionId) {
        throw new Error(`Session ID mismatch: expected ${sessionId}, got ${result.session_id}`);
      }

      if (result.thought_chain_ids.length !== 2) {
        throw new Error(`Expected 2 thought chain IDs, got ${result.thought_chain_ids.length}`);
      }

      if (result.analysis_confidence < 0 || result.analysis_confidence > 1) {
        throw new Error(`Analysis confidence out of range: ${result.analysis_confidence}`);
      }

      if (result.tier_scores.overall_score < 0 || result.tier_scores.overall_score > 1) {
        throw new Error(`Overall score out of range: ${result.tier_scores.overall_score}`);
      }

      if (processingTime > 1000) {
        throw new Error(`Processing too slow: ${processingTime}ms`);
      }

      console.log(
        `✅ Simple test passed (${processingTime}ms, score: ${result.tier_scores.overall_score.toFixed(3)})`
      );

      // Test database integration
      const analysisResult = await this.memoryStore.analyzeAndStoreThoughtChain(sessionId);
      if (!analysisResult) {
        throw new Error('Failed to store analysis result');
      }

      const retrievedAnalysis = await this.memoryStore.getThoughtAnalysis(sessionId);
      if (!retrievedAnalysis) {
        throw new Error('Failed to retrieve analysis result');
      }

      if (retrievedAnalysis.session_id !== sessionId) {
        throw new Error('Retrieved analysis has wrong session ID');
      }

      console.log('✅ Database integration test passed');

      console.log('🎉 All simple tests passed!');
    } catch (error) {
      console.error('❌ Simple test failed:', error);
      process.exit(1);
    } finally {
      // Proper async lifecycle management now handles pending operations
      await this.memoryStore.close();
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const testRunner = new SimpleThoughtAnalysisTest();
  await testRunner.runTest();
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

export { SimpleThoughtAnalysisTest };
