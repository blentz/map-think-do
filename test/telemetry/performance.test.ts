/**
 * Performance validation tests for Phoenix observability enhancements
 * Ensures that LLM impact metrics and telemetry features have minimal performance overhead
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';

describe('Phoenix Telemetry Performance Tests', () => {
  const PERFORMANCE_THRESHOLD = 0.05; // 5% maximum overhead
  const TEST_ITERATIONS = 10;
  const MCP_REQUEST_TIMEOUT = 20000;

  /**
   * Measure baseline performance without telemetry
   */
  async function measureBaselinePerformance(): Promise<number[]> {
    const results: number[] = [];

    for (let i = 0; i < TEST_ITERATIONS; i++) {
      const testRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: i,
        method: 'tools/call',
        params: {
          name: 'code-reasoning',
          arguments: {
            thought: `Performance baseline test iteration ${i + 1} - measuring cognitive processing without telemetry overhead`,
            thought_number: 1,
            total_thoughts: 1,
            next_thought_needed: false,
            working_directory: '/home/brett_lentz/git/map-think-do',
          },
        },
      });

      const startTime = performance.now();

      const result = await new Promise<number>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Baseline test timeout'));
        }, MCP_REQUEST_TIMEOUT);

        // Set environment to disable telemetry
        const serverProcess = spawn('npm', ['start'], {
          cwd: process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, TELEMETRY_ENABLED: 'false' },
        });

        let responseReceived = false;

        serverProcess.stdout.on('data', (data: Buffer) => {
          const output = data.toString();
          if (output.includes('"result"') && !responseReceived) {
            responseReceived = true;
            clearTimeout(timeout);
            serverProcess.kill('SIGTERM');
            const endTime = performance.now();
            resolve(endTime - startTime);
          }
        });

        serverProcess.stdin.write(testRequest + '\n');
        serverProcess.stdin.end();

        serverProcess.on('error', error => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      results.push(result);

      // Brief pause between iterations
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  /**
   * Measure performance with full telemetry enabled
   */
  async function measureTelemetryPerformance(): Promise<number[]> {
    const results: number[] = [];

    for (let i = 0; i < TEST_ITERATIONS; i++) {
      const testRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: i,
        method: 'tools/call',
        params: {
          name: 'code-reasoning',
          arguments: {
            thought: `Performance telemetry test iteration ${i + 1} - measuring cognitive processing with full Phoenix observability`,
            thought_number: 1,
            total_thoughts: 1,
            next_thought_needed: false,
            working_directory: '/home/brett_lentz/git/map-think-do',
          },
        },
      });

      const startTime = performance.now();

      const result = await new Promise<number>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Telemetry test timeout'));
        }, MCP_REQUEST_TIMEOUT);

        // Full telemetry enabled (default)
        const serverProcess = spawn('npm', ['start'], {
          cwd: process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, TELEMETRY_ENABLED: 'true' },
        });

        let responseReceived = false;

        serverProcess.stdout.on('data', (data: Buffer) => {
          const output = data.toString();
          if (output.includes('"result"') && !responseReceived) {
            responseReceived = true;
            clearTimeout(timeout);
            serverProcess.kill('SIGTERM');
            const endTime = performance.now();
            resolve(endTime - startTime);
          }
        });

        serverProcess.stdin.write(testRequest + '\n');
        serverProcess.stdin.end();

        serverProcess.on('error', error => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      results.push(result);

      // Brief pause between iterations
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  test('should maintain performance within acceptable overhead limits', async () => {
    console.log('🚀 Starting performance validation tests...');
    console.log(`📊 Running ${TEST_ITERATIONS} iterations per test`);
    console.log(
      `⚡ Performance threshold: ${(PERFORMANCE_THRESHOLD * 100).toFixed(1)}% maximum overhead`
    );

    // Measure baseline performance
    console.log('📈 Measuring baseline performance (telemetry disabled)...');
    const baselineTimes = await measureBaselinePerformance();

    // Measure telemetry performance
    console.log('📊 Measuring telemetry performance (full Phoenix observability)...');
    const telemetryTimes = await measureTelemetryPerformance();

    // Calculate statistics
    const baselineAvg = baselineTimes.reduce((sum, time) => sum + time, 0) / baselineTimes.length;
    const telemetryAvg =
      telemetryTimes.reduce((sum, time) => sum + time, 0) / telemetryTimes.length;

    const baselineStdDev = Math.sqrt(
      baselineTimes.reduce((sum, time) => sum + Math.pow(time - baselineAvg, 2), 0) /
        baselineTimes.length
    );
    const telemetryStdDev = Math.sqrt(
      telemetryTimes.reduce((sum, time) => sum + Math.pow(time - telemetryAvg, 2), 0) /
        telemetryTimes.length
    );

    const performanceOverhead = (telemetryAvg - baselineAvg) / baselineAvg;
    const overheadPercentage = performanceOverhead * 100;

    // Log results
    console.log('\n📊 Performance Test Results:');
    console.log('=====================================');
    console.log(`🏃 Baseline Performance (no telemetry):`);
    console.log(`   Average: ${baselineAvg.toFixed(2)}ms`);
    console.log(`   Std Dev: ${baselineStdDev.toFixed(2)}ms`);
    console.log(`   Min: ${Math.min(...baselineTimes).toFixed(2)}ms`);
    console.log(`   Max: ${Math.max(...baselineTimes).toFixed(2)}ms`);

    console.log(`\n📡 Telemetry Performance (full Phoenix observability):`);
    console.log(`   Average: ${telemetryAvg.toFixed(2)}ms`);
    console.log(`   Std Dev: ${telemetryStdDev.toFixed(2)}ms`);
    console.log(`   Min: ${Math.min(...telemetryTimes).toFixed(2)}ms`);
    console.log(`   Max: ${Math.max(...telemetryTimes).toFixed(2)}ms`);

    console.log(`\n⚡ Performance Impact:`);
    console.log(`   Overhead: ${overheadPercentage.toFixed(2)}%`);
    console.log(`   Threshold: ${(PERFORMANCE_THRESHOLD * 100).toFixed(1)}%`);
    console.log(
      `   Status: ${performanceOverhead <= PERFORMANCE_THRESHOLD ? '✅ PASS' : '❌ FAIL'}`
    );

    // Write detailed results to file
    const performanceReport = {
      testDate: new Date().toISOString(),
      iterations: TEST_ITERATIONS,
      performanceThreshold: PERFORMANCE_THRESHOLD,
      baseline: {
        times: baselineTimes,
        average: baselineAvg,
        stdDev: baselineStdDev,
        min: Math.min(...baselineTimes),
        max: Math.max(...baselineTimes),
      },
      telemetry: {
        times: telemetryTimes,
        average: telemetryAvg,
        stdDev: telemetryStdDev,
        min: Math.min(...telemetryTimes),
        max: Math.max(...telemetryTimes),
      },
      impact: {
        overheadAbsolute: telemetryAvg - baselineAvg,
        overheadRelative: performanceOverhead,
        overheadPercentage: overheadPercentage,
        withinThreshold: performanceOverhead <= PERFORMANCE_THRESHOLD,
      },
    };

    await fs.mkdir('test-results', { recursive: true });
    await fs.writeFile(
      `test-results/performance-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
      JSON.stringify(performanceReport, null, 2)
    );

    // Assertions
    expect(baselineTimes.length).toBe(TEST_ITERATIONS);
    expect(telemetryTimes.length).toBe(TEST_ITERATIONS);
    expect(baselineAvg).toBeGreaterThan(0);
    expect(telemetryAvg).toBeGreaterThan(0);
    expect(performanceOverhead).toBeLessThanOrEqual(PERFORMANCE_THRESHOLD);

    console.log(
      `\n✅ Performance validation complete. Overhead: ${overheadPercentage.toFixed(2)}%`
    );
  }, 300000); // 5 minute timeout for performance tests

  test('should verify LLM impact metrics calculation overhead', async () => {
    console.log('🧠 Testing LLM impact metrics calculation performance...');

    const { calculateLLMImpactMetrics } = require('../../dist/telemetry/llm-impact-metrics.js');

    const mockInput = {
      latencyMs: 1500,
      tokenCount: 250,
      cost: 0.001,
      insightCount: 3,
      interventionCount: 2,
      cognitiveState: {
        metacognitive_awareness: 0.8,
        creative_pressure: 0.6,
        analytical_depth: 0.7,
        confidence_trajectory: [0.5, 0.6, 0.7, 0.8],
        current_complexity: 5,
        recent_success_rate: 0.9,
      },
    };

    const iterations = 10000;
    const startTime = performance.now();

    // Run impact metrics calculation many times
    for (let i = 0; i < iterations; i++) {
      calculateLLMImpactMetrics(mockInput);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTimePerCalculation = totalTime / iterations;

    console.log(`📊 LLM Impact Metrics Performance:`);
    console.log(`   Iterations: ${iterations.toLocaleString()}`);
    console.log(`   Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`   Average per calculation: ${avgTimePerCalculation.toFixed(4)}ms`);

    // Expect very fast calculation (should be sub-millisecond)
    expect(avgTimePerCalculation).toBeLessThan(1); // Less than 1ms per calculation
    expect(totalTime).toBeLessThan(1000); // Total should be under 1 second

    console.log(
      `✅ Impact metrics calculation performance: ${avgTimePerCalculation.toFixed(4)}ms per call`
    );
  });

  test('should verify Phoenix span attribute overhead', async () => {
    console.log('🔍 Testing Phoenix span attribute creation performance...');

    const { createImpactMetricAttributes } = require('../../dist/telemetry/llm-impact-metrics.js');

    const mockMetrics = {
      thoughtLatency: 1500,
      tokenCount: 250,
      cost: 0.001,
      confidenceScore: 0.8,
      breakthroughLikelihood: 0.7,
      cognitiveEfficiency: 0.75,
      thoughtQuality: 0.82,
      learningVelocity: 0.65,
      conceptualDepth: 0.78,
      problemSolvingEffectiveness: 0.88,
    };

    const iterations = 100000;
    const startTime = performance.now();

    // Run span attribute creation many times
    for (let i = 0; i < iterations; i++) {
      createImpactMetricAttributes(mockMetrics);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTimePerCreation = totalTime / iterations;

    console.log(`📊 Phoenix Span Attributes Performance:`);
    console.log(`   Iterations: ${iterations.toLocaleString()}`);
    console.log(`   Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`   Average per creation: ${avgTimePerCreation.toFixed(6)}ms`);

    // Expect very fast attribute creation (should be sub-millisecond)
    expect(avgTimePerCreation).toBeLessThan(0.1); // Less than 0.1ms per creation
    expect(totalTime).toBeLessThan(1000); // Total should be under 1 second

    console.log(
      `✅ Span attribute creation performance: ${avgTimePerCreation.toFixed(6)}ms per call`
    );
  });
});
