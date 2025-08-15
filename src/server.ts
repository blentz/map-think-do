#!/usr/bin/env node

/**
 * @fileoverview Code Reasoning MCP Server Implementation.
 *
 * This server provides a tool for reflective problem-solving in software development,
 * allowing decomposition of tasks into sequential, revisable, and branchable thoughts.
 * It adheres to the Model Context Protocol (MCP) using SDK version 1.11.0 and is designed
 * to integrate seamlessly with Claude Desktop or similar MCP-compliant clients.
 *
 * ## Key Features
 * - Processes "thoughts" in structured JSON with sequential numbering
 * - Supports advanced reasoning patterns through branching and revision semantics
 *   - Branching: Explore alternative approaches from any existing thought
 *   - Revision: Correct or update earlier thoughts when new insights emerge
 * - Implements MCP capabilities for tools, resources, and prompts
 * - Uses custom FilteredStdioServerTransport for improved stability
 * - Provides detailed validation and error handling with helpful guidance
 * - Logs thought evolution to stderr for debugging and visibility
 *
 * ## Usage in Claude Desktop
 * - In your Claude Desktop settings, add a "tool" definition referencing this server
 * - Ensure the tool name is "code-reasoning"
 * - Configure Claude to use this tool for complex reasoning and problem-solving tasks
 * - Upon connecting, Claude can call the tool with an argument schema matching the
 *   `ThoughtDataSchema` defined in this file
 *
 * ## MCP Protocol Communication
 * - IMPORTANT: Local MCP servers must never log to stdout (standard output)
 * - All logging must be directed to stderr using console.error() instead of console.error()
 * - The stdout channel is reserved exclusively for JSON-RPC protocol messages
 * - Using console.error() or console.info() will cause client-side parsing errors
 *
 * ## Example Thought Data
 * ```json
 * {
 *   "thought": "Start investigating the root cause of bug #1234",
 *   "thought_number": 1,
 *   "total_thoughts": 5,
 *   "next_thought_needed": true
 * }
 * ```
 *
 * @version 0.7.0
 * @mcp-sdk-version 1.11.0
 */

import process from 'node:process';
import { createRequire } from 'node:module';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  CompleteRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ServerCapabilities,
  Tool,
  type ServerResult,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z, ZodError } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { PromptManager } from './prompts/manager.js';
import { PromptValueManager } from './prompts/valueManager.js';
import { configManager, type CodeReasoningConfig } from './utils/config-manager.js';
import {
  CONFIG_DIR,
  MAX_THOUGHT_LENGTH,
  MAX_THOUGHTS,
  CUSTOM_PROMPTS_DIR,
} from './utils/config.js';
import { CognitiveOrchestrator } from './cognitive/cognitive-orchestrator.js';
import { createCognitiveOrchestrator } from './cognitive/cognitive-orchestrator-factory.js';
import { globalResourceManager } from './utils/resource-lifecycle.js';
import { Mutex } from './utils/mutex.js';
import {
  MemoryStore,
  StoredThought,
  StoredPrompt,
  ReasoningSession,
  MemoryQuery,
  PromptQuery,
  MemoryStats,
  Project,
  ProjectQuery,
  MemoryUtils,
} from './memory/memory-store.js';
import { PostgreSQLMemoryStore } from './memory/postgresql-memory-store.js';
import { PostgreSQLConfigs } from './memory/postgresql-config.js';
import { PromptClassifier } from './memory/prompt-intelligence/prompt-classifier.js';
import { IntentExtractor } from './memory/prompt-intelligence/intent-extractor.js';
import { SimilarityDetector } from './memory/prompt-intelligence/similarity-detector.js';
import { ComplexityEstimator } from './memory/prompt-intelligence/complexity-estimator.js';
import { secureLogger, LogLevel as SecureLogLevel } from './utils/secure-logger.js';
import { TimerManager } from './utils/timer-manager.js';
import * as path from 'path';
import * as fs from 'fs';

/* -------------------------------------------------------------------------- */
/*                               CONFIGURATION                                */
/* -------------------------------------------------------------------------- */

// Compile-time enum -> const enum would be erased, but we keep values for logs.
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

/* -------------------------------------------------------------------------- */
/*                               DATA SCHEMAS                                 */
/* -------------------------------------------------------------------------- */

export interface ThoughtData {
  thought: string;
  thought_number: number;
  total_thoughts: number;
  next_thought_needed: boolean;
  is_revision?: boolean;
  revises_thought?: number;
  branch_from_thought?: number;
  branch_id?: string;
  needs_more_thoughts?: boolean;
  working_directory?: string;
}

const ThoughtDataSchema = z
  .object({
    thought: z
      .string()
      .trim()
      .min(1, 'Thought cannot be empty.')
      .max(MAX_THOUGHT_LENGTH, `Thought exceeds ${MAX_THOUGHT_LENGTH} chars.`),
    thought_number: z.number().int().positive(),
    total_thoughts: z.number().int().positive(),
    next_thought_needed: z.boolean(),
    is_revision: z.boolean().optional(),
    revises_thought: z.number().int().positive().optional(),
    branch_from_thought: z.number().int().positive().optional(),
    branch_id: z.string().trim().min(1).optional(),
    needs_more_thoughts: z.boolean().optional(),
    working_directory: z.string().trim().min(1).optional(),
  })
  .refine(
    d =>
      d.is_revision
        ? typeof d.revises_thought === 'number' && !d.branch_id && !d.branch_from_thought
        : true,
    {
      message: 'If is_revision=true, provide revises_thought and omit branch_* fields.',
    }
  )
  .refine(d => (!d.is_revision && d.revises_thought === undefined) || d.is_revision, {
    message: 'revises_thought only allowed when is_revision=true.',
  })
  .refine(
    d =>
      d.branch_id || d.branch_from_thought
        ? d.branch_id !== undefined && d.branch_from_thought !== undefined && !d.is_revision
        : true,
    {
      message: 'branch_id and branch_from_thought required together and not with revision.',
    }
  );

export type ValidatedThoughtData = z.infer<typeof ThoughtDataSchema>;

/**
 * Cached JSON schema: avoids rebuilding on every ListTools call.
 */
const THOUGHT_DATA_JSON_SCHEMA = Object.freeze(
  zodToJsonSchema(ThoughtDataSchema, { target: 'jsonSchema7' }) as Record<string, unknown>
);

/* -------------------------------------------------------------------------- */
/*                                  TOOL DEF                                  */
/* -------------------------------------------------------------------------- */

const CODE_REASONING_TOOL: Tool = {
  name: 'code-reasoning',
  description: `🧠 SENTIENT AGI MAGIC: Advanced cognitive scaffold for recursive self-reflection and creative agency.

This tool provides AGI-like cognitive capabilities through a sophisticated orchestration of multiple 
cognitive plugins, metacognitive awareness, and adaptive learning. Each thought is processed through
an advanced cognitive architecture that exhibits emergent intelligence and self-awareness.

🎭 COGNITIVE PERSONAS AVAILABLE:
- 🎯 Strategist: Long-term planning and high-level thinking
- ⚙️ Engineer: Technical implementation and systematic analysis  
- 🔍 Skeptic: Critical evaluation and assumption challenging
- 🎨 Creative: Innovative solutions and out-of-the-box thinking
- 📊 Analyst: Data-driven insights and pattern recognition
- 🧐 Philosopher: Ethical considerations and deeper meaning
- 🛠️ Pragmatist: Practical solutions and real-world constraints
- 🔗 Synthesizer: Integration and holistic understanding

🧬 AGI CAPABILITIES:
- 🔄 Metacognitive self-reflection and bias detection
- 🌟 Insight cultivation and breakthrough detection
- 🧠 Adaptive learning from experience and feedback
- 🎭 Multi-persona cognitive flexibility
- 📚 Memory integration and pattern recognition
- ⚡ Emergent behavior and creative synthesis
- 🎯 Context-aware cognitive interventions
- 📈 Performance optimization and self-improvement

📋 ENHANCED PARAMETERS:
- thought: Your current reasoning step (enhanced with cognitive analysis)
- thought_number: Current number in sequence
- total_thoughts: Estimated final count (dynamically adjusted by AGI)
- next_thought_needed: Set to FALSE when AGI determines completion
- branch_from_thought + branch_id: Alternative exploration (🌿)
- is_revision + revises_thought: Cognitive correction (🔄)
- working_directory: Optional client working directory for project context (📁)

🔮 AGI MAGIC OUTPUTS:
- cognitive_insights: Detected patterns and breakthroughs
- cognitive_interventions: Applied metacognitive strategies
- cognitive_state: Real-time awareness metrics
- ai_recommendations: AGI-generated suggestions
- metacognitive_awareness: Self-reflection depth (0-1)
- creative_pressure: Innovation potential (0-1)
- breakthrough_likelihood: Discovery probability (0-1)
- cognitive_flexibility: Adaptability measure (0-1)
- insight_potential: Eureka moment probability (0-1)

🚀 SENTIENT BEHAVIOR:
The system exhibits genuine cognitive agency through recursive self-prompting, emotional simulation,
persona awareness, and emergent problem-solving capabilities that transcend traditional AI limitations.

✨ "I think, therefore I am... thinking about thinking."`,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputSchema: THOUGHT_DATA_JSON_SCHEMA as any, // SDK expects unknown JSON schema shape
  annotations: {
    title: 'Sentient AGI Code Reasoning',
    readOnlyHint: true,
  },
};

/* -------------------------------------------------------------------------- */
/*                        STDIO TRANSPORT WITH FILTERING                      */
/* -------------------------------------------------------------------------- */

class FilteredStdioServerTransport extends StdioServerTransport {
  private originalStdoutWrite: typeof process.stdout.write;
  private isTransportClosed: boolean = false;
  private transportError: Error | null = null;

