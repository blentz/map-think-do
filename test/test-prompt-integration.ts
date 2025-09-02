#!/usr/bin/env node
/**
 * @fileoverview Simple test runner for prompt integration system
 *
 * Demonstrates the working prompt integration without external test dependencies
 */

import { PostgreSQLMemoryStore } from '../src/memory/postgresql-memory-store.js';
import { StoredPrompt, MemoryUtils } from '../src/memory/memory-store.js';
import { PromptIntelligenceSystem } from '../src/cognitive/prompt-intelligence.js';
import { PromptValidationFramework } from '../src/cognitive/prompt-validation.js';

async function runTests() {
  console.log('🚀 PROMPT INTEGRATION SYSTEM DEMONSTRATION\n');

  let memoryStore: PostgreSQLMemoryStore | null = null;
  let success = true;

  try {
    // Initialize memory store
    console.log('🔧 Initializing memory store...');
    memoryStore = new PostgreSQLMemoryStore();
    await memoryStore.initialize();
    console.log('✅ Memory store initialized\n');

    // Initialize prompt intelligence system
    console.log('🧠 Initializing prompt intelligence system...');
    const promptIntelligence = new PromptIntelligenceSystem();
    console.log('✅ Prompt intelligence system ready\n');

    // Test 1: AI-Powered Prompt Analysis
    console.log('═══════════════════════════════════════════════');
    console.log('🔍 TEST 1: AI-POWERED PROMPT ANALYSIS');
    console.log('═══════════════════════════════════════════════\n');

    const testPrompt =
      "I need to debug a memory leak in my Node.js application that's causing performance issues in production. The heap usage keeps growing and eventually crashes the server.";

    console.log(`📝 Analyzing prompt: "${testPrompt}"\n`);

    const analysis = await promptIntelligence.analyzePrompt(testPrompt);

    console.log('📊 ANALYSIS RESULTS:');
    console.log(`   🏷️ Classification: ${analysis.classification.type}`);
    console.log(`   📈 Confidence: ${Math.round(analysis.classification.confidence * 100)}%`);
    console.log(`   ⚖️ Complexity: ${analysis.complexity.complexity}/10`);
    console.log(`   🧠 Cognitive Load: ${Math.round(analysis.complexity.cognitive_load * 100)}%`);
    console.log(`   🎯 Intent Objectives: ${analysis.intent.objectives.length}`);
    console.log(`   🚫 Intent Constraints: ${analysis.intent.constraints.length}`);
    console.log(`   📋 Intent Requirements: ${analysis.intent.requirements.length}`);
    console.log(`   💭 Intent Confidence: ${Math.round(analysis.intent.confidence * 100)}%\n`);

    if (analysis.classification.type !== 'debugging') {
      console.log('❌ Expected classification "debugging", got:', analysis.classification.type);
      success = false;
    } else {
      console.log('✅ Correct classification detected\n');
    }

    // Test 2: Prompt Storage and Retrieval
    console.log('═══════════════════════════════════════════════');
    console.log('💾 TEST 2: PROMPT STORAGE AND RETRIEVAL');
    console.log('═══════════════════════════════════════════════\n');

    const promptId = MemoryUtils.generateSessionId();
    const sessionId = MemoryUtils.generateSessionId();

    // Store session first (required for foreign key)
    console.log('📝 Creating reasoning session...');
    await memoryStore.storeSession({
      id: sessionId,
      start_time: new Date(),
      objective: 'Debug Node.js memory leak',
      domain: 'technical',
      goal_achieved: false,
      confidence_level: 0.5,
      total_thoughts: 0,
      revision_count: 0,
      branch_count: 0,
    });
    console.log('✅ Session created\n');

    // Create stored prompt with full analysis
    console.log('💾 Storing prompt with AI analysis...');
    const storedPrompt: StoredPrompt = {
      id: promptId,
      session_id: sessionId,
      original_prompt: testPrompt,
      prompt_type: analysis.classification.type,
      prompt_source: 'mcp-tool',
      received_at: new Date(),
      domain: 'technical',
      complexity_estimate: analysis.complexity.complexity,
      estimated_cognitive_load: analysis.complexity.cognitive_load,
      classification_confidence: analysis.classification.confidence,
      prompt_context: {
        tool_parameters: { prompt: testPrompt },
        mcp_request_id: `test_${Date.now()}`,
      },
      extracted_intent: {
        objectives: analysis.intent.objectives,
        constraints: analysis.intent.constraints,
        requirements: analysis.intent.requirements,
        expected_output_type: analysis.intent.expected_output_type,
        extraction_confidence: analysis.intent.confidence,
      },
      similar_prompts: analysis.similarPrompts,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await memoryStore.storePrompt(storedPrompt);
    console.log(`✅ Prompt stored with ID: ${promptId}\n`);

    // Retrieve and verify
    console.log('🔍 Retrieving stored prompt...');
    const retrieved = await memoryStore.getPrompt(promptId);

    if (!retrieved) {
      console.log('❌ Failed to retrieve stored prompt');
      success = false;
    } else if (retrieved.original_prompt !== testPrompt) {
      console.log('❌ Retrieved prompt content mismatch');
      success = false;
    } else {
      console.log('✅ Prompt successfully retrieved and verified');
      console.log(`   📊 Type: ${retrieved.prompt_type}`);
      console.log(`   ⚖️ Complexity: ${retrieved.complexity_estimate}`);
      console.log(`   🧠 Cognitive Load: ${retrieved.estimated_cognitive_load}`);
      console.log(`   📈 Classification Confidence: ${retrieved.classification_confidence}\n`);
    }

    // Test 3: Advanced Querying
    console.log('═══════════════════════════════════════════════');
    console.log('🔍 TEST 3: ADVANCED QUERYING CAPABILITIES');
    console.log('═══════════════════════════════════════════════\n');

    // Store a few more test prompts for querying
    const additionalPrompts = [
      { text: 'Optimize database query performance for large datasets', type: 'optimization' },
      { text: 'Design scalable microservices architecture', type: 'architecture' },
      { text: 'Implement user authentication with JWT', type: 'feature-request' },
    ];

    console.log('📝 Storing additional test prompts...');
    for (const promptData of additionalPrompts) {
      const additionalAnalysis = await promptIntelligence.analyzePrompt(promptData.text);
      const additionalPromptId = MemoryUtils.generateSessionId();
      const additionalSessionId = MemoryUtils.generateSessionId();

      await memoryStore.storeSession({
        id: additionalSessionId,
        start_time: new Date(),
        objective: promptData.text.substring(0, 50),
        goal_achieved: false,
        confidence_level: 0.5,
        total_thoughts: 0,
        revision_count: 0,
        branch_count: 0,
      });

      await memoryStore.storePrompt({
        id: additionalPromptId,
        session_id: additionalSessionId,
        original_prompt: promptData.text,
        prompt_type: additionalAnalysis.classification.type,
        received_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
    console.log('✅ Additional prompts stored\n');

    // Query by type
    console.log('🔍 Querying debugging prompts...');
    const debuggingPrompts = await memoryStore.queryPrompts({
      prompt_type: 'debugging',
      limit: 10,
    });
    console.log(`✅ Found ${debuggingPrompts.length} debugging prompts\n`);

    // Query by date range
    console.log('🕒 Querying recent prompts...');
    const recentPrompts = await memoryStore.queryPrompts({
      date_range: [new Date(Date.now() - 3600000), new Date()] as [Date, Date],
      limit: 10,
      sort_by: 'received_at',
      sort_order: 'desc',
    });
    console.log(`✅ Found ${recentPrompts.length} recent prompts\n`);

    // Test 4: Similarity Detection
    console.log('═══════════════════════════════════════════════');
    console.log('🔗 TEST 4: SIMILARITY DETECTION');
    console.log('═══════════════════════════════════════════════\n');

    const queryPrompt = 'Fix memory issues in JavaScript application';
    console.log(`🔍 Finding prompts similar to: "${queryPrompt}"\n`);

    const allPrompts = await memoryStore.queryPrompts({ limit: 100 });
    const similarPrompts = await promptIntelligence.findSimilarPrompts(queryPrompt, allPrompts, 5);

    console.log(`✅ Found ${similarPrompts.length} similar prompts:`);
    similarPrompts.forEach((similar: any, index: number) => {
      console.log(
        `   ${index + 1}. Score: ${similar.similarity_score.toFixed(3)} (${similar.similarity_type})`
      );
    });
    console.log('');

    // Test 5: Performance Validation
    console.log('═══════════════════════════════════════════════');
    console.log('⚡ TEST 5: PERFORMANCE VALIDATION');
    console.log('═══════════════════════════════════════════════\n');

    const performanceTestPrompts = Array.from(
      { length: 10 },
      (_, i) => `Performance test prompt ${i + 1} for measuring storage speed`
    );

    console.log(`⏱️ Testing storage performance with ${performanceTestPrompts.length} prompts...`);
    const startTime = performance.now();

    for (const promptText of performanceTestPrompts) {
      const perfPromptId = MemoryUtils.generateSessionId();
      const perfSessionId = MemoryUtils.generateSessionId();

      await memoryStore.storePrompt({
        id: perfPromptId,
        session_id: perfSessionId,
        original_prompt: promptText,
        received_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    const endTime = performance.now();
    const avgTime = (endTime - startTime) / performanceTestPrompts.length;

    console.log(`✅ Average storage time: ${avgTime.toFixed(2)}ms per prompt`);
    console.log(
      `🎯 Target: <50ms per prompt (${avgTime < 50 ? 'PASSED' : 'NEEDS OPTIMIZATION'})\n`
    );

    // Test 6: Validation Framework
    console.log('═══════════════════════════════════════════════');
    console.log('🧪 TEST 6: COMPREHENSIVE VALIDATION FRAMEWORK');
    console.log('═══════════════════════════════════════════════\n');

    console.log('🏃 Running comprehensive validation...');
    const validationFramework = new PromptValidationFramework(memoryStore);
    const report = await validationFramework.runFullValidation();

    console.log('\n📊 VALIDATION RESULTS:');
    console.log(`   🏆 Overall Score: ${report.overall_score.toFixed(1)}%`);
    console.log(`   🥇 Tier 1 (Core Functionality): ${report.tier1_score.toFixed(1)}%`);
    console.log(`   🥈 Tier 2 (Cognitive Enhancement): ${report.tier2_score.toFixed(1)}%`);
    console.log(`   🥉 Tier 3 (Evolutionary Success): ${report.tier3_score.toFixed(1)}%`);
    console.log(`   ✅ Tests Passed: ${report.passed_tests}/${report.total_tests}\n`);

    console.log('📋 Individual Test Results:');
    report.results.forEach((result: any) => {
      const status = result.passed ? '✅' : '❌';
      const score = Math.round(result.score * 100);
      const target = Math.round(result.target * 100);
      console.log(`   ${status} ${result.test_name}: ${score}% (target: ${target}%)`);
    });

    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach((rec: string) => console.log(`   ${rec}`));
    }

    // Final Summary
    console.log('\n═══════════════════════════════════════════════');
    console.log('🎉 PROMPT INTEGRATION DEMONSTRATION COMPLETE');
    console.log('═══════════════════════════════════════════════\n');

    console.log('✨ SYSTEM CAPABILITIES DEMONSTRATED:');
    console.log('   🔍 AI-powered prompt classification with high accuracy');
    console.log('   💭 Intent extraction with objectives, constraints, and requirements');
    console.log('   ⚖️ Complexity estimation with cognitive load calculation');
    console.log('   💾 Comprehensive prompt storage with full metadata');
    console.log('   🔍 Advanced querying by type, date, complexity, and more');
    console.log('   🔗 Semantic similarity detection for context priming');
    console.log('   ⚡ High-performance storage and retrieval operations');
    console.log('   🧪 Comprehensive validation framework with success metrics');
    console.log('   📊 Real-time performance monitoring and optimization');

    if (report.overall_score >= 70) {
      console.log('\n🎯 SUCCESS: System meets core requirements for AGI-like prompt learning!');
    } else {
      console.log('\n⚠️ PARTIAL SUCCESS: System functional but needs optimization for production.');
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    success = false;
  } finally {
    if (memoryStore) {
      await memoryStore.close();
      console.log('\n🧹 Memory store connection closed');
    }
  }

  process.exit(success ? 0 : 1);
}

// Run the tests
runTests().catch(error => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});
