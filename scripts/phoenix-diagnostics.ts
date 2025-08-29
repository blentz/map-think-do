#!/usr/bin/env ts-node

/**
 * Phoenix Diagnostics Script
 *
 * This script provides tools for querying and analyzing trace data from Phoenix observability platform.
 * It supports both GraphQL and REST API endpoints for comprehensive trace analysis.
 */

import axios, { AxiosInstance } from 'axios';
import { format } from 'date-fns';

interface PhoenixConfig {
  baseUrl: string;
  apiKey?: string;
  projectId?: string;
}

interface Span {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  duration: number;
  statusCode: string;
  attributes: Record<string, any>;
  events: Event[];
  parentId?: string;
  children?: Span[];
}

interface Trace {
  id: string;
  rootSpan: Span;
  spans: Span[];
  startTime: string;
  endTime: string;
  duration: number;
  spanCount: number;
}

interface Event {
  name: string;
  timestamp: string;
  attributes: Record<string, any>;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface QueryOptions {
  limit?: number;
  offset?: number;
  startTime?: Date;
  endTime?: Date;
  filterBy?: Record<string, any>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class PhoenixDiagnostics {
  private client: AxiosInstance;
  private config: PhoenixConfig;

  constructor(config: PhoenixConfig) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:6006',
      apiKey: config.apiKey,
      projectId: config.projectId || 'UHJvamVjdDoy', // Default to Project:2
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
      },
    });
  }

  /**
   * Execute a GraphQL query against Phoenix
   */
  async graphqlQuery<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
    try {
      const response = await this.client.post('/graphql', {
        query,
        variables,
      });

      if (response.data.errors) {
        console.error('GraphQL errors:', response.data.errors);
        throw new Error(`GraphQL query failed: ${JSON.stringify(response.data.errors)}`);
      }

      return response.data.data;
    } catch (error) {
      console.error('Failed to execute GraphQL query:', error);
      throw error;
    }
  }

  /**
   * Get project information
   */
  async getProject(projectId?: string): Promise<Project> {
    const id = projectId || this.config.projectId;
    const query = `
      query GetProject($id: ID!) {
        project(id: $id) {
          id
          name
          description
          createdAt
          updatedAt
        }
      }
    `;

    const data = await this.graphqlQuery(query, { id });
    return data.project;
  }

  /**
   * List all projects
   */
  async listProjects(): Promise<Project[]> {
    const query = `
      query ListProjects {
        projects {
          edges {
            node {
              id
              name
              description
              createdAt
              updatedAt
            }
          }
        }
      }
    `;

    const data = await this.graphqlQuery(query);
    return data.projects.edges.map((edge: any) => edge.node);
  }

  /**
   * Get traces for a project
   */
  async getTraces(options: QueryOptions = {}): Promise<Trace[]> {
    const query = `
      query GetTraces($projectId: ID!, $first: Int, $after: String, $filter: TraceFilter) {
        project(id: $projectId) {
          traces(first: $first, after: $after, filter: $filter) {
            edges {
              node {
                id
                rootSpan {
                  id
                  name
                  startTime
                  endTime
                  statusCode
                  attributes
                }
                spans {
                  id
                  name
                  startTime
                  endTime
                  statusCode
                  parentId
                  attributes
                  events {
                    name
                    timestamp
                    attributes
                  }
                }
                startTime
                endTime
                spanCount
              }
              cursor
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `;

    const variables = {
      projectId: this.config.projectId,
      first: options.limit || 100,
      filter: this.buildTraceFilter(options),
    };

    const data = await this.graphqlQuery(query, variables);
    return data.project.traces.edges.map((edge: any) => this.transformTrace(edge.node));
  }

  /**
   * Get a specific trace by ID
   */
  async getTrace(traceId: string): Promise<Trace> {
    const query = `
      query GetTrace($traceId: ID!) {
        trace(id: $traceId) {
          id
          rootSpan {
            id
            name
            startTime
            endTime
            statusCode
            attributes
          }
          spans {
            id
            name
            startTime
            endTime
            statusCode
            parentId
            attributes
            events {
              name
              timestamp
              attributes
            }
          }
          startTime
          endTime
          spanCount
        }
      }
    `;

    const data = await this.graphqlQuery(query, { traceId });
    return this.transformTrace(data.trace);
  }

  /**
   * Get spans for a specific trace
   */
  async getSpans(traceId: string): Promise<Span[]> {
    const trace = await this.getTrace(traceId);
    return trace.spans;
  }

  /**
   * Get a specific span by ID
   */
  async getSpan(spanId: string): Promise<Span> {
    const query = `
      query GetSpan($spanId: ID!) {
        span(id: $spanId) {
          id
          name
          startTime
          endTime
          statusCode
          parentId
          attributes
          events {
            name
            timestamp
            attributes
          }
        }
      }
    `;

    const data = await this.graphqlQuery(query, { spanId });
    return data.span;
  }

  /**
   * Search for traces matching specific criteria
   */
  async searchTraces(
    searchCriteria: {
      name?: string;
      statusCode?: string;
      minDuration?: number;
      maxDuration?: number;
      attributes?: Record<string, any>;
    },
    options: QueryOptions = {}
  ): Promise<Trace[]> {
    const traces = await this.getTraces(options);

    return traces.filter(trace => {
      const rootSpan = trace.rootSpan;

      if (searchCriteria.name && !rootSpan.name.includes(searchCriteria.name)) {
        return false;
      }

      if (searchCriteria.statusCode && rootSpan.statusCode !== searchCriteria.statusCode) {
        return false;
      }

      if (searchCriteria.minDuration && trace.duration < searchCriteria.minDuration) {
        return false;
      }

      if (searchCriteria.maxDuration && trace.duration > searchCriteria.maxDuration) {
        return false;
      }

      if (searchCriteria.attributes) {
        for (const [key, value] of Object.entries(searchCriteria.attributes)) {
          if (rootSpan.attributes[key] !== value) {
            return false;
          }
        }
      }

      return true;
    });
  }

  /**
   * Analyze trace performance metrics
   */
  async analyzeTracePerformance(traceId: string): Promise<{
    totalDuration: number;
    spanCount: number;
    averageSpanDuration: number;
    slowestSpan: Span;
    errorSpans: Span[];
    spanTree: any;
  }> {
    const trace = await this.getTrace(traceId);
    const spans = trace.spans;

    const durations = spans.map(s => this.calculateDuration(s));
    const totalDuration = trace.duration;
    const averageSpanDuration = durations.reduce((a, b) => a + b, 0) / spans.length;

    const slowestSpan = spans.reduce((prev, current) =>
      this.calculateDuration(current) > this.calculateDuration(prev) ? current : prev
    );

    const errorSpans = spans.filter(s => s.statusCode === 'ERROR');

    const spanTree = this.buildSpanTree(spans);

    return {
      totalDuration,
      spanCount: trace.spanCount,
      averageSpanDuration,
      slowestSpan,
      errorSpans,
      spanTree,
    };
  }

  /**
   * Get aggregated metrics for traces
   */
  async getTraceMetrics(options: QueryOptions = {}): Promise<{
    totalTraces: number;
    averageDuration: number;
    errorRate: number;
    throughput: number;
    topOperations: Array<{ name: string; count: number; avgDuration: number }>;
  }> {
    const traces = await this.getTraces(options);

    const totalTraces = traces.length;
    const durations = traces.map(t => t.duration);
    const averageDuration = durations.reduce((a, b) => a + b, 0) / totalTraces;

    const errorTraces = traces.filter(t => t.rootSpan.statusCode === 'ERROR');
    const errorRate = (errorTraces.length / totalTraces) * 100;

    // Calculate throughput (traces per minute)
    const timeRange = this.calculateTimeRange(traces);
    const throughput = totalTraces / (timeRange / 60000); // Convert to minutes

    // Group by operation name
    const operationStats = new Map<string, { count: number; totalDuration: number }>();
    traces.forEach(trace => {
      const name = trace.rootSpan.name;
      const stats = operationStats.get(name) || { count: 0, totalDuration: 0 };
      stats.count++;
      stats.totalDuration += trace.duration;
      operationStats.set(name, stats);
    });

    const topOperations = Array.from(operationStats.entries())
      .map(([name, stats]) => ({
        name,
        count: stats.count,
        avgDuration: stats.totalDuration / stats.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalTraces,
      averageDuration,
      errorRate,
      throughput,
      topOperations,
    };
  }

  /**
   * Export traces to JSON file
   */
  async exportTracesToFile(filename: string, options: QueryOptions = {}): Promise<void> {
    const fs = await import('fs/promises');
    const traces = await this.getTraces(options);

    const exportData = {
      exportedAt: new Date().toISOString(),
      projectId: this.config.projectId,
      traceCount: traces.length,
      traces,
    };

    await fs.writeFile(filename, JSON.stringify(exportData, null, 2));
    console.log(`Exported ${traces.length} traces to ${filename}`);
  }

  /**
   * Generate a trace summary report
   */
  async generateTraceReport(traceId: string): Promise<string> {
    const trace = await this.getTrace(traceId);
    const analysis = await this.analyzeTracePerformance(traceId);

    const report = `
PHOENIX TRACE DIAGNOSTIC REPORT
================================
Generated: ${new Date().toISOString()}

TRACE INFORMATION
-----------------
Trace ID: ${trace.id}
Root Operation: ${trace.rootSpan.name}
Start Time: ${trace.startTime}
End Time: ${trace.endTime}
Total Duration: ${trace.duration}ms
Total Spans: ${trace.spanCount}
Status: ${trace.rootSpan.statusCode}

PERFORMANCE ANALYSIS
--------------------
Average Span Duration: ${analysis.averageSpanDuration.toFixed(2)}ms
Slowest Span: ${analysis.slowestSpan.name} (${this.calculateDuration(analysis.slowestSpan)}ms)
Error Count: ${analysis.errorSpans.length}

ERROR DETAILS
-------------
${
  analysis.errorSpans.length > 0
    ? analysis.errorSpans
        .map(span => `- ${span.name}: ${span.attributes.error_message || 'No error message'}`)
        .join('\n')
    : 'No errors detected'
}

SPAN HIERARCHY
--------------
${this.formatSpanTree(analysis.spanTree)}

ROOT SPAN ATTRIBUTES
--------------------
${JSON.stringify(trace.rootSpan.attributes, null, 2)}
`;

    return report;
  }

  /**
   * Monitor traces in real-time
   */
  async monitorTraces(
    interval: number = 5000,
    callback?: (traces: Trace[]) => void
  ): Promise<void> {
    console.log(`Starting trace monitoring (interval: ${interval}ms)...`);

    const monitor = async () => {
      try {
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - interval);

        const traces = await this.getTraces({
          startTime,
          endTime,
          limit: 50,
        });

        console.log(`[${format(new Date(), 'HH:mm:ss')}] Found ${traces.length} new traces`);

        if (callback) {
          callback(traces);
        }

        // Display summary
        if (traces.length > 0) {
          const errorCount = traces.filter(t => t.rootSpan.statusCode === 'ERROR').length;
          const avgDuration = traces.reduce((sum, t) => sum + t.duration, 0) / traces.length;

          console.log(`  - Errors: ${errorCount}`);
          console.log(`  - Avg Duration: ${avgDuration.toFixed(2)}ms`);
          console.log(
            `  - Operations: ${[...new Set(traces.map(t => t.rootSpan.name))].join(', ')}`
          );
        }
      } catch (error) {
        console.error('Monitoring error:', error);
      }
    };

    // Initial run
    await monitor();

    // Set up interval
    setInterval(monitor, interval);
  }

  // Helper methods

  private transformTrace(rawTrace: any): Trace {
    const duration = this.calculateDurationFromTimestamps(rawTrace.startTime, rawTrace.endTime);

    return {
      ...rawTrace,
      duration,
    };
  }

  private calculateDuration(span: Span): number {
    return this.calculateDurationFromTimestamps(span.startTime, span.endTime);
  }

  private calculateDurationFromTimestamps(start: string, end: string): number {
    return new Date(end).getTime() - new Date(start).getTime();
  }

  private calculateTimeRange(traces: Trace[]): number {
    if (traces.length === 0) return 0;

    const startTimes = traces.map(t => new Date(t.startTime).getTime());
    const endTimes = traces.map(t => new Date(t.endTime).getTime());

    const minTime = Math.min(...startTimes);
    const maxTime = Math.max(...endTimes);

    return maxTime - minTime;
  }

  private buildTraceFilter(options: QueryOptions): any {
    const filter: any = {};

    if (options.startTime) {
      filter.startTime = { gte: options.startTime.toISOString() };
    }

    if (options.endTime) {
      filter.endTime = { lte: options.endTime.toISOString() };
    }

    if (options.filterBy) {
      filter.attributes = options.filterBy;
    }

    return filter;
  }

  private buildSpanTree(spans: Span[]): any {
    const spanMap = new Map(spans.map(s => [s.id, s]));
    const tree: any = {};

    spans.forEach(span => {
      if (!span.parentId) {
        tree[span.id] = { ...span, children: [] };
      }
    });

    spans.forEach(span => {
      if (span.parentId) {
        const parent = spanMap.get(span.parentId);
        if (parent) {
          if (!parent.children) parent.children = [];
          parent.children.push(span);
        }
      }
    });

    return tree;
  }

  private formatSpanTree(tree: any, indent: number = 0): string {
    let result = '';

    for (const [, span] of Object.entries(tree)) {
      const s = span as any;
      result += '  '.repeat(indent) + `├─ ${s.name} (${this.calculateDuration(s)}ms)\n`;

      if (s.children && s.children.length > 0) {
        s.children.forEach((child: Span) => {
          result += this.formatSpanTreeNode(child, indent + 1);
        });
      }
    }

    return result;
  }

  private formatSpanTreeNode(span: Span, indent: number): string {
    let result = '  '.repeat(indent) + `├─ ${span.name} (${this.calculateDuration(span)}ms)\n`;

    if (span.children && span.children.length > 0) {
      span.children.forEach(child => {
        result += this.formatSpanTreeNode(child, indent + 1);
      });
    }

    return result;
  }
}

