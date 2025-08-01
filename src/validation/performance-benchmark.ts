/**
 * @fileoverview Real Production Performance Benchmarking System
 *
 * Tests actual system performance with real operations and measurements.
 * No simulated data - all results come from actual system behavior.
 */

import { MemoryStore } from '../memory/memory-store.js';
import { PromptClassifier } from '../memory/prompt-intelligence/prompt-classifier.js';
import { IntentExtractor } from '../memory/prompt-intelligence/intent-extractor.js';
import { SimilarityDetector } from '../memory/prompt-intelligence/similarity-detector.js';
import { ComplexityEstimator } from '../memory/prompt-intelligence/complexity-estimator.js';

export interface PerformanceMetrics {
  operation_times: number[];
  avg_time: number;
  median_time: number;
  p95_time: number;
  p99_time: number;
  min_time: number;
  max_time: number;
  standard_deviation: number;
  throughput_ops_per_second: number;
}

export interface ConcurrencyTestResult {
  concurrent_operations: number;
  success_count: number;
  failure_count: number;
  success_rate: number;
  avg_response_time: number;
  deadlock_count: number;
  timeout_count: number;
}

export interface MemoryAnalysis {
  initial_heap_mb: number;
  peak_heap_mb: number;
  final_heap_mb: number;
  memory_increase_percentage: number;
  gc_pressure_score: number;
  memory_leak_detected: boolean;
  efficiency_score: number;
}

/**
 * Real Production Performance Benchmarking System
 */
export class PerformanceBenchmark {
  private promptClassifier: PromptClassifier;
  private intentExtractor: IntentExtractor;
  private similarityDetector: SimilarityDetector;
  private complexityEstimator: ComplexityEstimator;

  constructor(private memoryStore: MemoryStore) {
    this.promptClassifier = new PromptClassifier();
    this.intentExtractor = new IntentExtractor();
    this.similarityDetector = new SimilarityDetector();
    this.complexityEstimator = new ComplexityEstimator();
  }

  /**
   * Benchmark real storage operations with actual AI analysis
   */
  async benchmarkStorageOperations(iterations: number = 1000): Promise<PerformanceMetrics> {
    console.error(`📊 Benchmarking real storage operations (${iterations} iterations)...`);

    const times: number[] = [];
    const startTime = Date.now();

    // Use real test prompts from different domains
    const realTestPrompts = this.getRealTestPrompts();

    for (let i = 0; i < iterations; i++) {
      const operationStart = performance.now();

      try {
        const realPrompt = realTestPrompts[i % realTestPrompts.length];

        // Run actual AI analysis (no fake data)
        const [classification, intent, complexity] = await Promise.all([
          this.promptClassifier.classifyPrompt(realPrompt),
          this.intentExtractor.extractIntent(realPrompt),
          this.complexityEstimator.estimateComplexity(realPrompt),
        ]);

        // Store with real analysis results
        const testPrompt = {
          id: `benchmark_${i}_${Date.now()}`,
          session_id: `benchmark_session_${Math.floor(i / 10)}`,
          original_prompt: realPrompt,
          prompt_type: classification.type,
          classification_confidence: classification.confidence,
          extracted_intent: {
            objectives: intent.objectives,
            constraints: intent.constraints,
            requirements: intent.requirements,
            expected_output_type: intent.expected_output_type,
            extraction_confidence: intent.extraction_confidence,
          },
          complexity_estimate: complexity.complexity,
          estimated_cognitive_load: complexity.cognitive_load_estimate,
          received_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        };

        await this.memoryStore.storePrompt(testPrompt);

        const operationEnd = performance.now();
        times.push(operationEnd - operationStart);

        // Progress indicator for long runs
        if (i % 100 === 0 && i > 0) {
          console.error(
            `   Progress: ${i}/${iterations} (${((i / iterations) * 100).toFixed(1)}%)`
          );
        }
      } catch (error) {
        console.error(`❌ Storage operation ${i} failed:`, error);
        // Record actual failure time, not penalty
        const operationEnd = performance.now();
        times.push(operationEnd - operationStart);
      }
    }

    const totalTime = Date.now() - startTime;

    return this.calculatePerformanceMetrics(times, totalTime);
  }

