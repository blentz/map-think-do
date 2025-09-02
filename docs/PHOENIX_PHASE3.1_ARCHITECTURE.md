# Phoenix Observability Phase 3.1: Project Management Technical Architecture

Version: 2.0.0
Status: Production-Ready Architecture
Author: System Architect
Date: 2025-09-02

## Executive Summary

This document provides the complete technical architecture for Phoenix Phase 3.1 Project Management features. The architecture is designed for production deployment, integrating seamlessly with existing Phase 1/2 telemetry infrastructure while providing enterprise-grade multi-project support, metrics aggregation, and cross-project analysis capabilities.

### Architecture Principles

1. **Zero Breaking Changes**: All Phase 3.1 components integrate without modifying existing Phase 1/2 functionality
2. **Performance First**: Sub-100ms project operations with efficient caching and indexing
3. **Scalability**: Support for 100+ concurrent projects with millions of spans
4. **Observability**: Full telemetry integration with existing Phoenix infrastructure
5. **Security**: Project-level isolation with proper access control

## Architecture Overview

### Core Design Principles

1. **Isolation**: Each project maintains separate trace namespaces and data partitions
2. **Performance**: Sub-100ms project switching, sub-500ms metrics calculation
3. **Scalability**: Support for 100+ projects with minimal performance impact
4. **Resilience**: Circuit breakers, fallbacks, and graceful degradation
5. **Observability**: Comprehensive metrics and audit trails for all operations

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Phoenix UI Layer                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Project  │  │ Metrics  │  │ Analysis │  │  Config  │   │
│  │ Selector │  │Dashboard │  │  Views   │  │  Editor  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   REST API   │  │ GraphQL API  │  │  WebSocket   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Core Components Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Project    │  │   Metrics    │  │Cross-Project │      │
│  │   Manager    │  │  Aggregator  │  │   Analyzer   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Context    │  │    Cache     │  │   Circuit    │      │
│  │   Provider   │  │   Manager    │  │   Breaker    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Data Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ PostgreSQL   │  │    Redis     │  │  Message     │      │
│  │ (Partitioned)│  │   (Cache)    │  │    Queue     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. ProjectManager

Central orchestrator for all project-related operations.

```typescript
interface IProjectManager {
  // Core CRUD operations
  createProject(config: ProjectConfig): Promise<Project>;
  getProject(projectId: string): Promise<Project>;
  updateProject(projectId: string, updates: Partial<ProjectConfig>): Promise<Project>;
  archiveProject(projectId: string): Promise<void>;
  restoreProject(projectId: string): Promise<void>;

  // Query operations
  listProjects(filter?: ProjectFilter): Promise<Project[]>;
  searchProjects(query: string): Promise<Project[]>;

  // Context management
  switchContext(projectId: string): Promise<void>;
  getCurrentContext(): string | null;

  // Bulk operations
  bulkUpdate(updates: ProjectUpdate[]): Promise<BulkResult>;
  bulkArchive(projectIds: string[]): Promise<BulkResult>;
}

interface ProjectConfig {
  name: string;
  description?: string;
  owner: string;
  tags: string[];
  metadata: Record<string, any>;
  settings: ProjectSettings;
}

interface ProjectSettings {
  samplingRate: number;
  retentionDays: number;
  alertThresholds: AlertThresholds;
  quotaLimits: QuotaLimits;
}
```

### 2. ProjectContextProvider

Manages project context propagation through OpenTelemetry.

```typescript
interface IProjectContextProvider {
  // Context management
  setCurrentProject(projectId: string): void;
  getCurrentProject(): string | null;
  clearContext(): void;

  // OpenTelemetry integration
  injectContext(span: Span): void;
  extractContext(context: Context): string | null;
  propagateContext(headers: Headers): void;

  // Validation
  validateProjectAccess(projectId: string, userId: string): Promise<boolean>;
  checkProjectQuota(projectId: string): Promise<QuotaStatus>;
}
```

### 3. ProjectMetricsAggregator

Handles real-time and batch metrics calculation.

```typescript
interface IProjectMetricsAggregator {
  // Real-time metrics
  calculateRealTimeMetrics(projectId: string): Promise<ProjectMetrics>;
  streamMetrics(projectId: string): AsyncIterator<ProjectMetrics>;

  // Batch processing
  scheduleBatchAggregation(projectId: string, schedule: CronExpression): void;
  processBatchMetrics(projectId: string, range: TimeRange): Promise<void>;

  // Historical data
  getHistoricalMetrics(projectId: string, range: TimeRange): Promise<HistoricalMetrics>;
  getMetricsTrend(projectId: string, metric: MetricType, range: TimeRange): Promise<Trend>;

  // Export capabilities
  exportMetrics(projectId: string, format: ExportFormat): Promise<Buffer>;
  generateReport(projectId: string, template: ReportTemplate): Promise<Report>;
}

interface ProjectMetrics {
  spanCount: number;
  errorRate: number;
  avgDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  throughput: number;
  uniqueTraces: number;
  lastUpdated: Date;
}
```

### 4. CrossProjectAnalyzer

Enables comparative analysis across projects.