// CLI Interface
async function main() {
  const diagnostics = new PhoenixDiagnostics({
    baseUrl: process.env.PHOENIX_URL || 'http://localhost:6006',
    apiKey: process.env.PHOENIX_API_KEY,
    projectId: process.env.PHOENIX_PROJECT_ID || 'UHJvamVjdDoy',
  });

  const command = process.argv[2];

  try {
    switch (command) {
      case 'projects':
        const projects = await diagnostics.listProjects();
        console.log('Available Projects:');
        projects.forEach(p => {
          console.log(`  - ${p.name} (ID: ${p.id})`);
        });
        break;

      case 'traces':
        const limit = parseInt(process.argv[3]) || 10;
        const traces = await diagnostics.getTraces({ limit });
        console.log(`Recent ${limit} Traces:`);
        traces.forEach(t => {
          console.log(
            `  - ${t.id}: ${t.rootSpan.name} (${t.duration}ms) [${t.rootSpan.statusCode}]`
          );
        });
        break;

      case 'trace':
        const traceId = process.argv[3];
        if (!traceId) {
          console.error('Please provide a trace ID');
          process.exit(1);
        }
        const report = await diagnostics.generateTraceReport(traceId);
        console.log(report);
        break;

      case 'metrics':
        const metrics = await diagnostics.getTraceMetrics();
        console.log('Trace Metrics:');
        console.log(`  Total Traces: ${metrics.totalTraces}`);
        console.log(`  Average Duration: ${metrics.averageDuration.toFixed(2)}ms`);
        console.log(`  Error Rate: ${metrics.errorRate.toFixed(2)}%`);
        console.log(`  Throughput: ${metrics.throughput.toFixed(2)} traces/min`);
        console.log('\n  Top Operations:');
        metrics.topOperations.forEach(op => {
          console.log(`    - ${op.name}: ${op.count} calls (avg ${op.avgDuration.toFixed(2)}ms)`);
        });
        break;

      case 'monitor':
        const interval = parseInt(process.argv[3]) || 5000;
        await diagnostics.monitorTraces(interval);
        break;

      case 'export':
        const filename = process.argv[3] || `traces-${Date.now()}.json`;
        await diagnostics.exportTracesToFile(filename);
        break;

      case 'search':
        const searchName = process.argv[3];
        const results = await diagnostics.searchTraces({ name: searchName });
        console.log(`Found ${results.length} traces matching "${searchName}":`);
        results.forEach(t => {
          console.log(`  - ${t.id}: ${t.rootSpan.name} (${t.duration}ms)`);
        });
        break;

      case 'analyze':
        const analyzeId = process.argv[3];
        if (!analyzeId) {
          console.error('Please provide a trace ID');
          process.exit(1);
        }
        const analysis = await diagnostics.analyzeTracePerformance(analyzeId);
        console.log('Performance Analysis:');
        console.log(`  Total Duration: ${analysis.totalDuration}ms`);
        console.log(`  Span Count: ${analysis.spanCount}`);
        console.log(`  Average Span Duration: ${analysis.averageSpanDuration.toFixed(2)}ms`);
        console.log(
          `  Slowest Span: ${analysis.slowestSpan.name} (${diagnostics['calculateDuration'](analysis.slowestSpan)}ms)`
        );
        console.log(`  Error Spans: ${analysis.errorSpans.length}`);
        break;

      default:
        console.log(`
Phoenix Diagnostics Tool
========================

Usage: ts-node phoenix-diagnostics.ts <command> [options]

Commands:
  projects              List all projects
  traces [limit]        List recent traces (default: 10)
  trace <id>           Generate detailed report for a specific trace
  metrics              Display aggregate metrics
  monitor [interval]   Monitor traces in real-time (default: 5000ms)
  export [filename]    Export traces to JSON file
  search <name>        Search for traces by operation name
  analyze <id>         Analyze performance of a specific trace

Environment Variables:
  PHOENIX_URL          Phoenix server URL (default: http://localhost:6006)
  PHOENIX_API_KEY      API key for authentication (optional)
  PHOENIX_PROJECT_ID   Project ID to query (default: UHJvamVjdDoy)

Examples:
  ts-node phoenix-diagnostics.ts traces 20
  ts-node phoenix-diagnostics.ts trace 7daecbbf77cc54bcc118df96a4e67c24
  ts-node phoenix-diagnostics.ts metrics
  ts-node phoenix-diagnostics.ts monitor 10000
  ts-node phoenix-diagnostics.ts export traces-backup.json
  ts-node phoenix-diagnostics.ts search "GET /api"
        `);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Export for use as a module
export { PhoenixDiagnostics, PhoenixConfig, Trace, Span, QueryOptions };

// Run CLI if executed directly
if (require.main === module) {
  main().catch(console.error);
}
