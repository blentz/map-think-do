#!/usr/bin/env node

/**
 * Test script for AI analysis integration
 */

import { PostgreSQLMemoryStore } from '../dist/src/memory/postgresql-memory-store.js';

async function testAIAnalysis() {
  console.error('🧪 Testing AI Analysis Integration...\n');

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
      logQueries: false
    });
    
    await memoryStore.initialize();
    console.error('✅ Memory store initialized\n');

    // Test 1: Analyze existing prompts
    console.error('🔄 Test 1: Analyzing existing prompts...');
    await memoryStore.analyzeExistingPrompts(10); // Analyze up to 10 prompts
    console.error('✅ Existing prompts analyzed\n');

    // Test 2: Store a new prompt with AI analysis
    console.error('🔄 Test 2: Storing new prompt with AI analysis...');
    
    // First create a session
    const testSession = {
      id: 'test_session_ai_' + Date.now(),
      start_time: new Date(),
      objective: 'Test AI analysis integration',
      domain: 'testing',
      goal_achieved: false,
      confidence_level: 0.8,
      effectiveness_score: 0.7,
      total_thoughts: 0,
      revision_count: 0,
      branch_count: 0,
      cognitive_roles_used: ['Engineer'],
      metacognitive_interventions: 0,
      lessons_learned: [],
      successful_strategies: [],
      failed_approaches: [],
      tags: ['test', 'ai-analysis'],
      created_at: new Date(),
      updated_at: new Date()
    };
    
    await memoryStore.storeSession(testSession);
    console.error('✅ Test session created');
    
    const testPrompt = {
      id: 'test_ai_analysis_' + Date.now(),
      session_id: testSession.id,
      original_prompt: 'Help me debug a performance issue in my React application. The components are rendering too slowly and I need to optimize the rendering performance.',
      received_at: new Date(),
      domain: 'testing',
      created_at: new Date(),
      updated_at: new Date()
    };
    
    await memoryStore.storePrompt(testPrompt);
    console.error('✅ New prompt stored with AI analysis\n');

    // Test 3: Check results
    console.error('🔍 Test 3: Checking analysis results...');
    const analyzedPrompts = await memoryStore.queryPrompts({ limit: 5 });
    
    let analyzedCount = 0;
    for (const prompt of analyzedPrompts) {
      if (prompt.prompt_type && prompt.classification_confidence && prompt.extracted_intent) {
        analyzedCount++;
        console.error(`✅ Prompt ${prompt.id}:`);
        console.error(`   Type: ${prompt.prompt_type} (${(prompt.classification_confidence * 100).toFixed(1)}%)`);
        console.error(`   Objectives: ${prompt.extracted_intent.objectives?.length || 0}`);
        console.error(`   Similar prompts: ${prompt.similar_prompts?.length || 0}`);
        console.error(`   Tags: ${prompt.tags?.join(', ') || 'none'}`);
      }
    }
    
    console.error(`\n📊 Analysis Summary:`);
    console.error(`   Analyzed prompts: ${analyzedCount}/${analyzedPrompts.length}`);
    console.error(`   Success rate: ${(analyzedCount / analyzedPrompts.length * 100).toFixed(1)}%`);
    
    console.error('\n🎉 AI Analysis integration test completed successfully!');
    
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
testAIAnalysis().catch(error => {
  console.error('💥 Test script failed:', error);
  process.exit(1);
});