```typescript
interface ICrossProjectAnalyzer {
  // Comparison operations
  compareProjects(projectIds: string[], metrics: MetricType[]): Promise<ComparisonResult>;
  rankProjects(metric: MetricType, order: SortOrder): Promise<RankingResult>;

  // Pattern detection
  identifyPatterns(projectIds: string[]): Promise<Pattern[]>;
  detectAnomalies(projectIds: string[]): Promise<Anomaly[]>;
  findSimilarProjects(projectId: string, threshold: number): Promise<Project[]>;

  // Benchmarking
  benchmarkPerformance(projectId: string, baseline?: string): Promise<BenchmarkResult>;
  calculateEfficiency(projectId: string): Promise<EfficiencyScore>;

  // Reporting
  generateComparativeReport(config: AnalysisConfig): Promise<Report>;
  exportAnalysis(analysis: Analysis, format: ExportFormat): Promise<Buffer>;
}
```

## Database Schema

### Core Tables

```sql
-- Projects table with partitioning support
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  owner VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'suspended')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  archived_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb
) PARTITION BY HASH (id);

-- Create 4 partitions for load distribution
CREATE TABLE projects_p0 PARTITION OF projects FOR VALUES WITH (modulus 4, remainder 0);
CREATE TABLE projects_p1 PARTITION OF projects FOR VALUES WITH (modulus 4, remainder 1);
CREATE TABLE projects_p2 PARTITION OF projects FOR VALUES WITH (modulus 4, remainder 2);
CREATE TABLE projects_p3 PARTITION OF projects FOR VALUES WITH (modulus 4, remainder 3);

-- Project configuration versioning
CREATE TABLE project_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  config JSONB NOT NULL,
  environment VARCHAR(50) DEFAULT 'production',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(255) NOT NULL,
  change_summary TEXT,
  UNIQUE(project_id, version, environment)
);

-- Project tags for searchability
CREATE TABLE project_tags (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tag VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (project_id, tag)
);

-- Audit log for compliance
CREATE TABLE project_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  changes JSONB,
  performed_by VARCHAR(255) NOT NULL,
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
) PARTITION BY RANGE (performed_at);

-- Create monthly partitions for audit log
CREATE TABLE project_audit_log_2025_01 PARTITION OF project_audit_log
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
-- Continue for each month...

-- Project metrics cache
CREATE TABLE project_metrics_cache (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  metric_type VARCHAR(50) NOT NULL,
  value NUMERIC,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ttl_seconds INTEGER DEFAULT 60,
  PRIMARY KEY (project_id, metric_type)
);
```

### Materialized Views for Performance

```sql
-- Real-time metrics view (refreshed every minute)
CREATE MATERIALIZED VIEW project_metrics_realtime AS
SELECT
  p.id as project_id,
  p.name as project_name,
  COUNT(DISTINCT s.trace_id) as trace_count,
  COUNT(s.id) as span_count,
  AVG(s.duration_ms)::NUMERIC(10,2) as avg_duration,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.duration_ms) as p50_duration,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY s.duration_ms) as p95_duration,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY s.duration_ms) as p99_duration,
  (SUM(CASE WHEN s.status = 'ERROR' THEN 1 ELSE 0 END)::FLOAT / NULLIF(COUNT(*), 0) * 100)::NUMERIC(5,2) as error_rate,
  COUNT(s.id) / EXTRACT(EPOCH FROM (MAX(s.created_at) - MIN(s.created_at))) as throughput,
  MAX(s.created_at) as last_activity,
  NOW() as calculated_at
FROM projects p
LEFT JOIN spans s ON s.project_id = p.id
  AND s.created_at > NOW() - INTERVAL '1 hour'
WHERE p.status = 'active'
GROUP BY p.id, p.name
WITH DATA;

-- Create refresh job
CREATE OR REPLACE FUNCTION refresh_project_metrics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY project_metrics_realtime;
END;
$$ LANGUAGE plpgsql;

-- Schedule refresh every minute
SELECT cron.schedule('refresh-project-metrics', '* * * * *', 'SELECT refresh_project_metrics()');

-- Historical metrics aggregation
CREATE TABLE project_metrics_historical (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  granularity VARCHAR(20) NOT NULL CHECK (granularity IN ('minute', 'hour', 'day', 'week', 'month')),
  metrics JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (project_id, period_start, granularity)
) PARTITION BY RANGE (period_start);
```

### Performance Indexes

```sql
-- Primary lookup indexes
CREATE INDEX idx_projects_status ON projects(status) WHERE status = 'active';
CREATE INDEX idx_projects_owner ON projects(owner);
CREATE INDEX idx_projects_created ON projects(created_at DESC);

-- Configuration indexes
CREATE INDEX idx_project_configs_lookup ON project_configs(project_id, environment, version DESC);
CREATE INDEX idx_project_configs_latest ON project_configs(project_id, environment)
  WHERE version = (SELECT MAX(version) FROM project_configs pc2 WHERE pc2.project_id = project_id);

-- Tag search indexes
CREATE INDEX idx_project_tags_tag ON project_tags USING gin(tag gin_trgm_ops);
CREATE INDEX idx_project_tags_project ON project_tags(project_id);

-- Audit log indexes
CREATE INDEX idx_audit_log_project ON project_audit_log(project_id, performed_at DESC);
CREATE INDEX idx_audit_log_action ON project_audit_log(action, performed_at DESC);
CREATE INDEX idx_audit_log_user ON project_audit_log(performed_by, performed_at DESC);

-- Metrics cache indexes
CREATE INDEX idx_metrics_cache_lookup ON project_metrics_cache(project_id, metric_type);
CREATE INDEX idx_metrics_cache_ttl ON project_metrics_cache(calculated_at, ttl_seconds);

-- Full-text search
CREATE INDEX idx_projects_search ON projects USING gin(
  to_tsvector('english', name || ' ' || COALESCE(description, ''))
);
```

