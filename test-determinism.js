#!/usr/bin/env node

/**
 * Test if Session 17's "deterministic" fixes actually work
 */

console.log('=== TESTING SESSION 17 DETERMINISM CLAIMS ===\n');

// Test 1: Hash function determinism
console.log('TEST 1: Hash Function Determinism');
console.log('-'.repeat(40));

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Test same input produces same output
const test1 = hashString('strategist');
const test2 = hashString('strategist');
const test3 = hashString('engineer');

console.log(`Hash of 'strategist' (run 1): ${test1}`);
console.log(`Hash of 'strategist' (run 2): ${test2}`);
console.log(`Hash of 'engineer': ${test3}`);
console.log(`✓ Deterministic: ${test1 === test2}`);
console.log();

// Test 2: Template selection determinism
console.log('TEST 2: Template Selection Logic');
console.log('-'.repeat(40));

const templates = ['template1', 'template2', 'template3', 'template4', 'template5'];
const contextComplexity = 100;
const thoughtHistoryLength = 2;
const personaIdHash = hashString('strategist');

const selectionIndex =
  (contextComplexity + thoughtHistoryLength + personaIdHash) % templates.length;
console.log(`Context complexity: ${contextComplexity}`);
console.log(`Thought history length: ${thoughtHistoryLength}`);
console.log(`Persona ID hash: ${personaIdHash}`);
console.log(`Selection index: ${selectionIndex}`);
console.log(`Selected template: ${templates[selectionIndex]}`);

// Run multiple times - should always select same template
const results = [];
for (let i = 0; i < 5; i++) {
  const idx = (contextComplexity + thoughtHistoryLength + personaIdHash) % templates.length;
  results.push(templates[idx]);
}
console.log(`5 runs produced: ${results.join(', ')}`);
console.log(`✓ All same: ${results.every(r => r === results[0])}`);
console.log();

// Test 3: Complexity calculation
console.log('TEST 3: Complexity Calculation');
console.log('-'.repeat(40));

const template = 'Fix React component re-rendering issues';
const type = 'debugging';
const templateHash = hashString(template + type);
const normalizedHash = (templateHash % 1000) / 1000;
const minComplexity = 0.6;
const maxComplexity = 0.9;
const expectedComplexity = minComplexity + normalizedHash * (maxComplexity - minComplexity);

console.log(`Template: "${template}"`);
console.log(`Type: ${type}`);
console.log(`Hash: ${templateHash}`);
console.log(`Normalized (0-1): ${normalizedHash.toFixed(3)}`);
console.log(`Complexity range: ${minComplexity} - ${maxComplexity}`);
console.log(`Calculated complexity: ${expectedComplexity.toFixed(3)}`);
console.log();

// Test 4: Usage simulation
console.log('TEST 4: Usage Simulation');
console.log('-'.repeat(40));

const componentId = 'cognitive-orchestrator';
const componentType = 'core';
const componentHash = hashString(componentId + componentType);
const usageIncrement = (componentHash % 1000) / 10000;

console.log(`Component: ${componentId} (${componentType})`);
console.log(`Hash: ${componentHash}`);
console.log(`Usage increment: ${usageIncrement.toFixed(6)}`);
console.log(`Note: This produces tiny values (0-0.1 range)`);
console.log();

// Test 5: Timestamp generation
console.log('TEST 5: Timestamp Generation');
console.log('-'.repeat(40));

const now = Date.now();
for (let i = 0; i < 5; i++) {
  const timestamp = new Date(now - (i % 100) * 864000);
  console.log(`Index ${i}: ${timestamp.toISOString()}`);
}
console.log();

// Summary
console.log('=== ANALYSIS ===');
console.log('-'.repeat(40));
console.log('✓ Hash functions ARE deterministic');
console.log('✓ Template selection IS reproducible');
console.log("✗ But it's just cycling through templates predictably");
console.log('✗ Complexity is just hash-to-range mapping, not real analysis');
console.log('✗ Usage simulation produces unrealistic tiny values');
console.log('✗ Timestamps go backwards in time based on index');
console.log();
console.log('VERDICT: Deterministic? YES. Meaningful? NO.');
console.log('The system now produces REPRODUCIBLE FAKE DATA instead of RANDOM FAKE DATA.');
