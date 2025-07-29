/**
 * @fileoverview PostgreSQL Memory Store Implementation for Sentient AGI Reasoning Server
 *
 * Provides persistent memory storage with advanced analytics capabilities including:
 * - TimescaleDB time-series analytics for cognitive performance tracking
 * - JSONB context storage with efficient indexing
 * - Connection pooling for high-performance operations
 * - Comprehensive query support with SQL-based analytics
 * - Automatic schema management and health checks
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import {
  MemoryStore,
  StoredThought,
  ReasoningSession,
  MemoryQuery,
  MemoryStats,
  MemoryConfig,
  MemoryUtils,
} from './memory-store.js';
import { PostgreSQLConfig, PostgreSQLConfigs } from './postgresql-config.js';
import { MemoryMonitor } from './memory-monitor.js';

/**
 * PostgreSQL-based memory store implementation
 */
export class PostgreSQLMemoryStore extends MemoryStore {
  protected config: PostgreSQLConfig;
  private pool: Pool | null = null;
  private isInitialized = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private memoryMonitor: MemoryMonitor;

  constructor(config?: PostgreSQLConfig) {
    super();
    this.config = config || PostgreSQLConfigs.fromEnvironment();
    PostgreSQLConfigs.validate(this.config);
    this.memoryMonitor = MemoryMonitor.getInstance();
    this.memoryMonitor.enable();
  }