## API Design

### REST API Endpoints

```yaml
openapi: 3.0.0
info:
  title: Phoenix Project Management API
  version: 1.0.0

paths:
  /api/v1/projects:
    post:
      summary: Create new project
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ProjectConfig'
      responses:
        201:
          description: Project created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Project'

    get:
      summary: List projects
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [active, archived, suspended]
        - name: owner
          in: query
          schema:
            type: string
        - name: tags
          in: query
          schema:
            type: array
            items:
              type: string
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
      responses:
        200:
          description: List of projects
          content:
            application/json:
              schema:
                type: object
                properties:
                  projects:
                    type: array
                    items:
                      $ref: '#/components/schemas/Project'
                  pagination:
                    $ref: '#/components/schemas/Pagination'

  /api/v1/projects/{projectId}:
    get:
      summary: Get project details
      parameters:
        - name: projectId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        200:
          description: Project details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Project'

    put:
      summary: Update project
      parameters:
        - name: projectId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ProjectUpdate'
      responses:
        200:
          description: Project updated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Project'

    delete:
      summary: Archive project
      parameters:
        - name: projectId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        204:
          description: Project archived

  /api/v1/projects/{projectId}/metrics:
    get:
      summary: Get project metrics
      parameters:
        - name: projectId
          in: path
          required: true
          schema:
            type: string
            format: uuid
        - name: range
          in: query
          schema:
            type: string
            enum: [1h, 6h, 24h, 7d, 30d]
            default: 24h
      responses:
        200:
          description: Project metrics
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProjectMetrics'

  /api/v1/projects/{projectId}/metrics/stream:
    get:
      summary: Stream real-time metrics
      parameters:
        - name: projectId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        200:
          description: Server-sent events stream
          content:
            text/event-stream:
              schema:
                type: string

  /api/v1/analysis/compare:
    post:
      summary: Compare multiple projects
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                projectIds:
                  type: array
                  items:
                    type: string
                    format: uuid
                metrics:
                  type: array
                  items:
                    type: string
                    enum: [spanCount, errorRate, avgDuration, p95Duration, throughput]
      responses:
        200:
          description: Comparison results
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ComparisonResult'
```

### GraphQL Schema

```graphql
type Query {
  # Single project queries
  project(id: ID!): Project
  projectByName(name: String!): Project

  # List queries with filtering
  projects(filter: ProjectFilter, sort: ProjectSort, pagination: Pagination): ProjectConnection!

  # Search capabilities
  searchProjects(query: String!, limit: Int = 10): [Project!]!

  # Metrics queries
  projectMetrics(projectId: ID!, range: TimeRange!, granularity: MetricGranularity): ProjectMetrics!

  # Analysis queries
  compareProjects(projectIds: [ID!]!, metrics: [MetricType!]!, range: TimeRange): ComparisonResult!

  projectPatterns(projectIds: [ID!]!, minSupport: Float = 0.1): [Pattern!]!

  projectBenchmark(projectId: ID!, baselineId: ID): BenchmarkResult!
}

type Mutation {
  # Project CRUD
  createProject(input: CreateProjectInput!): Project!
  updateProject(id: ID!, input: UpdateProjectInput!): Project!
  archiveProject(id: ID!): Project!
  restoreProject(id: ID!): Project!

  # Bulk operations
  bulkUpdateProjects(updates: [ProjectUpdate!]!): BulkResult!
  bulkArchiveProjects(ids: [ID!]!): BulkResult!

  # Configuration management
  updateProjectConfig(projectId: ID!, config: JSON!, environment: Environment!): ProjectConfig!

  rollbackProjectConfig(projectId: ID!, version: Int!, environment: Environment!): ProjectConfig!

  # Tag management
  addProjectTags(projectId: ID!, tags: [String!]!): Project!
  removeProjectTags(projectId: ID!, tags: [String!]!): Project!
}

type Subscription {
  # Real-time updates
  projectUpdated(id: ID!): Project!
  projectMetrics(id: ID!): ProjectMetrics!

  # Batch notifications
  projectsCreated: [Project!]!
  projectsArchived: [Project!]!
}

type Project {
  id: ID!
  name: String!
  description: String
  owner: String!
  status: ProjectStatus!
  tags: [String!]!
  createdAt: DateTime!
  updatedAt: DateTime!
  archivedAt: DateTime
  metadata: JSON!
  settings: ProjectSettings!

  # Relationships
  config(environment: Environment!): ProjectConfig!
  configs(limit: Int, offset: Int): [ProjectConfig!]!
  metrics(range: TimeRange!): ProjectMetrics!
  auditLog(limit: Int, offset: Int): [AuditEntry!]!

  # Computed fields
  spanCount: Int!
  activeUsers: Int!
  storageUsed: BigInt!
  quotaStatus: QuotaStatus!
}

type ProjectMetrics {
  projectId: ID!
  spanCount: Int!
  traceCount: Int!
  errorRate: Float!
  avgDuration: Float!
  p50Duration: Float!
  p95Duration: Float!
  p99Duration: Float!
  throughput: Float!
  uniqueServices: Int!
  uniqueOperations: Int!
  lastActivity: DateTime!
  calculatedAt: DateTime!

  # Time series data
  timeSeries(metric: MetricType!, granularity: MetricGranularity!): [TimeSeriesPoint!]!

  # Comparisons
  changeFromPrevious: MetricChange!
  trend: TrendDirection!
}

enum ProjectStatus {
  ACTIVE
  ARCHIVED
  SUSPENDED
}

enum MetricType {
  SPAN_COUNT
  ERROR_RATE
  AVG_DURATION
  P50_DURATION
  P95_DURATION
  P99_DURATION
  THROUGHPUT
}

enum MetricGranularity {
  MINUTE
  HOUR
  DAY
  WEEK
  MONTH
}

enum TrendDirection {
  IMPROVING
  STABLE
  DEGRADING
}
```