  /**
   * Benchmark real query operations with actual database queries
   */
  async benchmarkQueryOperations(iterations: number = 1000): Promise<PerformanceMetrics> {
    console.error(`📊 Benchmarking real query operations (${iterations} iterations)...`);

    const times: number[] = [];
    const startTime = Date.now();

    // Ensure we have real data to query against
    await this.ensureTestDataExists(100);

    for (let i = 0; i < iterations; i++) {
      const operationStart = performance.now();

      try {
        // Test different real query patterns
        const queryType = i % 6;

        switch (queryType) {
          case 0:
            await this.memoryStore.queryPrompts({ limit: 10 });
            break;
          case 1:
            await this.memoryStore.queryPrompts({
              prompt_type: 'debugging',
              limit: 20,
            });
            break;
          case 2:
            await this.memoryStore.queryThoughts({
              limit: 15,
            });
            break;
          case 3:
            await this.memoryStore.queryPrompts({
              limit: 25,
            });
            break;
          case 4:
            // Get memory stats if available
            if (typeof (this.memoryStore as any).getMemoryStats === 'function') {
              await (this.memoryStore as any).getMemoryStats();
            }
            break;
          case 5:
            // Test project-aware queries if available
            const projects = (await this.memoryStore.queryProjects?.({ limit: 5 })) || [];
            if (projects.length > 0) {
              await this.memoryStore.queryPrompts({
                project_id: projects[0].id,
                limit: 10,
              });
            }
            break;
        }

        const operationEnd = performance.now();
        times.push(operationEnd - operationStart);
      } catch (error) {
        console.error(`❌ Query operation ${i} failed:`, error);
        const operationEnd = performance.now();
        times.push(operationEnd - operationStart);
      }
    }

    const totalTime = Date.now() - startTime;

    return this.calculatePerformanceMetrics(times, totalTime);
  }

  /**
   * Test real concurrent operations with actual database connections
   */
  async testConcurrentOperations(
    concurrentUsers: number = 50,
    operationsPerUser: number = 10
  ): Promise<ConcurrencyTestResult> {
    console.error(
      `📊 Testing real concurrent operations (${concurrentUsers} users, ${operationsPerUser} ops each)...`
    );

    const results = {
      concurrent_operations: concurrentUsers * operationsPerUser,
      success_count: 0,
      failure_count: 0,
      success_rate: 0,
      avg_response_time: 0,
      deadlock_count: 0,
      timeout_count: 0,
    };

    const allTimes: number[] = [];
    const userPromises: Promise<void>[] = [];

    // Create real concurrent user simulations
    for (let user = 0; user < concurrentUsers; user++) {
      const userPromise = this.simulateRealUserOperations(user, operationsPerUser)
        .then(userResults => {
          results.success_count += userResults.successes;
          results.failure_count += userResults.failures;
          results.deadlock_count += userResults.deadlocks;
          results.timeout_count += userResults.timeouts;
          allTimes.push(...userResults.times);
        })
        .catch(error => {
          console.error(`❌ User ${user} simulation failed:`, error);
          results.failure_count += operationsPerUser;
        });

      userPromises.push(userPromise);
    }

    // Wait for all concurrent operations to complete
    await Promise.all(userPromises);

    // Calculate real metrics from actual results
    results.success_rate = results.success_count / results.concurrent_operations;
    results.avg_response_time =
      allTimes.length > 0 ? allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length : 0;

    console.error(`   Success Rate: ${(results.success_rate * 100).toFixed(2)}%`);
    console.error(`   Avg Response Time: ${results.avg_response_time.toFixed(2)}ms`);
    console.error(`   Deadlocks: ${results.deadlock_count}`);
    console.error(`   Timeouts: ${results.timeout_count}`);

    return results;
  }

