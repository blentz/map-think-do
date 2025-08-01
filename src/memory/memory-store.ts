/**
 * @fileoverview Memory store interface and types for persistent thought storage
 *
 * This provides the foundation for AGI-like memory capabilities, enabling the
 * system to persist, query, and learn from its reasoning history. Essential
 * for building cognitive experience and pattern recognition over time.
 */

/**
 * Project interface with comprehensive metadata for normalized project management
 */
export interface Project {
  id: string; // UUID
  directory_path: string;
  project_name: string;
  description?: string;

  // Technology metadata
  technology_stack?: string[];
  project_type?: string;
  programming_languages?: string[];

  // Lifecycle information
  created_at: Date;
  updated_at: Date;
  last_activity_at: Date;
  is_active: boolean;
  is_archived: boolean;

  // Cognitive and custom metadata
  cognitive_settings?: Record<string, any>;
  project_metadata?: Record<string, any>;

  // Analytics
  total_sessions?: number;
  total_thoughts?: number;
  total_prompts?: number;
}

/**
 * Extended thought record with additional metadata for memory storage
 */
export interface StoredThought {
  // Core thought data
  id: string;
  thought: string;
  thought_number: number;
  total_thoughts: number;
  next_thought_needed: boolean;

  // Branching and revision metadata
  is_revision?: boolean;
  revises_thought?: number;
  branch_from_thought?: number;
  branch_id?: string;
  needs_more_thoughts?: boolean;

  // Memory-specific metadata
  timestamp: Date;
  session_id: string;
  prompt_id?: string; // Link to originating prompt
  project_id?: string; // UUID foreign key to projects
  project?: Project; // Optional populated project data
  confidence?: number;
  domain?: string;
  objective?: string;
  complexity?: number;

  // Outcome tracking
  success?: boolean;
  effectiveness_score?: number;
  user_feedback?: string;

  // Context information
  context: {
    available_tools?: string[];
    time_constraints?: {
      urgency: 'low' | 'medium' | 'high';
      deadline?: Date;
    };
    problem_type?: string;
    cognitive_load?: number;
  };

  // Learning metadata
  tags?: string[];
  patterns_detected?: string[];
  similar_thoughts?: string[]; // IDs of similar thoughts
  outcome_quality?: 'excellent' | 'good' | 'fair' | 'poor';

  // Output for reflection
  output?: string;
  context_trace?: string[];
}

/**
 * Stored prompt record with comprehensive metadata for AGI learning
 */
export interface StoredPrompt {
  // Primary identification
  id: string;
  session_id: string;

  // Core prompt data
  original_prompt: string;
  prompt_type?: string;
  prompt_source?: 'mcp-tool' | 'api' | 'direct';
  project_id?: string; // UUID foreign key to projects
  project?: Project; // Optional populated project data

  // Temporal data
  received_at: Date;

  // AI-Generated Classification (Algorithmic processing results)
  domain?: string;
  complexity_estimate?: number;
  estimated_cognitive_load?: number;
  classification_confidence?: number; // Confidence in AI classification

  // Structured metadata
  prompt_context?: {
    tool_parameters?: Record<string, any>;
    user_context?: Record<string, any>;
    mcp_request_id?: string;
  };
  extracted_intent?: {
    objectives?: string[];
    constraints?: string[];
    requirements?: string[];
    expected_output_type?: string;
    extraction_confidence?: number; // Confidence in intent extraction
  };

  // Processing metadata
  processing_started_at?: Date;
  processing_completed_at?: Date;
  processing_success?: boolean;
  processing_error?: string;

  // Learning analytics (Enhanced with similarity scores)
  tags?: string[];
  similar_prompts?: Array<{
    prompt_id: string;
    similarity_score: number;
    similarity_type: 'semantic' | 'structural' | 'domain' | 'intent';
  }>;

  // Performance tracking (For validation criteria)
  reasoning_improvement?: number; // Measured improvement over baseline
  persona_selected?: string; // Which persona was chosen based on this prompt
  cognitive_priming_effectiveness?: number; // Measured priming impact

