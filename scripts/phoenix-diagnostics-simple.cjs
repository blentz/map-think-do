#!/usr/bin/env node

/**
 * Phoenix Diagnostics Script (Simple Version)
 *
 * A simpler JavaScript version that can query Phoenix REST API directly
 * without requiring TypeScript compilation.
 */

const axios = require('axios');

class PhoenixDiagnostics {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || process.env.PHOENIX_URL || 'http://localhost:6006';
    this.apiKey = config.apiKey || process.env.PHOENIX_API_KEY;
    this.projectId = config.projectId || process.env.PHOENIX_PROJECT_ID || 'UHJvamVjdDoy';

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
      },
    });
  }

  /**
   * Query Phoenix GraphQL API
   */
  async query(graphqlQuery, variables = {}) {
    try {
      const response = await this.client.post('/graphql', {
        query: graphqlQuery,
        variables,
      });

      if (response.data.errors) {
        console.error('GraphQL errors:', JSON.stringify(response.data.errors, null, 2));
        throw new Error('GraphQL query failed');
      }

      return response.data.data;
    } catch (error) {
      if (error.response) {
        console.error('Response error:', error.response.status, error.response.data);
      } else if (error.request) {
        console.error('No response received from Phoenix server at', this.baseUrl);
      } else {
        console.error('Error:', error.message);
      }
      throw error;
    }
  }

  /**
   * Test connection to Phoenix
   */
  async testConnection() {
    console.log(`Testing connection to Phoenix at ${this.baseUrl}...`);
    try {
      await this.client.get('/');
      console.log('✅ Successfully connected to Phoenix');
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to Phoenix');
      return false;
    }
  }

  /**
   * Get projects
   */
  async getProjects() {
    const query = `
      query {
        projects {
          edges {
            node {
              id
              name
              gradientStartColor
              gradientEndColor
            }
          }
        }
      }
    `;

    const data = await this.query(query);
    return data.projects.edges.map(edge => edge.node);
  }

  /**
   * Get recent traces
   */
  async getRecentTraces(limit = 10) {
    const query = `
      query GetTraces($projectId: ID!, $first: Int) {
        project(id: $projectId) {
          id
          name
          traces(first: $first) {
            edges {
              node {
                traceId
                startTime
                endTime
                latencyMs
                tokenCountTotal
                tokenCountPrompt
                tokenCountCompletion
                rootSpan {
                  id
                  name
                  statusCode
                  spanKind
                  startTime
                  endTime
                  latencyMs
                  tokenCountTotal
                  tokenCountPrompt
                  tokenCountCompletion
                  input {
                    value
                    mimeType
                  }
                  output {
                    value
                    mimeType
                  }
                  metadata
                  numDocuments
                  context {
                    spanId
                    traceId
                  }
                }
              }
            }
          }
        }
      }
    `;

    const data = await this.query(query, {
      projectId: this.projectId,
      first: limit,
    });

    return data.project.traces.edges.map(edge => edge.node);
  }

  /**
   * Get spans for a trace
   */
  async getTraceSpans(traceId) {
    const query = `
      query GetSpans($projectId: ID!, $traceId: ID!) {
        project(id: $projectId) {
          trace(traceId: $traceId) {
            traceId
            spans {
              id
              name
              statusCode
              spanKind
              startTime
              endTime
              latencyMs
              parentId
              tokenCountTotal
              tokenCountPrompt
              tokenCountCompletion
              input {
                value
                mimeType
              }
              output {
                value
                mimeType
              }
              metadata
              numDocuments
              events {
                name
                message
                timestamp
              }
            }
          }
        }
      }
    `;

    const data = await this.query(query, {
      projectId: this.projectId,
      traceId,
    });

    return data.project.trace;
  }

  /**
   * Get span details
   */
  async getSpanDetails(spanId) {
    const query = `
      query GetSpan($spanId: ID!) {
        span(id: $spanId) {
          id
          name
          statusCode
          spanKind
          startTime
          endTime
          latencyMs
          parentId
          tokenCountTotal
          tokenCountPrompt
          tokenCountCompletion
          input {
            value
            mimeType
          }
          output {
            value
            mimeType
          }
          metadata
          numDocuments
          events {
            name
            message
            timestamp
          }
          context {
            spanId
            traceId
          }
          cumulativeTokenCountTotal
          cumulativeTokenCountPrompt
          cumulativeTokenCountCompletion
          propagatedStatusCode
        }
      }
    `;

    const data = await this.query(query, { spanId });
    return data.span;
  }

  /**
   * Get trace metrics summary
   */
  async getMetricsSummary() {
    const traces = await this.getRecentTraces(100);

    if (traces.length === 0) {
      return {
        totalTraces: 0,
        averageLatency: 0,
        errorRate: 0,
        totalTokens: 0,
        operations: [],
      };
    }

    const totalTraces = traces.length;
    const latencies = traces.map(t => t.latencyMs || 0);
    const averageLatency = latencies.reduce((a, b) => a + b, 0) / totalTraces;

    const errorTraces = traces.filter(t => t.rootSpan && t.rootSpan.statusCode === 'ERROR');
    const errorRate = (errorTraces.length / totalTraces) * 100;

    const totalTokens = traces.reduce((sum, t) => sum + (t.tokenCountTotal || 0), 0);

    // Group by operation
    const operationMap = new Map();
    traces.forEach(trace => {
      if (trace.rootSpan) {
        const name = trace.rootSpan.name;
        const stats = operationMap.get(name) || {
          count: 0,
          totalLatency: 0,
          errors: 0,
        };
        stats.count++;
        stats.totalLatency += trace.latencyMs || 0;
        if (trace.rootSpan.statusCode === 'ERROR') {
          stats.errors++;
        }
        operationMap.set(name, stats);
      }
    });

    const operations = Array.from(operationMap.entries())
      .map(([name, stats]) => ({
        name,
        count: stats.count,
        avgLatency: stats.totalLatency / stats.count,
        errorRate: (stats.errors / stats.count) * 100,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      totalTraces,
      averageLatency,
      errorRate,
      totalTokens,
      operations,
    };
  }

  /**
   * Format trace for display
   */
  formatTrace(trace) {
    const output = [];
    output.push('═'.repeat(60));
    output.push(`Trace ID: ${trace.traceId}`);
    output.push(`Start: ${new Date(trace.startTime).toLocaleString()}`);
    output.push(`Latency: ${trace.latencyMs}ms`);

    if (trace.tokenCountTotal) {
      output.push(
        `Tokens: ${trace.tokenCountTotal} (${trace.tokenCountPrompt} prompt + ${trace.tokenCountCompletion} completion)`
      );
    }

    if (trace.rootSpan) {
      output.push(`\nRoot Span: ${trace.rootSpan.name}`);
      output.push(`Status: ${trace.rootSpan.statusCode}`);
      output.push(`Kind: ${trace.rootSpan.spanKind}`);

      if (trace.rootSpan.input && trace.rootSpan.input.value) {
        output.push('\nInput:');
        const input =
          typeof trace.rootSpan.input.value === 'string'
            ? trace.rootSpan.input.value
            : JSON.stringify(trace.rootSpan.input.value, null, 2);
        output.push(input.substring(0, 500) + (input.length > 500 ? '...' : ''));
      }

      if (trace.rootSpan.output && trace.rootSpan.output.value) {
        output.push('\nOutput:');
        const outputStr =
          typeof trace.rootSpan.output.value === 'string'
            ? trace.rootSpan.output.value
            : JSON.stringify(trace.rootSpan.output.value, null, 2);
        output.push(outputStr.substring(0, 500) + (outputStr.length > 500 ? '...' : ''));
      }
    }

    output.push('═'.repeat(60));
    return output.join('\n');
  }

  /**
   * Build span tree visualization
   */
  buildSpanTree(spans) {
    const roots = [];

    // Find root spans
    spans.forEach(span => {
      if (!span.parentId) {
        roots.push(span);
      }
    });

    // Build tree structure
    const buildNode = (span, depth = 0) => {
      const indent = '  '.repeat(depth);
      const prefix = depth === 0 ? '┌─' : '├─';
      const latency = span.latencyMs ? `${span.latencyMs}ms` : 'N/A';
      const status = span.statusCode === 'ERROR' ? ' ❌' : '';

      let result = `${indent}${prefix} ${span.name} (${latency})${status}\n`;

      // Find children
      const children = spans.filter(s => s.parentId === span.id);
      children.forEach(child => {
        result += buildNode(child, depth + 1);
      });

      return result;
    };

    let tree = '';
    roots.forEach(root => {
      tree += buildNode(root);
    });

    return tree || 'No spans found';
  }
}

// CLI Commands
async function main() {
  const diagnostics = new PhoenixDiagnostics();
  const command = process.argv[2];
  const args = process.argv.slice(3);

  try {
    // Test connection first
    const connected = await diagnostics.testConnection();
    if (!connected && command !== 'help') {
      console.error('\nMake sure Phoenix is running at', diagnostics.baseUrl);
      process.exit(1);
    }

    switch (command) {
      case 'projects':
        console.log('\n📁 Projects:');
        const projects = await diagnostics.getProjects();
        projects.forEach(p => {
          console.log(`  • ${p.name} (ID: ${p.id})`);
        });
        break;

      case 'traces':
        const limit = parseInt(args[0]) || 10;
        console.log(`\n📊 Recent ${limit} Traces:`);
        const traces = await diagnostics.getRecentTraces(limit);

        if (traces.length === 0) {
          console.log('No traces found');
          break;
        }

        traces.forEach(trace => {
          const time = new Date(trace.startTime).toLocaleTimeString();
          const status = trace.rootSpan?.statusCode === 'ERROR' ? '❌' : '✅';
          const name = trace.rootSpan?.name || 'Unknown';
          const latency = trace.latencyMs ? `${trace.latencyMs}ms` : 'N/A';
          console.log(`  ${status} [${time}] ${name} - ${latency}`);
          console.log(`     ID: ${trace.traceId}`);
        });
        break;

      case 'trace':
        const traceId = args[0];
        if (!traceId) {
          console.error('Please provide a trace ID');
          process.exit(1);
        }

        console.log(`\n🔍 Trace Details:`);
        const traceData = await diagnostics.getTraceSpans(traceId);

        if (!traceData) {
          console.log('Trace not found');
          break;
        }

        console.log(diagnostics.formatTrace(traceData));

        if (traceData.spans && traceData.spans.length > 0) {
          console.log('\n📋 Span Tree:');
          console.log(diagnostics.buildSpanTree(traceData.spans));
        }
        break;

      case 'span':
        const spanId = args[0];
        if (!spanId) {
          console.error('Please provide a span ID');
          process.exit(1);
        }

        console.log(`\n🔬 Span Details:`);
        const span = await diagnostics.getSpanDetails(spanId);

        if (!span) {
          console.log('Span not found');
          break;
        }

        console.log('═'.repeat(60));
        console.log(`Span ID: ${span.id}`);
        console.log(`Name: ${span.name}`);
        console.log(`Status: ${span.statusCode}`);
        console.log(`Kind: ${span.spanKind}`);
        console.log(`Latency: ${span.latencyMs}ms`);
        console.log(`Parent ID: ${span.parentId || 'None (Root)'}`);

        if (span.tokenCountTotal) {
          console.log(`\nToken Usage:`);
          console.log(`  Total: ${span.tokenCountTotal}`);
          console.log(`  Prompt: ${span.tokenCountPrompt}`);
          console.log(`  Completion: ${span.tokenCountCompletion}`);
          console.log(`  Cumulative Total: ${span.cumulativeTokenCountTotal}`);
        }

        if (span.metadata) {
          console.log(`\nMetadata:`);
          console.log(JSON.stringify(span.metadata, null, 2));
        }

        if (span.events && span.events.length > 0) {
          console.log(`\nEvents:`);
          span.events.forEach(event => {
            console.log(`  • ${event.name}: ${event.message}`);
          });
        }
        console.log('═'.repeat(60));
        break;

      case 'metrics':
        console.log('\n📈 Metrics Summary:');
        const metrics = await diagnostics.getMetricsSummary();

        console.log(`\nOverall Statistics:`);
        console.log(`  • Total Traces: ${metrics.totalTraces}`);
        console.log(`  • Average Latency: ${metrics.averageLatency.toFixed(2)}ms`);
        console.log(`  • Error Rate: ${metrics.errorRate.toFixed(2)}%`);
        console.log(`  • Total Tokens Used: ${metrics.totalTokens.toLocaleString()}`);

        if (metrics.operations.length > 0) {
          console.log(`\nTop Operations:`);
          metrics.operations.slice(0, 10).forEach(op => {
            console.log(`  • ${op.name}:`);
            console.log(`    - Count: ${op.count}`);
            console.log(`    - Avg Latency: ${op.avgLatency.toFixed(2)}ms`);
            console.log(`    - Error Rate: ${op.errorRate.toFixed(2)}%`);
          });
        }
        break;

      case 'monitor':
        const interval = parseInt(args[0]) || 5000;
        console.log(`\n👁️  Monitoring traces (refresh every ${interval}ms)...`);
        console.log('Press Ctrl+C to stop\n');

        const monitor = async () => {
          const timestamp = new Date().toLocaleTimeString();
          const recentTraces = await diagnostics.getRecentTraces(5);

          console.log(`[${timestamp}] Latest activity:`);

          if (recentTraces.length === 0) {
            console.log('  No recent traces');
          } else {
            recentTraces.forEach(trace => {
              const status = trace.rootSpan?.statusCode === 'ERROR' ? '❌' : '✅';
              const name = trace.rootSpan?.name || 'Unknown';
              const latency = trace.latencyMs ? `${trace.latencyMs}ms` : 'N/A';
              console.log(`  ${status} ${name} - ${latency}`);
            });
          }
          console.log('');
        };

        await monitor();
        setInterval(monitor, interval);
        break;

      case 'find-by-time':
        const searchTime = args[0];
        if (!searchTime) {
          console.error('Please provide a timestamp to search');
          process.exit(1);
        }

        console.log(`\n🕐 Searching for traces around timestamp "${searchTime}"...`);
        const timeQuery = `
          query {
            projects {
              edges {
                node {
                  id
                  name
                  traces: spans(first: 1000, rootSpansOnly: true, sort: { col: startTime, dir: desc }) {
                    edges {
                      node {
                        id
                        name
                        startTime
                        context { traceId }
                        attributes
                      }
                    }
                  }
                }
              }
            }
          }
        `;

        const timeData = await diagnostics.query(timeQuery);
        let foundTime = false;

        timeData.projects.edges.forEach(project => {
          project.node.traces.edges.forEach(trace => {
            const startTime = new Date(trace.node.startTime);
            const localTime = startTime.toLocaleString();

            // Check if the time matches (flexible matching)
            if (localTime.includes(searchTime) || trace.node.startTime.includes(searchTime)) {
              if (!foundTime) {
                console.log('✅ Found matching trace!');
                foundTime = true;
              }

              console.log(`\n📍 Trace: ${trace.node.context.traceId}`);
              console.log(`   Start Time: ${localTime}`);
              console.log(`   ISO Time: ${trace.node.startTime}`);

              if (trace.node.attributes) {
                try {
                  const attrs = JSON.parse(trace.node.attributes);

                  if (attrs.resource?.memory?.heap_used_mb) {
                    console.log(`\n   💾 Memory Metrics:`);
                    console.log(`      • Heap Used: ${attrs.resource.memory.heap_used_mb} MB`);
                    console.log(`      • Heap Total: ${attrs.resource.memory.heap_total_mb} MB`);
                    console.log(`      • RSS: ${attrs.resource.memory.rss_mb} MB`);
                  }

                  if (attrs.mcp?.timestamp) {
                    console.log(`   MCP Timestamp: ${attrs.mcp.timestamp}`);
                  }
                } catch (e) {
                  // Skip parse errors
                }
              }
            }
          });
        });

        if (!foundTime) {
          console.log('❌ No traces found for that timestamp.');
        }
        break;

      case 'experiment-analysis':
        // Analyze experimental A/B test results
        const experimentId = args[0];
        if (!experimentId) {
          console.error('Please provide an experiment ID');
          process.exit(1);
        }

        console.log(`\n🧪 Analyzing Experiment: ${experimentId}`);

        const expQuery = `
          query {
            projects {
              edges {
                node {
                  id
                  name
                  traces: spans(first: 1000, rootSpansOnly: true, sort: { col: startTime, dir: desc }) {
                    edges {
                      node {
                        id
                        name
                        startTime
                        context { traceId }
                        attributes
                      }
                    }
                  }
                }
              }
            }
          }
        `;

        const expData = await diagnostics.query(expQuery);
        const controlGroup = [];
        const treatmentGroup = [];

        // Separate control and treatment groups
        expData.projects.edges.forEach(project => {
          project.node.traces.edges.forEach(trace => {
            if (trace.node.attributes && trace.node.attributes.includes(experimentId)) {
              try {
                const attrs = JSON.parse(trace.node.attributes);

                if (
                  attrs.experiment?.id === experimentId ||
                  attrs.mcp?.request_id?.includes(experimentId)
                ) {
                  const metrics = {
                    quality_score: attrs.cognitive?.confidence || 0,
                    thought_length: attrs.cognitive?.thought_length || 0,
                    complexity: attrs.cognitive?.thought_complexity || 0,
                    latency: attrs.performance?.latency_ms || 0,
                    heap_used: attrs.resource?.memory?.heap_used_mb || 0,
                    metacognitive_awareness: attrs.cognitive?.metacognitive_awareness || 0,
                    breakthrough_likelihood: attrs.cognitive?.breakthrough_likelihood || 0,
                    group: attrs.experiment?.group || 'unknown',
                  };

                  if (metrics.group === 'control' || attrs.cognitive?.mode === 'baseline') {
                    controlGroup.push(metrics);
                  } else if (metrics.group === 'treatment' || attrs.cognitive?.mode === 'agi') {
                    treatmentGroup.push(metrics);
                  }
                }
              } catch (e) {
                // Skip parse errors
              }
            }
          });
        });

        // Perform statistical analysis
        if (controlGroup.length > 0 || treatmentGroup.length > 0) {
          console.log('\n📊 Experiment Results:');
          console.log(`   Control Group: ${controlGroup.length} samples`);
          console.log(`   Treatment Group: ${treatmentGroup.length} samples`);

          if (controlGroup.length > 1 && treatmentGroup.length > 1) {
            // Calculate means
            const controlMean = {
              quality: controlGroup.reduce((s, m) => s + m.quality_score, 0) / controlGroup.length,
              complexity: controlGroup.reduce((s, m) => s + m.complexity, 0) / controlGroup.length,
              latency: controlGroup.reduce((s, m) => s + m.latency, 0) / controlGroup.length,
              metacognitive:
                controlGroup.reduce((s, m) => s + m.metacognitive_awareness, 0) /
                controlGroup.length,
            };

            const treatmentMean = {
              quality:
                treatmentGroup.reduce((s, m) => s + m.quality_score, 0) / treatmentGroup.length,
              complexity:
                treatmentGroup.reduce((s, m) => s + m.complexity, 0) / treatmentGroup.length,
              latency: treatmentGroup.reduce((s, m) => s + m.latency, 0) / treatmentGroup.length,
              metacognitive:
                treatmentGroup.reduce((s, m) => s + m.metacognitive_awareness, 0) /
                treatmentGroup.length,
            };

            // Calculate improvement percentages
            const improvements = {
              quality: (
                ((treatmentMean.quality - controlMean.quality) / controlMean.quality) *
                100
              ).toFixed(1),
              complexity: (
                ((treatmentMean.complexity - controlMean.complexity) / controlMean.complexity) *
                100
              ).toFixed(1),
              latency: (
                ((controlMean.latency - treatmentMean.latency) / controlMean.latency) *
                100
              ).toFixed(1),
              metacognitive: (
                ((treatmentMean.metacognitive - controlMean.metacognitive) /
                  controlMean.metacognitive) *
                100
              ).toFixed(1),
            };

            console.log('\n   📈 Performance Comparison:');
            console.log(
              `      Quality Score: ${controlMean.quality.toFixed(3)} → ${treatmentMean.quality.toFixed(3)} (${improvements.quality}%)`
            );
            console.log(
              `      Complexity: ${controlMean.complexity.toFixed(1)} → ${treatmentMean.complexity.toFixed(1)} (${improvements.complexity}%)`
            );
            console.log(
              `      Latency: ${controlMean.latency.toFixed(1)}ms → ${treatmentMean.latency.toFixed(1)}ms (${improvements.latency}% faster)`
            );
            console.log(
              `      Metacognitive: ${controlMean.metacognitive.toFixed(3)} → ${treatmentMean.metacognitive.toFixed(3)} (${improvements.metacognitive}%)`
            );

            // Simple t-test calculation
            const variance = (arr, mean) => {
              return arr.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / (arr.length - 1);
            };

            const controlQualityVar = variance(
              controlGroup.map(m => m.quality_score),
              controlMean.quality
            );
            const treatmentQualityVar = variance(
              treatmentGroup.map(m => m.quality_score),
              treatmentMean.quality
            );

            const pooledSE = Math.sqrt(
              controlQualityVar / controlGroup.length + treatmentQualityVar / treatmentGroup.length
            );
            const tStat = Math.abs((treatmentMean.quality - controlMean.quality) / pooledSE);

            console.log('\n   📉 Statistical Analysis:');
            console.log(`      T-Statistic: ${tStat.toFixed(3)}`);
            console.log(
              `      Significance: ${tStat > 1.96 ? '✅ Significant (p < 0.05)' : '❌ Not significant'}`
            );

            // Cohen's d effect size
            const pooledSD = Math.sqrt((controlQualityVar + treatmentQualityVar) / 2);
            const cohenD = Math.abs((treatmentMean.quality - controlMean.quality) / pooledSD);

            console.log(
              `      Effect Size (Cohen's d): ${cohenD.toFixed(3)} ${
                cohenD < 0.2
                  ? '(negligible)'
                  : cohenD < 0.5
                    ? '(small)'
                    : cohenD < 0.8
                      ? '(medium)'
                      : '(large)'
              }`
            );
          }
        } else {
          console.log('❌ No experiment data found for ID:', experimentId);
        }
        break;

      case 'cognitive-query':
        // Generic query for cognitive metrics
        const queryType = args[0];
        const queryValue = args[1];

        if (!queryType || !queryValue) {
          console.error('Usage: cognitive-query <metric> <threshold>');
          console.error(
            'Metrics: metacognitive_awareness, breakthrough_likelihood, confidence, complexity'
          );
          process.exit(1);
        }

        console.log(`\n🧠 Querying for ${queryType} > ${queryValue}...`);

        const cogQuery = `
          query {
            projects {
              edges {
                node {
                  id
                  name
                  traces: spans(first: 500, rootSpansOnly: true, sort: { col: startTime, dir: desc }) {
                    edges {
                      node {
                        id
                        name
                        startTime
                        context { traceId }
                        attributes
                      }
                    }
                  }
                }
              }
            }
          }
        `;

        const cogData = await diagnostics.query(cogQuery);
        const threshold = parseFloat(queryValue);
        const matches = [];

        cogData.projects.edges.forEach(project => {
          project.node.traces.edges.forEach(trace => {
            if (trace.node.attributes) {
              try {
                const attrs = JSON.parse(trace.node.attributes);
                const value = attrs.cognitive?.[queryType] || attrs.performance?.[queryType];

                if (value && value > threshold) {
                  matches.push({
                    traceId: trace.node.context.traceId,
                    timestamp: new Date(trace.node.startTime).toLocaleString(),
                    value: value,
                    thought_length: attrs.cognitive?.thought_length,
                    complexity: attrs.cognitive?.thought_complexity,
                    requestId: attrs.mcp?.request_id,
                  });
                }
              } catch (e) {
                // Skip parse errors
              }
            }
          });
        });

        if (matches.length > 0) {
          console.log(`✅ Found ${matches.length} traces with ${queryType} > ${threshold}:\n`);
          matches.slice(0, 10).forEach(match => {
            console.log(`   📍 Trace: ${match.traceId}`);
            console.log(`      Time: ${match.timestamp}`);
            console.log(`      ${queryType}: ${match.value}`);
            if (match.thought_length) console.log(`      Thought Length: ${match.thought_length}`);
            if (match.complexity) console.log(`      Complexity: ${match.complexity}`);
            console.log('');
          });

          if (matches.length > 10) {
            console.log(`   ... and ${matches.length - 10} more`);
          }
        } else {
          console.log(`❌ No traces found with ${queryType} > ${threshold}`);
        }
        break;

      case 'aggregate':
        // Aggregate statistics over time period
        const period = args[0] || '1h';
        console.log(`\n📊 Aggregating metrics for last ${period}...`);

        const aggQuery = `
          query {
            projects {
              edges {
                node {
                  id
                  name
                  traces: spans(first: 1000, rootSpansOnly: true, sort: { col: startTime, dir: desc }) {
                    edges {
                      node {
                        id
                        startTime
                        attributes
                      }
                    }
                  }
                }
              }
            }
          }
        `;

        const aggData = await diagnostics.query(aggQuery);

        // Parse time period
        const now = new Date();
        const periodMs = period.includes('h')
          ? parseInt(period) * 3600000
          : period.includes('m')
            ? parseInt(period) * 60000
            : period.includes('d')
              ? parseInt(period) * 86400000
              : 3600000;
        const cutoff = new Date(now - periodMs);

        const aggregates = {
          total_traces: 0,
          avg_thought_length: [],
          avg_complexity: [],
          avg_metacognitive: [],
          avg_confidence: [],
          avg_latency: [],
          memory_usage: [],
          breakthrough_count: 0,
          error_count: 0,
        };

        aggData.projects.edges.forEach(project => {
          project.node.traces.edges.forEach(trace => {
            const traceTime = new Date(trace.node.startTime);

            if (traceTime > cutoff && trace.node.attributes) {
              try {
                const attrs = JSON.parse(trace.node.attributes);

                aggregates.total_traces++;

                if (attrs.cognitive?.thought_length)
                  aggregates.avg_thought_length.push(attrs.cognitive.thought_length);
                if (attrs.cognitive?.thought_complexity)
                  aggregates.avg_complexity.push(attrs.cognitive.thought_complexity);
                if (attrs.cognitive?.metacognitive_awareness)
                  aggregates.avg_metacognitive.push(attrs.cognitive.metacognitive_awareness);
                if (attrs.cognitive?.confidence)
                  aggregates.avg_confidence.push(attrs.cognitive.confidence);
                if (attrs.performance?.latency_ms)
                  aggregates.avg_latency.push(attrs.performance.latency_ms);
                if (attrs.resource?.memory?.heap_used_mb)
                  aggregates.memory_usage.push(attrs.resource.memory.heap_used_mb);
                if (attrs.cognitive?.breakthrough_likelihood > 0.7) aggregates.breakthrough_count++;
                if (attrs.status === 'ERROR') aggregates.error_count++;
              } catch (e) {
                // Skip parse errors
              }
            }
          });
        });

        // Calculate averages
        const avg = arr => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

        console.log('📈 Aggregate Statistics:');
        console.log(`   Period: Last ${period} (${aggregates.total_traces} traces)`);
        console.log('\n   Cognitive Metrics:');
        console.log(`      Avg Thought Length: ${avg(aggregates.avg_thought_length).toFixed(0)}`);
        console.log(`      Avg Complexity: ${avg(aggregates.avg_complexity).toFixed(1)}`);
        console.log(`      Avg Metacognitive: ${avg(aggregates.avg_metacognitive).toFixed(3)}`);
        console.log(`      Avg Confidence: ${avg(aggregates.avg_confidence).toFixed(3)}`);
        console.log(`      Breakthroughs: ${aggregates.breakthrough_count}`);

        console.log('\n   Performance Metrics:');
        console.log(`      Avg Latency: ${avg(aggregates.avg_latency).toFixed(1)}ms`);
        console.log(`      Avg Memory: ${avg(aggregates.memory_usage).toFixed(1)}MB`);
        console.log(
          `      Error Rate: ${((aggregates.error_count / aggregates.total_traces) * 100).toFixed(1)}%`
        );

        if (aggregates.avg_thought_length.length > 10) {
          // Calculate percentiles
          const sorted = [...aggregates.avg_thought_length].sort((a, b) => a - b);
          const p50 = sorted[Math.floor(sorted.length * 0.5)];
          const p95 = sorted[Math.floor(sorted.length * 0.95)];
          const p99 = sorted[Math.floor(sorted.length * 0.99)];

          console.log('\n   Thought Length Percentiles:');
          console.log(`      P50: ${p50}`);
          console.log(`      P95: ${p95}`);
          console.log(`      P99: ${p99}`);
        }
        break;

      case 'search':
        const searchTerm = args[0];
        if (!searchTerm) {
          console.error('Please provide a search term (e.g., request_id)');
          process.exit(1);
        }

        console.log(`\n🔍 Searching for "${searchTerm}" in attributes...`);
        const searchQuery = `
          query {
            projects {
              edges {
                node {
                  id
                  name
                  traces: spans(first: 500, rootSpansOnly: true, sort: { col: startTime, dir: desc }) {
                    edges {
                      node {
                        id
                        name
                        context { traceId }
                        attributes
                      }
                    }
                  }
                }
              }
            }
          }
        `;

        const searchData = await diagnostics.query(searchQuery);
        let found = false;

        searchData.projects.edges.forEach(project => {
          project.node.traces.edges.forEach(trace => {
            if (trace.node.attributes && trace.node.attributes.includes(searchTerm)) {
              if (!found) {
                console.log('✅ Found match!');
                found = true;
              }

              try {
                const attrs = JSON.parse(trace.node.attributes);
                console.log(`\n📍 Trace: ${trace.node.context.traceId}`);
                console.log(`   Span: ${trace.node.name}`);
                console.log(`   Request ID: ${attrs.mcp?.request_id}`);

                if (attrs.cognitive) {
                  console.log('\n   🧠 Cognitive Metrics:');
                  console.log(`      • Thought Length: ${attrs.cognitive.thought_length}`);
                  console.log(`      • Thought Number: ${attrs.cognitive.thought_number}`);
                  console.log(`      • Total Thoughts: ${attrs.cognitive.total_thoughts}`);
                  console.log(`      • Thought Complexity: ${attrs.cognitive.thought_complexity}`);
                }
              } catch (e) {
                console.log('   Attributes:', trace.node.attributes);
              }
            }
          });
        });

        if (!found) {
          console.log('❌ No matches found.');
        }
        break;

      case 'help':
      default:
        console.log(`
Phoenix Diagnostics Tool
========================

A tool for querying and analyzing Phoenix observability data.

Usage: node phoenix-diagnostics-simple.js <command> [options]

Commands:
  projects                    List all projects
  traces [limit]              List recent traces (default: 10)
  trace <id>                  Show detailed trace information
  span <id>                   Show detailed span information
  metrics                     Display metrics summary
  monitor [ms]                Monitor traces in real-time (default: 5000ms)
  search <term>               Search for a term in trace attributes
  find-by-time <ts>           Find traces by timestamp
  experiment-analysis <id>    Analyze A/B test experiment results
  cognitive-query <m> <v>     Query traces by cognitive metric threshold
  aggregate [period]          Aggregate statistics (1h, 24h, 7d, etc.)
  help                        Show this help message

Environment Variables:
  PHOENIX_URL        Phoenix server URL (default: http://localhost:6006)
  PHOENIX_API_KEY    API key for authentication (optional)
  PHOENIX_PROJECT_ID Project ID (default: UHJvamVjdDoy)

Examples:
  node phoenix-diagnostics-simple.js projects
  node phoenix-diagnostics-simple.js traces 20
  node phoenix-diagnostics-simple.js trace 7daecbbf77cc54bcc118df96a4e67c24
  node phoenix-diagnostics-simple.js span U3BhbjoxMTk0
  node phoenix-diagnostics-simple.js metrics
  node phoenix-diagnostics-simple.js monitor 10000
  node phoenix-diagnostics-simple.js search 6f776d89406d5621
  node phoenix-diagnostics-simple.js find-by-time "10:12:40 PM"
  node phoenix-diagnostics-simple.js experiment-analysis exp_abc123
  node phoenix-diagnostics-simple.js cognitive-query metacognitive_awareness 0.7
  node phoenix-diagnostics-simple.js aggregate 24h

Advanced Queries:
  - Find high-confidence traces: cognitive-query confidence 0.8
  - Find breakthrough moments: cognitive-query breakthrough_likelihood 0.7
  - Analyze last hour: aggregate 1h
  - Compare experiment groups: experiment-analysis <experiment_id>
        `);
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response && error.response.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { PhoenixDiagnostics };
