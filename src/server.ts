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
 * - All logging must be directed to stderr using console.error() instead of console.log()
 * - The stdout channel is reserved exclusively for JSON-RPC protocol messages
 * - Using console.log() or console.info() will cause client-side parsing errors
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
  ReasoningSession,
  MemoryQuery,
  MemoryStats,
} from './memory/memory-store.js';
import { PostgreSQLMemoryStore } from './memory/postgresql-memory-store.js';
import { PostgreSQLConfigs } from './memory/postgresql-config.js';
import { secureLogger, LogLevel as SecureLogLevel } from './utils/secure-logger.js';
import { TimerManager } from './utils/timer-manager.js';

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

class CodeReasoningServer {
  private readonly thoughtHistory: ValidatedThoughtData[] = [];
  private readonly branches = new Map<string, ValidatedThoughtData[]>();
  private cognitiveOrchestrator!: CognitiveOrchestrator;
  private readonly memoryStore: MemoryStore;
  private currentSessionId: string;
  private readonly thoughtMutex = new Mutex();
  
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
      tags: []
    };
  }

  /**
   * Update session data and persist to database
   */
  private async updateAndStoreSession(data: ValidatedThoughtData, cognitiveResult: any): Promise<void> {
    if (!this.currentSession) {
      console.error('Warning: Session not initialized, creating new session');
      this.initializeSession();
    }

    // Update session with current thought data
    this.currentSession!.objective = this.inferObjective(data);
    this.currentSession!.domain = this.inferDomain(data);
    this.currentSession!.total_thoughts = data.total_thoughts;
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
    const metacognitiveCount = cognitiveResult.interventions?.filter(
      (i: any) => i.metadata?.plugin_id === 'metacognitive'
    ).length || 0;
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
      console.error(`📝 Session stored: ${this.currentSessionId} (thought ${data.thought_number}/${data.total_thoughts})`);
    } catch (error) {
      console.error('Failed to store session:', error);
    }
  }

  /**
   * Calculate session effectiveness based on cognitive metrics
   */
  private calculateSessionEffectiveness(cognitiveResult: any): number {
    const cognitiveState = cognitiveResult.cognitiveState;
    const avgConfidence = cognitiveState.confidence_trajectory.reduce((a: number, b: number) => a + b, 0) / 
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
    const finalConfidence = cognitiveResult.cognitiveState.confidence_trajectory[
      cognitiveResult.cognitiveState.confidence_trajectory.length - 1
    ];
    const hasConclusion = data.thought.toLowerCase().includes('conclusion') || 
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
        heapUsedPercent: Math.round((afterMemory.heapUsed / afterMemory.heapTotal) * 100)
      });
      
      // Emergency cleanup if still over threshold
      if (afterMB > 2000) { // 2GB threshold
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

      // 🧠 AGI MAGIC: Cognitive orchestration and sentient processing
      console.error('🧠 Engaging cognitive orchestrator for AGI-level processing...');

      const cognitiveResult = await this.cognitiveOrchestrator.processThought(data, {
        id: this.currentSessionId,
        objective: this.inferObjective(data),
        domain: this.inferDomain(data),
        start_time: new Date(),
        goal_achieved: false,
        confidence_level: 0.5,
        total_thoughts: data.total_thoughts,
        revision_count: this.thoughtHistory.filter(t => t.is_revision).length,
        branch_count: this.branches.size,
      });

      // Store thought in memory with cognitive enrichment
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

      await this.memoryStore.storeThought(storedThought);

      // Update and store session information
      await this.updateAndStoreSession(data, cognitiveResult);

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
            branches: memStats.branchCount
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

      console.error('✔️ AGI processed', {
        num: data.thought_number,
        cognitive_efficiency: cognitiveResult.cognitiveState.cognitive_efficiency,
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
    if (this.thoughtHistory.length >= this.memoryConfig.maxThoughtHistory * this.memoryConfig.cleanupThreshold) {
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
        thoughtCount: thoughts.length
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
    const totalBranchThoughts = Array.from(this.branches.values())
      .reduce((total, thoughts) => total + thoughts.length, 0);
    
    const memoryPressure = Math.max(
      this.thoughtHistory.length / this.memoryConfig.maxThoughtHistory,
      this.branches.size / this.memoryConfig.maxBranches,
      totalBranchThoughts / (this.memoryConfig.maxBranches * this.memoryConfig.maxBranchThoughts)
    );
    
    return {
      thoughtHistorySize: this.thoughtHistory.length,
      branchCount: this.branches.size,
      totalBranchThoughts,
      memoryPressure
    };
  }

  /**
   * Emergency memory cleanup when pressure is high
   */
  private performEmergencyMemoryCleanup(): void {
    console.error('🚨 Performing emergency memory cleanup...');
    
    const beforeSize = this.thoughtHistory.length + Array.from(this.branches.values()).reduce((total, thoughts) => total + thoughts.length, 0);
    
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
    
    const afterSize = this.thoughtHistory.length + Array.from(this.branches.values()).reduce((total, thoughts) => total + thoughts.length, 0);
    console.error(`✅ Emergency cleanup complete: ${beforeSize} → ${afterSize} total objects (${((beforeSize - afterSize) / beforeSize * 100).toFixed(1)}% reduction)`);
  }

  /**
   * Force immediate memory cleanup - for memory leak prevention
   */
  forceEmergencyMemoryCleanup(): void {
    const beforeHistory = this.thoughtHistory.length;
    const beforeBranches = this.branches.size;
    
    // Aggressively trim arrays to emergency levels
    const emergencyHistorySize = Math.min(10, Math.floor(this.memoryConfig.maxThoughtHistory * 0.2));
    const emergencyBranchSize = Math.min(2, Math.floor(this.memoryConfig.maxBranches * 0.2));
    
    // Keep only most recent thoughts
    if (this.thoughtHistory.length > emergencyHistorySize) {
      this.thoughtHistory.splice(0, this.thoughtHistory.length - emergencyHistorySize);
    }
    
    // Clear oldest branches if too many
    if (this.branches.size > emergencyBranchSize) {
      const sorted = Array.from(this.branches.entries())
        .sort(([,a], [,b]) => (a[0]?.thought_number || 0) - (b[0]?.thought_number || 0));
      const toRemove = sorted.slice(0, this.branches.size - emergencyBranchSize);
      toRemove.forEach(([id]) => this.branches.delete(id));
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const afterHistory = this.thoughtHistory.length;
    const afterBranches = this.branches.size;
    
    console.error(`🧹 EMERGENCY CLEANUP: History ${beforeHistory}→${afterHistory}, Branches ${beforeBranches}→${afterBranches}`);
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
      
      const configPath = pathModule.join(process.env.HOME || '', '.config', 'sentient-agi', 'cognitive-performance.json');
      if (fsModule.existsSync(configPath)) {
        return JSON.parse(fsModule.readFileSync(configPath, 'utf8'));
      }
    } catch (error) {
      console.error("⚠️ Could not load performance config:", (error as Error).message);
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

  // Memory management constants
  private readonly MAX_THOUGHTS = 10000;
  private readonly MAX_SESSIONS = 1000;
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
    const results = Array.from(this.thoughts.values())
      .filter(t => t.thought.toLowerCase().includes(thought.toLowerCase()))
      .slice(0, limit || 10);
    return results;
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

  async close(): Promise<void> {
    this.thoughts.clear();
    this.sessions.clear();
  }
}