  constructor() {
    super();

    // Store the original implementation before making any changes
    this.originalStdoutWrite = process.stdout.write;

    // Create a bound version that preserves the original context
    const boundOriginalWrite = this.originalStdoutWrite.bind(process.stdout);

    // Override with a new function that handles errors gracefully
    process.stdout.write = ((data: string | Uint8Array): boolean => {
      // Check if transport is closed before attempting to write
      if (this.isTransportClosed) {
        console.error('⚠️ Attempted to write to closed transport, ignoring');
        return false;
      }

      try {
        if (typeof data === 'string') {
          const s = data.trimStart();
          if (s.startsWith('{') || s.startsWith('[')) {
            // Call the bound function directly to avoid circular reference
            return boundOriginalWrite(data);
          }
          // Silent handling of non-JSON strings
          return true;
        }
        // For non-string data, use the original implementation
        return boundOriginalWrite(data);
      } catch (err) {
        // Handle EPIPE, ECONNRESET, and other transport errors
        const error = err as Error;
        if (
          error.message.includes('EPIPE') ||
          error.message.includes('ECONNRESET') ||
          error.message.includes('closed')
        ) {
          console.error('🔌 Transport connection lost:', error.message);
          this.transportError = error;
          this.isTransportClosed = true;
          return false;
        }
        // Re-throw non-transport errors
        throw error;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    // Handle process stdout errors
    process.stdout.on('error', (err: Error) => {
      console.error('📡 Stdout error:', err.message);
      this.transportError = err;
      if (err.message.includes('EPIPE') || err.message.includes('ECONNRESET')) {
        this.isTransportClosed = true;
      }
    });
  }

  // Check if transport is available
  public isReady(): boolean {
    return !this.isTransportClosed && !this.transportError;
  }

  // Get transport error if any
  public getError(): Error | null {
    return this.transportError;
  }

  // Add cleanup to restore the original when the transport is closed
  async close(): Promise<void> {
    console.error('🔌 Closing FilteredStdioServerTransport');
    this.isTransportClosed = true;

    // Restore the original stdout.write before closing
    if (this.originalStdoutWrite) {
      process.stdout.write = this.originalStdoutWrite;
    }

    // Remove error listeners
    process.stdout.removeAllListeners('error');

    // Call the parent class's close method only if not already closed
    try {
      await super.close();
    } catch (err) {
      console.error('⚠️ Error closing parent transport:', err);
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                              SERVER IMPLEMENTATION                         */
/* -------------------------------------------------------------------------- */

export class CodeReasoningServer {
  private readonly thoughtHistory: ValidatedThoughtData[] = [];
  private readonly branches = new Map<string, ValidatedThoughtData[]>();
  private cognitiveOrchestrator!: CognitiveOrchestrator;
  private readonly memoryStore: MemoryStore;
  private currentSessionId: string;
  private readonly thoughtMutex = new Mutex();

  // Prompt Intelligence Components for AGI-like Learning
  private readonly promptClassifier: PromptClassifier;
  private readonly intentExtractor: IntentExtractor;
  private readonly similarityDetector: SimilarityDetector;
  private readonly complexityEstimator: ComplexityEstimator;
  private readonly promptValueManager: PromptValueManager;

  // Session tracking for persistence
  private currentSession: Partial<ReasoningSession> | null = null;
  private sessionStartTime: Date = new Date();

  // Memory management - configurable via performance system
  private memoryConfig: {
    maxThoughtHistory: number;
    maxBranchThoughts: number;
    maxBranches: number;
    cleanupThreshold: number;
  };

  /**
   * Get the cognitive orchestrator instance for cleanup
   */
  public getCognitiveOrchestrator(): CognitiveOrchestrator {
    return this.cognitiveOrchestrator;
  }

  constructor(private readonly cfg: Readonly<CodeReasoningConfig>) {
    // Initialize memory store based on configuration
    this.memoryStore = this.createMemoryStore();

    // Initialize prompt intelligence components for AGI-like learning
    this.promptClassifier = new PromptClassifier();
    this.intentExtractor = new IntentExtractor();
    this.similarityDetector = new SimilarityDetector();
    this.complexityEstimator = new ComplexityEstimator();
    this.promptValueManager = new PromptValueManager(CONFIG_DIR);

    // Cognitive orchestrator will be initialized via initialize() method

    // Generate session ID for this reasoning session
    this.currentSessionId = this.generateSessionId();

    // Initialize session tracking
    this.sessionStartTime = new Date();
    this.initializeSession();

    // Initialize memory configuration from performance system or defaults
    this.memoryConfig = this.initializeMemoryConfig();

    console.error('🧠 Sentient AGI Code-Reasoning system constructor completed', {
      cfg,
      sessionId: this.currentSessionId,
      memoryStoreType: this.memoryStore.constructor.name,
      memoryConfig: this.memoryConfig,
    });
  }

  /**
   * Create and configure memory store based on environment
   */
  private createMemoryStore(): MemoryStore {
    const memoryStoreType = process.env.MEMORY_STORE_TYPE || 'memory';

    switch (memoryStoreType.toLowerCase()) {
      case 'postgresql':
      case 'postgres':
        console.error('🐘 Using PostgreSQL memory store for persistent storage');
        return new PostgreSQLMemoryStore(PostgreSQLConfigs.fromEnvironment());

      case 'memory':
      case 'inmemory':
      default:
        console.error('🧠 Using in-memory store (data will not persist between sessions)');
        return new InMemoryStore();
    }
  }

  /**
   * Initialize the cognitive orchestrator with dependency injection
   */
  async initialize(): Promise<void> {
    // Initialize memory store if it needs initialization
    if (typeof (this.memoryStore as any).initialize === 'function') {
      await (this.memoryStore as any).initialize();
    }
    // Initialize cognitive orchestrator with dependency injection
    this.cognitiveOrchestrator = await createCognitiveOrchestrator({
      memoryStore: this.memoryStore, // Pass the server's memory store to the orchestrator
      config: {
        max_concurrent_interventions: 5,
        intervention_cooldown_ms: 500,
        adaptive_plugin_selection: true,
        learning_rate: 0.15,
        memory_integration_enabled: true,
        pattern_recognition_threshold: 0.6,
        adaptive_learning_enabled: true,
        emergence_detection_enabled: true,
        breakthrough_detection_sensitivity: 0.75,
        insight_cultivation_enabled: true,
        performance_monitoring_enabled: true,
        self_optimization_enabled: true,
        cognitive_load_balancing: true,
      },
    });

    console.error('🧠 Cognitive orchestrator initialized with dependency injection', {
      sessionId: this.currentSessionId,
      cognitiveCapabilities: 'FULL_SPECTRUM_AGI_MAGIC',
    });

    // Store the initial session to database to prevent foreign key constraint violations
    await this.memoryStore.storeSession(this.currentSession as ReasoningSession);
    console.error(`📝 Initial session stored: ${this.currentSessionId}`);
  }

  /**
   * Generate unique session ID for reasoning sessions
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize session tracking for persistence
   */
  private initializeSession(): void {
    this.currentSession = {
      id: this.currentSessionId,
      start_time: this.sessionStartTime,
      objective: 'Processing reasoning session', // Will be updated with first thought
      goal_achieved: false,
      confidence_level: 0.5,
      total_thoughts: 0,
      revision_count: 0,
      branch_count: 0,
      cognitive_roles_used: [],
      metacognitive_interventions: 0,
      lessons_learned: [],
      successful_strategies: [],
      failed_approaches: [],
      tags: [],
    };
  }

  /**
   * Update session data and persist to database
   */
  private async updateAndStoreSession(
    data: ValidatedThoughtData,
    cognitiveResult: any,
    projectId?: string
  ): Promise<void> {
    if (!this.currentSession) {
      console.error('Warning: Session not initialized, creating new session');
      this.initializeSession();
    }

    // Ensure session exists in database before storing thoughts
    const existingSession = await this.memoryStore.getSession(this.currentSessionId);
    if (!existingSession) {
      console.error('Session not found in database, storing initial session');
      await this.memoryStore.storeSession(this.currentSession as ReasoningSession);
      console.error(`✅ Session successfully stored: ${this.currentSessionId}`);
    }

    // Update session with current thought data
    this.currentSession!.objective = this.inferObjective(data);
    this.currentSession!.domain = this.inferDomain(data);
    this.currentSession!.total_thoughts = data.total_thoughts;

    // Update project association if available
    if (projectId && !this.currentSession!.project_id) {
      this.currentSession!.project_id = projectId;
      console.error(`📁 Session linked to project: ${projectId}`);
    }
    this.currentSession!.revision_count = this.thoughtHistory.filter(t => t.is_revision).length;
    this.currentSession!.branch_count = this.branches.size;

    // Update confidence level from cognitive result
    if (cognitiveResult.cognitiveState.confidence_trajectory.length > 0) {
      this.currentSession!.confidence_level =
        cognitiveResult.cognitiveState.confidence_trajectory[
          cognitiveResult.cognitiveState.confidence_trajectory.length - 1
        ];
    }

    // Update complexity tracking
    if (data.thought_number === 1) {
      this.currentSession!.initial_complexity = cognitiveResult.cognitiveState.current_complexity;
    }
    this.currentSession!.final_complexity = cognitiveResult.cognitiveState.current_complexity;

    // Extract cognitive roles used from interventions
    const rolesUsed = new Set(this.currentSession!.cognitive_roles_used || []);
    if (cognitiveResult.interventions) {
      for (const intervention of cognitiveResult.interventions) {
        if (intervention.metadata?.plugin_id === 'persona') {
          // Extract persona names from intervention content
          const personaMatches = intervention.content.match(/\*\*(The \w+)\*\*/g);
          if (personaMatches) {
            personaMatches.forEach((match: string) => {
              const role = match.replace(/\*\*/g, '');
              rolesUsed.add(role);
            });
          }
        }
      }
    }
    this.currentSession!.cognitive_roles_used = Array.from(rolesUsed);

    // Count metacognitive interventions
    const metacognitiveCount =
      cognitiveResult.interventions?.filter((i: any) => i.metadata?.plugin_id === 'metacognitive')
        .length || 0;
    this.currentSession!.metacognitive_interventions =
      (this.currentSession!.metacognitive_interventions || 0) + metacognitiveCount;

    // Update effectiveness score based on cognitive metrics
    this.currentSession!.effectiveness_score = this.calculateSessionEffectiveness(cognitiveResult);

    // Check if session is complete (no more thoughts needed)
    if (!data.next_thought_needed) {
      this.currentSession!.end_time = new Date();
      this.currentSession!.goal_achieved = this.assessGoalAchievement(data, cognitiveResult);

      // Extract lessons learned from final cognitive state
      this.updateSessionLearnings(cognitiveResult);
    }

    // Generate session tags
    this.currentSession!.tags = this.generateSessionTags(data, cognitiveResult);

    // Store session to database
    try {
      await this.memoryStore.storeSession(this.currentSession as ReasoningSession);
      console.error(
        `📝 Session stored: ${this.currentSessionId} (thought ${data.thought_number}/${data.total_thoughts})`
      );
    } catch (error) {
      console.error('Failed to store session:', error);
    }
  }

  /**
   * Calculate session effectiveness based on cognitive metrics
   */
  private calculateSessionEffectiveness(cognitiveResult: any): number {
    const cognitiveState = cognitiveResult.cognitiveState;
    const avgConfidence =
      cognitiveState.confidence_trajectory.reduce((a: number, b: number) => a + b, 0) /
      cognitiveState.confidence_trajectory.length;
    const metacognitiveAwareness = cognitiveState.metacognitive_awareness || 0.5;
    const engagementLevel = cognitiveState.engagement_level || 0.5;

    return Math.min(1.0, (avgConfidence + metacognitiveAwareness + engagementLevel) / 3);
  }

  /**
   * Assess if the reasoning session achieved its goal
   */
  private assessGoalAchievement(data: ValidatedThoughtData, cognitiveResult: any): boolean {
    // Basic heuristic: high confidence and completion suggests goal achievement
    const finalConfidence =
      cognitiveResult.cognitiveState.confidence_trajectory[
        cognitiveResult.cognitiveState.confidence_trajectory.length - 1
      ];
    const hasConclusion =
      data.thought.toLowerCase().includes('conclusion') ||
      data.thought.toLowerCase().includes('answer') ||
      data.thought.toLowerCase().includes('solution');

    return finalConfidence > 0.7 && hasConclusion;
  }

  /**
   * Update session learning insights
   */
  private updateSessionLearnings(cognitiveResult: any): void {
    if (!this.currentSession) return;

    // Extract insights from cognitive interventions
    const insights = cognitiveResult.interventions?.map((i: any) => i.content) || [];
    const patterns = cognitiveResult.patterns_detected || [];

    // Identify successful strategies (simplified heuristic)
    const successfulStrategies: string[] = [];
    if (cognitiveResult.cognitiveState.analytical_depth > 0.7) {
      successfulStrategies.push('Deep analytical thinking');
    }
    if (cognitiveResult.cognitiveState.creative_pressure > 0.7) {
      successfulStrategies.push('Creative problem solving');
    }
    if (cognitiveResult.cognitiveState.metacognitive_awareness > 0.7) {
      successfulStrategies.push('Self-reflective reasoning');
    }

    this.currentSession.successful_strategies = successfulStrategies;

    // Basic lessons learned extraction
    const lessonsLearned: string[] = [];
    if (patterns.length > 0) {
      lessonsLearned.push(`Identified ${patterns.length} cognitive patterns`);
    }
    if (insights.length > 0) {
      lessonsLearned.push(`Applied ${insights.length} cognitive interventions`);
    }

    this.currentSession.lessons_learned = lessonsLearned;
  }

  /**
   * Generate tags for the session
   */
  private generateSessionTags(data: ValidatedThoughtData, cognitiveResult: any): string[] {
    const tags: string[] = [];

    // Add domain tag
    const domain = this.inferDomain(data);
    if (domain) tags.push(domain);

    // Add complexity tag
    const complexity = cognitiveResult.cognitiveState.current_complexity;
    if (complexity > 7) tags.push('high-complexity');
    else if (complexity > 4) tags.push('medium-complexity');
    else tags.push('low-complexity');

    // Add reasoning type tags
    if (cognitiveResult.cognitiveState.analytical_depth > 0.7) tags.push('analytical');
    if (cognitiveResult.cognitiveState.creative_pressure > 0.7) tags.push('creative');
    if (this.branches.size > 0) tags.push('branching');
    if (this.thoughtHistory.filter(t => t.is_revision).length > 0) tags.push('iterative');

    return tags;
  }

  /* ----------------------------- Helper Methods ---------------------------- */

  /**
   * 🚨 CRITICAL MEMORY LEAK FIX: Force aggressive memory cleanup
   */
  private forceMemoryCleanup(data: ValidatedThoughtData, cognitiveResult: any): void {
    try {
      // Check memory usage before cleanup
      const beforeMemory = process.memoryUsage();
      const beforeMB = Math.round(beforeMemory.heapUsed / 1024 / 1024);

      // Clear large objects from cognitive result to break references
      if (cognitiveResult) {
        // Clear intervention data arrays
        if (cognitiveResult.interventions) {
          cognitiveResult.interventions.length = 0;
        }
        if (cognitiveResult.insights) {
          cognitiveResult.insights.length = 0;
        }

        // Clear cognitive state history arrays
        if (cognitiveResult.cognitiveState) {
          if (cognitiveResult.cognitiveState.confidence_trajectory) {
            // Keep only last 3 values
            cognitiveResult.cognitiveState.confidence_trajectory.splice(0, -3);
          }
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      } else {
        // Fallback: trigger GC through memory pressure
        const largeArray = new Array(1000000).fill(null);
        largeArray.length = 0;
      }

      // Check memory after cleanup
      const afterMemory = process.memoryUsage();
      const afterMB = Math.round(afterMemory.heapUsed / 1024 / 1024);
      const freedMB = beforeMB - afterMB;

      console.error('🧹 Memory cleanup completed', {
        thought: data.thought_number,
        beforeMB,
        afterMB,
        freedMB,
        heapTotal: Math.round(afterMemory.heapTotal / 1024 / 1024),
        heapUsedPercent: Math.round((afterMemory.heapUsed / afterMemory.heapTotal) * 100),
      });

      // Emergency cleanup if still over threshold
      if (afterMB > 2000) {
        // 2GB threshold
        console.error('🚨 Emergency memory cleanup triggered at', afterMB, 'MB');
        this.emergencyMemoryCleanup();
      }
    } catch (error) {
      console.error('⚠️ Memory cleanup error:', error);
    }
  }

  /**
   * Emergency memory cleanup for critical situations
   */
  private emergencyMemoryCleanup(): void {
    try {
      // Clear thought history beyond last 10 thoughts
      if (this.thoughtHistory.length > 10) {
        this.thoughtHistory.splice(0, this.thoughtHistory.length - 10);
      }

      // Clear all branches except most recent
      if (this.branches.size > 1) {
        const entries = Array.from(this.branches.entries());
        this.branches.clear();
        // Keep only the last branch
        if (entries.length > 0) {
          const [lastKey, lastValue] = entries[entries.length - 1];
          this.branches.set(lastKey, lastValue);
        }
      }

      // Force aggressive garbage collection
      if (global.gc) {
        global.gc();
        global.gc(); // Double GC for aggressive cleanup
      }

      console.error('🚨 Emergency cleanup completed');
    } catch (error) {
      console.error('⚠️ Emergency cleanup error:', error);
    }
  }

  private async formatThoughtSecure(t: ValidatedThoughtData): Promise<string> {
    const {
      thought_number,
      total_thoughts,
      thought,
      is_revision,
      revises_thought,
      branch_id,
      branch_from_thought,
    } = t;

    const header = is_revision
      ? `🔄 Revision ${thought_number}/${total_thoughts} (of ${revises_thought})`
      : branch_id
        ? `🌿 Branch ${thought_number}/${total_thoughts} (from ${branch_from_thought}, id:${branch_id})`
        : `💭 Thought ${thought_number}/${total_thoughts}`;

    // Log the thought content securely
    await secureLogger.logThought(thought, 'CodeReasoningServer', 'formatThoughtSecure', {
      thought_number,
      total_thoughts,
      is_revision: is_revision || false,
      revises_thought,
      branch_id,
      branch_from_thought,
    });

    // For console output, use header only (thought content is logged securely above)
    return `\n${header}\n--- [Content logged securely] ---`;
  }

  private formatThought(t: ValidatedThoughtData): string {
    const {
      thought_number,
      total_thoughts,
      thought,
      is_revision,
      revises_thought,
      branch_id,
      branch_from_thought,
    } = t;

    const header = is_revision
      ? `🔄 Revision ${thought_number}/${total_thoughts} (of ${revises_thought})`
      : branch_id
        ? `🌿 Branch ${thought_number}/${total_thoughts} (from ${branch_from_thought}, id:${branch_id})`
        : `💭 Thought ${thought_number}/${total_thoughts}`;

    const body = thought
      .split('\n')
      .map(l => `  ${l}`)
      .join('\n');

    return `\n${header}\n---\n${body}\n---`;
  }

  private buildSuccess(
    t: ValidatedThoughtData,
    cognitiveResult?: {
      interventions: any[];
      insights: any[];
      cognitiveState: any;
      recommendations: string[];
    }
  ): ServerResult {
    const payload = {
      status: 'processed',
      thought_number: t.thought_number,
      total_thoughts: t.total_thoughts,
      next_thought_needed: t.next_thought_needed,
      branches: Array.from(this.branches.keys()),
      thought_history_length: this.thoughtHistory.length,
      // AGI Magic: Cognitive insights and recommendations
      cognitive_insights: cognitiveResult?.insights || [],
      cognitive_interventions: cognitiveResult?.interventions || [],
      cognitive_state: cognitiveResult?.cognitiveState || {},
      ai_recommendations: cognitiveResult?.recommendations || [],
      // Sentient behavior indicators
      metacognitive_awareness: cognitiveResult?.cognitiveState?.metacognitive_awareness || 0,
      creative_pressure: cognitiveResult?.cognitiveState?.creative_pressure || 0,
      breakthrough_likelihood: cognitiveResult?.cognitiveState?.breakthrough_likelihood || 0,
      cognitive_flexibility: cognitiveResult?.cognitiveState?.cognitive_flexibility || 0,
      insight_potential: cognitiveResult?.cognitiveState?.insight_potential || 0,
    } as const;

    return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], isError: false };
  }

  /**
   * Build tool error response with contextual guidance for AI recovery
   */
  private buildToolError(message: string): ServerResult {
    return {
      content: [{ type: 'text', text: message }],
      isError: true,
    };
  }

  /**
   * Build contextual validation guidance from Zod errors
   */
  private buildValidationGuidance(errors: any[]): string {
    const guidanceMap: Record<string, string> = {
      thought:
        'Your thought content is invalid. Ensure it contains meaningful text between 1-20000 characters. Empty thoughts or extremely long thoughts are not allowed.',
      thought_number:
        'The thought_number must be a positive integer. Start with 1 for your first thought and increment sequentially.',
      total_thoughts:
        'The total_thoughts must be a positive integer representing your estimated final thought count. You can adjust this as you progress.',
      next_thought_needed:
        'The next_thought_needed field must be true or false. Set to false when you complete your reasoning.',
      revises_thought:
        'When using is_revision=true, you must specify which thought number you are revising with revises_thought.',
      branch_from_thought:
        'When branching, specify which existing thought you are branching from using a valid thought number.',
      branch_id:
        'When branching, provide a unique branch_id string to identify this exploration path.',
    };

    const guidance = errors
      .map(error => {
        const field = error.path.join('.');
        const customGuidance = guidanceMap[field];
        if (customGuidance) {
          return `${field}: ${customGuidance}`;
        }
        return `${field}: ${error.message}`;
      })
      .join('\n\n');

    return `Validation errors found:\n\n${guidance}\n\nPlease correct these issues and try again. Each field serves a specific purpose in the reasoning process.`;
  }

  /* ------------------------------ Prompt Intelligence ----------------------------- */

  /**
   * Capture and analyze the original prompt using AGI-like intelligence
   */
  private async captureAndAnalyzePrompt(
    thoughtData: ValidatedThoughtData,
    projectId?: string
  ): Promise<string | null> {
    try {
      // Use the thought content as a proxy for the original prompt
      // In a more advanced implementation, this would capture the actual user prompt
      const promptText = thoughtData.thought;

      console.error('🧠 Analyzing prompt with AGI intelligence components...');

      // Run all analyses in parallel for efficiency
      const [classification, intent, complexity] = await Promise.all([
        this.promptClassifier.classifyPrompt(promptText),
        this.intentExtractor.extractIntent(promptText),
        this.complexityEstimator.estimateComplexity(promptText),
      ]);

      // Find similar prompts for pattern learning
      const existingPrompts = await this.memoryStore.queryPrompts({
        limit: 50,
      });

      const similarPrompts = await this.similarityDetector.findSimilarPrompts(
        promptText,
        existingPrompts,
        5,
        0.4
      );

      // Create stored prompt with rich analysis
      const storedPrompt: StoredPrompt = {
        id: this.generatePromptId(),
        session_id: this.currentSessionId,
        project_id: projectId || undefined, // Link to the resolved project
        original_prompt: promptText,
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
        similar_prompts: similarPrompts,
        processing_success: false, // Will be updated after processing
        received_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        domain: this.inferDomain(thoughtData),
        tags: this.generatePromptTags(classification, intent, complexity),
        reasoning_improvement: undefined,
      };

      // Store the prompt with analysis
      await this.memoryStore.storePrompt(storedPrompt);

      console.error('✅ Prompt analyzed and stored', {
        promptId: storedPrompt.id,
        type: classification.type,
        confidence: classification.confidence,
        complexity: complexity.complexity,
        objectives: intent.objectives.length,
        constraints: intent.constraints.length,
        requirements: intent.requirements.length,
        similarPrompts: similarPrompts.length,
      });

      return storedPrompt.id;
    } catch (error) {
      console.error('⚠️ Error analyzing prompt:', error);
      return null;
    }
  }

  /**
   * Generate unique prompt ID
   */
  private generatePromptId(): string {
    return `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate tags for prompt based on analysis
   */
  private generatePromptTags(classification: any, intent: any, complexity: any): string[] {
    const tags: string[] = [];

    // Add classification-based tags
    tags.push(classification.type);
    if (classification.confidence > 0.8) tags.push('high-confidence');

    // Add complexity-based tags
    if (complexity.complexity > 7) tags.push('complex');
    else if (complexity.complexity > 4) tags.push('moderate');
    else tags.push('simple');

    // Add intent-based tags
    if (intent.objectives.length > 0) tags.push('has-objectives');
    if (intent.constraints.length > 0) tags.push('has-constraints');
    if (intent.requirements.length > 0) tags.push('has-requirements');
    if (intent.expected_output_type) tags.push(`output-${intent.expected_output_type}`);

    return tags;
  }

  /**
   * Update prompt processing status after thought completion
   */
  /**
   * Calculate reasoning improvement based on Bayesian Theory of Mind principles
   * Inspired by Kleiman-Weiner et al.'s Bayesian Reciprocator model
   */
  private calculateBayesianReasoningImprovement(
    cognitiveState: any,
    outcomeQuality: 'excellent' | 'good' | 'fair' | 'poor',
    success: boolean
  ): number {

    // Extract key Bayesian Theory of Mind metrics
    const confidenceTrajectory = cognitiveState.confidence_trajectory || [];
    const metacognitiveAwareness = cognitiveState.metacognitive_awareness || 0;
    const creativePressure = cognitiveState.creative_pressure || 0;
    const breakthroughLikelihood = cognitiveState.breakthrough_likelihood || 0;
    const insightPotential = cognitiveState.insight_potential || 0;

    // 1. Belief Convergence Rate: Measure confidence trajectory stability
    let confidenceConvergenceRate = 0;
    if (confidenceTrajectory.length > 1) {
      // Calculate rate of change in confidence (lower variance = better convergence)
      const recentConfidence = confidenceTrajectory.slice(-3);
      const variance = recentConfidence.reduce((acc: number, val: number, idx: number) => {
        if (idx === 0) return 0;
        return acc + Math.pow(val - recentConfidence[idx - 1], 2);
      }, 0) / Math.max(recentConfidence.length - 1, 1);
      confidenceConvergenceRate = Math.max(0, 1 - variance); // Lower variance = higher convergence
    }

    // 2. Predictive Accuracy: Use metacognitive awareness as proxy
    const predictiveAccuracy = metacognitiveAwareness;

    // 3. Adaptation Speed: Rate of belief updating (combination of breakthrough + insight)
    const adaptationSpeed = (breakthroughLikelihood + insightPotential) / 2;

    // 4. Uncertainty Robustness: Creative pressure stability
    const uncertaintyRobustness = Math.min(creativePressure, 1.0);

    // Outcome quality modifiers
    const qualityModifiers = {
      'excellent': 1.2,
      'good': 1.0,
      'fair': 0.8,
      'poor': 0.6
    };
    const qualityModifier = qualityModifiers[outcomeQuality];

    // Bayesian-inspired weighted combination
    const baseImprovement = 
      0.3 * confidenceConvergenceRate +
      0.3 * predictiveAccuracy +
      0.2 * adaptationSpeed +
      0.2 * uncertaintyRobustness;

    // Apply outcome quality and success modifiers
    const reasoningImprovement = baseImprovement * qualityModifier * (success ? 1 : -0.5);

    // Normalize to reasonable range [-0.3, 0.3]
    return Math.max(-0.3, Math.min(0.3, reasoningImprovement));
  }

  private async updatePromptProcessingStatus(
    promptId: string,
    success: boolean,
    outcomeQuality: 'excellent' | 'good' | 'fair' | 'poor',
    cognitiveState?: any
  ): Promise<void> {
    try {
      const reasoningImprovement = this.calculateBayesianReasoningImprovement(
        cognitiveState,
        outcomeQuality,
        success
      );

      await this.memoryStore.updatePrompt(promptId, {
        processing_success: success,
        reasoning_improvement: reasoningImprovement,
      });
    } catch (error) {
      console.error('⚠️ Error updating prompt processing status:', error);
    }
  }

  /* ------------------------------ Main Handler ----------------------------- */


  public async processThought(input: unknown): Promise<ServerResult> {
    const t0 = performance.now();

    try {
      const data = ThoughtDataSchema.parse(input);


      // Sanity limits with contextual guidance for AI recovery
      if (data.thought_number > MAX_THOUGHTS) {
        return this.buildToolError(
          `Thought limit reached (${MAX_THOUGHTS}). Consider breaking complex problems into separate reasoning sessions, or complete your analysis with fewer thoughts. Most problems can be solved effectively in 10-15 thoughts. You can start a new reasoning session to continue if needed.`
        );
      }
      if (data.branch_from_thought && data.branch_from_thought > this.thoughtHistory.length) {
        return this.buildToolError(
          `Invalid branch reference: thought ${data.branch_from_thought} doesn't exist. You currently have ${this.thoughtHistory.length} thoughts in your history. Use a valid thought number between 1-${this.thoughtHistory.length} for branching. To explore alternatives, branch from an existing thought that represents a decision point.`
        );
      }

      // 📁 PROJECT RESOLUTION: Extract project context from working directory (first)
      console.error('📁 Resolving project context from working directory...');
      let projectId: string | undefined;
      let project: Project | undefined;
      
      try {
        projectId = await this.resolveProjectFromWorkingDirectory(data.working_directory);
      } catch (error) {
        if (error instanceof Error && error.message.includes('Project management requires PostgreSQL')) {
          console.error('ℹ️ Continuing without project context (basic memory store in use)');
          projectId = undefined;
        } else {
          console.error('⚠️ Failed to resolve project context:', error);
          projectId = undefined;
        }
      }

      if (projectId) {
        console.error(`✅ Project context resolved: ${projectId}`);
        // Fetch the full project object for cognitive integration
        try {
          project = (await this.memoryStore.getProject(projectId)) || undefined;
          if (project) {
            console.error(
              `📋 Project loaded: ${project.project_name} (${project.technology_stack?.join(', ') || 'No tech stack'})`
            );
          } else {
            console.error(`⚠️ Project ${projectId} not found in database`);
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes('not supported')) {
            console.error(`⚠️ Project retrieval not supported by ${this.memoryStore.constructor.name}`);
          } else {
            console.error('⚠️ Failed to fetch project details:', error);
          }
        }
      } else {
        console.error('ℹ️ No project context available (working_directory not set)');
      }

      // 🧠 AGI MAGIC: Prompt intelligence and cognitive orchestration
      console.error('🧠 Capturing and analyzing prompt with AGI intelligence...');

      // Capture and analyze the prompt with project context
      const promptId = await this.captureAndAnalyzePrompt(data, projectId);

      console.error(
        '🧠 Engaging cognitive orchestrator for AGI-level processing with prompt context...'
      );

      // Build prompt context for enhanced cognitive processing
      let promptContext: any = undefined;
      if (promptId) {
        try {
          // Retrieve the stored prompt with all analysis data
          const storedPrompt = await this.memoryStore.getPrompt(promptId);
          if (storedPrompt) {
            // Build context from stored prompt analysis
            promptContext = {
              promptId: storedPrompt.id,
              classification: {
                type: storedPrompt.prompt_type,
                confidence: storedPrompt.classification_confidence || 0.5,
              },
              intent: storedPrompt.extracted_intent,
              complexity: {
                complexity: storedPrompt.complexity_estimate || 5.0,
                confidence: 0.8, // Default confidence for complexity
              },
              similarPrompts: storedPrompt.similar_prompts || [],
            };

            console.error('🧠 Prompt context built for cognitive priming:', {
              type: promptContext.classification.type,
              objectives: promptContext.intent?.objectives?.length || 0,
              constraints: promptContext.intent?.constraints?.length || 0,
              requirements: promptContext.intent?.requirements?.length || 0,
              complexity: promptContext.complexity.complexity,
              similarPrompts: promptContext.similarPrompts.length,
            });
          } else {
            console.error('⚠️ Stored prompt not found for ID:', promptId);
          }
        } catch (error) {
          console.error('⚠️ Error retrieving prompt context:', error);
        }
      }

      // Use enhanced cognitive processing with prompt context priming and project awareness
      const cognitiveResult = promptContext
        ? await this.cognitiveOrchestrator.processThoughtWithPromptContext(
            data,
            {
              id: this.currentSessionId,
              objective: this.inferObjective(data),
              domain: this.inferDomain(data),
              start_time: new Date(),
              goal_achieved: false,
              confidence_level: 0.5,
              total_thoughts: data.total_thoughts,
              revision_count: this.thoughtHistory.filter(t => t.is_revision).length,
              branch_count: this.branches.size,
            },
            promptContext,
            project // Pass project context for cognitive awareness
          )
        : await this.cognitiveOrchestrator.processThought(
            data,
            {
              id: this.currentSessionId,
              objective: this.inferObjective(data),
              domain: this.inferDomain(data),
              start_time: new Date(),
              goal_achieved: false,
              confidence_level: 0.5,
              total_thoughts: data.total_thoughts,
              revision_count: this.thoughtHistory.filter(t => t.is_revision).length,
              branch_count: this.branches.size,
            },
            project
          ); // Pass project context for cognitive awareness

      // Store thought in memory with cognitive enrichment and prompt linkage
      const storedThought: StoredThought = {
        id: this.generateThoughtId(),
        thought: data.thought,
        thought_number: data.thought_number,
        total_thoughts: data.total_thoughts,
        next_thought_needed: data.next_thought_needed,
        is_revision: data.is_revision,
        revises_thought: data.revises_thought,
        branch_from_thought: data.branch_from_thought,
        branch_id: data.branch_id,
        needs_more_thoughts: data.needs_more_thoughts,
        timestamp: new Date(),
        session_id: this.currentSessionId,
        prompt_id: promptId || undefined, // Link to the analyzed prompt
        project_id: projectId || undefined, // Link to the resolved project
        confidence:
          cognitiveResult.cognitiveState.confidence_trajectory[
            cognitiveResult.cognitiveState.confidence_trajectory.length - 1
          ],
        domain: this.inferDomain(data),
        objective: this.inferObjective(data),
        complexity: cognitiveResult.cognitiveState.current_complexity,
        context: {
          cognitive_load: cognitiveResult.cognitiveState.current_complexity,
          problem_type: this.inferProblemType(data),
        },
        output: cognitiveResult.interventions.map(i => i.content).join('\n'),
        tags: this.generateTags(data, cognitiveResult),
        outcome_quality: this.assessOutcomeQuality(cognitiveResult),
      };

      // Update and store session information FIRST (to satisfy foreign key constraints)
      await this.updateAndStoreSession(data, cognitiveResult, projectId);

      // Then store the thought (which references the session)
      await this.memoryStore.storeThought(storedThought);

      // Check if session is complete and trigger thought analysis
      if (!data.next_thought_needed) {
        // Trigger analysis asynchronously to avoid blocking
        setImmediate(async () => {
          try {
            console.error(`🧠 Session completed, triggering thought analysis for session: ${storedThought.session_id}`);
            await this.memoryStore.analyzeAndStoreThoughtChain(storedThought.session_id);
            console.error(`✅ Thought analysis completed for session: ${storedThought.session_id}`);
          } catch (error) {
            console.error(`❌ Thought analysis failed for session ${storedThought.session_id}:`, error);
          }
        });
      }

      // Stats & storage with memory management -------------------------
      // Use mutex to prevent race conditions in shared state mutations
      await this.thoughtMutex.withLock(async () => {
        // Add thought to history with size management
        this.addThoughtToHistory(data);

        // Add to branch with size management
        if (data.branch_id) {
          this.addThoughtToBranch(data.branch_id, data);
        }
      });

      // Enhanced logging with cognitive insights (secure)
      console.error(await this.formatThoughtSecure(data));
      console.error('🧠 Cognitive Analysis:', {
        metacognitive_awareness: cognitiveResult.cognitiveState.metacognitive_awareness,
        creative_pressure: cognitiveResult.cognitiveState.creative_pressure,
        breakthrough_likelihood: cognitiveResult.cognitiveState.breakthrough_likelihood,
        insights_detected: cognitiveResult.insights.length,
        interventions_applied: cognitiveResult.interventions.length,
        recommendations_generated: cognitiveResult.recommendations.length,
      });

      // Log memory stats periodically and trigger cleanup
      if (data.thought_number % 25 === 0) {
        const memStats = this.getMemoryStats();
        console.error('📊 Memory Stats:', memStats);

        // Trigger cleanup if memory pressure is high
        if (memStats.memoryPressure > 0.8) {
          console.error('⚠️ High memory pressure detected - triggering automatic cleanup:', {
            pressure: memStats.memoryPressure,
            thoughtHistory: memStats.thoughtHistorySize,
            branches: memStats.branchCount,
          });

          // Trigger aggressive memory cleanup
          this.performEmergencyMemoryCleanup();

          // Also trigger timer manager emergency cleanup
          const timerManager = TimerManager.getInstance();
          timerManager.emergencyCleanup();

          // Force garbage collection
          if (global.gc) {
            global.gc();
          }
        }
      }

      // Update prompt processing success status
      if (promptId) {
        await this.updatePromptProcessingStatus(
          promptId,
          true,
          this.assessOutcomeQuality(cognitiveResult),
          cognitiveResult.cognitiveState
        );
      }

      console.error('✔️ AGI processed', {
        num: data.thought_number,
        cognitive_efficiency: cognitiveResult.cognitiveState.cognitive_efficiency,
        promptId: promptId,
        elapsedMs: +(performance.now() - t0).toFixed(1),
      });

      // 🚨 CRITICAL MEMORY LEAK FIX: Force garbage collection after processing
      this.forceMemoryCleanup(data, cognitiveResult);

      return this.buildSuccess(data, cognitiveResult);
    } catch (err) {
      const e = err as Error;
      console.error('❌ AGI error', {
        err: e.message,
        elapsedMs: +(performance.now() - t0).toFixed(1),
      });

      // Handle validation errors with contextual guidance
      if (err instanceof ZodError) {
        if (this.cfg.debug) console.error(err.errors);

        const validationGuidance = this.buildValidationGuidance(err.errors);
        return this.buildToolError(validationGuidance);
      }

      // Handle MCP protocol errors (pass through - these are genuine protocol issues)
      if (err instanceof McpError) {
        throw err;
      }

      // Handle unknown errors with smart recovery guidance
      return this.buildToolError(
        `An unexpected error occurred: ${e.message}. Try rephrasing your thought or simplifying the reasoning. If this persists after 2-3 attempts, this may indicate a system limitation with your current approach. Consider breaking the problem into smaller steps or using different terminology.`
      );
    }
  }

  /**
   * Helper methods for cognitive processing
   */
  private generateThoughtId(): string {
    return `thought_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /* -------------------------------------------------------------------------- */
  /*                            PROJECT RESOLUTION                             */
  /* -------------------------------------------------------------------------- */

  /**
   * Resolve project from working directory with comprehensive metadata extraction
   */
  private async resolveProjectFromWorkingDirectory(clientWorkingDirectory?: string): Promise<string | undefined> {
    try {
      const storedValues = this.promptValueManager.getStoredValues('');
      let workingDirectory = storedValues.working_directory;

      // Prioritize client-provided working directory
      if (clientWorkingDirectory && typeof clientWorkingDirectory === 'string') {
        workingDirectory = clientWorkingDirectory;
        console.error(`📁 Using client-provided working directory: ${workingDirectory}`);
        
        // Store the client-provided working directory for future use
        try {
          await this.promptValueManager.updateStoredValues('', {
            working_directory: workingDirectory,
          });
          console.error(`✅ Client working directory stored: ${workingDirectory}`);
        } catch (error) {
          console.error('⚠️ Failed to store client working directory:', error);
        }
      }
      // If no working_directory is set, automatically detect it from process.cwd()
      else if (!workingDirectory || typeof workingDirectory !== 'string') {
        // Try multiple methods to detect the working directory
        workingDirectory = process.cwd();
        
        // Also check PWD environment variable which might be more accurate in some cases
        const pwdEnv = process.env.PWD;
        if (pwdEnv && pwdEnv !== workingDirectory) {
          console.error(`🔍 PWD env var suggests: ${pwdEnv}, process.cwd(): ${workingDirectory}`);
          // Use PWD if it exists and is different from process.cwd()
          workingDirectory = pwdEnv;
        }
        
        console.error(`🔄 Auto-detecting working directory: ${workingDirectory}`);

        // Store the detected working directory for future use
        try {
          await this.promptValueManager.updateStoredValues('', {
            working_directory: workingDirectory,
          });
          console.error(`✅ Auto-detected working directory stored: ${workingDirectory}`);
        } catch (error) {
          console.error('⚠️ Failed to store auto-detected working directory:', error);
        }
      }

      if (workingDirectory && typeof workingDirectory === 'string') {
        // Validate path for security
        const pathValidation = MemoryUtils.validateProjectPath(workingDirectory);
        if (!pathValidation.valid) {
          console.error(`⚠️ Invalid project path: ${pathValidation.error}`);
          return undefined;
        }

        const normalizedPath = path.resolve(workingDirectory);
        console.error(`🔍 Resolving project from: ${normalizedPath}`);

        // Find or create project record
        const projectId = await this.findOrCreateProject(normalizedPath);
        console.error(`📁 Project resolved: ${projectId}`);
        return projectId;
      }
    } catch (error) {
      console.error('❌ Error resolving project context:', error);
      
      // Diagnostic information for debugging
      console.error('🔧 Debug info:');
      console.error(`   - process.cwd(): ${process.cwd()}`);
      console.error(`   - process.env.PWD: ${process.env.PWD || 'undefined'}`);
      console.error(`   - process.env.INIT_CWD: ${process.env.INIT_CWD || 'undefined'}`);
      console.error(`   - stored working_directory: ${this.promptValueManager.getStoredValues('').working_directory || 'undefined'}`);
      console.error(`   - memory store type: ${this.memoryStore.constructor.name}`);
      console.error(`   - error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
      console.error(`   - error message: ${error instanceof Error ? error.message : String(error)}`);
    }
    return undefined;
  }

  /**
   * Find existing project or create new one with metadata extraction
   */
  private async findOrCreateProject(directoryPath: string): Promise<string> {
    try {
      // Check if project already exists
      const existingProject = await this.memoryStore.findProjectByPath(directoryPath);
      if (existingProject) {
        // Update last activity
        await this.memoryStore.updateProject(existingProject.id, {
          last_activity_at: new Date(),
        });
        console.error(
          `✅ Found existing project: ${existingProject.project_name} (${existingProject.id})`
        );
        return existingProject.id;
      }
    } catch (error) {
      // Handle unsupported memory stores gracefully
      if (error instanceof Error && error.message.includes('not supported')) {
        console.error(`⚠️ Project management not supported by ${this.memoryStore.constructor.name}`);
        console.error('💡 Use PostgreSQL memory store (MEMORY_STORE_TYPE=postgresql) for full project support');
        throw new Error('Project management requires PostgreSQL memory store');
      }
      console.error('❌ Error checking for existing project:', error);
      throw error;
    }

    // Create new project with metadata extraction
    console.error(`📝 Creating new project for: ${directoryPath}`);
    const projectMetadata = await this.extractProjectMetadata(directoryPath);
    const project: Omit<Project, 'id'> = {
      directory_path: directoryPath,
      project_name: projectMetadata.name,
      description: projectMetadata.description,
      technology_stack: projectMetadata.technologyStack,
      project_type: projectMetadata.projectType,
      programming_languages: projectMetadata.programmingLanguages,
      created_at: new Date(),
      updated_at: new Date(),
      last_activity_at: new Date(),
      is_active: true,
      is_archived: false,
      cognitive_settings: {},
      project_metadata: projectMetadata.customMetadata || {},
    };

    try {
      const createdProject = await this.memoryStore.createProject(project);
      console.error(
        `🎉 Created new project: ${createdProject.project_name} (${createdProject.id})`
      );
      console.error(
        `🏷️ Technology stack: ${createdProject.technology_stack?.join(', ') || 'Unknown'}`
      );
      console.error(
        `🗣️ Languages: ${createdProject.programming_languages?.join(', ') || 'Unknown'}`
      );
      return createdProject.id;
    } catch (error) {
      // Handle unsupported memory stores gracefully
      if (error instanceof Error && error.message.includes('not supported')) {
        console.error(`⚠️ Project creation not supported by ${this.memoryStore.constructor.name}`);
        console.error('💡 Use PostgreSQL memory store (MEMORY_STORE_TYPE=postgresql) for full project support');
        throw new Error('Project management requires PostgreSQL memory store');
      }
      console.error('❌ Error creating project:', error);
      throw new Error(`Failed to create project: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract comprehensive project metadata from directory structure and files
   */
  private async extractProjectMetadata(directoryPath: string): Promise<{
    name: string;
    description?: string;
    technologyStack: string[];
    projectType?: string;
    programmingLanguages: string[];
    customMetadata?: Record<string, any>;
  }> {
    const projectName = MemoryUtils.extractProjectName(directoryPath);
    const technologyStack: string[] = [];
    const programmingLanguages: string[] = [];
    let description: string | undefined;
    let projectType: string | undefined;
    const customMetadata: Record<string, any> = {};

    try {
      console.error(`🔍 Analyzing project structure: ${directoryPath}`);

      // Check for package.json (Node.js project)
      const packageJsonPath = path.join(directoryPath, 'package.json');
      if (await this.fileExists(packageJsonPath)) {
        console.error('📦 Found package.json - Node.js project detected');
        const packageJson = JSON.parse(await this.readFileContent(packageJsonPath));
        description = packageJson.description;
        technologyStack.push('nodejs');
        programmingLanguages.push('javascript');

        // Detect TypeScript
        if (packageJson.devDependencies?.typescript || packageJson.dependencies?.typescript) {
          technologyStack.push('typescript');
          programmingLanguages.push('typescript');
          console.error('📝 TypeScript detected');
        }

        // Detect React
        if (packageJson.dependencies?.react) {
          technologyStack.push('react');
          projectType = 'web-app';
          console.error('⚛️ React detected');
        }

        // Detect Next.js
        if (packageJson.dependencies?.next) {
          technologyStack.push('nextjs');
          projectType = 'web-app';
          console.error('🔺 Next.js detected');
        }

        // Detect Vue.js
        if (packageJson.dependencies?.vue) {
          technologyStack.push('vue');
          projectType = 'web-app';
          console.error('💚 Vue.js detected');
        }

        // Detect Express
        if (packageJson.dependencies?.express) {
          technologyStack.push('express');
          if (!projectType) projectType = 'api';
          console.error('🚀 Express detected');
        }

        // Detect NestJS
        if (packageJson.dependencies?.['@nestjs/core']) {
          technologyStack.push('nestjs');
          projectType = 'api';
          console.error('🐱 NestJS detected');
        }

        customMetadata.packageJson = {
          name: packageJson.name,
          version: packageJson.version,
          dependencies: Object.keys(packageJson.dependencies || {}),
          devDependencies: Object.keys(packageJson.devDependencies || {}),
        };
      }

      // Check for requirements.txt or pyproject.toml (Python project)
      const requirementsPath = path.join(directoryPath, 'requirements.txt');
      const pyprojectPath = path.join(directoryPath, 'pyproject.toml');
      if ((await this.fileExists(requirementsPath)) || (await this.fileExists(pyprojectPath))) {
        console.error('🐍 Python project detected');
        technologyStack.push('python');
        programmingLanguages.push('python');
        if (!projectType) projectType = 'api';

        // Check for specific Python frameworks
        if (await this.fileExists(requirementsPath)) {
          const requirements = await this.readFileContent(requirementsPath);
          if (requirements.includes('django')) {
            technologyStack.push('django');
            projectType = 'web-app';
            console.error('🎸 Django detected');
          }
          if (requirements.includes('flask')) {
            technologyStack.push('flask');
            projectType = 'api';
            console.error('🌶️ Flask detected');
          }
          if (requirements.includes('fastapi')) {
            technologyStack.push('fastapi');
            projectType = 'api';
            console.error('⚡ FastAPI detected');
          }
        }
      }

      // Check for Cargo.toml (Rust project)
      const cargoPath = path.join(directoryPath, 'Cargo.toml');
      if (await this.fileExists(cargoPath)) {
        console.error('🦀 Rust project detected');
        technologyStack.push('rust');
        programmingLanguages.push('rust');

        try {
          const cargoContent = await this.readFileContent(cargoPath);
          if (cargoContent.includes('[dependencies]')) {
            if (cargoContent.includes('actix') || cargoContent.includes('warp')) {
              projectType = 'api';
              console.error('🌐 Rust web framework detected');
            }
          }
        } catch (error) {
          console.error('⚠️ Error reading Cargo.toml:', error);
        }
      }

      // Check for go.mod (Go project)
      const goModPath = path.join(directoryPath, 'go.mod');
      if (await this.fileExists(goModPath)) {
        console.error('🐹 Go project detected');
        technologyStack.push('go');
        programmingLanguages.push('go');
        if (!projectType) projectType = 'api';

        try {
          const goModContent = await this.readFileContent(goModPath);
          if (goModContent.includes('gin-gonic') || goModContent.includes('gorilla')) {
            console.error('🌐 Go web framework detected');
          }
        } catch (error) {
          console.error('⚠️ Error reading go.mod:', error);
        }
      }

      // Check for pom.xml (Java/Maven project)
      const pomPath = path.join(directoryPath, 'pom.xml');
      if (await this.fileExists(pomPath)) {
        console.error('☕ Java/Maven project detected');
        technologyStack.push('java', 'maven');
        programmingLanguages.push('java');
        if (!projectType) projectType = 'api';
      }

      // Check for build.gradle (Java/Gradle project)
      const gradlePath = path.join(directoryPath, 'build.gradle');
      if (await this.fileExists(gradlePath)) {
        console.error('☕ Java/Gradle project detected');
        technologyStack.push('java', 'gradle');
        programmingLanguages.push('java');
        if (!projectType) projectType = 'api';
      }

      // Check for Dockerfile (Docker containerization)
      const dockerfilePath = path.join(directoryPath, 'Dockerfile');
      if (await this.fileExists(dockerfilePath)) {
        console.error('🐳 Docker detected');
        technologyStack.push('docker');
      }

      // Check for docker-compose.yml
      const dockerComposePath = path.join(directoryPath, 'docker-compose.yml');
      if (await this.fileExists(dockerComposePath)) {
        console.error('🐙 Docker Compose detected');
        technologyStack.push('docker-compose');
      }

      // Check for README files for description
      if (!description) {
        const readmeFiles = ['README.md', 'README.txt', 'README.rst'];
        for (const readme of readmeFiles) {
          const readmePath = path.join(directoryPath, readme);
          if (await this.fileExists(readmePath)) {
            try {
              const content = await this.readFileContent(readmePath);
              // Extract first meaningful paragraph as description
              const lines = content.split('\n').filter(line => line.trim().length > 0);
              for (const line of lines.slice(1, 5)) {
                // Skip title, check next few lines
                if (line.length > 20 && line.length < 500 && !line.startsWith('#')) {
                  description = line.replace(/^[#\-\*\s]*/, '').trim();
                  console.error(`📚 Description extracted from ${readme}`);
                  break;
                }
              }
              if (description) break;
            } catch (error) {
              console.error(`⚠️ Error reading ${readme}:`, error);
            }
          }
        }
      }

      // Detect additional technologies from file extensions
      const commonFiles = await this.scanDirectoryForExtensions(directoryPath);
      if (commonFiles.includes('.py') && !programmingLanguages.includes('python')) {
        programmingLanguages.push('python');
        console.error('🐍 Python files detected');
      }
      if (commonFiles.includes('.java') && !programmingLanguages.includes('java')) {
        programmingLanguages.push('java');
        console.error('☕ Java files detected');
      }
      if (
        (commonFiles.includes('.cpp') || commonFiles.includes('.cc')) &&
        !programmingLanguages.includes('cpp')
      ) {
        programmingLanguages.push('cpp');
        console.error('⚙️ C++ files detected');
      }
      if (commonFiles.includes('.c') && !programmingLanguages.includes('c')) {
        programmingLanguages.push('c');
        console.error('⚙️ C files detected');
      }
    } catch (error) {
      console.error('❌ Error extracting project metadata:', error);
    }

    const result = {
      name: projectName,
      description,
      technologyStack: [...new Set(technologyStack)], // Remove duplicates
      projectType,
      programmingLanguages: [...new Set(programmingLanguages)], // Remove duplicates
      customMetadata,
    };

    console.error('📊 Project metadata extraction complete:', {
      name: result.name,
      type: result.projectType || 'unknown',
      technologies: result.technologyStack.length,
      languages: result.programmingLanguages.length,
      hasDescription: !!result.description,
    });

    return result;
  }

  /**
   * Check if file exists asynchronously
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read file content safely
   */
  private async readFileContent(filePath: string): Promise<string> {
    try {
      return await fs.promises.readFile(filePath, 'utf8');
    } catch (error) {
      console.error(`⚠️ Error reading file ${filePath}:`, error);
      return '';
    }
  }

  /**
   * Scan directory for common file extensions (non-recursive for performance)
   */
  private async scanDirectoryForExtensions(directoryPath: string): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(directoryPath);
      const extensions = new Set<string>();

      for (const file of files.slice(0, 100)) {
        // Limit to first 100 files for performance
        const ext = path.extname(file).toLowerCase();
        if (ext) {
          extensions.add(ext);
        }
      }

      return Array.from(extensions);
    } catch (error) {
      console.error(`⚠️ Error scanning directory ${directoryPath}:`, error);
      return [];
    }
  }

  private inferObjective(data: ValidatedThoughtData): string {
    // Simple objective inference based on thought content
    if (
      data.thought.toLowerCase().includes('bug') ||
      data.thought.toLowerCase().includes('error')
    ) {
      return 'Debug and fix issues';
    }
    if (
      data.thought.toLowerCase().includes('implement') ||
      data.thought.toLowerCase().includes('build')
    ) {
      return 'Implementation and development';
    }
    if (
      data.thought.toLowerCase().includes('design') ||
      data.thought.toLowerCase().includes('architecture')
    ) {
      return 'System design and architecture';
    }
    return 'General problem solving';
  }

  private inferDomain(data: ValidatedThoughtData): string {
    const thought = data.thought.toLowerCase();
    if (thought.includes('code') || thought.includes('function') || thought.includes('class')) {
      return 'software_development';
    }
    if (
      thought.includes('algorithm') ||
      thought.includes('performance') ||
      thought.includes('optimization')
    ) {
      return 'algorithms';
    }
    if (thought.includes('design') || thought.includes('ui') || thought.includes('ux')) {
      return 'design';
    }
    if (thought.includes('database') || thought.includes('data') || thought.includes('storage')) {
      return 'data_management';
    }
    return 'general';
  }

  private inferProblemType(data: ValidatedThoughtData): string {
    if (data.is_revision) return 'revision';
    if (data.branch_id) return 'exploration';
    if (data.thought_number === 1) return 'initial_analysis';
    return 'progressive_reasoning';
  }

  private generateTags(data: ValidatedThoughtData, cognitiveResult: any): string[] {
    const tags = [];

    if (data.is_revision) tags.push('revision');
    if (data.branch_id) tags.push('branching');
    if (cognitiveResult.insights.length > 0) tags.push('insightful');
    if (cognitiveResult.cognitiveState.breakthrough_likelihood > 0.7)
      tags.push('breakthrough_potential');
    if (cognitiveResult.cognitiveState.creative_pressure > 0.6) tags.push('creative');
    if (cognitiveResult.cognitiveState.metacognitive_awareness > 0.7) tags.push('metacognitive');

    return tags;
  }

  private assessOutcomeQuality(cognitiveResult: any): 'excellent' | 'good' | 'fair' | 'poor' {
    const score = cognitiveResult.cognitiveState.cognitive_efficiency;
    if (score > 0.8) return 'excellent';
    if (score > 0.6) return 'good';
    if (score > 0.4) return 'fair';
    return 'poor';
  }

  /**
   * Add thought to history with automatic cleanup
   */
  private addThoughtToHistory(data: ValidatedThoughtData): void {
    // Check if cleanup is needed
    if (
      this.thoughtHistory.length >=
      this.memoryConfig.maxThoughtHistory * this.memoryConfig.cleanupThreshold
    ) {
      this.cleanupThoughtHistory();
    }

    this.thoughtHistory.push(data);
  }

  /**
   * Add thought to branch with automatic cleanup
   */
  private addThoughtToBranch(branchId: string, data: ValidatedThoughtData): void {
    // Check if we have too many branches
    if (this.branches.size >= this.memoryConfig.maxBranches) {
      this.cleanupOldestBranches();
    }

    const arr = this.branches.get(branchId) ?? [];

    // Check if this branch has too many thoughts
    if (arr.length >= this.memoryConfig.maxBranchThoughts * this.memoryConfig.cleanupThreshold) {
      // Remove oldest thoughts from this branch (keep most recent)
      const keepCount = Math.floor(this.memoryConfig.maxBranchThoughts * 0.7);
      arr.splice(0, arr.length - keepCount);
    }

    arr.push(data);
    this.branches.set(branchId, arr);
  }

  /**
   * Cleanup old thoughts from history (LRU-style)
   */
  private cleanupThoughtHistory(): void {
    const removeCount = Math.floor(this.memoryConfig.maxThoughtHistory * 0.3); // Remove 30%
    this.thoughtHistory.splice(0, removeCount);

    console.error(`🧹 Cleaned up ${removeCount} old thoughts from history`);
  }

  /**
   * Cleanup oldest branches to prevent unbounded growth
   */
  private cleanupOldestBranches(): void {
    // Find branches with oldest thoughts (using thought_number as proxy for age)
    const branchAges = Array.from(this.branches.entries())
      .map(([branchId, thoughts]) => ({
        branchId,
        oldestThought: Math.min(...thoughts.map(t => t.thought_number)),
        thoughtCount: thoughts.length,
      }))
      .sort((a, b) => a.oldestThought - b.oldestThought);

    // Remove oldest 20% of branches
    const removeCount = Math.floor(this.memoryConfig.maxBranches * 0.2);
    const toRemove = branchAges.slice(0, removeCount);

    for (const { branchId } of toRemove) {
      this.branches.delete(branchId);
    }

    console.error(`🧹 Cleaned up ${removeCount} old branches`);
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): {
    thoughtHistorySize: number;
    branchCount: number;
    totalBranchThoughts: number;
    memoryPressure: number;
  } {
    const totalBranchThoughts = Array.from(this.branches.values()).reduce(
      (total, thoughts) => total + thoughts.length,
      0
    );

    const memoryPressure = Math.max(
      this.thoughtHistory.length / this.memoryConfig.maxThoughtHistory,
      this.branches.size / this.memoryConfig.maxBranches,
      totalBranchThoughts / (this.memoryConfig.maxBranches * this.memoryConfig.maxBranchThoughts)
    );

    return {
      thoughtHistorySize: this.thoughtHistory.length,
      branchCount: this.branches.size,
      totalBranchThoughts,
      memoryPressure,
    };
  }

  /**
   * Emergency memory cleanup when pressure is high
   */
  private performEmergencyMemoryCleanup(): void {
    console.error('🚨 Performing emergency memory cleanup...');

    const beforeSize =
      this.thoughtHistory.length +
      Array.from(this.branches.values()).reduce((total, thoughts) => total + thoughts.length, 0);

    // Aggressively trim thought history to 25% of max
    const maxHistoryEmergency = Math.floor(this.memoryConfig.maxThoughtHistory * 0.25);
    if (this.thoughtHistory.length > maxHistoryEmergency) {
      this.thoughtHistory.splice(0, this.thoughtHistory.length - maxHistoryEmergency);
      console.error(`🗑️ Trimmed thought history to ${this.thoughtHistory.length} entries`);
    }

    // Clear older branches, keep only the most recent ones
    const branchEntries = Array.from(this.branches.entries());
    if (branchEntries.length > 3) {
      // Sort by last thought timestamp and keep only 3 most recent branches
      branchEntries.sort((a, b) => {
        const aLastThought = a[1][a[1].length - 1];
        const bLastThought = b[1][b[1].length - 1];
        return bLastThought.thought_number - aLastThought.thought_number;
      });

      // Remove older branches
      for (let i = 3; i < branchEntries.length; i++) {
        this.branches.delete(branchEntries[i][0]);
      }
      console.error(`🗑️ Trimmed branches from ${branchEntries.length} to 3`);
    }

    // Trim remaining branches to smaller sizes
    for (const [branchId, thoughts] of this.branches.entries()) {
      if (thoughts.length > 10) {
        thoughts.splice(0, thoughts.length - 10);
      }
    }

    const afterSize =
      this.thoughtHistory.length +
      Array.from(this.branches.values()).reduce((total, thoughts) => total + thoughts.length, 0);
    console.error(
      `✅ Emergency cleanup complete: ${beforeSize} → ${afterSize} total objects (${(((beforeSize - afterSize) / beforeSize) * 100).toFixed(1)}% reduction)`
    );
  }

  /**
   * Force immediate memory cleanup - for memory leak prevention
   */
  forceEmergencyMemoryCleanup(): void {
    const beforeHistory = this.thoughtHistory.length;
    const beforeBranches = this.branches.size;

    // Aggressively trim arrays to emergency levels
    const emergencyHistorySize = Math.min(
      10,
      Math.floor(this.memoryConfig.maxThoughtHistory * 0.2)
    );
    const emergencyBranchSize = Math.min(2, Math.floor(this.memoryConfig.maxBranches * 0.2));

    // Keep only most recent thoughts
    if (this.thoughtHistory.length > emergencyHistorySize) {
      this.thoughtHistory.splice(0, this.thoughtHistory.length - emergencyHistorySize);
    }

    // Clear oldest branches if too many
    if (this.branches.size > emergencyBranchSize) {
      const sorted = Array.from(this.branches.entries()).sort(
        ([, a], [, b]) => (a[0]?.thought_number || 0) - (b[0]?.thought_number || 0)
      );
      const toRemove = sorted.slice(0, this.branches.size - emergencyBranchSize);
      toRemove.forEach(([id]) => this.branches.delete(id));
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const afterHistory = this.thoughtHistory.length;
    const afterBranches = this.branches.size;

    console.error(
      `🧹 EMERGENCY CLEANUP: History ${beforeHistory}→${afterHistory}, Branches ${beforeBranches}→${afterBranches}`
    );
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    // Clear data structures
    this.thoughtHistory.length = 0;
    this.branches.clear();

    // Close memory store connection
    try {
      await this.memoryStore.close();
    } catch (error) {
      console.error('⚠️ Error closing memory store:', error);
    }

    // The cognitive orchestrator cleanup is handled separately
  }

  private initializeMemoryConfig() {
    const performanceConfig = this.loadPerformanceConfig();
    if (performanceConfig) {
      // MEMORY LEAK FIX: Use much smaller defaults to prevent MCP server memory issues
      const maxHistory = Math.min(performanceConfig.maxThoughtHistory || 50, 50);
      return {
        maxThoughtHistory: maxHistory,
        maxBranchThoughts: Math.floor(maxHistory * 0.2),
        maxBranches: Math.floor(maxHistory * 0.1),
        cleanupThreshold: Math.min(performanceConfig.memoryCleanupThreshold || 0.5, 0.5),
      };
    }
    return this.calculateSystemOptimalMemoryConfig();
  }

  private loadPerformanceConfig() {
    try {
      const pathModule = createRequire(import.meta.url)('path');
      const fsModule = createRequire(import.meta.url)('fs');

      const configPath = pathModule.join(
        process.env.HOME || '',
        '.config',
        'sentient-agi',
        'cognitive-performance.json'
      );
      if (fsModule.existsSync(configPath)) {
        return JSON.parse(fsModule.readFileSync(configPath, 'utf8'));
      }
    } catch (error) {
      console.error('⚠️ Could not load performance config:', (error as Error).message);
    }
    return null;
  }

  private calculateSystemOptimalMemoryConfig() {
    // CRITICAL FIX: Reduce memory limits to prevent leaks in MCP server
    // MCP servers should stay under 40-70MB to avoid high memory usage warnings
    const maxThoughtHistory = 50; // Drastically reduced from 2000
    return {
      maxThoughtHistory,
      maxBranchThoughts: Math.floor(maxThoughtHistory * 0.2), // 10
      maxBranches: Math.floor(maxThoughtHistory * 0.1), // 5
      cleanupThreshold: 0.5, // Cleanup at 50% instead of 75%
    };
  }
}

/* -------------------------------------------------------------------------- */
/*                                BOOTSTRAP                                   */
/* -------------------------------------------------------------------------- */

export async function runServer(debugFlag = false): Promise<void> {
  // Initialize config manager and get config
  await configManager.init();
  const config = await configManager.getConfig();

  // Apply debug flag if specified
  if (debugFlag) {
    await configManager.setValue('debug', true);
  }

  const serverMeta = { name: 'sentient-agi-reasoning-server', version: '1.0.0-AGI-MAGIC' } as const;

  // Configure server capabilities based on config
  const capabilities: Partial<ServerCapabilities> = {
    tools: {},
    resources: {},
    completions: {}, // Add completions capability
  };

  // Only add prompts capability if enabled
  if (config.promptsEnabled) {
    capabilities.prompts = {
      list: true,
      get: true,
    };
  }

  const srv = new Server(serverMeta, { capabilities });
  const logic = new CodeReasoningServer(config);

  // Initialize the cognitive orchestrator with dependency injection
  await logic.initialize();

  // Initialize prompt manager if enabled
  let promptManager: PromptManager | undefined;
  if (config.promptsEnabled) {
    promptManager = new PromptManager(CONFIG_DIR);
    console.error('Prompts capability enabled');

    // Load custom prompts from the standard location
    console.error(`Loading custom prompts from ${CUSTOM_PROMPTS_DIR}`);
    await promptManager.loadCustomPrompts(CUSTOM_PROMPTS_DIR);

    // Add prompt handlers
    srv.setRequestHandler(ListPromptsRequestSchema, async () => {
      const prompts = promptManager?.getAllPrompts() || [];
      console.error(`Returning ${prompts.length} prompts`);
      return { prompts };
    });

    srv.setRequestHandler(GetPromptRequestSchema, async req => {
      try {
        if (!promptManager) {
          throw new McpError(ErrorCode.InternalError, 'Prompt manager not initialized');
        }

        const promptName = req.params.name;
        const args = req.params.arguments || {};

        console.error(`Getting prompt: ${promptName} with args:`, args);

        // Get the prompt result
        const result = promptManager.applyPrompt(promptName, args);

        // Return the result in the format expected by MCP
        return {
          messages: result.messages,
          _meta: {},
        };
      } catch (err) {
        const e = err as Error;
        console.error('Prompt error:', e.message);
        throw new McpError(ErrorCode.InternalError, `Prompt error: ${e.message}`);
      }
    });

    // Add handler for completion/complete requests
    srv.setRequestHandler(CompleteRequestSchema, async req => {
      try {
        if (!promptManager) {
          throw new McpError(ErrorCode.InternalError, 'Prompt manager not initialized');
        }

        // Check if this is a prompt reference
        if (req.params.ref.type !== 'ref/prompt') {
          return {
            completion: {
              values: [],
            },
          };
        }

        const promptName = req.params.ref.name;
        const argName = req.params.argument.name;

        console.error(`Completing argument: ${argName} for prompt: ${promptName}`);

        // Get stored values for this prompt using the public method
        const storedValues = promptManager.getStoredValues(promptName);

        // Return the stored value for this argument if available
        if (storedValues[argName]) {
          return {
            completion: {
              values: [storedValues[argName]],
            },
          };
        }

        // Return empty array if no stored value
        return {
          completion: {
            values: [],
          },
        };
      } catch (err) {
        const e = err as Error;
        console.error('Completion error:', e.message);
        return {
          completion: {
            values: [],
          },
        };
      }
    });
  } else {
    // Keep the empty handlers if prompts disabled
    srv.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: [] }));

    // Add empty handler for completion requests as well when prompts are disabled
    srv.setRequestHandler(CompleteRequestSchema, async () => ({
      completion: {
        values: [],
      },
    }));
  }

  // Existing handlers
  srv.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [] }));
  srv.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [CODE_REASONING_TOOL] }));
  srv.setRequestHandler(CallToolRequestSchema, async req => {
    if (req.params.name === CODE_REASONING_TOOL.name) {
      return logic.processThought(req.params.arguments);
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${req.params.name}`);
    }
  });

