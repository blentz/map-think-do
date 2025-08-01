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
  StoredPrompt,
  ReasoningSession,
  MemoryQuery,
  PromptQuery,
  MemoryStats,
  MemoryConfig,
  MemoryUtils,
  Project,
  ProjectQuery,
} from './memory-store.js';
import { PostgreSQLConfig, PostgreSQLConfigs } from './postgresql-config.js';
import { MemoryMonitor } from './memory-monitor.js';
import { ReasoningImprovementTracker } from './prompt-intelligence/reasoning-improvement-tracker.js';
import { PromptClassifier } from './prompt-intelligence/prompt-classifier.js';
import { IntentExtractor } from './prompt-intelligence/intent-extractor.js';
import { SimilarityDetector } from './prompt-intelligence/similarity-detector.js';
import { BiasReductionTracker } from './prompt-intelligence/bias-reduction-tracker.js';
import {
  ThoughtQualityAnalyzer,
  ThoughtAnalysisResult,
  ThoughtChainContext,
} from './thought-intelligence/thought-quality-analyzer.js';
import { getEmbeddingService } from '../utils/embedding-service.js';

/**
 * Safely extracts error message from unknown error type
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

/**
 * PostgreSQL-based memory store implementation
 */
export class PostgreSQLMemoryStore extends MemoryStore {
  protected config: PostgreSQLConfig;
  private pool: Pool | null = null;
  private isInitialized = false;
  private isShuttingDown = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private memoryMonitor: MemoryMonitor;
  private reasoningTracker: ReasoningImprovementTracker;
  private promptClassifier: PromptClassifier;
  private intentExtractor: IntentExtractor;
  private similarityDetector: SimilarityDetector;
  private biasTracker: BiasReductionTracker;
  private thoughtAnalyzer: ThoughtQualityAnalyzer;
  private pendingOperations: Set<Promise<any>> = new Set();

  // Project caching for single-user optimization
  private projectCache = new Map<string, Project>();
  private projectPathCache = new Map<string, Project>();

  constructor(config?: PostgreSQLConfig) {
    super();
    this.config = config || PostgreSQLConfigs.fromEnvironment();
    PostgreSQLConfigs.validate(this.config);
    this.memoryMonitor = MemoryMonitor.getInstance();
    this.memoryMonitor.enable();
    this.reasoningTracker = new ReasoningImprovementTracker();
    this.promptClassifier = new PromptClassifier();
    this.intentExtractor = new IntentExtractor();
    this.similarityDetector = new SimilarityDetector();
    this.biasTracker = new BiasReductionTracker();
    this.thoughtAnalyzer = new ThoughtQualityAnalyzer(this);
  }

  /**
   * Initialize the PostgreSQL connection pool and verify schema
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Create connection pool with limits to prevent memory exhaustion
      this.pool = new Pool({
        ...this.config,
        max: Math.min(this.config.max || 20, 20),
        min: 2,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        allowExitOnIdle: true,
      });

      // Test connection
      const client = await this.pool.connect();
      console.error('New client connected to PostgreSQL');

      try {
        // Verify database connectivity
        const result = await client.query('SELECT NOW() as current_time');
        if (this.config.debug) {
          console.error('PostgreSQL connection verified:', result.rows[0]);
        }

        // Initialize advanced features
        await this.initializeAdvancedFeatures(client);

        this.isInitialized = true;
        console.error('PostgreSQL Memory Store initialized successfully');

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
          console.error('TimescaleDB is available (server-level parameters already configured)');
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
          console.error('pgvector extension not found. Vector search will be disabled.');
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
          console.error('Apache AGE extension not found. Graph queries will be disabled.');
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

    // Use TimerManager for managed timers with auto-cleanup
    import('../utils/timer-manager.js')
      .then(({ TimerManager }) => {
        const timerManager = TimerManager.getInstance();

        const healthCheckId = timerManager.setInterval(
          async () => {
            try {
              if (!this.pool) {
                timerManager.clearTimer(healthCheckId);
                return;
              }

              // Skip health check if too many consecutive failures (circuit breaker)
              if (consecutiveFailures >= MAX_FAILURES) {
                console.warn(
                  `PostgreSQL health check suspended after ${consecutiveFailures} failures`
                );
                return;
              }

              const client = await this.pool.connect();
              try {
                await client.query('SELECT 1');
                consecutiveFailures = 0; // Reset on success
                if (this.config.debug) {
                  console.error('PostgreSQL health check passed');
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

              // Stop health checks after max failures to prevent further resource consumption
              if (consecutiveFailures >= MAX_FAILURES) {
                timerManager.clearTimer(healthCheckId);
              }
            }
          },
          120000,
          'postgresql-health-check',
          {
            maxExecutions: 100, // Limit to 100 health checks max
            ttlMs: 10 * 60 * 1000, // 10 minutes max lifetime
            memoryPressureLimit: 0.8, // Stop at 80% memory usage
          }
        );

        // Store the timer ID for cleanup
        this.healthCheckInterval = { [Symbol.toPrimitive]: () => healthCheckId } as any;
      })
      .catch(error => {
        console.warn('Failed to start managed health monitoring:', error);
      });
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
        console.error('Executing query:', text, params);
      }

      // Add query timeout to prevent long-running queries that could cause OOM
      let timeoutId: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('Query timeout')),
          this.config.queryTimeout || 30000
        );
      });

      try {
        const result = await Promise.race([client.query(text, params), timeoutPromise]);
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
   * Track an async operation and handle its completion
   */
  private trackAsyncOperation<T>(operation: Promise<T>): Promise<T> {
    if (this.isShuttingDown) {
      // Don't start new operations during shutdown
      return Promise.resolve(undefined as T);
    }

    this.pendingOperations.add(operation);

    const cleanupOperation = operation.finally(() => {
      this.pendingOperations.delete(operation);
    });

    return cleanupOperation;
  }

  /**
   * Wait for all pending async operations to complete
   */
  private async waitForPendingOperations(timeoutMs: number = 5000): Promise<void> {
    if (this.pendingOperations.size === 0) {
      return;
    }

    console.log(`⏳ Waiting for ${this.pendingOperations.size} pending operations to complete...`);

    try {
      await Promise.race([
        Promise.allSettled([...this.pendingOperations]),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout waiting for operations')), timeoutMs)
        ),
      ]);
      console.log('✅ All pending operations completed');
    } catch (error) {
      console.warn('⚠️ Some operations did not complete in time:', error);
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
        id, session_id, prompt_id, thought, thought_number, total_thoughts, next_thought_needed,
        is_revision, revises_thought, branch_from_thought, branch_id, needs_more_thoughts,
        timestamp, confidence, domain, objective, complexity,
        success, effectiveness_score, user_feedback, outcome_quality,
        context, tags, patterns_detected, similar_thoughts,
        output, context_trace
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
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
      thought.prompt_id,
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

    // Generate and store embedding asynchronously but tracked
    this.trackAsyncOperation(
      this.generateAndStoreThoughtEmbedding(thought.id, limitedThought)
        .then(() => {
          // After thought embedding is stored, update session embeddings
          return this.trackAsyncOperation(
            this.updateSessionEmbeddings(thought.session_id).catch(error => {
              if (this.isInitialized && !this.isShuttingDown) {
                console.warn(
                  `Failed to update session embeddings for ${thought.session_id}:`,
                  error
                );
              }
            })
          );
        })
        .then(() => {
          // Update pattern embeddings if patterns were detected
          if (thought.patterns_detected && thought.patterns_detected.length > 0) {
            this.trackAsyncOperation(
              this.updatePatternEmbeddings().catch(error => {
                if (this.isInitialized && !this.isShuttingDown) {
                  console.warn('Failed to update pattern embeddings:', error);
                }
              })
            );

            // Generate embeddings for new patterns immediately
            this.trackAsyncOperation(
              this.generatePatternEmbeddings(thought.patterns_detected).catch(error => {
                if (this.isInitialized && !this.isShuttingDown) {
                  console.warn('Failed to generate pattern embeddings:', error);
                }
              })
            );
          }
        })
        .catch(error => {
          if (this.isInitialized && !this.isShuttingDown) {
            console.warn(`Failed to generate embedding for thought ${thought.id}:`, error);
          }
        })
    );
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

    // Generate session objective embedding asynchronously but tracked
    this.trackAsyncOperation(
      this.generateAndStoreSessionObjectiveEmbedding(session.id, session.objective).catch(error => {
        if (this.isInitialized && !this.isShuttingDown) {
          console.warn(`Failed to generate session objective embedding for ${session.id}:`, error);
        }
      })
    );
  }