  /**
   * Analyze real memory usage during actual operations
   */
  async analyzeMemoryUsage(operationCount: number = 1000): Promise<MemoryAnalysis> {
    console.error(`📊 Analyzing real memory usage (${operationCount} operations)...`);

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const initialMemory = process.memoryUsage();
    const initialHeapMB = initialMemory.heapUsed / 1024 / 1024;

    let peakHeapMB = initialHeapMB;
    const memoryReadings: number[] = [];

    // Perform real intensive operations
    const realTestPrompts = this.getRealTestPrompts();

    for (let i = 0; i < operationCount; i++) {
      // Perform real operations with actual AI processing
      const realPrompt = realTestPrompts[i % realTestPrompts.length];

      // Real AI analysis - no shortcuts
      const [classification, intent, complexity] = await Promise.all([
        this.promptClassifier.classifyPrompt(realPrompt),
        this.intentExtractor.extractIntent(realPrompt),
        this.complexityEstimator.estimateComplexity(realPrompt),
      ]);

      // Store real analyzed data
      const testPrompt = {
        id: `memory_test_${i}_${Date.now()}`,
        session_id: `memory_session_${Math.floor(i / 20)}`,
        original_prompt: realPrompt,
        prompt_type: classification.type,
        classification_confidence: classification.confidence,
        complexity_estimate: complexity.complexity,
        received_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      await this.memoryStore.storePrompt(testPrompt);

      // Real query operations
      if (i % 5 === 0) {
        await this.memoryStore.queryPrompts({ limit: 10 });
      }

      // Sample memory usage during real operations
      if (i % 50 === 0) {
        const currentMemory = process.memoryUsage();
        const currentHeapMB = currentMemory.heapUsed / 1024 / 1024;
        memoryReadings.push(currentHeapMB);

        if (currentHeapMB > peakHeapMB) {
          peakHeapMB = currentHeapMB;
        }
      }
    }

    // Force garbage collection again
    if (global.gc) {
      global.gc();
    }

    // Wait for GC to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    const finalMemory = process.memoryUsage();
    const finalHeapMB = finalMemory.heapUsed / 1024 / 1024;

    const memoryIncrease = ((finalHeapMB - initialHeapMB) / initialHeapMB) * 100;
    const gcPressure = this.calculateGCPressure(memoryReadings);
    const memoryLeakDetected = memoryIncrease > 50 || gcPressure > 0.8;

    // Calculate efficiency score based on real measurements
    const efficiencyScore = Math.max(0, 1 - memoryIncrease / 100 - gcPressure * 0.3);

    return {
      initial_heap_mb: initialHeapMB,
      peak_heap_mb: peakHeapMB,
      final_heap_mb: finalHeapMB,
      memory_increase_percentage: memoryIncrease,
      gc_pressure_score: gcPressure,
      memory_leak_detected: memoryLeakDetected,
      efficiency_score: efficiencyScore,
    };
  }

  /**
   * Real test prompts from actual usage scenarios
   */
  private getRealTestPrompts(): string[] {
    return [
      "Help me debug this React component that's throwing a TypeError when rendering the user profile",
      'Design a scalable microservices architecture for a high-traffic e-commerce platform',
      'Implement a real-time chat feature with WebSocket connections and message persistence',
      "Optimize this SQL query that's causing performance issues in our user dashboard",
      'Review the security implications of this authentication flow and suggest improvements',
      'Explain how this recursive algorithm works and identify potential stack overflow issues',
      'Create a comprehensive test suite for this payment processing module',
      'Refactor this legacy codebase to use modern async/await patterns instead of callbacks',
      'Build a CI/CD pipeline that supports automated testing and blue-green deployments',
      'Analyze the memory usage patterns in this data processing service and fix memory leaks',
      'Implement error handling and retry logic for this external API integration',
      'Design a database schema for a multi-tenant SaaS application with proper isolation',
      'Create a monitoring and alerting system for microservices health and performance',
      'Build a caching layer to improve response times for frequently accessed data',
      'Implement role-based access control with fine-grained permissions',
      'Debug why the WebSocket connections are dropping after 30 seconds of inactivity',
      'Create a data migration script that handles large datasets without downtime',
      'Implement proper logging and observability for distributed system troubleshooting',
      'Build a feature flag system that supports gradual rollouts and A/B testing',
      'Design an event-driven architecture using message queues for decoupled services',
    ];
  }

  /**
   * Ensure test data exists for query benchmarks
   */
  private async ensureTestDataExists(minCount: number): Promise<void> {
    const existing = await this.memoryStore.queryPrompts({ limit: minCount });

    if (existing.length < minCount) {
      console.error(`📊 Creating ${minCount - existing.length} real test records...`);

      const realPrompts = this.getRealTestPrompts();
      const needed = minCount - existing.length;

      for (let i = 0; i < needed; i++) {
        const realPrompt = realPrompts[i % realPrompts.length];

        // Real AI analysis for test data
        const classification = await this.promptClassifier.classifyPrompt(realPrompt);

        const testPrompt = {
          id: `test_data_${i}_${Date.now()}`,
          session_id: `test_session_${Math.floor(i / 10)}`,
          original_prompt: realPrompt,
          prompt_type: classification.type,
          classification_confidence: classification.confidence,
          received_at: new Date(Date.now() - Math.random() * 86400000), // Recent timestamps
          created_at: new Date(),
          updated_at: new Date(),
        };

        await this.memoryStore.storePrompt(testPrompt);
      }
    }
  }

  /**
   * Calculate real performance metrics from actual measurements
   */
  private calculatePerformanceMetrics(times: number[], totalTimeMs: number): PerformanceMetrics {
    if (times.length === 0) {
      throw new Error('No timing data available for analysis');
    }

    // Sort times for percentile calculations
    const sortedTimes = [...times].sort((a, b) => a - b);

    // Calculate statistics from real measurements
    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const medianTime = this.calculatePercentile(sortedTimes, 50);
    const p95Time = this.calculatePercentile(sortedTimes, 95);
    const p99Time = this.calculatePercentile(sortedTimes, 99);
    const minTime = sortedTimes[0];
    const maxTime = sortedTimes[sortedTimes.length - 1];

    // Calculate standard deviation
    const variance =
      times.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / times.length;
    const standardDeviation = Math.sqrt(variance);

    // Calculate throughput from real measurements
    const throughput = (times.length * 1000) / totalTimeMs;

    return {
      operation_times: times,
      avg_time: avgTime,
      median_time: medianTime,
      p95_time: p95Time,
      p99_time: p99Time,
      min_time: minTime,
      max_time: maxTime,
      standard_deviation: standardDeviation,
      throughput_ops_per_second: throughput,
    };
  }

  /**
   * Calculate percentile from sorted array
   */
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sortedArray[lower];
    }

    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * Simulate real user operations with actual system calls
   */
  private async simulateRealUserOperations(
    userId: number,
    operations: number
  ): Promise<{
    successes: number;
    failures: number;
    deadlocks: number;
    timeouts: number;
    times: number[];
  }> {
    const results = {
      successes: 0,
      failures: 0,
      deadlocks: 0,
      timeouts: 0,
      times: [] as number[],
    };

    const realPrompts = this.getRealTestPrompts();

    for (let i = 0; i < operations; i++) {
      const startTime = performance.now();

      try {
        if (i % 3 === 0) {
          // Real write operation with AI analysis
          const realPrompt = realPrompts[(userId * operations + i) % realPrompts.length];
          const classification = await this.promptClassifier.classifyPrompt(realPrompt);

          const testPrompt = {
            id: `concurrent_${userId}_${i}_${Date.now()}`,
            session_id: `concurrent_session_${userId}`,
            original_prompt: realPrompt,
            prompt_type: classification.type,
            classification_confidence: classification.confidence,
            received_at: new Date(),
            created_at: new Date(),
            updated_at: new Date(),
          };

          await this.memoryStore.storePrompt(testPrompt);
        } else {
          // Real read operation
          await this.memoryStore.queryPrompts({ limit: 5 });
        }

        const endTime = performance.now();
        results.times.push(endTime - startTime);
        results.successes++;
      } catch (error: any) {
        const endTime = performance.now();
        results.times.push(endTime - startTime);
        results.failures++;

        // Classify real error types
        const errorMessage = error.message?.toLowerCase() || '';
        if (errorMessage.includes('deadlock') || errorMessage.includes('lock')) {
          results.deadlocks++;
        } else if (errorMessage.includes('timeout')) {
          results.timeouts++;
        }
      }

      // Small delay between operations
      await new Promise(resolve => setTimeout(resolve, 5));
    }

    return results;
  }

  /**
   * Calculate GC pressure from real memory readings
   */
  private calculateGCPressure(memoryReadings: number[]): number {
    if (memoryReadings.length < 2) {
      return 0;
    }

    let totalVariation = 0;
    let upwardSpikes = 0;

    for (let i = 1; i < memoryReadings.length; i++) {
      const change = memoryReadings[i] - memoryReadings[i - 1];
      totalVariation += Math.abs(change);

      if (change > memoryReadings[i - 1] * 0.1) {
        upwardSpikes++;
      }
    }

    const avgMemory =
      memoryReadings.reduce((sum, reading) => sum + reading, 0) / memoryReadings.length;
    const normalizedVariation = totalVariation / (avgMemory * memoryReadings.length);
    const spikeRatio = upwardSpikes / memoryReadings.length;

    return Math.min(1, normalizedVariation + spikeRatio);
  }
}
