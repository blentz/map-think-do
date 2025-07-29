#!/usr/bin/env node

/**
 * @fileoverview PostgreSQL Memory Store Acceptance Tests Runner
 *
 * This script runs acceptance tests for the PostgreSQL memory store implementation
 * to validate that it meets all requirements for cognitive workloads.
 */

import { PostgreSQLMemoryStore } from '../../src/memory/postgresql-memory-store.js';
import { PostgreSQLConfigs } from '../../src/memory/postgresql-config.js';
import { StoredThought, ReasoningSession, MemoryUtils } from '../../src/memory/memory-store.js';

/**
 * Simple acceptance test runner
 */
class AcceptanceTestRunner {
  private postgresStore: PostgreSQLMemoryStore;

  constructor() {
    this.postgresStore = new PostgreSQLMemoryStore(PostgreSQLConfigs.fromEnvironment());
  }

  /**
   * Run all acceptance tests
   */
  async runTests(): Promise<void> {
    console.log('🧪 Starting PostgreSQL Memory Store Acceptance Tests...');

    try {
      // Initialize the store
      await this.postgresStore.initialize();
      console.log('✅ PostgreSQL Memory Store initialized');

      // Test basic operations
      await this.testBasicOperations();

      // Test query functionality
      await this.testQueryFunctionality();

      // Test data integrity
      await this.testDataIntegrity();

      console.log('🎉 All acceptance tests passed!');
    } catch (error) {
      console.error('❌ Acceptance tests failed:', error);
      process.exit(1);
    } finally {
      await this.postgresStore.close();
    }
  }

  /**
   * Test basic CRUD operations
   */
  private async testBasicOperations(): Promise<void> {
    console.log('📝 Testing basic operations...');

    // Create test session
    const session: ReasoningSession = {
      id: MemoryUtils.generateSessionId(),
      start_time: new Date(),
      objective: 'Test basic operations',
      domain: 'testing',
      goal_achieved: false,
      confidence_level: 0.8,
      total_thoughts: 1,
      revision_count: 0,
      branch_count: 0,
    };

    await this.postgresStore.storeSession(session);

    // Create test thought
    const thought: StoredThought = {
      id: MemoryUtils.generateThoughtId(),
      session_id: session.id,
      thought: 'This is a test thought to verify basic operations work correctly.',
      thought_number: 1,
      total_thoughts: 1,
      next_thought_needed: false,
      timestamp: new Date(),
      confidence: 0.85,
      domain: 'testing',
      context: {
        problem_type: 'acceptance_test',
        cognitive_load: 0.5,
      },
      tags: ['test', 'acceptance', 'basic'],
    };

    await this.postgresStore.storeThought(thought);

    // Verify we can retrieve them
    const retrievedSession = await this.postgresStore.getSession(session.id);
    const retrievedThought = await this.postgresStore.getThought(thought.id);

    if (!retrievedSession || !retrievedThought) {
      throw new Error('Failed to retrieve stored data');
    }

    console.log('✅ Basic operations test passed');
  }

  /**
   * Test query functionality
   */
  private async testQueryFunctionality(): Promise<void> {
    console.log('🔍 Testing query functionality...');

    // Query by domain
    const domainResults = await this.postgresStore.queryThoughts({ domain: 'testing' });
    if (domainResults.length === 0) {
      throw new Error('Domain query returned no results');
    }

    // Query with confidence range
    const confidenceResults = await this.postgresStore.queryThoughts({
      confidence_range: [0.8, 1.0],
    });
    if (confidenceResults.length === 0) {
      throw new Error('Confidence range query returned no results');
    }

    console.log('✅ Query functionality test passed');
  }

  /**
   * Test data integrity
   */
  private async testDataIntegrity(): Promise<void> {
    console.log('🔒 Testing data integrity...');

    const stats = await this.postgresStore.getStats();
    if (stats.total_thoughts === 0 || stats.total_sessions === 0) {
      throw new Error('Data integrity check failed - no data found');
    }

    console.log('✅ Data integrity test passed');
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new AcceptanceTestRunner();
  runner.runTests().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

export { AcceptanceTestRunner };