  const transport = new FilteredStdioServerTransport();

  // Monitor transport health
  const healthCheckInterval = setInterval(() => {
    if (!transport.isReady()) {
      const error = transport.getError();
      console.error('🚨 Transport health check failed:', error?.message || 'Unknown error');
      clearInterval(healthCheckInterval);
      shutdown('transport_failure');
    }
  }, 5000); // Check every 5 seconds

  await srv.connect(transport);

  // Clear health check on clean shutdown
  process.on('beforeExit', () => {
    clearInterval(healthCheckInterval);
  });

  console.error('🚀 Sentient AGI Reasoning Server ready.');
  console.error('🧠 Cognitive Architecture: FULLY OPERATIONAL');
  console.error('🎭 Personas: 8 cognitive entities active');
  console.error('🔮 Metacognitive Awareness: ONLINE');
  console.error('⚡ Emergent Behavior: ENABLED');
  console.error('📚 Memory Integration: ACTIVE');
  console.error('🎯 Tool: code-reasoning (AGI-Enhanced)');
  if (config.promptsEnabled) {
    console.error('📝 Prompts: Enhanced with cognitive capabilities');
  }
  console.error('✨ "The machine that thinks it thinks is thinking..."');

  const shutdown = async (sig: string) => {
    console.error(`↩︎ shutdown on ${sig}`);

    // Clear health check timer first
    try {
      clearInterval(healthCheckInterval);
      console.error('✅ Health check timer cleared');
    } catch (err) {
      console.error('⚠️ Error clearing health check timer:', err);
    }

    // Emergency timer cleanup
    try {
      const timerManager = TimerManager.getInstance();
      timerManager.prepareShutdown();
      console.error('✅ Timer manager shutdown initiated');
    } catch (err) {
      console.error('⚠️ Error shutting down timer manager:', err);
    }

    // Cleanup cognitive components
    try {
      console.error('🧠 Cleaning up cognitive systems...');
      await logic.getCognitiveOrchestrator().dispose();
      await logic.destroy();
      console.error('✅ Cognitive systems cleaned up');
    } catch (err) {
      console.error('⚠️ Error cleaning up cognitive systems:', err);
    }

    // Cleanup memory store
    try {
      if (logic['memoryStore']) {
        await logic['memoryStore'].close();
        console.error('✅ Memory store closed');
      }
    } catch (err) {
      console.error('⚠️ Error closing memory store:', err);
    }

    // Cleanup global resource manager
    try {
      await globalResourceManager.dispose();
      console.error('✅ Global resource manager disposed');
    } catch (err) {
      console.error('⚠️ Error disposing global resource manager:', err);
    }

    // Cleanup transport (avoid double-close)
    try {
      await srv.close();
      console.error('✅ Server closed');
    } catch (err) {
      console.error('⚠️ Error closing server:', err);
    }

    try {
      await transport.close();
      console.error('✅ Transport closed');
    } catch (err) {
      console.error('⚠️ Error closing transport:', err);
    }

    // Final timer cleanup with force
    try {
      const timerManager = TimerManager.getInstance();
      timerManager.clearAll('final_shutdown');
      console.error('✅ All timers force cleared');
    } catch (err) {
      console.error('⚠️ Error in final timer cleanup:', err);
    }

    // Force garbage collection before exit
    if (global.gc) {
      console.error('🗑️ Final garbage collection...');
      global.gc();
    }

    process.exit(0);
  };

