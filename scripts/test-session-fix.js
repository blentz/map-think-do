#!/usr/bin/env node

/**
 * Test script to verify the session foreign key constraint fix
 */

import { PostgreSQLMemoryStore } from '../dist/src/memory/postgresql-memory-store.js';

async function testSessionFix() {
  console.error('🧪 Testing Session Foreign Key Constraint Fix...\n');

  let memoryStore;

  try {
    // Initialize PostgreSQL memory store
    console.error('📦 Initializing PostgreSQL memory store...');
    memoryStore = new PostgreSQLMemoryStore({
      host: 'localhost',
      port: 5432,
      database: 'map_think_do',
      user: 'mtd_user',
      password: 'p4ssw0rd',
      max: 5,
      min: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      ssl: false,
      enableTimeSeries: true,
      enableVectorSearch: true,
      enableGraphQueries: false,
      statementTimeout: 60000,
      queryTimeout: 30000,
      lockTimeout: 5000,
      debug: false,
      logQueries: false,
    });

    await memoryStore.initialize();
    console.error('✅ Memory store initialized\n');

    // Test: Create a session first
    const testSessionId = 'test_session_' + Date.now();
    const testSession = {
      id: testSessionId,
      start_time: new Date(),
      objective: 'Test foreign key constraint fix',
      domain: 'testing',
      goal_achieved: false,
      confidence_level: 0.8,
      effectiveness_score: 0.7,
      total_thoughts: 1,
      revision_count: 0,
      branch_count: 0,
      cognitive_roles_used: ['Engineer'],
      metacognitive_interventions: 0,
      lessons_learned: ['Foreign key constraints must be satisfied'],
      successful_strategies: ['Store session before thoughts'],
      failed_approaches: [],
      tags: ['test', 'foreign-key'],
      created_at: new Date(),
      updated_at: new Date(),
    };

    console.error('📝 Storing test session...');
    await memoryStore.storeSession(testSession);
    console.error('✅ Session stored successfully\n');

    // Test: Now store a thought that references this session
    const testThoughtId = 'test_thought_' + Date.now();
    const testThought = {
      id: testThoughtId,
      session_id: testSessionId, // This should now work without foreign key error
      thought:
        'This thought should successfully reference the existing session without causing a foreign key constraint violation.',
      thought_number: 1,
      total_thoughts: 1,
      next_thought_needed: false,
      is_revision: false,
      timestamp: new Date(),
      confidence: 0.9,
      domain: 'testing',
      objective: 'Test foreign key fix',
      complexity: 5.0,
      success: true,
      effectiveness_score: 0.9,
      context: {
        test_context: 'foreign key constraint fix',
      },
      tags: ['test', 'foreign-key-fix'],
      patterns_detected: ['constraint-validation'],
      similar_thoughts: [],
      output: 'Foreign key constraint test',
      context_trace: ['session-first', 'thought-second'],
      created_at: new Date(),
      updated_at: new Date(),
    };

    console.error('💭 Storing test thought (referencing existing session)...');
    await memoryStore.storeThought(testThought);
    console.error('✅ Thought stored successfully without foreign key error!\n');

    // Verify both records exist
    console.error('🔍 Verifying stored records...');
    const storedSession = await memoryStore.getSession(testSessionId);
    if (storedSession) {
      console.error(`✅ Session found: ${storedSession.id} - "${storedSession.objective}"`);
    } else {
      console.error('❌ Session not found');
    }

    const storedThoughts = await memoryStore.queryThoughts({ session_id: testSessionId });
    if (storedThoughts.length > 0) {
      console.error(`✅ Found ${storedThoughts.length} thought(s) for session ${testSessionId}`);
      storedThoughts.forEach(thought => {
        console.error(`   - ${thought.id}: "${thought.thought.substring(0, 50)}..."`);
      });
    } else {
      console.error('❌ No thoughts found for session');
    }

    console.error('\n🎉 Foreign key constraint fix test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    if (memoryStore) {
      await memoryStore.close();
      console.error('📤 Memory store connection closed');
    }
  }
}

// Run the test
testSessionFix().catch(error => {
  console.error('💥 Test script failed:', error);
  process.exit(1);
});
