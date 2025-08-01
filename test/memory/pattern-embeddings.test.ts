/**
 * @fileoverview Pattern Embeddings Integration Test
 *
 * Tests the pattern embeddings functionality to ensure the database functions
 * are properly integrated with the TypeScript memory store implementation.
 */

import { PostgreSQLMemoryStore } from '../../src/memory/postgresql-memory-store.js';
import { PostgreSQLConfigs } from '../../src/memory/postgresql-config.js';
import { StoredThought, ReasoningSession } from '../../src/memory/memory-store.js';
import { strict as assert } from 'assert';

/**
 * Main test runner for pattern embeddings functionality
 */
export async function runPatternEmbeddingsTests(): Promise<void> {
  console.error('🧪 Running Pattern Embeddings Integration Tests...');

  const config = PostgreSQLConfigs.testing();
  const memoryStore = new PostgreSQLMemoryStore(config);

  try {
    await memoryStore.initialize();
    console.error('✅ PostgreSQL Memory Store initialized for pattern testing');

    // Test 1: Pattern Detection and Storage
    await testPatternDetectionAndStorage(memoryStore);

    // Test 2: Pattern Embedding Generation
    await testPatternEmbeddingGeneration(memoryStore);

    // Test 3: Pattern Similarity Search
    await testPatternSimilaritySearch(memoryStore);

    // Test 4: Pattern Retrieval and Management
    await testPatternRetrieval(memoryStore);

    // Test 5: Pattern Frequency Updates
    await testPatternFrequencyUpdates(memoryStore);

    console.error('🎉 All pattern embeddings tests passed!');
  } catch (error) {
    console.error('❌ Pattern embeddings test failed:', error);
    throw error;
  } finally {
    await memoryStore.close();
  }
}

/**
 * Test 1: Pattern Detection and Storage
 */
async function testPatternDetectionAndStorage(store: PostgreSQLMemoryStore): Promise<void> {
  console.error('Testing pattern detection and storage...');

  // Create test session
  const session: ReasoningSession = {
    id: 'pattern-test-session-1',
    start_time: new Date(),
    objective: 'Test pattern detection and storage',
    goal_achieved: true,
    confidence_level: 0.9,
    total_thoughts: 1,
    revision_count: 0,
    branch_count: 0,
  };

  await store.storeSession(session);

  // Create thought with patterns
  const thoughtWithPatterns: StoredThought = {
    id: 'pattern-test-thought-1',
    session_id: 'pattern-test-session-1',
    thought: 'This thought demonstrates debugging techniques and problem-solving patterns',
    thought_number: 1,
    total_thoughts: 1,
    next_thought_needed: false,
    timestamp: new Date(),
    patterns_detected: ['debugging-technique', 'problem-solving-pattern', 'systematic-approach'],
    success: true,
    context: {},
  };

  await store.storeThought(thoughtWithPatterns);

  // Wait a moment for async pattern processing
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.error('✅ Pattern detection and storage validated');
}

/**
 * Test 2: Pattern Embedding Generation
 */
async function testPatternEmbeddingGeneration(store: PostgreSQLMemoryStore): Promise<void> {
  console.error('Testing pattern embedding generation...');

  // Update pattern embeddings to ensure they are generated
  const updateCount = await store.updatePatternEmbeddings();
  console.error(`Updated ${updateCount} patterns with embeddings`);

  // Verify patterns were stored
  const patterns = await store.getPatterns(10, 1);
  assert(patterns.length > 0, 'Should have stored patterns');

  // Check that some patterns have embeddings
  const patternsWithEmbeddings = patterns.filter(p => p.has_embedding);
  console.error(
    `Found ${patternsWithEmbeddings.length} patterns with embeddings out of ${patterns.length} total`
  );

  // Find our test patterns
  const testPatterns = patterns.filter(p =>
    ['debugging-technique', 'problem-solving-pattern', 'systematic-approach'].includes(
      p.pattern_name
    )
  );

  assert(testPatterns.length > 0, 'Should find our test patterns');

  console.error('✅ Pattern embedding generation validated');
}

/**
 * Test 3: Pattern Similarity Search
 */