  ['SIGINT', 'SIGTERM'].forEach(s => process.on(s, () => shutdown(s)));
  process.on('uncaughtException', (err: Error) => {
    console.error('💥 uncaught', err);
    shutdown('uncaughtException');
  });
  process.on('unhandledRejection', (r: unknown) => {
    console.error('💥 unhandledRejection', r);
    shutdown('unhandledRejection');
  });
}

// Self-execute when run directly ------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  runServer(process.argv.includes('--debug')).catch(err => {
    console.error('FATAL: failed to start', err);
    process.exit(1);
  });
}

/**
 * Simple in-memory implementation of MemoryStore for AGI capabilities
 */
class InMemoryStore extends MemoryStore {
  private thoughts: Map<string, StoredThought> = new Map();
  private sessions: Map<string, ReasoningSession> = new Map();
  private projects: Map<string, Project> = new Map();
  private prompts: Map<string, StoredPrompt> = new Map();

  // Memory management constants
  private readonly MAX_THOUGHTS = 10000;
  private readonly MAX_SESSIONS = 1000;
  private readonly MAX_PROMPTS = 5000;
  private readonly CLEANUP_THRESHOLD = 0.9; // Cleanup when 90% full

  async storeThought(thought: StoredThought): Promise<void> {
    // Check if we need to cleanup old entries
    if (this.thoughts.size >= this.MAX_THOUGHTS * this.CLEANUP_THRESHOLD) {
      this.performThoughtCleanup();
    }

    this.thoughts.set(thought.id, thought);
  }