  // Audit
  created_at: Date;
  updated_at: Date;
}

/**
 * Project analytics interface for comprehensive project insights
 */
export interface ProjectAnalytics {
  totalSessions: number;
  totalThoughts: number;
  totalPrompts: number;
  averageSessionLength: number;
  successRate: number;
  mostUsedTechnologies: Array<{ tech: string; usage: number }>;
  recentActivity: Array<{ date: string; sessions: number; thoughts: number }>;
  averageComplexity: number;
  cognitiveRolesUsage: Array<{ role: string; frequency: number }>;
  timeToResolution: number; // Average time to complete objectives
  knowledgeDomains: Array<{ domain: string; expertise_level: number }>;
}

/**
 * Cross-project pattern analysis for personal development insights
 */
export interface CrossProjectPattern {
  pattern: string;
  projects: string[];
  frequency: number;
  successRate: number;
  averageComplexity: number;
  recommendedStrategies: string[];
  learningOpportunities: string[];
}

/**
 * Query parameters for retrieving stored prompts
 */
export interface PromptQuery {
  // Project-based filtering
  project_id?: string; // Filter by specific project
  project_ids?: string[]; // Filter by multiple projects
  project_scoped_only?: boolean; // Restrict to project data only
  include_project?: boolean; // Populate project data in results
  project_active_only?: boolean; // Only active projects
  session_id?: string;
  prompt_type?: string;
  domain?: string;
  complexity_range?: [number, number];
  date_range?: [Date, Date];
  processing_success?: boolean;
  tags?: string[];
  similar_to?: string; // Text similarity search
  exclude_id?: string; // Exclude specific prompt ID from results
  limit?: number;
  offset?: number;
  sort_by?: 'received_at' | 'complexity_estimate' | 'processing_success';
  sort_order?: 'asc' | 'desc';
  orderBy?: string;
  ascending?: boolean;
}

/**
 * Project query interface for comprehensive project management operations
 */
export interface ProjectQuery {
  directory_path?: string; // Find by directory path
  project_name?: string; // Filter by name
  project_type?: string; // Filter by type
  technology_stack?: string[]; // Must include all specified technologies
  programming_languages?: string[]; // Must include all specified languages
  is_active?: boolean; // Filter by active status
  is_archived?: boolean; // Filter by archived status
  created_after?: Date; // Created after date
  created_before?: Date; // Created before date
  last_activity_after?: Date; // Activity after date
  has_cognitive_settings?: boolean; // Has custom cognitive settings
  limit?: number;
  offset?: number;
  sort_by?: 'created_at' | 'updated_at' | 'last_activity_at' | 'project_name';
  sort_order?: 'asc' | 'desc';
}

/**
 * Reasoning session containing multiple related thoughts
 */
export interface ReasoningSession {
  id: string;
  start_time: Date;
  end_time?: Date;
  objective: string;
  domain?: string;
  project_id?: string; // UUID foreign key to projects
  project?: Project; // Optional populated project data
  initial_complexity?: number;
  final_complexity?: number;

  // Session outcomes
  goal_achieved: boolean;
  confidence_level: number;
  total_thoughts: number;
  revision_count: number;
  branch_count: number;

  // Session patterns
  cognitive_roles_used?: string[];
  metacognitive_interventions?: number;
  effectiveness_score?: number;

  // Learning insights
  lessons_learned?: string[];
  successful_strategies?: string[];
  failed_approaches?: string[];

  tags?: string[];
}

/**
 * Memory query parameters for retrieving relevant thoughts
 */
export interface MemoryQuery {
  // Project-based filtering
  project_id?: string; // Filter by specific project
  project_ids?: string[]; // Filter by multiple projects
  project_scoped_only?: boolean; // Restrict to project data only
  include_project?: boolean; // Populate project data in results
  project_active_only?: boolean; // Only active projects
  // Content-based queries
  text_similarity?: string;
  domain?: string;
  objective_similarity?: string;

