#!/usr/bin/env node
/**
 * @fileoverview Simple test for prompt integration system
 * 
 * Demonstrates the working prompt integration without complex test framework dependencies
 */

import { PostgreSQLMemoryStore } from '../src/memory/postgresql-memory-store.js';
import { StoredPrompt, MemoryUtils } from '../src/memory/memory-store.js';
import { PromptIntelligenceSystem } from '../src/cognitive/prompt-intelligence.js';

async function runSimpleTest() {
  console.log('🚀 SIMPLE PROMPT INTEGRATION TEST\n');
  
  let memoryStore: PostgreSQLMemoryStore | null = null;
  let success = true;
  
  try {
    // Initialize components
    console.log('🔧 Initializing components...');
    memoryStore = new PostgreSQLMemoryStore();
    await memoryStore.initialize();
    const promptIntelligence = new PromptIntelligenceSystem();
    console.log('✅ Components initialized\n');
    
    // Test 1: Prompt Analysis
    console.log('🧪 TEST 1: Prompt Analysis');
    const testPrompt = "Fix the TypeError: Cannot read property 'length' of undefined in my React component";
    console.log(`📝 Analyzing: "${testPrompt}"\n`);
    
    const analysis = await promptIntelligence.analyzePrompt(testPrompt);
    
    console.log('📊 Results:');
    console.log(`   Classification: ${analysis.classification.type}`);
    console.log(`   Confidence: ${Math.round(analysis.classification.confidence * 100)}%`);
    console.log(`   Complexity: ${analysis.complexity.complexity}/10`);
    console.log(`   Intent Objectives: ${analysis.intent.objectives.length}`);
    console.log(`   Intent Constraints: ${analysis.intent.constraints.length}`);
    
    // Verify results
    if (analysis.classification.type !== 'debugging') {
      console.log(`❌ Expected 'debugging', got '${analysis.classification.type}'`);
      success = false;
    } else {
      console.log('✅ Classification correct');
    }
    
    if (analysis.classification.confidence < 0.5) {
      console.log(`❌ Low confidence: ${analysis.classification.confidence}`);
      success = false;
    } else {
      console.log('✅ Good confidence level');
    }
    
    console.log('');
    
    // Test 2: Storage and Retrieval
    console.log('🧪 TEST 2: Storage and Retrieval');
    const promptId = MemoryUtils.generateSessionId();
    const sessionId = MemoryUtils.generateSessionId();
    
    // Store session first
    await memoryStore.storeSession({
      id: sessionId,
      start_time: new Date(),
      objective: 'Test session',
      goal_achieved: false,
      confidence_level: 0.5,
      total_thoughts: 0,
      revision_count: 0,
      branch_count: 0
    });
    
    // Store prompt
    const storedPrompt: StoredPrompt = {
      id: promptId,
      session_id: sessionId,
      original_prompt: testPrompt,
      prompt_type: analysis.classification.type,
      complexity_estimate: analysis.complexity.complexity,
      classification_confidence: analysis.classification.confidence,
      received_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    };
    
    await memoryStore.storePrompt(storedPrompt);
    console.log('✅ Prompt stored');
    
    // Retrieve and verify
    const retrieved = await memoryStore.getPrompt(promptId);
    if (!retrieved) {
      console.log('❌ Failed to retrieve prompt');
      success = false;
    } else if (retrieved.original_prompt !== testPrompt) {
      console.log('❌ Retrieved prompt mismatch');
      success = false;
    } else {
      console.log('✅ Prompt retrieved successfully');
    }
    
    console.log('');
    
    // Test 3: Querying
    console.log('🧪 TEST 3: Querying');
    const debuggingPrompts = await memoryStore.queryPrompts({
      prompt_type: 'debugging',
      limit: 10
    });
    
    console.log(`✅ Found ${debuggingPrompts.length} debugging prompts`);
    
    if (debuggingPrompts.length === 0) {
      console.log('❌ No debugging prompts found');
      success = false;
    }
    
    // Verify all retrieved prompts are debugging type
    let allCorrectType = true;
    for (const prompt of debuggingPrompts) {
      if (prompt.prompt_type !== 'debugging') {
        allCorrectType = false;
        break;
      }
    }
    
    if (!allCorrectType) {
      console.log('❌ Query returned incorrect prompt types');
      success = false;
    } else {
      console.log('✅ All retrieved prompts have correct type');
    }
    
    console.log('');
    
    // Test 4: Similarity Detection
    console.log('🧪 TEST 4: Similarity Detection');
    const queryPrompt = "Debug memory issues in JavaScript application";
    const allPrompts = await memoryStore.queryPrompts({ limit: 100 });
    const similarPrompts = await promptIntelligence.findSimilarPrompts(queryPrompt, allPrompts, 5);
    
    console.log(`✅ Found ${similarPrompts.length} similar prompts`);
    
    for (const similar of similarPrompts.slice(0, 3)) {
      console.log(`   - Score: ${similar.similarity_score.toFixed(3)} (${similar.similarity_type})`);
    }
    
    console.log('');
    
    // Final Results
    console.log('═══════════════════════════════════════');
    if (success) {
      console.log('🎉 ALL TESTS PASSED!');
      console.log('✨ Prompt integration system is working correctly');
    } else {
      console.log('❌ SOME TESTS FAILED');
      console.log('⚠️ Please check the implementation');
    }
    console.log('═══════════════════════════════════════');
    
  } catch (error) {
    console.error('💥 Test failed with error:', error);
    success = false;
  } finally {
    if (memoryStore) {
      await memoryStore.close();
      console.log('🧹 Cleanup complete');
    }
  }
  
  process.exit(success ? 0 : 1);
}

// Run the test
runSimpleTest().catch(error => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});