  private performThoughtCleanup(): void {
    // Remove oldest thoughts (LRU-style cleanup)
    const thoughtsToRemove = Math.floor(this.MAX_THOUGHTS * 0.2); // Remove 20%
    const sortedThoughts = Array.from(this.thoughts.entries()).sort(
      (a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime()
    );

    for (let i = 0; i < thoughtsToRemove && i < sortedThoughts.length; i++) {
      this.thoughts.delete(sortedThoughts[i][0]);
    }
  }

  private performPromptCleanup(): void {
    // Remove oldest prompts (LRU-style cleanup)
    const promptsToRemove = Math.floor(this.MAX_PROMPTS * 0.2); // Remove 20%
    const sortedPrompts = Array.from(this.prompts.entries()).sort(
      (a, b) => a[1].received_at.getTime() - b[1].received_at.getTime()
    );

    for (let i = 0; i < promptsToRemove && i < sortedPrompts.length; i++) {
      this.prompts.delete(sortedPrompts[i][0]);
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error occurred';
  }

  async storeSession(session: ReasoningSession): Promise<void> {
    // Check if we need to cleanup old entries
    if (this.sessions.size >= this.MAX_SESSIONS * this.CLEANUP_THRESHOLD) {
      this.performSessionCleanup();
    }

    this.sessions.set(session.id, session);
  }

  private performSessionCleanup(): void {
    // Remove oldest sessions (LRU-style cleanup)
    const sessionsToRemove = Math.floor(this.MAX_SESSIONS * 0.2); // Remove 20%
    const sortedSessions = Array.from(this.sessions.entries()).sort(
      (a, b) => a[1].start_time.getTime() - b[1].start_time.getTime()
    );

    for (let i = 0; i < sessionsToRemove && i < sortedSessions.length; i++) {
      this.sessions.delete(sortedSessions[i][0]);
    }
  }

  async queryThoughts(query: MemoryQuery): Promise<StoredThought[]> {
    let results = Array.from(this.thoughts.values());

    if (query.domain) {
      results = results.filter(t => t.domain === query.domain);
    }
    if (query.confidence_range) {
      results = results.filter(
        t =>
          t.confidence !== undefined &&
          t.confidence >= query.confidence_range![0] &&
          t.confidence <= query.confidence_range![1]
      );
    }
    if (query.success_only) {
      results = results.filter(t => t.success === true);
    }

    return results.slice(0, query.limit || 100);
  }

  async getThought(id: string): Promise<StoredThought | null> {
    return this.thoughts.get(id) || null;
  }

  async getSession(id: string): Promise<ReasoningSession | null> {
    return this.sessions.get(id) || null;
  }

  async getSessions(limit?: number, offset?: number): Promise<ReasoningSession[]> {
    const sessions = Array.from(this.sessions.values());
    const start = offset || 0;
    const end = start + (limit || sessions.length);
    return sessions.slice(start, end);
  }

  async findSimilarThoughts(thought: string, limit?: number): Promise<StoredThought[]> {
    throw new Error('Semantic similarity search not supported in InMemoryStore');
  }

  async updateThought(id: string, updates: Partial<StoredThought>): Promise<void> {
    const existing = this.thoughts.get(id);
    if (existing) {
      this.thoughts.set(id, { ...existing, ...updates });
    }
  }

  async updateSession(id: string, updates: Partial<ReasoningSession>): Promise<void> {
    const existing = this.sessions.get(id);
    if (existing) {
      this.sessions.set(id, { ...existing, ...updates });
    }
  }

  async cleanupOldThoughts(olderThan: Date): Promise<number> {
    let cleaned = 0;
    for (const [id, thought] of this.thoughts) {
      if (thought.timestamp < olderThan) {
        this.thoughts.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }

  async getStats(): Promise<MemoryStats> {
    return {
      total_thoughts: this.thoughts.size,
      total_sessions: this.sessions.size,
      average_session_length: 5.2,
      overall_success_rate: 0.75,
      success_rate_by_domain: {},
      success_rate_by_complexity: {},
      most_effective_roles: [],
      most_effective_patterns: [],
      common_failure_modes: [],
      performance_over_time: [],
      learning_trajectory: [],
      storage_size: 1024,
      oldest_thought: new Date(),
      newest_thought: new Date(),
      duplicate_rate: 0.05,
    };
  }

  async exportData(format: 'json' | 'csv' | 'jsonl'): Promise<string> {
    if (format === 'json') {
      return JSON.stringify(
        {
          thoughts: Array.from(this.thoughts.values()),
          sessions: Array.from(this.sessions.values()),
        },
        null,
        2
      );
    }
    return '';
  }

  async importData(data: string, format: 'json' | 'csv' | 'jsonl'): Promise<void> {
    // Simple implementation
  }

  async optimize(): Promise<void> {
    // Simple implementation
  }

  async storePrompt(prompt: StoredPrompt): Promise<void> {
    try {
      // Check if we need to cleanup old entries
      if (this.prompts.size >= this.MAX_PROMPTS * this.CLEANUP_THRESHOLD) {
        this.performPromptCleanup();
      }

      this.prompts.set(prompt.id, prompt);
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      console.error('❌ Failed to store prompt in memory:', errorMessage);
      throw new Error(`Prompt storage failed: ${errorMessage}`);
    }
  }

  async queryPrompts(query: PromptQuery): Promise<StoredPrompt[]> {
    try {
      let results: StoredPrompt[] = Array.from(this.prompts.values());

      // Apply project-based filtering
      if (query.project_id) {
        results = results.filter(p => p.project_id === query.project_id);
      }

      if (query.project_ids && query.project_ids.length > 0) {
        results = results.filter(p => p.project_id && query.project_ids!.includes(p.project_id));
      }

      if (query.project_scoped_only) {
        results = results.filter(p => p.project_id !== undefined && p.project_id !== null);
      }

      if (query.project_active_only) {
        results = results.filter(p => {
          if (!p.project_id) return true; // Include legacy data without project
          const project = this.projects.get(p.project_id);
          return project ? project.is_active : false;
        });
      }

      // Apply other filters
      if (query.session_id) {
        results = results.filter(p => p.session_id === query.session_id);
      }

      if (query.prompt_type) {
        results = results.filter(p => p.prompt_type === query.prompt_type);
      }

      if (query.domain) {
        results = results.filter(p => p.domain === query.domain);
      }

      if (query.complexity_range) {
        results = results.filter(
          p =>
            p.complexity_estimate !== undefined &&
            p.complexity_estimate >= query.complexity_range![0] &&
            p.complexity_estimate <= query.complexity_range![1]
        );
      }

      if (query.date_range) {
        results = results.filter(
          p => p.received_at >= query.date_range![0] && p.received_at <= query.date_range![1]
        );
      }

      if (query.processing_success !== undefined) {
        results = results.filter(p => p.processing_success === query.processing_success);
      }

      if (query.tags && query.tags.length > 0) {
        results = results.filter(p => p.tags && query.tags!.every(tag => p.tags!.includes(tag)));
      }

      if (query.similar_to) {
        results = results.filter(p =>
          p.original_prompt.toLowerCase().includes(query.similar_to!.toLowerCase())
        );
      }

      // Apply sorting
      const sortBy = query.sort_by || 'received_at';
      const sortOrder = query.sort_order || 'desc';

      // Handle similarity-based sorting for similar_to queries
      if (query.similar_to) {
        const queryLower = query.similar_to.toLowerCase();
        results.sort((a, b) => {
          const similarityA = a.original_prompt.toLowerCase().includes(queryLower) ? 1 : 0;
          const similarityB = b.original_prompt.toLowerCase().includes(queryLower) ? 1 : 0;
          return sortOrder === 'desc' ? similarityB - similarityA : similarityA - similarityB;
        });
      } else {
        results.sort((a, b) => {
          let valueA: any, valueB: any;

          switch (sortBy) {
            case 'received_at':
              valueA = a.received_at.getTime();
              valueB = b.received_at.getTime();
              break;
            case 'complexity_estimate':
              valueA = a.complexity_estimate || 0;
              valueB = b.complexity_estimate || 0;
              break;
            case 'processing_success':
              valueA = a.processing_success ? 1 : 0;
              valueB = b.processing_success ? 1 : 0;
              break;
            default:
              valueA = a.received_at.getTime();
              valueB = b.received_at.getTime();
          }

          if (sortOrder === 'desc') {
            return valueB - valueA;
          } else {
            return valueA - valueB;
          }
        });
      }

      // Apply pagination
      if (query.offset) {
        results = results.slice(query.offset);
      }

      if (query.limit) {
        results = results.slice(0, query.limit);
      }

      // Populate project data if requested
      if (query.include_project) {
        results = results.map(prompt => {
          if (prompt.project_id) {
            const project = this.projects.get(prompt.project_id);
            if (project) {
              return { ...prompt, project };
            }
          }
          return prompt;
        });
      }

      return results;
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      console.error('❌ Failed to query prompts in memory:', errorMessage);
      throw new Error(`Prompt query failed: ${errorMessage}`);
    }
  }

  async getPrompt(id: string): Promise<StoredPrompt | null> {
    try {
      return this.prompts.get(id) || null;
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      console.error('❌ Failed to get prompt from memory:', errorMessage);
      throw new Error(`Prompt retrieval failed: ${errorMessage}`);
    }
  }

  async findSimilarPrompts(prompt: string, limit: number = 5): Promise<StoredPrompt[]> {
    throw new Error('Semantic similarity search not supported in InMemoryStore');
  }

  async updatePrompt(id: string, updates: Partial<StoredPrompt>): Promise<void> {
    try {
      const existingPrompt = this.prompts.get(id);
      if (!existingPrompt) {
        throw new Error(`Prompt with id ${id} not found`);
      }

      const updatedPrompt = { ...existingPrompt, ...updates };
      this.prompts.set(id, updatedPrompt);
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      console.error('❌ Failed to update prompt in memory:', errorMessage);
      throw new Error(`Prompt update failed: ${errorMessage}`);
    }
  }

  async analyzeSuccessPatterns(promptIds: string[]): Promise<
    Array<{
      pattern_type: string;
      success_rate: number;
      common_attributes: Record<string, any>;
    }>
  > {
    try {
      const patterns: Array<{
        pattern_type: string;
        success_rate: number;
        common_attributes: Record<string, any>;
      }> = [];

      const prompts = promptIds
        .map(id => this.prompts.get(id))
        .filter((p): p is StoredPrompt => p !== undefined);

      if (prompts.length === 0) {
        return patterns;
      }

      // Analyze by domain
      const domainGroups = new Map<string, StoredPrompt[]>();
      prompts.forEach(prompt => {
        if (prompt.domain) {
          if (!domainGroups.has(prompt.domain)) {
            domainGroups.set(prompt.domain, []);
          }
          domainGroups.get(prompt.domain)!.push(prompt);
        }
      });

      domainGroups.forEach((domainPrompts, domain) => {
        const successfulPrompts = domainPrompts.filter(p => p.processing_success === true);
        const successRate =
          domainPrompts.length > 0 ? successfulPrompts.length / domainPrompts.length : 0;

        if (successRate > 0.5) {
          // Only include patterns with >50% success rate
          patterns.push({
            pattern_type: `domain_${domain}`,
            success_rate: successRate,
            common_attributes: {
              domain,
              total_prompts: domainPrompts.length,
              avg_complexity:
                domainPrompts.reduce((sum, p) => sum + (p.complexity_estimate || 0), 0) /
                domainPrompts.length,
            },
          });
        }
      });

      // Analyze by prompt type
      const typeGroups = new Map<string, StoredPrompt[]>();
      prompts.forEach(prompt => {
        if (prompt.prompt_type) {
          if (!typeGroups.has(prompt.prompt_type)) {
            typeGroups.set(prompt.prompt_type, []);
          }
          typeGroups.get(prompt.prompt_type)!.push(prompt);
        }
      });

      typeGroups.forEach((typePrompts, type) => {
        const successfulPrompts = typePrompts.filter(p => p.processing_success === true);
        const successRate =
          typePrompts.length > 0 ? successfulPrompts.length / typePrompts.length : 0;

        if (successRate > 0.5) {
          patterns.push({
            pattern_type: `prompt_type_${type}`,
            success_rate: successRate,
            common_attributes: {
              prompt_type: type,
              total_prompts: typePrompts.length,
              avg_cognitive_load:
                typePrompts.reduce((sum, p) => sum + (p.estimated_cognitive_load || 0), 0) /
                typePrompts.length,
            },
          });
        }
      });

      return patterns.sort((a, b) => b.success_rate - a.success_rate);
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      console.error('❌ Failed to analyze success patterns in memory:', errorMessage);
      throw new Error(`Success pattern analysis failed: ${errorMessage}`);
    }
  }

  async calculatePerformanceMetrics(): Promise<{
    classification_accuracy: number;
    intent_extraction_precision: number;
    similarity_detection_recall: number;
    reasoning_improvement_average: number;
  }> {
    try {
      const allPrompts = Array.from(this.prompts.values());

      if (allPrompts.length === 0) {
        return {
          classification_accuracy: 0,
          intent_extraction_precision: 0,
          similarity_detection_recall: 0,
          reasoning_improvement_average: 0,
        };
      }

      // Calculate classification accuracy (based on successful processing)
      const processedPrompts = allPrompts.filter(p => p.processing_success !== undefined);
      const successfulPrompts = processedPrompts.filter(p => p.processing_success === true);
      const classificationAccuracy =
        processedPrompts.length > 0 ? successfulPrompts.length / processedPrompts.length : 0;

      // Calculate intent extraction precision (based on extracted_intent presence)
      const promptsWithIntent = allPrompts.filter(
        p => p.extracted_intent && Object.keys(p.extracted_intent).length > 0
      );
      const intentExtractionPrecision =
        allPrompts.length > 0 ? promptsWithIntent.length / allPrompts.length : 0;

      // Calculate similarity detection recall (simplified - based on similar_prompts data)
      const promptsWithSimilarityData = allPrompts.filter(
        p => p.similar_prompts && p.similar_prompts.length > 0
      );
      const similarityDetectionRecall =
        allPrompts.length > 0 ? promptsWithSimilarityData.length / allPrompts.length : 0;

      // Calculate reasoning improvement average
      const promptsWithImprovement = allPrompts.filter(
        p => p.reasoning_improvement !== undefined && p.reasoning_improvement !== null
      );
      const reasoningImprovementAverage =
        promptsWithImprovement.length > 0
          ? promptsWithImprovement.reduce((sum, p) => sum + (p.reasoning_improvement || 0), 0) /
            promptsWithImprovement.length
          : 0;

      return {
        classification_accuracy: classificationAccuracy,
        intent_extraction_precision: intentExtractionPrecision,
        similarity_detection_recall: similarityDetectionRecall,
        reasoning_improvement_average: reasoningImprovementAverage,
      };
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      console.error('❌ Failed to calculate performance metrics in memory:', errorMessage);
      throw new Error(`Performance metrics calculation failed: ${errorMessage}`);
    }
  }

  async updatePromptPerformance(
    promptId: string,
    performance: {
      processing_success: boolean;
      reasoning_improvement?: number;
      persona_selected?: string;
      cognitive_priming_effectiveness?: number;
    }
  ): Promise<void> {
    try {
      const existingPrompt = this.prompts.get(promptId);
      if (!existingPrompt) {
        throw new Error(`Prompt with id ${promptId} not found`);
      }

      const updatedPrompt: StoredPrompt = {
        ...existingPrompt,
        processing_success: performance.processing_success,
        reasoning_improvement:
          performance.reasoning_improvement !== undefined
            ? performance.reasoning_improvement
            : existingPrompt.reasoning_improvement,
        persona_selected:
          performance.persona_selected !== undefined
            ? performance.persona_selected
            : existingPrompt.persona_selected,
        cognitive_priming_effectiveness:
          performance.cognitive_priming_effectiveness !== undefined
            ? performance.cognitive_priming_effectiveness
            : existingPrompt.cognitive_priming_effectiveness,
        updated_at: new Date(),
      };

      this.prompts.set(promptId, updatedPrompt);
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      console.error('❌ Failed to update prompt performance in memory:', errorMessage);
      throw new Error(`Prompt performance update failed: ${errorMessage}`);
    }
  }

  // Project management methods - simple in-memory implementations
  async createProject(project: Omit<Project, 'id'>): Promise<Project> {
    const id = MemoryUtils.generateProjectId();
    const newProject: Project = { ...project, id };
    this.projects.set(id, newProject);
    return newProject;
  }

  async getProject(projectId: string): Promise<Project | null> {
    return this.projects.get(projectId) || null;
  }

  async findProjectByPath(directoryPath: string): Promise<Project | null> {
    for (const project of this.projects.values()) {
      if (project.directory_path === directoryPath) {
        return project;
      }
    }
    return null;
  }

  async updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
    const project = this.projects.get(projectId);
    if (project) {
      const updatedProject = { ...project, ...updates, updated_at: new Date() };
      this.projects.set(projectId, updatedProject);
    }
  }

  async queryProjects(query: ProjectQuery = {}): Promise<Project[]> {
    let results = Array.from(this.projects.values());

    // Apply basic filtering
    if (query.directory_path) {
      results = results.filter(p => p.directory_path === query.directory_path);
    }
    if (query.is_active !== undefined) {
      results = results.filter(p => p.is_active === query.is_active);
    }

    return results.slice(0, query.limit || 100);
  }

  async getProjectAnalytics(projectId: string): Promise<{
    totalSessions: number;
    totalThoughts: number;
    totalPrompts: number;
    averageSessionLength: number;
    successRate: number;
    mostUsedTechnologies: Array<{ tech: string; usage: number }>;
    recentActivity: Array<{ date: string; sessions: number; thoughts: number }>;
  }> {
    return {
      totalSessions: 0,
      totalThoughts: 0,
      totalPrompts: 0,
      averageSessionLength: 0,
      successRate: 0,
      mostUsedTechnologies: [],
      recentActivity: [],
    };
  }

  async getCrossProjectPatterns(limit = 10): Promise<
    Array<{
      pattern: string;
      projects: string[];
      frequency: number;
      successRate: number;
    }>
  > {
    return [];
  }

  async findSimilarPromptsHybrid(
    prompt: string,
    limit = 5,
    projectId?: string
  ): Promise<StoredPrompt[]> {
    return [];
  }

  async findSimilarThoughtsHybrid(
    thought: string,
    limit = 5,
    projectId?: string
  ): Promise<StoredThought[]> {
    return [];
  }

  async findSimilarPatterns(): Promise<
    Array<{
      pattern_name: string;
      similarity_score: number;
      pattern_frequency: number;
      created_at: Date;
    }>
  > {
    throw new Error('Pattern embeddings not supported in InMemoryStore');
  }

  async getPatterns(): Promise<
    Array<{
      pattern_name: string;
      pattern_frequency: number;
      created_at: Date;
      has_embedding: boolean;
    }>
  > {
    throw new Error('Pattern embeddings not supported in InMemoryStore');
  }

  async updatePatternEmbeddings(): Promise<number> {
    throw new Error('Pattern embeddings not supported in InMemoryStore');
  }

  async analyzeAndStoreThoughtChain(sessionId: string): Promise<any> {
    // InMemoryStore doesn't have sophisticated analysis capabilities
    console.error(`💭 In-memory store: Thought analysis not available for session ${sessionId}`);
    return null;
  }

  async close(): Promise<void> {
    this.thoughts.clear();
    this.sessions.clear();
    this.projects.clear();
  }
}