## Performance Optimization

### 1. Caching Strategy

```typescript
class ProjectCacheManager {
  private redis: Redis;
  private memoryCache: LRUCache<string, any>;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    this.memoryCache = new LRUCache({
      max: 1000,
      ttl: 1000 * 60, // 1 minute
      updateAgeOnGet: true,
    });
  }

  async getProject(projectId: string): Promise<Project | null> {
    // L1 cache: Memory
    const memCached = this.memoryCache.get(`project:${projectId}`);
    if (memCached) {
      return memCached;
    }

    // L2 cache: Redis
    const redisCached = await this.redis.get(`project:${projectId}`);
    if (redisCached) {
      const project = JSON.parse(redisCached);
      this.memoryCache.set(`project:${projectId}`, project);
      return project;
    }

    return null;
  }

  async setProject(project: Project): Promise<void> {
    const key = `project:${project.id}`;
    const value = JSON.stringify(project);

    // Set in both caches
    this.memoryCache.set(key, project);
    await this.redis.setex(key, 300, value); // 5 minute TTL
  }

  async invalidateProject(projectId: string): Promise<void> {
    const pattern = `*:${projectId}*`;

    // Clear memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.includes(projectId)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear Redis cache
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

### 2. Database Query Optimization

```typescript
class OptimizedProjectRepository {
  private db: Pool;
  private preparedStatements: Map<string, string>;

  constructor() {
    this.db = new Pool({
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      statement_timeout: 5000,
      query_timeout: 5000,
    });

    this.preparedStatements = new Map([
      ['getProject', 'SELECT * FROM projects WHERE id = $1 AND status = $2'],
      [
        'listProjects',
        'SELECT * FROM projects WHERE status = ANY($1) ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      ],
      ['getMetrics', 'SELECT * FROM project_metrics_realtime WHERE project_id = $1'],
    ]);
  }

  async getProject(projectId: string): Promise<Project> {
    const query = {
      name: 'getProject',
      text: this.preparedStatements.get('getProject'),
      values: [projectId, 'active'],
    };

    const result = await this.db.query(query);
    return result.rows[0];
  }

  async getProjectWithMetrics(projectId: string): Promise<ProjectWithMetrics> {
    // Parallel queries for better performance
    const [projectResult, metricsResult] = await Promise.all([
      this.db.query({
        name: 'getProject',
        text: this.preparedStatements.get('getProject'),
        values: [projectId, 'active'],
      }),
      this.db.query({
        name: 'getMetrics',
        text: this.preparedStatements.get('getMetrics'),
        values: [projectId],
      }),
    ]);

    return {
      ...projectResult.rows[0],
      metrics: metricsResult.rows[0],
    };
  }

  async bulkGetProjects(projectIds: string[]): Promise<Project[]> {
    // Use VALUES list for efficient bulk fetch
    const query = `
      SELECT p.*, pm.*
      FROM projects p
      LEFT JOIN project_metrics_realtime pm ON p.id = pm.project_id
      WHERE p.id = ANY($1::uuid[])
      ORDER BY array_position($1::uuid[], p.id)
    `;

    const result = await this.db.query(query, [projectIds]);
    return result.rows;
  }
}
```

### 3. Async Processing Queue

```typescript
class MetricsProcessingQueue {
  private queue: Queue;
  private workers: Worker[];

