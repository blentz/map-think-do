#!/usr/bin/env node

/**
 * Test script for embedding generation system
 * Tests the integration between embedding service and PostgreSQL storage
 */

import { PostgreSQLMemoryStore } from '../dist/src/memory/postgresql-memory-store.js';

async function testEmbeddingGeneration() {
  console.error('🧪 Testing Embedding Generation System...\n');

  let memoryStore;

  try {
    // Initialize PostgreSQL memory store with explicit configuration
    console.error('📦 Initializing PostgreSQL memory store...');
    memoryStore = new PostgreSQLMemoryStore({
      // Connection settings
      host: 'localhost',
      port: 5432,
      database: 'map_think_do',
      user: 'mtd_user',
      password: 'p4ssw0rd',

      // Pool configuration
      max: 10,
      min: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,

      // Advanced settings
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      ssl: false,

      // Feature flags
      enableTimeSeries: true,
      enableVectorSearch: true,
      enableGraphQueries: false,

      // Performance settings
      statementTimeout: 60000,
      queryTimeout: 30000,
      lockTimeout: 5000,

      // Development settings
      debug: false,
      logQueries: false,
    });

    await memoryStore.initialize();
    console.error('✅ Memory store initialized\n');

    // Test 1: Store a test session
    console.error('📝 Creating test session...');
    const testSessionId = 'embedding_test_session_' + Date.now();
    const testSession = {
      id: testSessionId,
      start_time: new Date(),
      objective: 'Test embedding generation and storage system',
      domain: 'testing',
      goal_achieved: false,
      confidence_level: 0.8,
      effectiveness_score: 0.7,
      total_thoughts: 0,
      revision_count: 0,
      branch_count: 0,
      cognitive_roles_used: ['Engineer', 'Analyst'],
      metacognitive_interventions: 0,
      lessons_learned: ['Testing is important'],
      successful_strategies: ['Systematic approach'],
      failed_approaches: [],
      tags: ['test', 'embedding'],
      created_at: new Date(),
      updated_at: new Date(),
    };

    await memoryStore.storeSession(testSession);
    console.error('✅ Test session created\n');

    // Test 2: Store a test prompt (should trigger embedding generation)
    console.error('🎯 Storing test prompt (this should generate embeddings)...');
    const testPromptId = 'embedding_test_prompt_' + Date.now();
    const testPrompt = {
      id: testPromptId,
      session_id: testSessionId,
      original_prompt:
        'How can I optimize the performance of my machine learning model for text classification? I need to improve accuracy and reduce training time.',
      prompt_type: 'optimization',
      prompt_source: 'mcp-tool',
      received_at: new Date(),
      domain: 'machine-learning',
      complexity_estimate: 7.5,
      estimated_cognitive_load: 0.8,
      classification_confidence: 0.85,
      prompt_context: {
        user_context: 'ML performance optimization',
        tools_available: ['tensorflow', 'pytorch'],
        cognitive_load: 0.8,
      },
      extracted_intent: {
        objectives: ['optimize model performance', 'improve accuracy', 'reduce training time'],
        constraints: ['computational resources'],
        context: 'machine learning optimization',
      },
      similar_prompts: [],
      tags: ['ml', 'optimization', 'performance'],
      reasoning_improvement: 0.1,
      persona_selected: 'Engineer',
      cognitive_priming_effectiveness: 0.7,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await memoryStore.storePrompt(testPrompt);
    console.error('✅ Test prompt stored (embedding should be generating asynchronously)\n');

    // Test 3: Store a test thought (should trigger embedding generation)
    console.error('💭 Storing test thought (this should generate embeddings)...');
    const testThoughtId = 'embedding_test_thought_' + Date.now();
    const testThought = {
      id: testThoughtId,
      session_id: testSessionId,
      prompt_id: testPromptId,
      thought:
        'To optimize machine learning model performance, I should consider: 1) Feature engineering to improve data quality, 2) Hyperparameter tuning using grid search or Bayesian optimization, 3) Model architecture optimization, 4) Data augmentation techniques, and 5) Distributed training for large datasets.',
      thought_number: 1,
      total_thoughts: 3,
      next_thought_needed: true,
      is_revision: false,
      timestamp: new Date(),
      confidence: 0.85,
      domain: 'machine-learning',
      objective: 'Provide ML optimization strategies',
      complexity: 7.2,
      success: true,
      effectiveness_score: 0.8,
      context: {
        cognitive_load: 0.7,
        reasoning_depth: 'systematic',
        approach: 'structured-analysis',
      },
      tags: ['optimization', 'ml', 'systematic'],
      patterns_detected: ['structured-analysis', 'multi-factor-consideration'],
      similar_thoughts: [],
      output: 'Comprehensive optimization strategy',
      context_trace: ['analysis', 'categorization', 'prioritization'],
      created_at: new Date(),
      updated_at: new Date(),
    };

    await memoryStore.storeThought(testThought);
    console.error('✅ Test thought stored (embedding should be generating asynchronously)\n');

    // Test 4: Wait a bit for async embedding generation to complete
    console.error('⏳ Waiting 10 seconds for embedding generation to complete...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Test 5: Check if embeddings were created in database
    console.error('🔍 Checking database for generated embeddings...');

    try {
      const embeddingCheck = await memoryStore.query(
        'SELECT thought_id, embedding_model, created_at FROM thought_embeddings WHERE thought_id IN ($1, $2) ORDER BY created_at DESC',
        [testPrompt.id, testThought.id]
      );

      if (embeddingCheck.rows.length > 0) {
        console.error(`✅ Found ${embeddingCheck.rows.length} embeddings in database:`);
        embeddingCheck.rows.forEach(row => {
          console.error(
            `   - ${row.thought_id} (${row.embedding_model}) created at ${row.created_at}`
          );
        });
      } else {
        console.error('❌ No embeddings found in database');
      }

      console.error('');

      // Test 6: Test semantic search if embeddings exist
      if (embeddingCheck.rows.length > 0) {
        console.error('🔎 Testing semantic search functionality...');

        // Get an embedding for similarity search
        const firstEmbedding = await memoryStore.query(
          'SELECT embedding FROM thought_embeddings WHERE thought_id = $1',
          [testThought.id]
        );

        if (firstEmbedding.rows.length > 0) {
          const embeddingVector = firstEmbedding.rows[0].embedding;

          // Test semantic similarity search
          const similarThoughts = await memoryStore.findSimilarThoughtsSemantic(
            embeddingVector,
            0.1,
            5,
            testSessionId
          );

          console.error(`✅ Semantic search returned ${similarThoughts.length} similar thoughts`);
          similarThoughts.forEach(thought => {
            console.error(
              `   - Similarity: ${thought.similarity_score?.toFixed(3)} | ${thought.thought_text?.substring(0, 100)}...`
            );
          });
        }
      }
    } catch (error) {
      console.error('❌ Error checking embeddings:', error.message);
    }

    console.error('\n🎉 Embedding system test completed!');
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
testEmbeddingGeneration().catch(error => {
  console.error('💥 Test script failed:', error);
  process.exit(1);
});