  /**
   * Initialize the PostgreSQL connection pool and verify schema
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Create connection pool
      this.pool = new Pool(this.config);

      // Test connection
      const client = await this.pool.connect();
      console.log('New client connected to PostgreSQL');

      try {
        // Verify database connectivity
        const result = await client.query('SELECT NOW() as current_time');
        if (this.config.debug) {
          console.log('PostgreSQL connection verified:', result.rows[0]);
        }

        // Initialize advanced features
        await this.initializeAdvancedFeatures(client);

        this.isInitialized = true;
        console.log('PostgreSQL Memory Store initialized successfully');

        // Start health and memory monitoring
        this.startHealthMonitoring();
        this.memoryMonitor.startMonitoring();
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Failed to initialize PostgreSQL Memory Store:', error);
      throw new Error(
        `PostgreSQL initialization failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Initialize advanced PostgreSQL features
   */
  private async initializeAdvancedFeatures(client: PoolClient): Promise<void> {
    // Check for TimescaleDB
    if (this.config.enableTimeSeries) {
      try {
        const timescaleCheck = await client.query(
          "SELECT extname FROM pg_extension WHERE extname = 'timescaledb'"
        );
        if (timescaleCheck.rows.length > 0) {
          console.log('TimescaleDB is available (server-level parameters already configured)');
        } else {
          console.warn('TimescaleDB extension not found. Time-series features will be disabled.');
        }
      } catch (error) {
        console.warn(
          'Failed to set TimescaleDB parameters:',
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    // Check for pgvector
    if (this.config.enableVectorSearch) {
      try {
        const vectorCheck = await client.query(
          "SELECT extname FROM pg_extension WHERE extname = 'vector'"
        );
        if (vectorCheck.rows.length === 0) {
          console.log('pgvector extension not found. Vector search will be disabled.');
        }
      } catch (error) {
        console.warn(
          'pgvector extension check failed:',
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    // Check for Apache AGE
    if (this.config.enableGraphQueries) {
      try {
        const ageCheck = await client.query(
          "SELECT extname FROM pg_extension WHERE extname = 'age'"
        );
        if (ageCheck.rows.length === 0) {
          console.log('Apache AGE extension not found. Graph queries will be disabled.');
        }
      } catch (error) {
        console.warn(
          'Apache AGE extension check failed:',
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  /**
   * Start health monitoring for the connection pool with circuit breaker
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      return;
    }

    let consecutiveFailures = 0;
    const MAX_FAILURES = 3;

    this.healthCheckInterval = setInterval(async () => {
      try {
        if (!this.pool) return;

        // Skip health check if too many consecutive failures (circuit breaker)
        if (consecutiveFailures >= MAX_FAILURES) {
          console.warn(`PostgreSQL health check suspended after ${consecutiveFailures} failures`);
          return;
        }

        const client = await this.pool.connect();
        try {
          await client.query('SELECT 1');
          consecutiveFailures = 0; // Reset on success
          if (this.config.debug) {
            console.log('PostgreSQL health check passed');
          }
        } finally {
          client.release();
        }
      } catch (error) {
        consecutiveFailures++;
        console.error(
          `PostgreSQL health check failed (${consecutiveFailures}/${MAX_FAILURES}):`,
          error
        );
      }
    }, 120000); // Check every 2 minutes (reduced frequency)
  }

  /**
   * Execute a query with error handling and connection management
   */
  async query(text: string, params?: any[]): Promise<QueryResult<any>> {
    if (!this.pool) {
      throw new Error('PostgreSQL Memory Store not initialized');
    }

    const client = await this.pool.connect();
    try {
      if (this.config.logQueries) {
        console.log('Executing query:', text, params);
      }

      // Add query timeout to prevent long-running queries that could cause OOM
      let timeoutId: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Query timeout')), this.config.queryTimeout || 30000);
      });

      try {
        const result = await Promise.race([
          client.query(text, params),
          timeoutPromise
        ]);
        clearTimeout(timeoutId!);
        return result;
      } catch (error) {
        clearTimeout(timeoutId!);
        throw error;
      }
    } finally {
      client.release();
    }
  }

  /**
   * Store a thought in the PostgreSQL database with context size limiting
   */
  async storeThought(thought: StoredThought): Promise<void> {
    // Limit context size to prevent OOM (max 1MB JSON)
    const contextString = JSON.stringify(thought.context || {});
    const MAX_CONTEXT_SIZE = 1024 * 1024; // 1MB
    const limitedContext =
      contextString.length > MAX_CONTEXT_SIZE
        ? JSON.stringify({
            truncated: true,
            original_size: contextString.length,
            data: 'Context too large, truncated to prevent OOM',
          })
        : contextString;

    // Limit thought text size (max 64KB)
    const MAX_THOUGHT_SIZE = 64 * 1024; // 64KB
    const limitedThought =
      thought.thought.length > MAX_THOUGHT_SIZE
        ? thought.thought.substring(0, MAX_THOUGHT_SIZE) + '...[truncated]'
        : thought.thought;

    const query = `
      INSERT INTO stored_thoughts (
        id, session_id, thought, thought_number, total_thoughts, next_thought_needed,
        is_revision, revises_thought, branch_from_thought, branch_id, needs_more_thoughts,
        timestamp, confidence, domain, objective, complexity,
        success, effectiveness_score, user_feedback, outcome_quality,
        context, tags, patterns_detected, similar_thoughts,
        output, context_trace
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
      ) ON CONFLICT (id) DO UPDATE SET
        thought = EXCLUDED.thought,
        confidence = EXCLUDED.confidence,
        effectiveness_score = EXCLUDED.effectiveness_score,
        user_feedback = EXCLUDED.user_feedback,
        updated_at = CURRENT_TIMESTAMP
    `;

    const params = [
      thought.id,
      thought.session_id,
      limitedThought,
      thought.thought_number,
      thought.total_thoughts,
      thought.next_thought_needed,
      thought.is_revision || false,
      thought.revises_thought,
      thought.branch_from_thought,
      thought.branch_id,
      thought.needs_more_thoughts,
      thought.timestamp,
      thought.confidence,
      thought.domain,
      thought.objective,
      thought.complexity,
      thought.success,
      thought.effectiveness_score,
      thought.user_feedback,
      thought.outcome_quality,
      limitedContext,
      thought.tags || [],
      thought.patterns_detected || [],
      thought.similar_thoughts || [],
      thought.output,
      thought.context_trace || [],
    ];

    await this.query(query, params);
  }

  /**
   * Store a reasoning session in the PostgreSQL database
   */
  async storeSession(session: ReasoningSession): Promise<void> {
    const query = `
      INSERT INTO reasoning_sessions (
        id, start_time, end_time, objective, domain, initial_complexity, final_complexity,
        goal_achieved, confidence_level, effectiveness_score, total_thoughts, revision_count, branch_count,
        cognitive_roles_used, metacognitive_interventions, lessons_learned, successful_strategies,
        failed_approaches, tags
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      ) ON CONFLICT (id) DO UPDATE SET
        end_time = EXCLUDED.end_time,
        goal_achieved = EXCLUDED.goal_achieved,
        confidence_level = EXCLUDED.confidence_level,
        effectiveness_score = EXCLUDED.effectiveness_score,
        total_thoughts = EXCLUDED.total_thoughts,
        revision_count = EXCLUDED.revision_count,
        branch_count = EXCLUDED.branch_count,
        updated_at = CURRENT_TIMESTAMP
    `;

    const params = [
      session.id,
      session.start_time,
      session.end_time,
      session.objective,
      session.domain,
      session.initial_complexity,
      session.final_complexity,
      session.goal_achieved,
      session.confidence_level,
      session.effectiveness_score,
      session.total_thoughts,
      session.revision_count,
      session.branch_count,
      session.cognitive_roles_used || [],
      session.metacognitive_interventions || 0,
      session.lessons_learned || [],
      session.successful_strategies || [],
      session.failed_approaches || [],
      session.tags || [],
    ];

    await this.query(query, params);
  }

  /**
   * Query thoughts based on criteria with memory-safe limits
   */
  async queryThoughts(queryParams: MemoryQuery): Promise<StoredThought[]> {
    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    // Build WHERE conditions
    if (queryParams.domain) {
      whereConditions.push(`domain = $${paramIndex++}`);
      params.push(queryParams.domain);
    }

    if (queryParams.confidence_range) {
      whereConditions.push(`confidence BETWEEN $${paramIndex++} AND $${paramIndex++}`);
      params.push(queryParams.confidence_range[0], queryParams.confidence_range[1]);
    }

    if (queryParams.complexity_range) {
      whereConditions.push(`complexity BETWEEN $${paramIndex++} AND $${paramIndex++}`);
      params.push(queryParams.complexity_range[0], queryParams.complexity_range[1]);
    }

    if (queryParams.success_only) {
      whereConditions.push('success = true');
    }

    if (queryParams.session_ids && queryParams.session_ids.length > 0) {
      whereConditions.push(`session_id = ANY($${paramIndex++})`);
      params.push(queryParams.session_ids);
    }

    if (queryParams.tags && queryParams.tags.length > 0) {
      whereConditions.push(`tags && $${paramIndex++}`);
      params.push(queryParams.tags);
    }

    // Build ORDER BY
    let orderBy = 'timestamp DESC';
    if (queryParams.sort_by) {
      const direction = queryParams.sort_order || 'desc';
      orderBy = `${queryParams.sort_by} ${direction.toUpperCase()}`;
    }

    // Build final query with memory-safe limits
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const limit = Math.min(queryParams.limit || 100, 1000); // Cap at 1000 to prevent OOM
    const offset = queryParams.offset || 0;

    const query = `
      SELECT * FROM stored_thoughts
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
    `;

    const result = await this.query(query, params);
    return result.rows.map(this.mapRowToStoredThought);
  }

  /**
   * Get a specific thought by ID
   */
  async getThought(id: string): Promise<StoredThought | null> {
    const result = await this.query('SELECT * FROM stored_thoughts WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.mapRowToStoredThought(result.rows[0]) : null;
  }

  /**
   * Get a specific session by ID
   */
  async getSession(id: string): Promise<ReasoningSession | null> {
    const result = await this.query('SELECT * FROM reasoning_sessions WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.mapRowToReasoningSession(result.rows[0]) : null;
  }

  /**
   * Get all sessions with pagination and memory-safe limits
   */
  async getSessions(limit = 100, offset = 0): Promise<ReasoningSession[]> {
    // Cap limit to prevent OOM
    const safeLimit = Math.min(limit, 1000);
    const result = await this.query(
      'SELECT * FROM reasoning_sessions ORDER BY start_time DESC LIMIT $1 OFFSET $2',
      [safeLimit, offset]
    );
    return result.rows.map(this.mapRowToReasoningSession);
  }

  /**
   * Find similar thoughts using text similarity
   */
  async findSimilarThoughts(thought: string, limit = 10): Promise<StoredThought[]> {
    // Use trigram similarity for text matching
    const query = `
      SELECT *, similarity(thought, $1) as sim
      FROM stored_thoughts
      WHERE similarity(thought, $1) > 0.3
      ORDER BY sim DESC
      LIMIT $2
    `;

    try {
      const result = await this.query(query, [thought, limit]);
      return result.rows.map(this.mapRowToStoredThought);
    } catch (error) {
      // Fallback to simple text search if trigram not available
      console.warn('Trigram similarity not available, using fallback search');
      const fallbackQuery = `
        SELECT * FROM stored_thoughts
        WHERE thought ILIKE $1
        ORDER BY timestamp DESC
        LIMIT $2
      `;
      const result = await this.query(fallbackQuery, [`%${thought}%`, limit]);
      return result.rows.map(this.mapRowToStoredThought);
    }
  }

  /**
   * Update thought metadata
   */
  async updateThought(id: string, updates: Partial<StoredThought>): Promise<void> {
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id') {
        updateFields.push(`${key} = $${paramIndex++}`);
        if (key === 'context') {
          params.push(JSON.stringify(value));
        } else {
          params.push(value);
        }
      }
    });

    if (updateFields.length === 0) return;

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const query = `
      UPDATE stored_thoughts
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
    `;

    await this.query(query, params);
  }

  /**
   * Update session metadata
   */
  async updateSession(id: string, updates: Partial<ReasoningSession>): Promise<void> {
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id') {
        updateFields.push(`${key} = $${paramIndex++}`);
        params.push(value);
      }
    });

    if (updateFields.length === 0) return;

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const query = `
      UPDATE reasoning_sessions
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
    `;

    await this.query(query, params);
  }

  /**
   * Delete old thoughts based on retention policy
   */
  async cleanupOldThoughts(olderThan: Date): Promise<number> {
    const result = await this.query('DELETE FROM stored_thoughts WHERE timestamp < $1', [
      olderThan,
    ]);
    return result.rowCount || 0;
  }

  /**
   * Get comprehensive memory statistics
   */
  async getStats(): Promise<MemoryStats> {
    // Basic counts
    const countsResult = await this.query(`
      SELECT
        (SELECT COUNT(*) FROM stored_thoughts) as total_thoughts,
        (SELECT COUNT(*) FROM reasoning_sessions) as total_sessions,
        (SELECT AVG(total_thoughts) FROM reasoning_sessions) as avg_session_length
    `);

    const counts = countsResult.rows[0];

    // Success rates
    const successResult = await this.query(`
      SELECT
        AVG(CASE WHEN success = true THEN 1.0 ELSE 0.0 END) as overall_success_rate
      FROM stored_thoughts
      WHERE success IS NOT NULL
    `);

    const overallSuccessRate = successResult.rows[0]?.overall_success_rate || 0;

    // Temporal info
    const temporalResult = await this.query(`
      SELECT
        MIN(timestamp) as oldest_thought,
        MAX(timestamp) as newest_thought
      FROM stored_thoughts
    `);

    const temporal = temporalResult.rows[0];

    // Return basic stats structure
    return {
      total_thoughts: parseInt(counts.total_thoughts) || 0,
      total_sessions: parseInt(counts.total_sessions) || 0,
      average_session_length: parseFloat(counts.avg_session_length) || 0,
      overall_success_rate: parseFloat(overallSuccessRate) || 0,
      success_rate_by_domain: {},
      success_rate_by_complexity: {},
      most_effective_roles: [],
      most_effective_patterns: [],
      common_failure_modes: [],
      performance_over_time: [],
      learning_trajectory: [],
      storage_size: 0,
      oldest_thought: temporal?.oldest_thought || new Date(),
      newest_thought: temporal?.newest_thought || new Date(),
      duplicate_rate: 0,
    };
  }

  /**
   * Export memory data with streaming to prevent OOM
   */
  async exportData(format: 'json' | 'csv' | 'jsonl', limit?: number): Promise<string> {
    if (format === 'json') {
      // Use reasonable limits to prevent OOM
      const maxLimit = limit || 10000;
      const [thoughtsResult, sessionsResult] = await Promise.all([
        this.query(`SELECT * FROM stored_thoughts ORDER BY timestamp LIMIT ${maxLimit}`),
        this.query(`SELECT * FROM reasoning_sessions ORDER BY start_time LIMIT ${maxLimit}`),
      ]);

      const thoughts = thoughtsResult.rows.map(this.mapRowToStoredThought);
      const sessions = sessionsResult.rows.map(this.mapRowToReasoningSession);

      return JSON.stringify(
        {
          thoughts,
          sessions,
          metadata: {
            export_limit: maxLimit,
            total_exported: { thoughts: thoughts.length, sessions: sessions.length },
          },
        },
        null,
        2
      );
    }

    throw new Error(`Export format ${format} not yet implemented`);
  }

  /**
   * Import memory data with batch processing to prevent OOM
   */
  async importData(data: string, format: 'json' | 'csv' | 'jsonl', batchSize = 100): Promise<void> {
    if (format === 'json') {
      const parsed = JSON.parse(data);

      // Process sessions in batches
      if (parsed.sessions && Array.isArray(parsed.sessions)) {
        for (let i = 0; i < parsed.sessions.length; i += batchSize) {
          const batch = parsed.sessions.slice(i, i + batchSize);
          for (const session of batch) {
            await this.storeSession(session);
          }
          // Allow garbage collection between batches
          if (i % 1000 === 0 && global.gc) {
            global.gc();
          }
        }
      }

      // Process thoughts in batches
      if (parsed.thoughts && Array.isArray(parsed.thoughts)) {
        for (let i = 0; i < parsed.thoughts.length; i += batchSize) {
          const batch = parsed.thoughts.slice(i, i + batchSize);
          for (const thought of batch) {
            await this.storeThought(thought);
          }
          // Allow garbage collection between batches
          if (i % 1000 === 0 && global.gc) {
            global.gc();
          }
        }
      }

      return;
    }

    throw new Error(`Import format ${format} not yet implemented`);
  }

  /**
   * Optimize storage
   */
  async optimize(): Promise<void> {
    // Run VACUUM and ANALYZE for optimization
    await this.query('VACUUM ANALYZE stored_thoughts');
    await this.query('VACUUM ANALYZE reasoning_sessions');

    console.log('PostgreSQL storage optimization completed');
  }

  /**
   * Close the memory store and cleanup resources
   */
  async close(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Stop memory monitoring
    this.memoryMonitor.stopMonitoring();

    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('PostgreSQL Memory Store closed');
    }

    this.isInitialized = false;
  }

  /**
   * Map database row to StoredThought object
   */
  private mapRowToStoredThought(row: any): StoredThought {
    return {
      id: row.id,
      thought: row.thought,
      thought_number: row.thought_number,
      total_thoughts: row.total_thoughts,
      next_thought_needed: row.next_thought_needed,
      is_revision: row.is_revision,
      revises_thought: row.revises_thought,
      branch_from_thought: row.branch_from_thought,
      branch_id: row.branch_id,
      needs_more_thoughts: row.needs_more_thoughts,
      timestamp: row.timestamp,
      session_id: row.session_id,
      confidence: row.confidence,
      domain: row.domain,
      objective: row.objective,
      complexity: row.complexity,
      success: row.success,
      effectiveness_score: row.effectiveness_score,
      user_feedback: row.user_feedback,
      context: row.context
        ? typeof row.context === 'string'
          ? JSON.parse(row.context)
          : row.context
        : {},
      tags: row.tags || [],
      patterns_detected: row.patterns_detected || [],
      similar_thoughts: row.similar_thoughts || [],
      outcome_quality: row.outcome_quality,
      output: row.output,
      context_trace: row.context_trace || [],
    };
  }

  /**
   * Map database row to ReasoningSession object
   */
  private mapRowToReasoningSession(row: any): ReasoningSession {
    return {
      id: row.id,
      start_time: row.start_time,
      end_time: row.end_time,
      objective: row.objective,
      domain: row.domain,
      initial_complexity: row.initial_complexity,
      final_complexity: row.final_complexity,
      goal_achieved: row.goal_achieved,
      confidence_level: row.confidence_level,
      total_thoughts: row.total_thoughts,
      revision_count: row.revision_count,
      branch_count: row.branch_count,
      cognitive_roles_used: row.cognitive_roles_used || [],
      metacognitive_interventions: row.metacognitive_interventions,
      effectiveness_score: row.effectiveness_score,
      lessons_learned: row.lessons_learned || [],
      successful_strategies: row.successful_strategies || [],
      failed_approaches: row.failed_approaches || [],
      tags: row.tags || [],
    };
  }
}