  /**
   * Store a prompt in the PostgreSQL database
   */
  async storePrompt(prompt: StoredPrompt): Promise<void> {
    // Start with the provided prompt data
    let analysisResults = {
      prompt_type: prompt.prompt_type,
      classification_confidence: prompt.classification_confidence,
      extracted_intent: prompt.extracted_intent,
      similar_prompts: prompt.similar_prompts,
      reasoning_improvement: prompt.reasoning_improvement,
      tags: prompt.tags,
    };

    try {
      // Run comprehensive AI analysis if not already provided
      if (!analysisResults.prompt_type || !analysisResults.classification_confidence) {
        console.error('🤖 Running prompt classification analysis...');
        const classification = await this.promptClassifier.classifyPrompt(prompt.original_prompt);
        analysisResults.prompt_type = classification.type;
        analysisResults.classification_confidence = classification.confidence;
        console.error(
          `✅ Classified as: ${classification.type} (${(classification.confidence * 100).toFixed(1)}%)`
        );
      }

      // Extract intent if not provided
      if (!analysisResults.extracted_intent) {
        console.error('🧠 Extracting intent from prompt...');
        const intentResult = await this.intentExtractor.extractIntent(prompt.original_prompt);
        analysisResults.extracted_intent = intentResult;
        console.error(
          `✅ Extracted ${intentResult.objectives.length} objectives, ${intentResult.constraints.length} constraints`
        );
      }

      // Find similar prompts if not provided
      if (!analysisResults.similar_prompts) {
        console.error('🔍 Finding similar prompts...');
        const existingPrompts = await this.queryPrompts({ limit: 100, exclude_id: prompt.id });
        const similarities = await this.similarityDetector.findSimilarPrompts(
          prompt.original_prompt,
          existingPrompts,
          5, // Top 5 similar prompts
          0.3 // Minimum similarity threshold
        );
        analysisResults.similar_prompts = similarities;
        console.error(`✅ Found ${similarities.length} similar prompts`);
      }

      // Calculate reasoning improvement if not provided
      if (
        analysisResults.reasoning_improvement === undefined ||
        analysisResults.reasoning_improvement === null
      ) {
        console.error('📈 Calculating reasoning improvement...');
        try {
          const sessionPrompts = await this.queryPrompts({
            session_id: prompt.session_id,
            limit: 10,
            orderBy: 'created_at',
            ascending: true,
          });

          if (sessionPrompts.length > 0) {
            const previousPrompts = sessionPrompts
              .filter(p => p.id !== prompt.id)
              .map(p => ({
                prompt: p.original_prompt,
                created_at: p.created_at,
              }));

            if (previousPrompts.length > 0) {
              analysisResults.reasoning_improvement =
                await this.reasoningTracker.calculateReasoningImprovement(
                  prompt.original_prompt,
                  previousPrompts
                );
              console.error(
                `✅ Reasoning improvement: ${(analysisResults.reasoning_improvement * 100).toFixed(1)}%`
              );
            }
          }
        } catch (error) {
          console.warn('Failed to calculate reasoning improvement:', error);
          analysisResults.reasoning_improvement = 0;
        }
      }

      // Generate tags if not provided
      if (!analysisResults.tags || analysisResults.tags.length === 0) {
        const tags = [];
        if (analysisResults.prompt_type) tags.push(analysisResults.prompt_type);
        if (analysisResults.extracted_intent && analysisResults.extracted_intent.objectives) {
          tags.push(...analysisResults.extracted_intent.objectives.slice(0, 3));
        }
        analysisResults.tags = tags.slice(0, 5); // Limit to 5 tags
      }
    } catch (error) {
      console.error('❌ AI analysis failed, using provided values:', error);
    }

    const query = `
      INSERT INTO stored_prompts (
        id, session_id, original_prompt, prompt_type, prompt_source,
        received_at, domain, complexity_estimate, estimated_cognitive_load,
        classification_confidence, prompt_context, extracted_intent, 
        similar_prompts, tags, reasoning_improvement, persona_selected,
        cognitive_priming_effectiveness, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      ) ON CONFLICT (id) DO UPDATE SET
        prompt_type = EXCLUDED.prompt_type,
        classification_confidence = EXCLUDED.classification_confidence,
        extracted_intent = EXCLUDED.extracted_intent,
        similar_prompts = EXCLUDED.similar_prompts,
        tags = EXCLUDED.tags,
        reasoning_improvement = EXCLUDED.reasoning_improvement,
        processing_completed_at = EXCLUDED.processing_completed_at,
        processing_success = EXCLUDED.processing_success,
        persona_selected = EXCLUDED.persona_selected,
        cognitive_priming_effectiveness = EXCLUDED.cognitive_priming_effectiveness,
        updated_at = CURRENT_TIMESTAMP
    `;

    const params = [
      prompt.id,
      prompt.session_id,
      prompt.original_prompt,
      analysisResults.prompt_type,
      prompt.prompt_source || 'mcp-tool',
      prompt.received_at,
      prompt.domain,
      prompt.complexity_estimate,
      prompt.estimated_cognitive_load,
      analysisResults.classification_confidence,
      prompt.prompt_context ? JSON.stringify(prompt.prompt_context) : null,
      analysisResults.extracted_intent ? JSON.stringify(analysisResults.extracted_intent) : null,
      analysisResults.similar_prompts ? JSON.stringify(analysisResults.similar_prompts) : null,
      analysisResults.tags || [],
      analysisResults.reasoning_improvement,
      prompt.persona_selected,
      prompt.cognitive_priming_effectiveness,
      prompt.created_at,
      prompt.updated_at,
    ];

    await this.query(query, params);
    console.error(`📝 Stored prompt ${prompt.id} with complete AI analysis`);

    // Generate and store prompt embedding asynchronously (don't block the main storage)
    this.generateAndStorePromptEmbedding(prompt.id, prompt.original_prompt).catch(error => {
      console.warn(`Failed to generate embedding for prompt ${prompt.id}:`, error);
    });
  }