  // Metadata filters
  confidence_range?: [number, number];
  complexity_range?: [number, number];
  time_range?: [Date, Date];
  session_ids?: string[];

  // Outcome filters
  success_only?: boolean;
  effectiveness_threshold?: number;

  // Pattern matching
  tags?: string[];
  patterns?: string[];
  cognitive_roles?: string[];

  // Similarity search
  similar_to_thought?: string; // Thought ID for similarity search

  // Pagination
  limit?: number;
  offset?: number;

  // Sorting
  sort_by?: 'timestamp' | 'confidence' | 'effectiveness' | 'similarity';
  sort_order?: 'asc' | 'desc';
}

/**
 * Memory statistics for analysis and optimization
 */
export interface MemoryStats {
  total_thoughts: number;
  total_sessions: number;
  average_session_length: number;

  // Success metrics
  overall_success_rate: number;
  success_rate_by_domain: Record<string, number>;
  success_rate_by_complexity: Record<string, number>;

  // Cognitive patterns
  most_effective_roles: Array<{ role: string; success_rate: number }>;
  most_effective_patterns: Array<{ pattern: string; frequency: number }>;
  common_failure_modes: Array<{ mode: string; frequency: number }>;

  // Temporal patterns
  performance_over_time: Array<{ period: string; success_rate: number }>;
  learning_trajectory: Array<{ period: string; avg_effectiveness: number }>;

  // Memory health
  storage_size: number;
  oldest_thought: Date;
  newest_thought: Date;
  duplicate_rate: number;
}

/**
 * Abstract interface for memory storage implementations
 */
export abstract class MemoryStore {
  /**
   * Store a thought in memory
   */
  abstract storeThought(thought: StoredThought): Promise<void>;

  /**
   * Store a complete reasoning session
   */
  abstract storeSession(session: ReasoningSession): Promise<void>;

  /**
   * Store a prompt in memory
   */
  abstract storePrompt(prompt: StoredPrompt): Promise<void>;

  /**
   * Query thoughts based on criteria
   */
  abstract queryThoughts(query: MemoryQuery): Promise<StoredThought[]>;

  /**
   * Query prompts based on criteria
   */
  abstract queryPrompts(query: PromptQuery): Promise<StoredPrompt[]>;

  /**
   * Get a specific thought by ID
   */
  abstract getThought(id: string): Promise<StoredThought | null>;

  /**
   * Get a specific session by ID
   */
  abstract getSession(id: string): Promise<ReasoningSession | null>;

  /**
   * Get a specific prompt by ID
   */
  abstract getPrompt(id: string): Promise<StoredPrompt | null>;

  /**
   * Get all sessions
   */
  abstract getSessions(limit?: number, offset?: number): Promise<ReasoningSession[]>;

  /**
   * Find similar prompts using content similarity
   */
  abstract findSimilarPrompts(prompt: string, limit?: number): Promise<StoredPrompt[]>;

  /**
   * Find similar thoughts using content similarity
   */
  abstract findSimilarThoughts(thought: string, limit?: number): Promise<StoredThought[]>;

  /**
   * Find similar patterns using semantic similarity
   */
  abstract findSimilarPatterns(
    pattern: string,
    limit?: number,
    similarityThreshold?: number
  ): Promise<
    Array<{
      pattern_name: string;
      similarity_score: number;
      pattern_frequency: number;
      created_at: Date;
    }>
  >;

  /**
   * Get all stored patterns with their frequencies
   */
  abstract getPatterns(
    limit?: number,
    minFrequency?: number
  ): Promise<
    Array<{
      pattern_name: string;
      pattern_frequency: number;
      created_at: Date;
      has_embedding: boolean;
    }>
  >;

  /**
   * Update pattern embeddings based on frequency thresholds
   */
  abstract updatePatternEmbeddings(): Promise<number>;

  /**
   * Create a new project
   */
  abstract createProject(project: Omit<Project, 'id'>): Promise<Project>;

  /**
   * Get a project by ID
   */
  abstract getProject(projectId: string): Promise<Project | null>;