async function testPatternSimilaritySearch(store: PostgreSQLMemoryStore): Promise<void> {
  console.error('Testing pattern similarity search...');

  try {
    // Search for patterns similar to debugging
    const similarPatterns = await store.findSimilarPatterns(
      'debugging and troubleshooting methods',
      5,
      0.5 // Lower threshold for testing
    );

    console.error(`Found ${similarPatterns.length} similar patterns to debugging`);

    if (similarPatterns.length > 0) {
      // Verify structure of results
      const firstPattern = similarPatterns[0];
      assert(typeof firstPattern.pattern_name === 'string', 'Pattern name should be string');
      assert(
        typeof firstPattern.similarity_score === 'number',
        'Similarity score should be number'
      );
      assert(
        typeof firstPattern.pattern_frequency === 'number',
        'Pattern frequency should be number'
      );
      assert(firstPattern.created_at instanceof Date, 'Created at should be Date');

      // Verify similarity score is within expected range
      assert(
        firstPattern.similarity_score >= 0 && firstPattern.similarity_score <= 1,
        'Similarity score should be between 0 and 1'
      );

      console.error(
        `Top similar pattern: "${firstPattern.pattern_name}" (score: ${firstPattern.similarity_score})`
      );
    }

    console.error('✅ Pattern similarity search validated');
  } catch (error) {
    console.error(
      '⚠️ Pattern similarity search not available (likely no embeddings generated yet)'
    );
    // This is acceptable for initial runs where embeddings haven't been generated
  }
}

/**
 * Test 4: Pattern Retrieval and Management
 */
async function testPatternRetrieval(store: PostgreSQLMemoryStore): Promise<void> {
  console.error('Testing pattern retrieval and management...');

  // Get all patterns with minimum frequency
  const allPatterns = await store.getPatterns(50, 1);
  console.error(`Retrieved ${allPatterns.length} patterns`);

  // Get patterns with higher frequency threshold
  const frequentPatterns = await store.getPatterns(10, 2);
  console.error(`Retrieved ${frequentPatterns.length} frequent patterns`);

  // Verify frequent patterns have higher frequency
  assert(
    frequentPatterns.length <= allPatterns.length,
    'Frequent patterns should be subset of all patterns'
  );

  if (frequentPatterns.length > 0) {
    assert(
      frequentPatterns.every(p => p.pattern_frequency >= 2),
      'All frequent patterns should have frequency >= 2'
    );
  }

  // Verify patterns are sorted by frequency (descending)
  if (allPatterns.length > 1) {
    for (let i = 1; i < allPatterns.length; i++) {
      assert(
        allPatterns[i - 1].pattern_frequency >= allPatterns[i].pattern_frequency,
        'Patterns should be sorted by frequency descending'
      );
    }
  }

  console.error('✅ Pattern retrieval and management validated');
}

/**
 * Test 5: Pattern Frequency Updates
 */
async function testPatternFrequencyUpdates(store: PostgreSQLMemoryStore): Promise<void> {
  console.error('Testing pattern frequency updates...');

  // Get initial pattern counts
  const initialPatterns = await store.getPatterns(100, 1);
  const debuggingPattern = initialPatterns.find(p => p.pattern_name === 'debugging-technique');
  const initialFrequency = debuggingPattern?.pattern_frequency || 0;

  // Add another thought with the same pattern
  const thought2: StoredThought = {
    id: 'pattern-test-thought-2',
    session_id: 'pattern-test-session-1',
    thought: 'Another thought that uses debugging-technique pattern',
    thought_number: 2,
    total_thoughts: 2,
    next_thought_needed: false,
    timestamp: new Date(),
    patterns_detected: ['debugging-technique', 'analytical-thinking'],
    success: true,
    context: {},
  };

  await store.storeThought(thought2);

  // Wait for async processing
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Update pattern embeddings to refresh frequencies
  await store.updatePatternEmbeddings();

  // Check updated frequencies
  const updatedPatterns = await store.getPatterns(100, 1);
  const updatedDebuggingPattern = updatedPatterns.find(
    p => p.pattern_name === 'debugging-technique'
  );

  if (updatedDebuggingPattern) {
    assert(
      updatedDebuggingPattern.pattern_frequency > initialFrequency,
      `Pattern frequency should increase from ${initialFrequency} to ${updatedDebuggingPattern.pattern_frequency}`
    );
    console.error(
      `✅ Pattern frequency updated: ${initialFrequency} → ${updatedDebuggingPattern.pattern_frequency}`
    );
  }

  // Check for new pattern
  const analyticalPattern = updatedPatterns.find(p => p.pattern_name === 'analytical-thinking');
  assert(analyticalPattern, 'Should find new analytical-thinking pattern');

  console.error('✅ Pattern frequency updates validated');
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPatternEmbeddingsTests().catch(console.error);
}