  /**
   * Analyze and update existing prompts with AI analysis
   */
  async analyzeExistingPrompts(limit: number = 50): Promise<void> {
    console.error('🔄 Starting batch analysis of existing prompts...');

    // Get prompts that haven't been analyzed yet
    const unanalyzedPrompts = await this.query(
      `
      SELECT id, original_prompt, session_id, created_at 
      FROM stored_prompts 
      WHERE (prompt_type IS NULL OR classification_confidence IS NULL OR extracted_intent IS NULL)
      ORDER BY created_at DESC 
      LIMIT $1
    `,
      [limit]
    );

    if (unanalyzedPrompts.rows.length === 0) {
      console.error('✅ All prompts have been analyzed');
      return;
    }

    console.error(`📊 Found ${unanalyzedPrompts.rows.length} prompts to analyze`);

    for (let i = 0; i < unanalyzedPrompts.rows.length; i++) {
      const row = unanalyzedPrompts.rows[i];
      console.error(`\n🔍 [${i + 1}/${unanalyzedPrompts.rows.length}] Analyzing prompt: ${row.id}`);

      try {
        // Run classification
        const classification = await this.promptClassifier.classifyPrompt(row.original_prompt);
        console.error(
          `   📝 Classification: ${classification.type} (${(classification.confidence * 100).toFixed(1)}%)`
        );

        // Extract intent
        const intentResult = await this.intentExtractor.extractIntent(row.original_prompt);
        console.error(
          `   🧠 Intent: ${intentResult.objectives.length} objectives, ${intentResult.constraints.length} constraints`
        );

        // Find similar prompts (excluding self)
        const existingPrompts = await this.queryPrompts({ limit: 100, exclude_id: row.id });
        const similarities = await this.similarityDetector.findSimilarPrompts(
          row.original_prompt,
          existingPrompts,
          5,
          0.3
        );
        console.error(`   🔗 Similarities: ${similarities.length} similar prompts found`);

        // Calculate reasoning improvement
        let reasoningImprovement = 0;
        const sessionPrompts = await this.queryPrompts({
          session_id: row.session_id,
          limit: 10,
          orderBy: 'created_at',
          ascending: true,
          exclude_id: row.id,
        });

        if (sessionPrompts.length > 0) {
          const previousPrompts = sessionPrompts.map(p => ({
            prompt: p.original_prompt,
            created_at: p.created_at,
          }));

          reasoningImprovement = await this.reasoningTracker.calculateReasoningImprovement(
            row.original_prompt,
            previousPrompts
          );
          console.error(`   📈 Reasoning improvement: ${(reasoningImprovement * 100).toFixed(1)}%`);
        }

        // Generate tags
        const tags = [];
        if (classification.type) tags.push(classification.type);
        tags.push(...intentResult.objectives.slice(0, 3));

        // Update the prompt with analysis results
        await this.query(
          `
          UPDATE stored_prompts 
          SET 
            prompt_type = $1,
            classification_confidence = $2,
            extracted_intent = $3,
            similar_prompts = $4,
            reasoning_improvement = $5,
            tags = $6,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $7
        `,
          [
            classification.type,
            classification.confidence,
            JSON.stringify(intentResult),
            JSON.stringify(similarities),
            reasoningImprovement,
            tags.slice(0, 5),
            row.id,
          ]
        );

        console.error(`   ✅ Updated prompt ${row.id} with AI analysis`);
      } catch (error) {
        console.error(`   ❌ Failed to analyze prompt ${row.id}:`, error);
      }

      // Small delay to prevent overwhelming the system
      if (i < unanalyzedPrompts.rows.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.error(`\n🎉 Completed batch analysis of ${unanalyzedPrompts.rows.length} prompts`);
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
   * Query prompts based on criteria with memory-safe limits
   */
  async queryPrompts(queryParams: PromptQuery): Promise<StoredPrompt[]> {
    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    // Build WHERE conditions
    if (queryParams.session_id) {
      whereConditions.push(`session_id = $${paramIndex++}`);
      params.push(queryParams.session_id);
    }

    if (queryParams.prompt_type) {
      whereConditions.push(`prompt_type = $${paramIndex++}`);
      params.push(queryParams.prompt_type);
    }

    if (queryParams.domain) {
      whereConditions.push(`domain = $${paramIndex++}`);
      params.push(queryParams.domain);
    }

    if (queryParams.complexity_range) {
      whereConditions.push(`complexity_estimate BETWEEN $${paramIndex++} AND $${paramIndex++}`);
      params.push(queryParams.complexity_range[0], queryParams.complexity_range[1]);
    }

    if (queryParams.date_range) {
      whereConditions.push(`received_at BETWEEN $${paramIndex++} AND $${paramIndex++}`);
      params.push(queryParams.date_range[0], queryParams.date_range[1]);
    }

    if (queryParams.processing_success !== undefined) {
      whereConditions.push(`processing_success = $${paramIndex++}`);
      params.push(queryParams.processing_success);
    }

    if (queryParams.tags && queryParams.tags.length > 0) {
      whereConditions.push(`tags && $${paramIndex++}`);
      params.push(queryParams.tags);
    }

    if (queryParams.similar_to) {
      whereConditions.push(`original_prompt ILIKE $${paramIndex++}`);
      params.push(`%${queryParams.similar_to}%`);
    }

    if (queryParams.exclude_id) {
      whereConditions.push(`id != $${paramIndex++}`);
      params.push(queryParams.exclude_id);
    }

    // Build ORDER BY
    let orderBy = 'received_at DESC';
    if (queryParams.sort_by) {
      const direction = queryParams.sort_order || 'desc';
      orderBy = `${queryParams.sort_by} ${direction.toUpperCase()}`;
    }

    // Build final query with memory-safe limits
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const limit = Math.min(queryParams.limit || 100, 1000); // Cap at 1000 to prevent OOM
    const offset = queryParams.offset || 0;

    const query = `
      SELECT * FROM stored_prompts
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
    `;

    const result = await this.query(query, params);
    return result.rows.map(this.mapRowToStoredPrompt);
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
   * Get a specific prompt by ID
   */
  async getPrompt(id: string): Promise<StoredPrompt | null> {
    const result = await this.query('SELECT * FROM stored_prompts WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.mapRowToStoredPrompt(result.rows[0]) : null;
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
   * Find similar thoughts using hybrid search (semantic + full-text)
   */
  async findSimilarThoughts(thought: string, limit = 10): Promise<StoredThought[]> {
    // Try hybrid search first (combines semantic similarity with full-text search)
    try {
      const hybridQuery = `
        SELECT * FROM hybrid_search_thoughts($1, NULL, 0.5, 0.5, $2)
      `;
      const result = await this.query(hybridQuery, [thought, limit]);
      if (result.rows.length > 0) {
        return result.rows.map(
          row =>
            ({
              id: row.thought_id,
              session_id: row.session_id,
              thought: row.thought_text,
              confidence: row.confidence,
              domain: row.domain,
              timestamp: row.timestamp,
              // Map additional fields as needed
              thought_number: 0,
              total_thoughts: 0,
              next_thought_needed: false,
            }) as StoredThought
        );
      }
    } catch (error) {
      console.warn('Hybrid search not available, falling back to trigram similarity');
    }

    // Fallback to trigram similarity for text matching
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
      // Final fallback to simple text search if trigram not available
      console.warn('Trigram similarity not available, using basic search fallback');
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
   * Find similar prompts using hybrid search (semantic + full-text)
   */
  async findSimilarPrompts(prompt: string, limit = 10): Promise<StoredPrompt[]> {
    // Try trigram similarity for text matching
    const query = `
      SELECT *, similarity(original_prompt, $1) as sim
      FROM stored_prompts
      WHERE similarity(original_prompt, $1) > 0.3
      ORDER BY sim DESC
      LIMIT $2
    `;

    try {
      const result = await this.query(query, [prompt, limit]);
      return result.rows.map(this.mapRowToStoredPrompt);
    } catch (error) {
      // Final fallback to simple text search if trigram not available
      console.warn('Trigram similarity not available for prompts, using basic search fallback');
      const fallbackQuery = `
        SELECT * FROM stored_prompts
        WHERE original_prompt ILIKE $1
        ORDER BY received_at DESC
        LIMIT $2
      `;
      const result = await this.query(fallbackQuery, [`%${prompt}%`, limit]);
      return result.rows.map(this.mapRowToStoredPrompt);
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
   * Update prompt metadata
   */
  async updatePrompt(id: string, updates: Partial<StoredPrompt>): Promise<void> {
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id') {
        updateFields.push(`${key} = $${paramIndex++}`);
        if (key === 'prompt_context' || key === 'extracted_intent' || key === 'similar_prompts') {
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
      UPDATE stored_prompts
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

    console.error('PostgreSQL storage optimization completed');
  }

  /**
   * Advanced Analytics Methods
   */

  /**
   * Analyze success patterns from prompt history
   */
  async analyzeSuccessPatterns(promptIds: string[]): Promise<
    Array<{
      pattern_type: string;
      success_rate: number;
      common_attributes: Record<string, any>;
    }>
  > {
    const client = await this.pool!.connect();
    try {
      const result = await client.query(
        `
        SELECT 
          p.prompt_type,
          p.domain,
          AVG(CASE WHEN p.processing_success THEN 1.0 ELSE 0.0 END) as success_rate,
          COUNT(*) as sample_size,
          AVG(p.complexity_estimate) as avg_complexity,
          AVG(p.classification_confidence) as avg_confidence
        FROM stored_prompts p 
        WHERE p.id = ANY($1)
        GROUP BY p.prompt_type, p.domain
        HAVING COUNT(*) >= 3
        ORDER BY success_rate DESC
      `,
        [promptIds]
      );

      return result.rows.map(row => ({
        pattern_type: `${row.prompt_type}_${row.domain}`,
        success_rate: parseFloat(row.success_rate),
        common_attributes: {
          prompt_type: row.prompt_type,
          domain: row.domain,
          avg_complexity: parseFloat(row.avg_complexity),
          avg_confidence: parseFloat(row.avg_confidence),
          sample_size: parseInt(row.sample_size),
        },
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Calculate performance metrics for validation criteria
   */
  async calculatePerformanceMetrics(): Promise<{
    classification_accuracy: number;
    intent_extraction_precision: number;
    similarity_detection_recall: number;
    reasoning_improvement_average: number;
  }> {
    const client = await this.pool!.connect();
    try {
      const result = await client.query(`
        SELECT 
          AVG(classification_confidence) as avg_classification_confidence,
          AVG(CASE WHEN extracted_intent->>'extraction_confidence' IS NOT NULL 
              THEN (extracted_intent->>'extraction_confidence')::float 
              ELSE 0 END) as avg_intent_precision,
          AVG(CASE WHEN similar_prompts IS NOT NULL AND jsonb_array_length(similar_prompts) > 0
              THEN 0.9 ELSE 0.7 END) as similarity_recall_estimate,
          AVG(COALESCE(reasoning_improvement, 0)) as avg_reasoning_improvement
        FROM stored_prompts 
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `);

      const row = result.rows[0];
      return {
        classification_accuracy: parseFloat(row.avg_classification_confidence) || 0,
        intent_extraction_precision: parseFloat(row.avg_intent_precision) || 0,
        similarity_detection_recall: parseFloat(row.similarity_recall_estimate) || 0,
        reasoning_improvement_average: parseFloat(row.avg_reasoning_improvement) || 0,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Update prompt with performance tracking data
   */
  async updatePromptPerformance(
    promptId: string,
    performance: {
      processing_success: boolean;
      reasoning_improvement?: number;
      persona_selected?: string;
      cognitive_priming_effectiveness?: number;
    }
  ): Promise<void> {
    const client = await this.pool!.connect();
    try {
      await client.query(
        `
        UPDATE stored_prompts 
        SET 
          processing_completed_at = NOW(),
          processing_success = $2,
          reasoning_improvement = $3,
          persona_selected = $4,
          cognitive_priming_effectiveness = $5,
          updated_at = NOW()
        WHERE id = $1
      `,
        [
          promptId,
          performance.processing_success,
          performance.reasoning_improvement,
          performance.persona_selected,
          performance.cognitive_priming_effectiveness,
        ]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get cognitive performance trends using TimescaleDB analytics
   */
  async getCognitivePerformanceTrend(daysBack = 30, domain?: string): Promise<any[]> {
    try {
      const result = await this.query('SELECT * FROM get_cognitive_performance_trend($1, $2)', [
        daysBack,
        domain || null,
      ]);
      return result.rows;
    } catch (error) {
      console.warn('Cognitive performance trend analysis not available:', error);
      return [];
    }
  }

  /**
   * Analyze pattern effectiveness using advanced analytics
   */
  async analyzePatternEffectiveness(daysBack = 60): Promise<any[]> {
    try {
      const result = await this.query('SELECT * FROM analyze_pattern_effectiveness($1)', [
        daysBack,
      ]);
      return result.rows;
    } catch (error) {
      console.warn('Pattern effectiveness analysis not available:', error);
      return [];
    }
  }

  /**
   * Get cognitive load alerts for monitoring
   */
  async getCognitiveLoadAlerts(hoursBack = 24): Promise<any[]> {
    try {
      const result = await this.query('SELECT * FROM get_cognitive_load_alerts($1)', [hoursBack]);
      return result.rows;
    } catch (error) {
      console.warn('Cognitive load alerts not available:', error);
      return [];
    }
  }

  /**
   * Get real-time cognitive metrics from continuous aggregates
   */
  async getCognitiveMetricsRealtime(hoursBack = 2): Promise<any[]> {
    try {
      const result = await this.query(`
        SELECT * FROM cognitive_load_realtime
        WHERE time_window >= NOW() - INTERVAL '${hoursBack} hours'
        ORDER BY time_window DESC
      `);
      return result.rows;
    } catch (error) {
      console.warn('Real-time cognitive metrics not available:', error);
      return [];
    }
  }

  /**
   * Semantic Search Methods (pgvector integration)
   */

  /**
   * Store embedding for a thought (integration point for sentence transformers)
   */
  async storeThoughtEmbedding(
    thoughtId: string,
    embedding: number[],
    model = 'all-MiniLM-L6-v2'
  ): Promise<void> {
    try {
      await this.query('SELECT upsert_thought_embedding($1, $2, $3)', [
        thoughtId,
        `[${embedding.join(',')}]`,
        model,
      ]);
    } catch (error) {
      if (this.isInitialized && !this.isShuttingDown) {
        console.warn('Thought embedding storage not available:', error);
      }
    }
  }

  /**
   * Store embedding for a prompt (integration point for sentence transformers)
   */
  async storePromptEmbedding(
    promptId: string,
    embedding: number[],
    model = 'all-MiniLM-L6-v2'
  ): Promise<void> {
    try {
      await this.query('SELECT upsert_prompt_embedding($1, $2, $3)', [
        promptId,
        `[${embedding.join(',')}]`,
        model,
      ]);
    } catch (error) {
      console.warn('Prompt embedding storage not available:', error);
    }
  }

  /**
   * Find semantically similar thoughts using vector similarity
   */
  async findSimilarThoughtsSemantic(
    embedding: number[],
    threshold = 0.7,
    limit = 10,
    excludeSessionId?: string
  ): Promise<any[]> {
    try {
      const result = await this.query(
        'SELECT * FROM find_similar_thoughts_semantic($1, $2, $3, $4)',
        [`[${embedding.join(',')}]`, threshold, limit, excludeSessionId || null]
      );
      return result.rows;
    } catch (error) {
      console.warn('Semantic thought similarity not available:', error);
      return [];
    }
  }

  /**
   * Find similar sessions based on objective embeddings
   */
  async findSimilarSessionsSemantic(
    embedding: number[],
    threshold = 0.6,
    limit = 5,
    excludeSessionId?: string
  ): Promise<any[]> {
    try {
      const result = await this.query(
        'SELECT * FROM find_similar_sessions_semantic($1, $2, $3, $4)',
        [`[${embedding.join(',')}]`, threshold, limit, excludeSessionId || null]
      );
      return result.rows;
    } catch (error) {
      console.warn('Semantic session similarity not available:', error);
      return [];
    }
  }

  /**
   * Cluster thoughts by semantic similarity
   */
  async clusterThoughtsSemantic(threshold = 0.8, minClusterSize = 3): Promise<any[]> {
    try {
      const result = await this.query('SELECT * FROM cluster_thoughts_semantic($1, $2)', [
        threshold,
        minClusterSize,
      ]);
      return result.rows;
    } catch (error) {
      console.warn('Semantic thought clustering not available:', error);
      return [];
    }
  }

  /**
   * Hybrid search combining full-text and semantic similarity
   */
  async hybridSearchThoughts(
    queryText: string,
    embedding?: number[],
    semanticWeight = 0.5,
    fulltextWeight = 0.5,
    limit = 10,
    excludeSessionId?: string
  ): Promise<any[]> {
    try {
      const embeddingParam = embedding ? `[${embedding.join(',')}]` : null;
      const result = await this.query(
        'SELECT * FROM hybrid_search_thoughts($1, $2, $3, $4, $5, $6)',
        [queryText, embeddingParam, semanticWeight, fulltextWeight, limit, excludeSessionId || null]
      );
      return result.rows;
    } catch (error) {
      console.warn('Hybrid search not available, falling back to basic search');
      return await this.findSimilarThoughts(queryText, limit);
    }
  }

  /**
   * Update session embeddings (aggregate from thoughts)
   */
  async updateSessionEmbeddings(sessionId: string): Promise<void> {
    try {
      await this.query('SELECT update_session_embeddings($1)', [sessionId]);
    } catch (error) {
      if (this.isInitialized && !this.isShuttingDown) {
        console.warn('Session embedding update not available:', error);
      }
    }
  }

  /**
   * Check if pgvector extension is available
   */
  private async checkVectorSupport(): Promise<boolean> {
    try {
      const result = await this.query("SELECT extname FROM pg_extension WHERE extname = 'vector'");
      return result.rows.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Update pattern embeddings based on frequency
   */
  async updatePatternEmbeddings(): Promise<number> {
    try {
      const result = await this.query('SELECT update_pattern_embeddings()');
      return result.rows[0]?.update_pattern_embeddings || 0;
    } catch (error) {
      console.warn('Pattern embedding update not available:', error);
      return 0;
    }
  }

  /**
   * Find similar patterns using semantic similarity
   */
  async findSimilarPatterns(
    pattern: string,
    limit: number = 10,
    similarityThreshold: number = 0.65
  ): Promise<
    Array<{
      pattern_name: string;
      similarity_score: number;
      pattern_frequency: number;
      created_at: Date;
    }>
  > {
    try {
      const embeddingService = getEmbeddingService();
      const embeddingResult = await embeddingService.generateEmbedding(pattern);

      const result = await this.query(
        'SELECT * FROM find_similar_patterns_semantic($1::vector(384), $2, $3)',
        [`[${embeddingResult.embedding.join(',')}]`, similarityThreshold, limit]
      );

      return result.rows.map(row => ({
        pattern_name: row.pattern_name,
        similarity_score: parseFloat(row.similarity_score),
        pattern_frequency: parseInt(row.pattern_frequency),
        created_at: new Date(row.created_at),
      }));
    } catch (error) {
      console.warn('Pattern similarity search not available:', error);
      return [];
    }
  }

  /**
   * Get all stored patterns with their frequencies
   */
  async getPatterns(
    limit: number = 100,
    minFrequency: number = 1
  ): Promise<
    Array<{
      pattern_name: string;
      pattern_frequency: number;
      created_at: Date;
      has_embedding: boolean;
    }>
  > {
    try {
      const hasVectorSupport = await this.checkVectorSupport();

      let query: string;
      if (hasVectorSupport) {
        query = `
          SELECT 
            pattern_name,
            pattern_frequency,
            created_at,
            (embedding IS NOT NULL) as has_embedding
          FROM pattern_embeddings 
          WHERE pattern_frequency >= $1
          ORDER BY pattern_frequency DESC, created_at DESC
          LIMIT $2
        `;
      } else {
        query = `
          SELECT 
            pattern_name,
            pattern_frequency,
            created_at,
            (embedding_json IS NOT NULL) as has_embedding
          FROM pattern_embeddings 
          WHERE pattern_frequency >= $1
          ORDER BY pattern_frequency DESC, created_at DESC
          LIMIT $2
        `;
      }

      const result = await this.query(query, [minFrequency, limit]);

      return result.rows.map(row => ({
        pattern_name: row.pattern_name,
        pattern_frequency: parseInt(row.pattern_frequency),
        created_at: new Date(row.created_at),
        has_embedding: Boolean(row.has_embedding),
      }));
    } catch (error) {
      console.warn('Pattern retrieval not available:', error);
      return [];
    }
  }

  /**
   * Helper method to generate and store thought embedding
   */
  private async generateAndStoreThoughtEmbedding(
    thoughtId: string,
    thoughtText: string
  ): Promise<void> {
    try {
      const embeddingService = getEmbeddingService();
      const result = await embeddingService.generateEmbedding(thoughtText);
      await this.storeThoughtEmbedding(thoughtId, result.embedding, result.model);
      console.error(`✅ Generated embedding for thought ${thoughtId} (${result.processingTime}ms)`);
    } catch (error) {
      console.warn(`Failed to generate/store embedding for thought ${thoughtId}:`, error);
    }
  }

  /**
   * Helper method to generate and store prompt embedding
   */
  private async generateAndStorePromptEmbedding(
    promptId: string,
    promptText: string
  ): Promise<void> {
    try {
      const embeddingService = getEmbeddingService();
      const result = await embeddingService.generateEmbedding(promptText);

      // Store in proper prompt embeddings table
      await this.storePromptEmbedding(promptId, result.embedding, result.model);
      console.error(`✅ Generated embedding for prompt ${promptId} (${result.processingTime}ms)`);
    } catch (error) {
      console.warn(`Failed to generate/store embedding for prompt ${promptId}:`, error);
    }
  }

  /**
   * Helper method to generate and store session objective embedding
   */
  private async generateAndStoreSessionObjectiveEmbedding(
    sessionId: string,
    objective: string
  ): Promise<void> {
    try {
      const embeddingService = getEmbeddingService();
      const result = await embeddingService.generateEmbedding(objective);

      // Store session objective embedding directly in session_embeddings table
      await this.query(
        'INSERT INTO session_embeddings (session_id, objective_embedding, embedding_model) VALUES ($1, $2, $3) ON CONFLICT (session_id) DO UPDATE SET objective_embedding = EXCLUDED.objective_embedding, embedding_model = EXCLUDED.embedding_model, updated_at = CURRENT_TIMESTAMP',
        [sessionId, `[${result.embedding.join(',')}]`, result.model]
      );
      console.error(
        `✅ Generated session objective embedding for ${sessionId} (${result.processingTime}ms)`
      );
    } catch (error) {
      if (this.isInitialized && !this.isShuttingDown) {
        console.warn(
          `Failed to generate/store session objective embedding for ${sessionId}:`,
          error
        );
      }
    }
  }

  /**
   * Helper method to generate embeddings for detected patterns
   */
  private async generatePatternEmbeddings(patterns: string[]): Promise<void> {
    try {
      const embeddingService = getEmbeddingService();

      for (const pattern of patterns) {
        try {
          const result = await embeddingService.generateEmbedding(pattern);

          // Check if pgvector is available for proper vector storage
          const hasVectorSupport = await this.checkVectorSupport();

          if (hasVectorSupport) {
            // Use the proper database function for vector storage
            await this.query('SELECT upsert_pattern_embedding($1, $2::vector(384), NULL, $3)', [
              pattern,
              `[${result.embedding.join(',')}]`,
              result.model,
            ]);
          } else {
            // Use JSONB fallback for systems without pgvector
            await this.query('SELECT upsert_pattern_embedding($1, NULL, $2::jsonb, $3)', [
              pattern,
              JSON.stringify(result.embedding),
              result.model,
            ]);
          }
          console.error(
            `✅ Generated pattern embedding for "${pattern}" (${result.processingTime}ms)`
          );
        } catch (error) {
          console.warn(`Failed to generate pattern embedding for "${pattern}":`, error);
        }
      }
    } catch (error) {
      console.warn('Failed to initialize embedding service for patterns:', error);
    }
  }

  /**
   * Streaming Export/Import Methods for Large Datasets
   */

  /**
   * Stream export thoughts in batches to prevent OOM
   */
  async *streamExportThoughts(batchSize = 1000): AsyncGenerator<StoredThought[], void, unknown> {
    let offset = 0;
    let hasMore = true;
    let batchCount = 0;

    while (hasMore) {
      const result = await this.query(
        'SELECT * FROM stored_thoughts ORDER BY timestamp LIMIT $1 OFFSET $2',
        [batchSize, offset]
      );

      if (result.rows.length === 0) {
        hasMore = false;
        break;
      }

      // Add backpressure control to prevent memory exhaustion
      if (batchCount % 10 === 0) {
        const memUsage = process.memoryUsage();
        if (memUsage.heapUsed > memUsage.heapTotal * 0.8) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      batchCount++;
      yield result.rows.map(this.mapRowToStoredThought);
      offset += batchSize;

      // Allow event loop processing
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  /**
   * Stream export sessions in batches to prevent OOM
   */
  async *streamExportSessions(batchSize = 1000): AsyncGenerator<ReasoningSession[], void, unknown> {
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const result = await this.query(
        'SELECT * FROM reasoning_sessions ORDER BY start_time LIMIT $1 OFFSET $2',
        [batchSize, offset]
      );

      if (result.rows.length === 0) {
        hasMore = false;
        break;
      }

      yield result.rows.map(this.mapRowToReasoningSession);
      offset += batchSize;

      // Allow event loop processing
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  // =============================================================================
  // THOUGHT ANALYSIS METHODS
  // =============================================================================

  /**
   * Analyze a thought chain for quality metrics and store the results
   */
  async analyzeAndStoreThoughtChain(sessionId: string): Promise<ThoughtAnalysisResult | null> {
    try {
      // Get all thoughts for the session
      const thoughts = await this.queryThoughts({
        session_ids: [sessionId],
        limit: 1000, // Get all thoughts for the session
        sort_by: 'timestamp',
        sort_order: 'asc',
      });

      if (thoughts.length === 0) {
        console.warn(`No thoughts found for session ${sessionId}`);
        return null;
      }

      // Get session data for additional context
      const sessionData = await this.getSession(sessionId);

      // Get similar sessions for cross-session analysis
      const similarSessions = await this.findSimilarSessions(sessionData?.domain || '', 5);

      // Create analysis context
      const context: ThoughtChainContext = {
        session_id: sessionId,
        thoughts,
        session_data: sessionData,
        similar_sessions: similarSessions,
      };

      // Perform analysis
      const analysisResult = await this.thoughtAnalyzer.analyzeThoughtChain(context);

      // Store analysis results in database
      await this.storeThoughtAnalysis(analysisResult);

      console.log(
        `✅ Thought chain analysis completed for session ${sessionId} (${analysisResult.tier_scores.overall_score.toFixed(3)} overall score)`
      );

      return analysisResult;
    } catch (error) {
      console.error(`❌ Failed to analyze thought chain for session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Store thought analysis results in the database
   */
  private async storeThoughtAnalysis(analysis: ThoughtAnalysisResult): Promise<void> {
    const query = `
      INSERT INTO thought_analysis (
        session_id, thought_chain_ids, thought_chain_length, revision_count, branch_count,
        parameter_adherence, sequential_integrity, branching_effectiveness, revision_improvement,
        logical_coherence, depth_progression, metacognitive_awareness, creative_synthesis,
        pattern_recognition, cross_session_transfer, failure_mode_avoidance, adaptation_speed,
        analysis_confidence, processing_time_ms, analysis_version,
        tier1_score, tier2_score, tier3_score, overall_score
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13,
        $14, $15, $16, $17,
        $18, $19, $20,
        $21, $22, $23, $24
      )
    `;

    const values = [
      analysis.session_id,
      analysis.thought_chain_ids,
      analysis.metadata.thought_chain_length,
      analysis.metadata.revision_count,
      analysis.metadata.branch_count,

      // Tier 1 metrics
      analysis.metrics.parameter_adherence,
      analysis.metrics.sequential_integrity,
      analysis.metrics.branching_effectiveness,
      analysis.metrics.revision_improvement,

      // Tier 2 metrics
      analysis.metrics.logical_coherence,
      analysis.metrics.depth_progression,
      analysis.metrics.metacognitive_awareness,
      analysis.metrics.creative_synthesis,

      // Tier 3 metrics
      analysis.metrics.pattern_recognition,
      analysis.metrics.cross_session_transfer,
      analysis.metrics.failure_mode_avoidance,
      analysis.metrics.adaptation_speed,

      // Metadata
      analysis.analysis_confidence,
      analysis.processing_time_ms,
      analysis.metadata.analysis_version,

      // Tier scores
      analysis.tier_scores.tier1_score,
      analysis.tier_scores.tier2_score,
      analysis.tier_scores.tier3_score,
      analysis.tier_scores.overall_score,
    ];

    await this.query(query, values);
  }

  /**
   * Get thought analysis results for a session
   */
  async getThoughtAnalysis(sessionId: string): Promise<ThoughtAnalysisResult | null> {
    try {
      const result = await this.query(
        'SELECT * FROM thought_analysis WHERE session_id = $1 ORDER BY analysis_timestamp DESC LIMIT 1',
        [sessionId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToThoughtAnalysis(result.rows[0]);
    } catch (error) {
      console.error(`Failed to get thought analysis for session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Get thought analysis results with filtering options
   */
  async queryThoughtAnalyses(
    options: {
      session_ids?: string[];
      min_overall_score?: number;
      max_overall_score?: number;
      analysis_version?: string;
      limit?: number;
      offset?: number;
      sort_by?: 'analysis_timestamp' | 'overall_score' | 'processing_time_ms';
      sort_order?: 'asc' | 'desc';
    } = {}
  ): Promise<ThoughtAnalysisResult[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build WHERE conditions
    if (options.session_ids && options.session_ids.length > 0) {
      conditions.push(`session_id = ANY($${paramIndex})`);
      values.push(options.session_ids);
      paramIndex++;
    }

    if (options.min_overall_score !== undefined) {
      conditions.push(`overall_score >= $${paramIndex}`);
      values.push(options.min_overall_score);
      paramIndex++;
    }

    if (options.max_overall_score !== undefined) {
      conditions.push(`overall_score <= $${paramIndex}`);
      values.push(options.max_overall_score);
      paramIndex++;
    }

    if (options.analysis_version) {
      conditions.push(`analysis_version = $${paramIndex}`);
      values.push(options.analysis_version);
      paramIndex++;
    }

    // Build query
    let query = 'SELECT * FROM thought_analysis';

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Add sorting
    const sortBy = options.sort_by || 'analysis_timestamp';
    const sortOrder = options.sort_order || 'desc';
    query += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

    // Add pagination
    const limit = options.limit || 100;
    const offset = options.offset || 0;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(limit, offset);

    try {
      const result = await this.query(query, values);
      return result.rows.map(row => this.mapRowToThoughtAnalysis(row));
    } catch (error) {
      console.error('Failed to query thought analyses:', error);
      return [];
    }
  }

  /**
   * Batch analyze multiple sessions
   */
  async batchAnalyzeThoughtChains(sessionIds: string[]): Promise<ThoughtAnalysisResult[]> {
    const results: ThoughtAnalysisResult[] = [];

    for (const sessionId of sessionIds) {
      try {
        const result = await this.analyzeAndStoreThoughtChain(sessionId);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        console.warn(`Batch analysis failed for session ${sessionId}:`, error);
      }
    }

    return results;
  }

  /**
   * Get thought analysis statistics
   */
  async getThoughtAnalysisStats(): Promise<{
    total_analyses: number;
    avg_overall_score: number;
    avg_processing_time_ms: number;
    score_distribution: {
      tier1_avg: number;
      tier2_avg: number;
      tier3_avg: number;
    };
    analysis_count_by_version: { [version: string]: number };
  }> {
    try {
      const result = await this.query(`
        SELECT 
          COUNT(*) as total_analyses,
          AVG(overall_score) as avg_overall_score,
          AVG(processing_time_ms) as avg_processing_time_ms,
          AVG(tier1_score) as tier1_avg,
          AVG(tier2_score) as tier2_avg,
          AVG(tier3_score) as tier3_avg
        FROM thought_analysis
      `);

      const versionResult = await this.query(`
        SELECT analysis_version, COUNT(*) as count
        FROM thought_analysis
        GROUP BY analysis_version
        ORDER BY analysis_version
      `);

      const analysisCountByVersion: { [version: string]: number } = {};
      for (const row of versionResult.rows) {
        analysisCountByVersion[row.analysis_version] = parseInt(row.count);
      }

      const stats = result.rows[0];
      return {
        total_analyses: parseInt(stats.total_analyses) || 0,
        avg_overall_score: parseFloat(stats.avg_overall_score) || 0,
        avg_processing_time_ms: parseFloat(stats.avg_processing_time_ms) || 0,
        score_distribution: {
          tier1_avg: parseFloat(stats.tier1_avg) || 0,
          tier2_avg: parseFloat(stats.tier2_avg) || 0,
          tier3_avg: parseFloat(stats.tier3_avg) || 0,
        },
        analysis_count_by_version: analysisCountByVersion,
      };
    } catch (error) {
      console.error('Failed to get thought analysis stats:', error);
      return {
        total_analyses: 0,
        avg_overall_score: 0,
        avg_processing_time_ms: 0,
        score_distribution: { tier1_avg: 0, tier2_avg: 0, tier3_avg: 0 },
        analysis_count_by_version: {},
      };
    }
  }

  /**
   * Find sessions with similar domains for cross-session analysis
   */
  private async findSimilarSessions(domain: string, limit: number = 5): Promise<any[]> {
    if (!domain) return [];

    try {
      const result = await this.query(
        `
        SELECT s.*, 
               array_agg(t.id) as thought_ids,
               array_agg(t.thought) as thoughts
        FROM reasoning_sessions s
        LEFT JOIN stored_thoughts t ON s.id = t.session_id
        WHERE s.domain = $1
        GROUP BY s.id, s.start_time, s.end_time, s.objective, s.domain, 
                 s.initial_complexity, s.final_complexity, s.goal_achieved,
                 s.confidence_level, s.total_thoughts, s.revision_count,
                 s.branch_count, s.cognitive_roles_used, s.metacognitive_interventions,
                 s.effectiveness_score, s.lessons_learned, s.successful_strategies,
                 s.failed_approaches, s.tags
        ORDER BY s.start_time DESC
        LIMIT $2
      `,
        [domain, limit]
      );

      return result.rows.map(row => ({
        ...this.mapRowToReasoningSession(row),
        thoughts: row.thoughts
          ? row.thoughts.map((thought: string, idx: number) => ({
              id: row.thought_ids[idx],
              thought: thought,
            }))
          : [],
      }));
    } catch (error) {
      console.warn(`Failed to find similar sessions for domain ${domain}:`, error);
      return [];
    }
  }

  /**
   * Map database row to ThoughtAnalysisResult object
   */
  private mapRowToThoughtAnalysis(row: any): ThoughtAnalysisResult {
    return {
      session_id: row.session_id,
      thought_chain_ids: row.thought_chain_ids || [],
      metrics: {
        parameter_adherence: parseFloat(row.parameter_adherence) || 0,
        sequential_integrity: parseFloat(row.sequential_integrity) || 0,
        branching_effectiveness: parseFloat(row.branching_effectiveness) || 0,
        revision_improvement: parseFloat(row.revision_improvement) || 0,
        logical_coherence: parseFloat(row.logical_coherence) || 0,
        depth_progression: parseFloat(row.depth_progression) || 0,
        metacognitive_awareness: parseFloat(row.metacognitive_awareness) || 0,
        creative_synthesis: parseFloat(row.creative_synthesis) || 0,
        pattern_recognition: parseFloat(row.pattern_recognition) || 0,
        cross_session_transfer: parseFloat(row.cross_session_transfer) || 0,
        failure_mode_avoidance: parseFloat(row.failure_mode_avoidance) || 0,
        adaptation_speed: parseFloat(row.adaptation_speed) || 0,
      },
      analysis_confidence: parseFloat(row.analysis_confidence) || 0,
      processing_time_ms: parseInt(row.processing_time_ms) || 0,
      tier_scores: {
        tier1_score: parseFloat(row.tier1_score) || 0,
        tier2_score: parseFloat(row.tier2_score) || 0,
        tier3_score: parseFloat(row.tier3_score) || 0,
        overall_score: parseFloat(row.overall_score) || 0,
      },
      metadata: {
        thought_chain_length: parseInt(row.thought_chain_length) || 0,
        revision_count: parseInt(row.revision_count) || 0,
        branch_count: parseInt(row.branch_count) || 0,
        analysis_version: row.analysis_version || '1.0.0',
      },
    };
  }

  /**
   * Close the memory store and cleanup resources
   */
  async close(): Promise<void> {
    console.error('🔄 Closing PostgreSQL Memory Store...');

    // Signal shutdown to prevent new operations
    this.isShuttingDown = true;

    // Wait for pending async operations to complete
    await this.waitForPendingOperations();

    // Clear health check timer
    if (this.healthCheckInterval) {
      try {
        // If using TimerManager, get the timer ID and clear it
        const timerManager = await import('../utils/timer-manager.js').then(m =>
          m.TimerManager.getInstance()
        );
        const timerId = String(this.healthCheckInterval);
        timerManager.clearTimer(timerId);
      } catch (error) {
        // Fallback to standard clearInterval
        if (typeof this.healthCheckInterval === 'object') {
          clearInterval(this.healthCheckInterval as any);
        }
      }
      this.healthCheckInterval = null;
    }

    // Stop memory monitoring
    if (this.memoryMonitor) {
      this.memoryMonitor.stopMonitoring();
    }

    // Close connection pool with proper cleanup
    if (this.pool) {
      try {
        // Wait for active connections to finish (max 5s)
        const closePromise = this.pool.end();
        const timeoutPromise = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Pool close timeout')), 5000)
        );

        await Promise.race([closePromise, timeoutPromise]);
        console.error('✅ Connection pool closed gracefully');
      } catch (error) {
        console.warn('⚠️ Force closing connection pool:', error);
        // Force close if graceful close fails
        this.pool.end();
      } finally {
        this.pool = null;
      }
    }

    this.isInitialized = false;
    console.error('✅ PostgreSQL Memory Store closed');
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
      prompt_id: row.prompt_id,
      project_id: row.project_id,
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
   * Map database row to StoredPrompt object
   */
  private mapRowToStoredPrompt(row: any): StoredPrompt {
    return {
      id: row.id,
      session_id: row.session_id,
      project_id: row.project_id,
      original_prompt: row.original_prompt,
      prompt_type: row.prompt_type,
      prompt_source: row.prompt_source,
      received_at: row.received_at,
      domain: row.domain,
      complexity_estimate: row.complexity_estimate,
      estimated_cognitive_load: row.estimated_cognitive_load,
      classification_confidence: row.classification_confidence,
      prompt_context: row.prompt_context
        ? typeof row.prompt_context === 'string'
          ? JSON.parse(row.prompt_context)
          : row.prompt_context
        : undefined,
      extracted_intent: row.extracted_intent
        ? typeof row.extracted_intent === 'string'
          ? JSON.parse(row.extracted_intent)
          : row.extracted_intent
        : undefined,
      processing_started_at: row.processing_started_at,
      processing_completed_at: row.processing_completed_at,
      processing_success: row.processing_success,
      processing_error: row.processing_error,
      tags: row.tags,
      similar_prompts: row.similar_prompts
        ? typeof row.similar_prompts === 'string'
          ? JSON.parse(row.similar_prompts)
          : row.similar_prompts
        : undefined,
      reasoning_improvement: row.reasoning_improvement,
      persona_selected: row.persona_selected,
      cognitive_priming_effectiveness: row.cognitive_priming_effectiveness,
      created_at: row.created_at,
      updated_at: row.updated_at,
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
      project_id: row.project_id,
    };
  }

  /* -------------------------------------------------------------------------- */
  /*                      PROJECT MANAGEMENT METHODS                           */
  /* -------------------------------------------------------------------------- */

  /**
   * Create a new project with comprehensive metadata
   */
  async createProject(project: Omit<Project, 'id'>): Promise<Project> {
    const client = await this.pool!.connect();

    try {
      await client.query('BEGIN');

      // Create project with generated UUID
      const createQuery = `
        INSERT INTO projects (
          directory_path, project_name, description, technology_stack,
          project_type, programming_languages, cognitive_settings, project_metadata,
          created_at, updated_at, last_activity_at, is_active, is_archived
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

      const values = [
        project.directory_path,
        project.project_name,
        project.description || null,
        project.technology_stack || [],
        project.project_type || null,
        project.programming_languages || [],
        JSON.stringify(project.cognitive_settings || {}),
        JSON.stringify(project.project_metadata || {}),
        project.created_at,
        project.updated_at,
        project.last_activity_at,
        project.is_active,
        project.is_archived,
      ];

      const result = await client.query(createQuery, values);
      await client.query('COMMIT');

      const createdProject = this.mapRowToProject(result.rows[0]);

      // Cache the project for single-user performance
      this.projectCache.set(createdProject.id, createdProject);
      this.projectPathCache.set(createdProject.directory_path, createdProject);

      console.error(`✅ Created project: ${createdProject.project_name} (${createdProject.id})`);
      return createdProject;
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      console.error('❌ Failed to create project:', error);
      throw new Error(`Project creation failed: ${getErrorMessage(error)}`);
    } finally {
      client.release();
    }
  }

  /**
   * Get a project by ID with caching optimization
   */
  async getProject(projectId: string): Promise<Project | null> {
    // Check cache first (single-user optimization)
    if (this.projectCache.has(projectId)) {
      return this.projectCache.get(projectId)!;
    }

    try {
      const query = 'SELECT * FROM projects WHERE id = $1';
      const result = await this.query(query, [projectId]);

      if (result.rows.length === 0) {
        return null;
      }

      const project = this.mapRowToProject(result.rows[0]);

      // Cache for future requests
      this.projectCache.set(project.id, project);
      this.projectPathCache.set(project.directory_path, project);

      return project;
    } catch (error: unknown) {
      console.error('❌ Failed to get project:', error);
      throw new Error(`Failed to retrieve project: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Find a project by directory path with caching
   */
  async findProjectByPath(directoryPath: string): Promise<Project | null> {
    // Check cache first
    if (this.projectPathCache.has(directoryPath)) {
      return this.projectPathCache.get(directoryPath)!;
    }

    try {
      const query = 'SELECT * FROM projects WHERE directory_path = $1';
      const result = await this.query(query, [directoryPath]);

      if (result.rows.length === 0) {
        return null;
      }

      const project = this.mapRowToProject(result.rows[0]);

      // Cache for future requests
      this.projectCache.set(project.id, project);
      this.projectPathCache.set(project.directory_path, project);

      return project;
    } catch (error: unknown) {
      console.error('❌ Failed to find project by path:', error);
      throw new Error(`Failed to find project by path: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Update a project with cache invalidation
   */
  async updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
    const client = await this.pool!.connect();

    try {
      await client.query('BEGIN');

      // Build dynamic update query
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.project_name !== undefined) {
        updateFields.push(`project_name = $${paramIndex++}`);
        values.push(updates.project_name);
      }

      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        values.push(updates.description);
      }

      if (updates.technology_stack !== undefined) {
        updateFields.push(`technology_stack = $${paramIndex++}`);
        values.push(updates.technology_stack);
      }

      if (updates.project_type !== undefined) {
        updateFields.push(`project_type = $${paramIndex++}`);
        values.push(updates.project_type);
      }

      if (updates.programming_languages !== undefined) {
        updateFields.push(`programming_languages = $${paramIndex++}`);
        values.push(updates.programming_languages);
      }

      if (updates.cognitive_settings !== undefined) {
        updateFields.push(`cognitive_settings = $${paramIndex++}`);
        values.push(JSON.stringify(updates.cognitive_settings));
      }

      if (updates.project_metadata !== undefined) {
        updateFields.push(`project_metadata = $${paramIndex++}`);
        values.push(JSON.stringify(updates.project_metadata));
      }

      if (updates.is_active !== undefined) {
        updateFields.push(`is_active = $${paramIndex++}`);
        values.push(updates.is_active);
      }

      if (updates.is_archived !== undefined) {
        updateFields.push(`is_archived = $${paramIndex++}`);
        values.push(updates.is_archived);
      }

      // Always update the timestamp
      updateFields.push(`updated_at = $${paramIndex++}`);
      values.push(new Date());

      if (updates.last_activity_at !== undefined) {
        updateFields.push(`last_activity_at = $${paramIndex++}`);
        values.push(updates.last_activity_at);
      }

      values.push(projectId); // WHERE condition

      const updateQuery = `
        UPDATE projects 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(updateQuery, values);
      await client.query('COMMIT');

      if (result.rows.length > 0) {
        const updatedProject = this.mapRowToProject(result.rows[0]);

        // Update cache
        this.projectCache.set(updatedProject.id, updatedProject);
        this.projectPathCache.set(updatedProject.directory_path, updatedProject);
      }

      console.error(`✅ Updated project: ${projectId}`);
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      console.error('❌ Failed to update project:', error);
      throw new Error(`Project update failed: ${getErrorMessage(error)}`);
    } finally {
      client.release();
    }
  }

  /**
   * Query projects with comprehensive filtering and sorting
   */
  async queryProjects(query: ProjectQuery = {}): Promise<Project[]> {
    try {
      let sql = 'SELECT * FROM projects WHERE 1=1';
      const values: any[] = [];
      let paramIndex = 1;

      // Add filtering conditions
      if (query.directory_path) {
        sql += ` AND directory_path = $${paramIndex++}`;
        values.push(query.directory_path);
      }

      if (query.project_name) {
        sql += ` AND project_name ILIKE $${paramIndex++}`;
        values.push(`%${query.project_name}%`);
      }

      if (query.project_type) {
        sql += ` AND project_type = $${paramIndex++}`;
        values.push(query.project_type);
      }

      if (query.technology_stack && query.technology_stack.length > 0) {
        sql += ` AND technology_stack @> $${paramIndex++}`;
        values.push(query.technology_stack);
      }

      if (query.programming_languages && query.programming_languages.length > 0) {
        sql += ` AND programming_languages @> $${paramIndex++}`;
        values.push(query.programming_languages);
      }

      if (query.is_active !== undefined) {
        sql += ` AND is_active = $${paramIndex++}`;
        values.push(query.is_active);
      }

      if (query.is_archived !== undefined) {
        sql += ` AND is_archived = $${paramIndex++}`;
        values.push(query.is_archived);
      }

      if (query.created_after) {
        sql += ` AND created_at >= $${paramIndex++}`;
        values.push(query.created_after);
      }

      if (query.created_before) {
        sql += ` AND created_at <= $${paramIndex++}`;
        values.push(query.created_before);
      }

      if (query.last_activity_after) {
        sql += ` AND last_activity_at >= $${paramIndex++}`;
        values.push(query.last_activity_after);
      }

      if (query.has_cognitive_settings) {
        sql += ` AND cognitive_settings != '{}'`;
      }

      // Add sorting
      const sortBy = query.sort_by || 'last_activity_at';
      const sortOrder = query.sort_order || 'desc';
      sql += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

      // Add pagination
      if (query.limit) {
        sql += ` LIMIT $${paramIndex++}`;
        values.push(query.limit);
      }

      if (query.offset) {
        sql += ` OFFSET $${paramIndex++}`;
        values.push(query.offset);
      }

      const result = await this.query(sql, values);
      return result.rows.map(row => this.mapRowToProject(row));
    } catch (error: unknown) {
      console.error('❌ Failed to query projects:', error);
      throw new Error(`Project query failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get comprehensive project analytics for personal insights
   */
  async getProjectAnalytics(projectId: string): Promise<{
    totalSessions: number;
    totalThoughts: number;
    totalPrompts: number;
    averageSessionLength: number;
    successRate: number;
    mostUsedTechnologies: Array<{ tech: string; usage: number }>;
    recentActivity: Array<{ date: string; sessions: number; thoughts: number }>;
  }> {
    try {
      const analytics = await Promise.all([
        // Basic counts
        this.query(
          `
          SELECT COUNT(*) as count FROM reasoning_sessions WHERE project_id = $1
        `,
          [projectId]
        ),

        this.query(
          `
          SELECT COUNT(*) as count FROM stored_thoughts WHERE project_id = $1
        `,
          [projectId]
        ),

        this.query(
          `
          SELECT COUNT(*) as count FROM stored_prompts WHERE project_id = $1
        `,
          [projectId]
        ),

        // Average session length
        this.query(
          `
          SELECT AVG(total_thoughts) as avg_length 
          FROM reasoning_sessions 
          WHERE project_id = $1 AND total_thoughts > 0
        `,
          [projectId]
        ),

        // Success rate
        this.query(
          `
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE goal_achieved = true) as successful
          FROM reasoning_sessions 
          WHERE project_id = $1
        `,
          [projectId]
        ),

        // Recent activity (last 30 days)
        this.query(
          `
          SELECT 
            DATE(start_time) as date,
            COUNT(*) as sessions,
            SUM(total_thoughts) as thoughts
          FROM reasoning_sessions 
          WHERE project_id = $1 
            AND start_time >= NOW() - INTERVAL '30 days'
          GROUP BY DATE(start_time)
          ORDER BY date DESC
          LIMIT 30
        `,
          [projectId]
        ),
      ]);

      const [sessions, thoughts, prompts, avgLength, successData, recentActivity] = analytics;

      const totalSessions = parseInt(sessions.rows[0]?.count || '0');
      const totalThoughts = parseInt(thoughts.rows[0]?.count || '0');
      const totalPrompts = parseInt(prompts.rows[0]?.count || '0');
      const averageSessionLength = parseFloat(avgLength.rows[0]?.avg_length || '0');

      const successTotal = parseInt(successData.rows[0]?.total || '0');
      const successCount = parseInt(successData.rows[0]?.successful || '0');
      const successRate = successTotal > 0 ? successCount / successTotal : 0;

      // Get project technology stack for insights
      const project = await this.getProject(projectId);
      const mostUsedTechnologies =
        project?.technology_stack?.map(tech => ({
          tech,
          usage: 1, // In single-user scenario, this is simplified
        })) || [];

      return {
        totalSessions,
        totalThoughts,
        totalPrompts,
        averageSessionLength,
        successRate,
        mostUsedTechnologies,
        recentActivity: recentActivity.rows.map(row => ({
          date: row.date,
          sessions: parseInt(row.sessions),
          thoughts: parseInt(row.thoughts || '0'),
        })),
      };
    } catch (error: unknown) {
      console.error('❌ Failed to get project analytics:', error);
      throw new Error(`Project analytics failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get cross-project patterns for personal learning insights
   */
  async getCrossProjectPatterns(limit = 10): Promise<
    Array<{
      pattern: string;
      projects: string[];
      frequency: number;
      successRate: number;
    }>
  > {
    try {
      const query = `
        SELECT 
          unnest(patterns_detected) as pattern,
          array_agg(DISTINCT pr.project_name) as project_names,
          COUNT(*) as frequency,
          AVG(CASE WHEN t.success THEN 1.0 ELSE 0.0 END) as success_rate
        FROM stored_thoughts t
        JOIN projects pr ON t.project_id = pr.id
        WHERE array_length(patterns_detected, 1) > 0
        GROUP BY pattern
        HAVING COUNT(DISTINCT t.project_id) > 1  -- Pattern appears in multiple projects
        ORDER BY frequency DESC, success_rate DESC
        LIMIT $1
      `;

      const result = await this.query(query, [limit]);

      return result.rows.map((row: any) => ({
        pattern: row.pattern,
        projects: row.project_names,
        frequency: parseInt(row.frequency),
        successRate: parseFloat(row.success_rate || '0'),
      }));
    } catch (error: unknown) {
      console.error('❌ Failed to get cross-project patterns:', error);
      throw new Error(`Cross-project pattern analysis failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Find similar prompts with hybrid project-aware search
   */
  async findSimilarPromptsHybrid(
    prompt: string,
    limit = 5,
    projectId?: string
  ): Promise<StoredPrompt[]> {
    if (projectId) {
      // First try project-scoped search
      const projectResults = await this.queryPrompts({
        project_id: projectId,
        similar_to: prompt,
        limit: limit,
        include_project: true,
      });

      if (projectResults.length >= Math.min(3, limit)) {
        return projectResults.slice(0, limit);
      }

      // Fallback to global search for remaining slots
      const globalResults = await this.queryPrompts({
        similar_to: prompt,
        limit: limit - projectResults.length,
        include_project: true,
      });

      return [...projectResults, ...globalResults].slice(0, limit);
    }

    // No project context, use global search
    return this.queryPrompts({
      similar_to: prompt,
      limit: limit,
      include_project: true,
    });
  }

  /**
   * Find similar thoughts with hybrid project-aware search
   */
  async findSimilarThoughtsHybrid(
    thought: string,
    limit = 5,
    projectId?: string
  ): Promise<StoredThought[]> {
    if (projectId) {
      // First try project-scoped search
      const projectResults = await this.queryThoughts({
        project_id: projectId,
        text_similarity: thought,
        limit: limit,
        include_project: true,
      });

      if (projectResults.length >= Math.min(3, limit)) {
        return projectResults.slice(0, limit);
      }

      // Fallback to global search for remaining slots
      const globalResults = await this.queryThoughts({
        text_similarity: thought,
        limit: limit - projectResults.length,
        include_project: true,
      });

      return [...projectResults, ...globalResults].slice(0, limit);
    }

    // No project context, use global search
    return this.queryThoughts({
      text_similarity: thought,
      limit: limit,
      include_project: true,
    });
  }

  /**
   * Clear project cache for testing
   */
  async clearProjectCache(): Promise<void> {
    this.projectCache.clear();
    this.projectPathCache.clear();
  }

  /**
   * Map database row to Project object
   */
  private mapRowToProject(row: any): Project {
    return {
      id: row.id,
      directory_path: row.directory_path,
      project_name: row.project_name,
      description: row.description,
      technology_stack: row.technology_stack || [],
      project_type: row.project_type,
      programming_languages: row.programming_languages || [],
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_activity_at: row.last_activity_at,
      is_active: row.is_active,
      is_archived: row.is_archived,
      cognitive_settings: row.cognitive_settings || {},
      project_metadata: row.project_metadata || {},
      total_sessions: row.total_sessions || 0,
      total_thoughts: row.total_thoughts || 0,
      total_prompts: row.total_prompts || 0,
    };
  }
}