  /**
   * Find a project by directory path
   */
  abstract findProjectByPath(directoryPath: string): Promise<Project | null>;

  /**
   * Update a project
   */
  abstract updateProject(projectId: string, updates: Partial<Project>): Promise<void>;

  /**
   * Query projects based on criteria
   */
  abstract queryProjects(query: ProjectQuery): Promise<Project[]>;

  /**
   * Get project analytics for single-user insights
   */
  abstract getProjectAnalytics(projectId: string): Promise<{
    totalSessions: number;
    totalThoughts: number;
    totalPrompts: number;
    averageSessionLength: number;
    successRate: number;
    mostUsedTechnologies: Array<{ tech: string; usage: number }>;
    recentActivity: Array<{ date: string; sessions: number; thoughts: number }>;
  }>;

  /**
   * Get cross-project patterns for personal learning insights
   */
  abstract getCrossProjectPatterns(limit?: number): Promise<
    Array<{
      pattern: string;
      projects: string[];
      frequency: number;
      successRate: number;
    }>
  >;

  /**
   * Find similar prompts with hybrid project-aware search
   */
  abstract findSimilarPromptsHybrid(
    prompt: string,
    limit?: number,
    projectId?: string
  ): Promise<StoredPrompt[]>;

  /**
   * Find similar thoughts with hybrid project-aware search
   */
  abstract findSimilarThoughtsHybrid(
    thought: string,
    limit?: number,
    projectId?: string
  ): Promise<StoredThought[]>;

  /**
   * Update thought metadata (e.g., after receiving feedback)
   */
  abstract updateThought(id: string, updates: Partial<StoredThought>): Promise<void>;

  /**
   * Update session metadata
   */
  abstract updateSession(id: string, updates: Partial<ReasoningSession>): Promise<void>;

  /**
   * Update prompt metadata
   */
  abstract updatePrompt(id: string, updates: Partial<StoredPrompt>): Promise<void>;

  /**
   * Analyze success patterns from prompt history
   */
  abstract analyzeSuccessPatterns(promptIds: string[]): Promise<
    Array<{
      pattern_type: string;
      success_rate: number;
      common_attributes: Record<string, any>;
    }>
  >;

  /**
   * Calculate performance metrics for validation
   */
  abstract calculatePerformanceMetrics(): Promise<{
    classification_accuracy: number;
    intent_extraction_precision: number;
    similarity_detection_recall: number;
    reasoning_improvement_average: number;
  }>;

  /**
   * Update prompt with performance tracking data
   */
  abstract updatePromptPerformance(
    promptId: string,
    performance: {
      processing_success: boolean;
      reasoning_improvement?: number;
      persona_selected?: string;
      cognitive_priming_effectiveness?: number;
    }
  ): Promise<void>;

  /**
   * Delete old thoughts based on retention policy
   */
  abstract cleanupOldThoughts(olderThan: Date): Promise<number>;

  /**
   * Get memory statistics
   */
  abstract getStats(): Promise<MemoryStats>;

  /**
   * Export memory data for backup or analysis
   */
  abstract exportData(format: 'json' | 'csv' | 'jsonl'): Promise<string>;

  /**
   * Import memory data from backup
   */
  abstract importData(data: string, format: 'json' | 'csv' | 'jsonl'): Promise<void>;

  /**
   * Optimize storage (e.g., rebuild indexes, compress data)
   */
  abstract optimize(): Promise<void>;

  /**
   * Close the memory store and cleanup resources
   */
  abstract close(): Promise<void>;
}

/**
 * Enhanced memory statistics with project-aware analytics
 */
export interface EnhancedMemoryStats extends MemoryStats {
  // Project-specific statistics
  total_projects: number;
  active_projects: number;
  archived_projects: number;

  // Project activity patterns
  most_active_projects: Array<{ project_name: string; activity_score: number }>;
  project_success_rates: Array<{ project_name: string; success_rate: number }>;
  technology_usage_patterns: Array<{
    technology: string;
    project_count: number;
    success_rate: number;
  }>;