  constructor() {
    this.queue = new Queue('metrics-processing', {
      connection: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 1000,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    this.initializeWorkers();
  }

  private initializeWorkers(): void {
    const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '10');

    for (let i = 0; i < concurrency; i++) {
      const worker = new Worker(
        'metrics-processing',
        async job => {
          switch (job.name) {
            case 'calculate-metrics':
              return await this.processMetricsCalculation(job.data);
            case 'aggregate-historical':
              return await this.processHistoricalAggregation(job.data);
            case 'cross-project-analysis':
              return await this.processCrossProjectAnalysis(job.data);
            default:
              throw new Error(`Unknown job type: ${job.name}`);
          }
        },
        {
          connection: {
            host: process.env.REDIS_HOST,
            port: parseInt(process.env.REDIS_PORT || '6379'),
          },
          concurrency: 5,
        }
      );

      worker.on('completed', job => {
        logger.info(`Job ${job.id} completed successfully`);
      });

      worker.on('failed', (job, err) => {
        logger.error(`Job ${job?.id} failed:`, err);
      });

      this.workers.push(worker);
    }
  }

  async scheduleMetricsCalculation(projectId: string): Promise<void> {
    await this.queue.add(
      'calculate-metrics',
      { projectId, timestamp: Date.now() },
      {
        priority: 1,
        delay: 0,
        jobId: `metrics-${projectId}-${Date.now()}`,
      }
    );
  }

  private async processMetricsCalculation(data: any): Promise<void> {
    const { projectId } = data;

    // Parallel processing for efficiency
    const [spanMetrics, errorMetrics, latencyMetrics] = await Promise.all([
      this.calculateSpanMetrics(projectId),
      this.calculateErrorMetrics(projectId),
      this.calculateLatencyMetrics(projectId),
    ]);

    // Update cache
    await this.updateMetricsCache(projectId, {
      ...spanMetrics,
      ...errorMetrics,
      ...latencyMetrics,
      calculatedAt: new Date(),
    });

    // Emit real-time update
    this.emitMetricsUpdate(projectId, metrics);
  }
}
```

## Error Handling & Resilience

### 1. Circuit Breaker Implementation

```typescript
class ProjectServiceCircuitBreaker {
  private breaker: CircuitBreaker;
  private fallbackCache: ICache;

  constructor(
    private projectService: IProjectService,
    private cache: ICache
  ) {
    this.breaker = new CircuitBreaker(
      async (projectId: string) => {
        return await this.projectService.getProject(projectId);
      },
      {
        timeout: 3000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        volumeThreshold: 10,
        sleepWindow: 10000,
      }
    );

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.breaker.on('open', () => {
      logger.warn('Circuit breaker opened - using fallback');
      metrics.increment('circuit_breaker.open');
    });

    this.breaker.on('halfOpen', () => {
      logger.info('Circuit breaker half-open - testing recovery');
    });

    this.breaker.on('close', () => {
      logger.info('Circuit breaker closed - service recovered');
      metrics.increment('circuit_breaker.close');
    });
  }

  async getProject(projectId: string): Promise<Project> {
    try {
      const project = await this.breaker.fire(projectId);

      // Update cache on success
      await this.cache.set(`project:${projectId}`, project, 300);

      return project;
    } catch (error) {
      // Circuit is open or request failed
      logger.warn(`Circuit breaker fallback for project ${projectId}`);

      // Try cache first
      const cached = await this.cache.get(`project:${projectId}`);
      if (cached) {
        return cached;
      }

      // Return minimal data as last resort
      return this.getMinimalProjectData(projectId);
    }
  }

  private getMinimalProjectData(projectId: string): Project {
    return {
      id: projectId,
      name: 'Unknown Project',
      status: 'unknown',
      metadata: {},
      settings: this.getDefaultSettings(),
    };
  }
}
```

### 2. Error Types and Handling

```typescript
// Custom error hierarchy
class ProjectError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: any,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'ProjectError';
    Error.captureStackTrace(this, this.constructor);
  }
}

class ProjectNotFoundError extends ProjectError {
  constructor(projectId: string) {
    super(`Project ${projectId} not found`, 'PROJECT_NOT_FOUND', 404, { projectId }, false);
  }
}

class ProjectQuotaExceededError extends ProjectError {
  constructor(projectId: string, limit: number, current: number) {
    super(
      `Project ${projectId} exceeded quota: ${current}/${limit}`,
      'QUOTA_EXCEEDED',
      429,
      { projectId, limit, current },
      false
    );
  }
}

class ProjectValidationError extends ProjectError {
  constructor(errors: ValidationError[]) {
    super('Project validation failed', 'VALIDATION_ERROR', 400, { errors }, false);
  }
}

