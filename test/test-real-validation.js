#!/usr/bin/env node

/**
 * Test the real validation system with actual measurements
 */

import { PerformanceBenchmark } from './dist/src/validation/performance-benchmark.js';
import { SimpleMemoryStore } from './dist/src/memory/simple-memory-store.js';

async function testRealValidation() {
  console.log('🧪 Testing Real Validation System...\n');
  
  try {
    const memoryStore = new SimpleMemoryStore();
    await memoryStore.initialize();
    
    const benchmark = new PerformanceBenchmark(memoryStore);
    
    console.log('📊 Testing Storage Performance...');
    const storageMetrics = await benchmark.benchmarkStorageOperations(50);
    console.log(`   Avg Time: ${storageMetrics.avg_time.toFixed(2)}ms`);
    console.log(`   P95 Time: ${storageMetrics.p95_time.toFixed(2)}ms`);
    console.log(`   Throughput: ${storageMetrics.throughput_ops_per_second.toFixed(1)} ops/sec`);
    
    console.log('\n📊 Testing Query Performance...');
    const queryMetrics = await benchmark.benchmarkQueryOperations(30);
    console.log(`   Avg Time: ${queryMetrics.avg_time.toFixed(2)}ms`);
    console.log(`   P95 Time: ${queryMetrics.p95_time.toFixed(2)}ms`);
    console.log(`   Throughput: ${queryMetrics.throughput_ops_per_second.toFixed(1)} ops/sec`);
    
    console.log('\n📊 Testing Memory Usage...');
    const memoryMetrics = await benchmark.analyzeMemoryUsage(100);
    console.log(`   Memory Increase: ${memoryMetrics.memory_increase_percentage.toFixed(2)}%`);
    console.log(`   Efficiency Score: ${(memoryMetrics.efficiency_score * 100).toFixed(1)}%`);
    console.log(`   Memory Leak: ${memoryMetrics.memory_leak_detected ? '❌ DETECTED' : '✅ NONE'}`);
    
    console.log('\n📊 Testing Concurrent Operations...');
    const concurrencyMetrics = await benchmark.testConcurrentOperations(10, 5);
    console.log(`   Success Rate: ${(concurrencyMetrics.success_rate * 100).toFixed(2)}%`);
    console.log(`   Avg Response: ${concurrencyMetrics.avg_response_time.toFixed(2)}ms`);
    console.log(`   Failures: ${concurrencyMetrics.failure_count}`);
    
    console.log('\n✅ Real validation system is working with actual measurements!');
    
  } catch (error) {
    console.error('❌ Real validation test failed:', error);
    process.exit(1);
  }
}

testRealValidation();