  // Cross-project learning insights
  knowledge_transfer_opportunities: Array<{
    from_project: string;
    to_project: string;
    similarity_score: number;
  }>;
  emerging_patterns: Array<{ pattern: string; growth_rate: number; projects_affected: string[] }>;

  // Project lifecycle analytics
  average_project_duration: number;
  project_complexity_trends: Array<{ time_period: string; average_complexity: number }>;
  cognitive_evolution: Array<{ skill_area: string; improvement_rate: number }>;
}

/**
 * Memory configuration options
 */
export interface MemoryConfig {
  // Storage settings
  maxThoughts?: number;
  maxSessions?: number;
  retentionDays?: number;

  // Performance settings
  similarityThreshold?: number;
  indexingEnabled?: boolean;
  compressionEnabled?: boolean;

  // Learning settings
  adaptiveLearning?: boolean;
  patternDetectionEnabled?: boolean;
  automaticTagging?: boolean;

  // Privacy settings
  anonymizeData?: boolean;
  encryptSensitiveData?: boolean;

  // Project-specific settings
  enableProjectIntelligence?: boolean;
  crossProjectLearning?: boolean;
  projectMetadataExtraction?: boolean;
  automaticProjectDetection?: boolean;
  projectCachingEnabled?: boolean;
  projectAnalyticsEnabled?: boolean;

  // Backup settings
  autoBackup?: boolean;
  backupInterval?: number; // hours
  backupLocation?: string;
}

/**
 * Memory event for observing memory operations
 */
export interface MemoryEvent {
  type: 'thought_stored' | 'session_stored' | 'query_executed' | 'cleanup_performed';
  timestamp: Date;
  data: any;
  performance?: {
    duration_ms: number;
    memory_used: number;
  };
}

/**
 * Memory observer interface for monitoring memory operations
 */
export interface MemoryObserver {
  onMemoryEvent(event: MemoryEvent): void;
}

/**
 * Utility functions for memory operations
 */