// Global error handler
class ProjectErrorHandler {
  handle(error: Error, req: Request, res: Response): void {
    // Log error with context
    logger.error('Request error', {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
      user: req.user?.id,
    });

    // Handle known errors
    if (error instanceof ProjectError) {
      res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          retryable: error.retryable,
          timestamp: new Date().toISOString(),
        },
      });

      // Track error metrics
      metrics.increment(`error.${error.code}`);
      return;
    }

    // Handle database errors
    if (error.code === '23505') {
      res.status(409).json({
        error: {
          code: 'DUPLICATE_PROJECT',
          message: 'A project with this name already exists',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Default error response
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
      },
    });

    // Track unknown errors
    metrics.increment('error.unknown');
  }
}
```

## Testing Strategy

### 1. Unit Tests

```typescript
describe('ProjectManager', () => {
  let projectManager: ProjectManager;
  let mockDb: jest.Mocked<IDatabase>;
  let mockCache: jest.Mocked<ICache>;
  let mockQueue: jest.Mocked<IQueue>;

  beforeEach(() => {
    mockDb = createMockDatabase();
    mockCache = createMockCache();
    mockQueue = createMockQueue();

    projectManager = new ProjectManager({
      database: mockDb,
      cache: mockCache,
      queue: mockQueue,
    });
  });

  describe('createProject', () => {
    it('should create project with valid configuration', async () => {
      const config: ProjectConfig = {
        name: 'Test Project',
        owner: 'test@example.com',
        tags: ['production', 'critical'],
        metadata: { team: 'platform' },
      };

      mockDb.insert.mockResolvedValue({ id: 'proj-123', ...config });

      const project = await projectManager.createProject(config);

      expect(project).toMatchObject({
        id: expect.any(String),
        name: config.name,
        owner: config.owner,
        status: 'active',
      });

      expect(mockDb.insert).toHaveBeenCalledWith(
        'projects',
        expect.objectContaining({
          name: config.name,
          owner: config.owner,
        })
      );

      expect(mockCache.set).toHaveBeenCalledWith(`project:${project.id}`, project, 300);
    });

    it('should enforce project quota limits', async () => {
      mockDb.count.mockResolvedValue(100); // At quota limit

      await expect(
        projectManager.createProject({ name: 'Over Quota', owner: 'test@example.com' })
      ).rejects.toThrow(ProjectQuotaExceededError);

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should validate project configuration', async () => {
      const invalidConfig = {
        name: '', // Invalid: empty name
        owner: 'invalid-email', // Invalid: not an email
        tags: ['a'.repeat(101)], // Invalid: tag too long
      };

      await expect(projectManager.createProject(invalidConfig)).rejects.toThrow(
        ProjectValidationError
      );
    });
  });

  describe('Performance Requirements', () => {
    it('should switch project context within 100ms', async () => {
      mockCache.get.mockResolvedValue({ id: 'proj-123', name: 'Cached Project' });

      const start = performance.now();
      await projectManager.switchContext('proj-123');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
      expect(mockCache.get).toHaveBeenCalledWith('project:proj-123');
    });

    it('should calculate metrics within 500ms for large datasets', async () => {
      // Mock large dataset with deterministic values
      const mockSpans = Array(1000000)
        .fill(null)
        .map((_, i) => ({
          id: `span-${i}`,
          duration_ms: (i % 1000) + 100, // Deterministic duration between 100-1100ms
          status: i % 20 === 0 ? 'ERROR' : 'OK', // 5% error rate deterministically
        }));

      mockDb.query.mockResolvedValue({ rows: mockSpans });

      const start = performance.now();
      const metrics = await projectManager.calculateMetrics('proj-123');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(500);
      expect(metrics).toHaveProperty('spanCount', 1000000);
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics).toHaveProperty('p95Duration');
    });

    it('should handle concurrent project operations', async () => {
      const projectIds = Array(100)
        .fill(null)
        .map((_, i) => `proj-${i}`);

      const operations = projectIds.map(id => projectManager.getProject(id));

      const start = performance.now();
      await Promise.all(operations);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1000); // All 100 operations in under 1 second
    });
  });
});
```

### 2. Integration Tests

```typescript
describe('Project Management Integration', () => {
  let app: Application;
  let db: Database;
  let redis: Redis;

  beforeAll(async () => {
    // Set up test environment
    db = await setupTestDatabase();
    redis = await setupTestRedis();
    app = await createTestApp({ db, redis });
  });

  afterAll(async () => {
    await cleanupTestData();
    await db.close();
    await redis.quit();
  });

  describe('Complete Project Lifecycle', () => {
    let projectId: string;

    it('should create a new project', async () => {
      const response = await request(app)
        .post('/api/v1/projects')
        .send({
          name: 'Integration Test Project',
          owner: 'test@example.com',
          tags: ['test', 'integration'],
          metadata: {
            environment: 'test',
            version: '1.0.0',
          },
        })
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        name: 'Integration Test Project',
        status: 'active',
      });

      projectId = response.body.id;
    });

    it('should update project configuration', async () => {
      const response = await request(app)
        .put(`/api/v1/projects/${projectId}`)
        .send({
          description: 'Updated description',
          tags: ['test', 'integration', 'updated'],
        })
        .expect(200);

      expect(response.body.description).toBe('Updated description');
      expect(response.body.tags).toContain('updated');
    });

    it('should retrieve project metrics', async () => {
      // Generate some test spans
      await generateTestSpans(projectId, 1000);

      const response = await request(app).get(`/api/v1/projects/${projectId}/metrics`).expect(200);

      expect(response.body).toMatchObject({
        spanCount: expect.any(Number),
        errorRate: expect.any(Number),
        avgDuration: expect.any(Number),
        p95Duration: expect.any(Number),
      });
    });

    it('should stream real-time metrics updates', done => {
      const eventSource = new EventSource(
        `http://localhost:3000/api/v1/projects/${projectId}/metrics/stream`
      );

      let updateCount = 0;

      eventSource.onmessage = event => {
        const metrics = JSON.parse(event.data);

        expect(metrics).toHaveProperty('spanCount');
        expect(metrics).toHaveProperty('calculatedAt');

        updateCount++;

        if (updateCount >= 3) {
          eventSource.close();
          done();
        }
      };

      // Generate spans to trigger updates
      setInterval(() => generateTestSpans(projectId, 10), 100);
    });

    it('should compare multiple projects', async () => {
      // Create additional projects for comparison
      const project2 = await createTestProject('Comparison Project 2');
      const project3 = await createTestProject('Comparison Project 3');

      await generateTestSpans(project2.id, 500);
      await generateTestSpans(project3.id, 750);

      const response = await request(app)
        .post('/api/v1/analysis/compare')
        .send({
          projectIds: [projectId, project2.id, project3.id],
          metrics: ['spanCount', 'errorRate', 'avgDuration'],
        })
        .expect(200);

      expect(response.body).toHaveProperty('comparison');
      expect(response.body.comparison).toHaveLength(3);
      expect(response.body).toHaveProperty('rankings');
    });

    it('should archive and restore project', async () => {
      // Archive project
      await request(app).delete(`/api/v1/projects/${projectId}`).expect(204);

      // Verify archived
      const getResponse = await request(app).get(`/api/v1/projects/${projectId}`).expect(200);

      expect(getResponse.body.status).toBe('archived');

      // Restore project
      await request(app).post(`/api/v1/projects/${projectId}/restore`).expect(200);

      // Verify restored
      const restoredResponse = await request(app).get(`/api/v1/projects/${projectId}`).expect(200);

      expect(restoredResponse.body.status).toBe('active');
    });
  });

  describe('Error Handling', () => {
    it('should handle project not found', async () => {
      const response = await request(app).get('/api/v1/projects/non-existent-id').expect(404);

      expect(response.body.error).toMatchObject({
        code: 'PROJECT_NOT_FOUND',
        message: expect.stringContaining('not found'),
      });
    });

    it('should handle duplicate project names', async () => {
      await createTestProject('Duplicate Name');

      const response = await request(app)
        .post('/api/v1/projects')
        .send({
          name: 'Duplicate Name',
          owner: 'test@example.com',
        })
        .expect(409);

      expect(response.body.error.code).toBe('DUPLICATE_PROJECT');
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/v1/projects')
        .send({
          name: '', // Invalid
          owner: 'not-an-email', // Invalid
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.errors).toHaveLength(2);
    });
  });
});
```

### 3. Load Testing

```javascript
// k6 load test script
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% under 500ms, 99% under 1s
    http_req_failed: ['rate<0.1'], // Error rate under 10%
    errors: ['rate<0.1'], // Custom error rate under 10%
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