export class MemoryUtils {
  /**
   * Generate a unique thought ID
   */
  static generateThoughtId(): string {
    return `thought_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate a unique session ID
   */
  static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate text similarity (optimized implementation)
   */
  static calculateSimilarity(text1: string, text2: string): number {
    // Quick check for empty strings
    if (!text1 || !text2) return 0;

    // Simplified Jaccard similarity with optimization
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    // Early exit for very different sizes
    if (words1.size > words2.size * 10 || words2.size > words1.size * 10) {
      return 0;
    }

    // Count intersection without creating intermediate array
    let intersectionCount = 0;
    const smaller = words1.size <= words2.size ? words1 : words2;
    const larger = words1.size <= words2.size ? words2 : words1;

    for (const word of smaller) {
      if (larger.has(word)) {
        intersectionCount++;
      }
    }

    // Union size = size1 + size2 - intersection
    const unionSize = words1.size + words2.size - intersectionCount;

    return unionSize > 0 ? intersectionCount / unionSize : 0;
  }

  /**
   * Extract keywords from text for tagging
   */
  static extractKeywords(text: string): string[] {
    // Simple keyword extraction - in practice would use more sophisticated NLP
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word));

    // Return most frequent words
    const wordCount = new Map<string, number>();
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });

    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Check if word is a stop word
   */
  private static isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'up',
      'about',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'between',
      'among',
      'this',
      'that',
      'these',
      'those',
      'i',
      'me',
      'my',
      'myself',
      'we',
      'our',
      'ours',
      'ourselves',
      'you',
      'your',
      'yours',
      'yourself',
      'yourselves',
      'he',
      'him',
      'his',
      'himself',
      'she',
      'her',
      'hers',
      'herself',
      'it',
      'its',
      'itself',
      'they',
      'them',
      'their',
      'theirs',
      'themselves',
      'what',
      'which',
      'who',
      'whom',
      'whose',
      'this',
      'that',
      'these',
      'those',
      'am',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'having',
      'do',
      'does',
      'did',
      'doing',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'can',
      'shall',
    ]);

    return stopWords.has(word);
  }

  /**
   * Generate a unique project ID
   */
  static generateProjectId(): string {
    return `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate project directory path for security
   */
  static validateProjectPath(directoryPath: string): { valid: boolean; error?: string } {
    if (!directoryPath || directoryPath.trim().length === 0) {
      return { valid: false, error: 'Directory path cannot be empty' };
    }

    // Check for path traversal attempts
    if (directoryPath.includes('..') || directoryPath.includes('~')) {
      return { valid: false, error: 'Path traversal not allowed' };
    }

    // Ensure path is absolute
    if (!directoryPath.startsWith('/') && !directoryPath.match(/^[A-Za-z]:\\/)) {
      return { valid: false, error: 'Path must be absolute' };
    }

    // Check path length
    if (directoryPath.length > 1000) {
      return { valid: false, error: 'Path too long' };
    }

    return { valid: true };
  }

  /**
   * Extract project name from directory path
   */
  static extractProjectName(directoryPath: string): string {
    const parts = directoryPath.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || 'Unknown Project';
  }

  /**
   * Calculate project similarity based on technology stacks
   */
  static calculateProjectSimilarity(project1: Project, project2: Project): number {
    const tech1 = new Set(project1.technology_stack || []);
    const tech2 = new Set(project2.technology_stack || []);

    if (tech1.size === 0 && tech2.size === 0) return 0;
    if (tech1.size === 0 || tech2.size === 0) return 0;

    const intersection = new Set([...tech1].filter(x => tech2.has(x)));
    const union = new Set([...tech1, ...tech2]);

    return intersection.size / union.size;
  }

  /**
   * Validate project configuration
   */
  static validateProject(project: Partial<Project>): string[] {
    const errors: string[] = [];

    if (!project.directory_path) {
      errors.push('directory_path is required');
    } else {
      const pathValidation = this.validateProjectPath(project.directory_path);
      if (!pathValidation.valid) {
        errors.push(`Invalid directory path: ${pathValidation.error}`);
      }
    }

    if (!project.project_name || project.project_name.trim().length === 0) {
      errors.push('project_name is required');
    }

    if (project.project_name && project.project_name.length > 200) {
      errors.push('project_name too long (max 200 characters)');
    }

    if (project.description && project.description.length > 2000) {
      errors.push('description too long (max 2000 characters)');
    }

    if (project.technology_stack && project.technology_stack.length > 50) {
      errors.push('too many technologies (max 50)');
    }

    if (project.programming_languages && project.programming_languages.length > 20) {
      errors.push('too many programming languages (max 20)');
    }

    return errors;
  }

  /**
   * Validate memory configuration
   */
  static validateConfig(config: MemoryConfig): string[] {
    const errors: string[] = [];

    if (config.maxThoughts !== undefined && config.maxThoughts <= 0) {
      errors.push('maxThoughts must be positive');
    }

    if (config.maxSessions !== undefined && config.maxSessions <= 0) {
      errors.push('maxSessions must be positive');
    }

    if (config.retentionDays !== undefined && config.retentionDays <= 0) {
      errors.push('retentionDays must be positive');
    }

    if (
      config.similarityThreshold !== undefined &&
      (config.similarityThreshold < 0 || config.similarityThreshold > 1)
    ) {
      errors.push('similarityThreshold must be between 0 and 1');
    }

    if (
      config.enableProjectIntelligence !== undefined &&
      typeof config.enableProjectIntelligence !== 'boolean'
    ) {
      errors.push('enableProjectIntelligence must be boolean');
    }

    if (
      config.crossProjectLearning !== undefined &&
      typeof config.crossProjectLearning !== 'boolean'
    ) {
      errors.push('crossProjectLearning must be boolean');
    }

    if (
      config.projectCachingEnabled !== undefined &&
      typeof config.projectCachingEnabled !== 'boolean'
    ) {
      errors.push('projectCachingEnabled must be boolean');
    }

    return errors;
  }
}