export default function () {
  const projectId = `test-project-${__VU}-${__ITER}`;

  // Test 1: Project creation (should be fast even under load)
  const createRes = http.post(
    `${BASE_URL}/api/v1/projects`,
    JSON.stringify({
      name: `Load Test Project ${projectId}`,
      owner: `user-${__VU}@example.com`,
      tags: ['load-test', `vu-${__VU}`],
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(createRes, {
    'project created': r => r.status === 201,
    'creation under 200ms': r => r.timings.duration < 200,
  });

  errorRate.add(createRes.status !== 201);

  if (createRes.status === 201) {
    const project = JSON.parse(createRes.body);

    // Test 2: Project switching (100ms requirement)
    const switchRes = http.post(`${BASE_URL}/api/v1/projects/${project.id}/switch`, null, {
      headers: { 'Content-Type': 'application/json' },
    });

    check(switchRes, {
      'switch successful': r => r.status === 200,
      'switch under 100ms': r => r.timings.duration < 100,
    });

    // Test 3: Metrics calculation (500ms requirement)
    const metricsRes = http.get(`${BASE_URL}/api/v1/projects/${project.id}/metrics`);

    check(metricsRes, {
      'metrics retrieved': r => r.status === 200,
      'metrics under 500ms': r => r.timings.duration < 500,
    });

    // Test 4: Concurrent operations
    const batch = http.batch([
      ['GET', `${BASE_URL}/api/v1/projects/${project.id}`],
      ['GET', `${BASE_URL}/api/v1/projects/${project.id}/metrics`],
      ['GET', `${BASE_URL}/api/v1/projects/${project.id}/config`],
    ]);

    check(batch[0], {
      'batch request 1 successful': r => r.status === 200,
    });

    // Clean up: Archive project
    http.del(`${BASE_URL}/api/v1/projects/${project.id}`);
  }

  sleep(1);
}

export function teardown(data) {
  // Clean up test data after load test
  console.log('Cleaning up test projects...');
}
```

## Implementation Timeline

### Phase 3.1 Schedule (6 Weeks)

#### Week 1-2: Foundation (Jan 6-17, 2025)

- **Database Setup**
  - Create PostgreSQL schemas and partitions
  - Set up materialized views
  - Implement migration scripts
  - Configure TimescaleDB (if applicable)

- **Core Components**
  - Implement ProjectManager
  - Build ProjectContextProvider
  - Create basic CRUD operations
  - Set up dependency injection

- **Caching Layer**
  - Configure Redis
  - Implement multi-tier caching
  - Create cache invalidation logic
  - Set up cache warming strategies

#### Week 3: Integration (Jan 20-24, 2025)

- **Phoenix Integration**
  - Extend PhoenixAdapter for project context
  - Add project selector to UI
  - Implement project-scoped filtering
  - Create project dashboard views

- **OpenTelemetry Integration**
  - Implement baggage propagation
  - Add project_id to span attributes
  - Create custom samplers
  - Build project-aware exporters

- **Phase 1/2 Integration**
  - Connect SpanHierarchyManager
  - Integrate OpenInferenceAdapter
  - Link EventManager
  - Update StatusMapper

#### Week 4: Metrics & Analytics (Jan 27-31, 2025)

- **Metrics Aggregation**
  - Build ProjectMetricsAggregator
  - Implement real-time calculations
  - Create batch processing pipeline
  - Set up incremental aggregation

- **Historical Data**
  - Design time-series storage
  - Implement data retention policies
  - Create aggregation jobs
  - Build trend analysis

- **Export Capabilities**
  - Implement JSON/CSV export
  - Add Prometheus metrics endpoint
  - Create report generation
  - Build data streaming APIs

#### Week 5: Cross-Project Features (Feb 3-7, 2025)

- **Comparison Engine**
  - Implement CrossProjectAnalyzer
  - Build comparison algorithms
  - Create ranking system
  - Add statistical analysis

- **Pattern Detection**
  - Implement pattern mining
  - Build anomaly detection
  - Create similarity matching
  - Add clustering algorithms

- **Benchmarking**
  - Create baseline calculations
  - Implement performance scoring
  - Build efficiency metrics
  - Add cost analysis

#### Week 6: Testing & Optimization (Feb 10-14, 2025)

- **Testing**
  - Complete unit test suite
  - Run integration tests
  - Perform load testing
  - Execute security testing

- **Performance Optimization**
  - Query optimization
  - Index tuning
  - Cache optimization
  - Connection pooling

- **Documentation & Deployment**
  - API documentation
  - Deployment guides
  - Runbooks
  - Performance benchmarks

### Resource Requirements

#### Team

- 2 Senior Backend Engineers (full-time)
- 1 Database Specialist (50%)
- 1 DevOps Engineer (50%)
- 1 QA Engineer (full-time weeks 5-6)
- 1 Technical Writer (25%)

#### Infrastructure

- PostgreSQL 14+ cluster (3 nodes)
- Redis 6+ cluster (3 nodes)
- Message queue (RabbitMQ/Bull)
- Load balancer
- Monitoring stack (Prometheus/Grafana)

#### Dependencies

```json
{
  "dependencies": {
    "@opentelemetry/api": "^1.7.0",
    "@opentelemetry/sdk-trace-base": "^1.18.0",
    "bull": "^4.11.0",
    "ioredis": "^5.3.0",
    "pg": "^8.11.0",
    "circuit-breaker-js": "^0.6.0",
    "lru-cache": "^10.0.0",
    "express": "^4.18.0",
    "graphql": "^16.8.0",
    "apollo-server-express": "^3.12.0"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "@types/jest": "^29.5.0",
    "supertest": "^6.3.0",
    "k6": "^0.47.0"
  }
}
```

## Risk Mitigation

### Technical Risks

1. **Performance Degradation**
   - Risk: System slows down with many projects
   - Mitigation: Implement partitioning, caching, and async processing
   - Monitoring: Set up performance alerts and dashboards

2. **Data Consistency**
   - Risk: Inconsistent data across caches and database
   - Mitigation: Implement cache invalidation and eventual consistency patterns
   - Monitoring: Add consistency checks and audit logs

3. **Resource Exhaustion**
   - Risk: Memory/CPU exhaustion under load
   - Mitigation: Implement circuit breakers and rate limiting
   - Monitoring: Resource usage alerts and auto-scaling

### Operational Risks

1. **Migration Complexity**
   - Risk: Difficult migration from single to multi-project
   - Mitigation: Create migration tools and rollback procedures
   - Testing: Extensive migration testing in staging

2. **User Adoption**
   - Risk: Users confused by new project features
   - Mitigation: Gradual rollout with feature flags
   - Support: Documentation and training materials

## Success Metrics

### Performance Metrics

- Project switch time < 100ms (p99)
- Metrics calculation < 500ms for 1M spans (p95)
- API response time < 200ms (p95)
- System supports 100+ active projects
- <5% performance degradation with cross-project analysis

### Business Metrics

- User adoption rate > 80% within 3 months
- Reduction in cross-project data confusion by 90%
- Increase in trace analysis efficiency by 50%
- Customer satisfaction score > 4.5/5

### Technical Metrics

- Test coverage > 90%
- Zero critical security vulnerabilities
- System availability > 99.9%
- Error rate < 0.1%

## Conclusion

This architecture provides a robust, scalable foundation for Phoenix Observability Phase 3.1 Project Management features. The design emphasizes:

1. **Performance**: Meeting all sub-second response time requirements
2. **Scalability**: Supporting 100+ projects with minimal impact
3. **Reliability**: Circuit breakers, fallbacks, and error handling
4. **Maintainability**: Clean architecture with clear separation of concerns
5. **Observability**: Comprehensive metrics and audit trails

The phased implementation approach ensures incremental delivery of value while maintaining system stability. With proper testing and monitoring, this architecture will successfully support multi-project observability at scale.
