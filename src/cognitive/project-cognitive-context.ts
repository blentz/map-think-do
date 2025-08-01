/**
 * @fileoverview Project-Cognitive Integration Layer
 *
 * This module creates the bridge between project information and cognitive reasoning,
 * enabling technology-aware cognitive strategies, project-specific persona selection,
 * and context-appropriate reasoning approaches.
 *
 * Key features:
 * - Technology stack-based cognitive strategy mapping
 * - Project lifecycle phase detection and adaptation
 * - Project-specific cognitive settings application
 * - Cross-project learning insights integration
 */

import { Project } from '../memory/memory-store.js';
import { CognitiveContext } from './plugin-system.js';

/**
 * Project lifecycle phases that influence cognitive strategies
 */
export enum ProjectLifecyclePhase {
  PLANNING = 'planning',           // Architecture and design phase
  DEVELOPMENT = 'development',     // Active implementation phase  
  TESTING = 'testing',            // Quality assurance and debugging
  MAINTENANCE = 'maintenance',     // Optimization and bug fixes
  RESEARCH = 'research'           // Experimentation and exploration
}

/**
 * Technology-specific cognitive strategies
 */
export interface TechnologyCognitiveStrategy {
  // Persona preferences (weights 0-1)
  preferredPersonas: {
    strategist: number;    // Long-term planning
    engineer: number;      // Technical implementation
    skeptic: number;       // Critical evaluation
    creative: number;      // Innovation and design
    analyst: number;       // Data-driven insights
    philosopher: number;   // Ethical and conceptual
    pragmatist: number;    // Practical solutions
    synthesizer: number;   // Integration and holistic
  };
  
  // Reasoning approach preferences
  reasoningStyle: {
    analytical_depth: number;      // 0-1: How deep to analyze
    creative_exploration: number;  // 0-1: How much to explore alternatives
    pragmatic_focus: number;       // 0-1: Focus on practical solutions
    systematic_approach: number;   // 0-1: Structured vs flexible approach
  };
  
  // Memory and knowledge preferences
  memoryStrategy: {
    project_scope_preference: number; // 0-1: Prefer project-scoped vs global memory
    pattern_recognition_weight: number; // 0-1: How much to weight patterns
    cross_domain_learning: number;   // 0-1: Learn from other domains
  };
  
  // Context-specific adaptations
  contextualFactors: {
    complexity_tolerance: number;    // 0-1: Tolerance for complex solutions
    performance_priority: number;    // 0-1: Performance vs clarity trade-off
    security_awareness: number;      // 0-1: Security consideration weight
    maintainability_focus: number;   // 0-1: Long-term maintainability focus
  };
}

/**
 * Enhanced cognitive context with project awareness
 */
export interface ProjectCognitiveContext extends CognitiveContext {
  // Project information
  project?: {
    id: string;
    name: string;
    directory_path: string;
    technology_stack: string[];
    project_type: string;
    programming_languages: string[];
    cognitive_settings: Record<string, any>;
    lifecycle_phase?: ProjectLifecyclePhase;
    complexity_estimate?: number;
  };
  
  // Technology-specific strategy
  technologyStrategy?: TechnologyCognitiveStrategy;
  
  // Project memory context
  projectMemoryContext?: {
    recent_patterns: string[];
    successful_strategies: string[];
    common_challenges: string[];
    learning_insights: string[];
  };
  
  // Cross-project learning
  similarProjects?: Array<{
    project_id: string;
    project_name: string;
    similarity_score: number;
    successful_patterns: string[];
  }>;
}

/**
 * Technology-cognitive strategy mappings
 */
export class TechnologyCognitiveStrategyMapper {
  private static readonly STRATEGY_CACHE = new Map<string, TechnologyCognitiveStrategy>();
  
  /**
   * Predefined cognitive strategies for different technology stacks
   */
  private static readonly TECHNOLOGY_STRATEGIES: Record<string, TechnologyCognitiveStrategy> = {
    // Frontend Technologies
    'react': {
      preferredPersonas: {
        strategist: 0.7, engineer: 0.9, skeptic: 0.6, creative: 0.9,
        analyst: 0.6, philosopher: 0.4, pragmatist: 0.8, synthesizer: 0.7
      },
      reasoningStyle: {
        analytical_depth: 0.7, creative_exploration: 0.9,
        pragmatic_focus: 0.8, systematic_approach: 0.7
      },
      memoryStrategy: {
        project_scope_preference: 0.8, pattern_recognition_weight: 0.7,
        cross_domain_learning: 0.6
      },
      contextualFactors: {
        complexity_tolerance: 0.6, performance_priority: 0.7,
        security_awareness: 0.6, maintainability_focus: 0.8
      }
    },
    
    'vue': {
      preferredPersonas: {
        strategist: 0.6, engineer: 0.8, skeptic: 0.5, creative: 0.8,
        analyst: 0.6, philosopher: 0.4, pragmatist: 0.9, synthesizer: 0.7
      },
      reasoningStyle: {
        analytical_depth: 0.6, creative_exploration: 0.8,
        pragmatic_focus: 0.9, systematic_approach: 0.8
      },
      memoryStrategy: {
        project_scope_preference: 0.7, pattern_recognition_weight: 0.6,
        cross_domain_learning: 0.6
      },
      contextualFactors: {
        complexity_tolerance: 0.5, performance_priority: 0.7,
        security_awareness: 0.6, maintainability_focus: 0.8
      }
    },
    
    // Backend Technologies
    'nodejs': {
      preferredPersonas: {
        strategist: 0.8, engineer: 0.9, skeptic: 0.7, creative: 0.6,
        analyst: 0.8, philosopher: 0.5, pragmatist: 0.9, synthesizer: 0.7
      },
      reasoningStyle: {
        analytical_depth: 0.8, creative_exploration: 0.6,
        pragmatic_focus: 0.9, systematic_approach: 0.8
      },
      memoryStrategy: {
        project_scope_preference: 0.7, pattern_recognition_weight: 0.8,
        cross_domain_learning: 0.7
      },
      contextualFactors: {
        complexity_tolerance: 0.7, performance_priority: 0.9,
        security_awareness: 0.8, maintainability_focus: 0.8
      }
    },
    
    'python': {
      preferredPersonas: {
        strategist: 0.7, engineer: 0.8, skeptic: 0.6, creative: 0.7,
        analyst: 0.9, philosopher: 0.6, pragmatist: 0.8, synthesizer: 0.8
      },
      reasoningStyle: {
        analytical_depth: 0.9, creative_exploration: 0.7,
        pragmatic_focus: 0.8, systematic_approach: 0.9
      },
      memoryStrategy: {
        project_scope_preference: 0.6, pattern_recognition_weight: 0.9,
        cross_domain_learning: 0.8
      },
      contextualFactors: {
        complexity_tolerance: 0.8, performance_priority: 0.7,
        security_awareness: 0.7, maintainability_focus: 0.9
      }
    },
    
    'go': {
      preferredPersonas: {
        strategist: 0.8, engineer: 0.9, skeptic: 0.8, creative: 0.5,
        analyst: 0.8, philosopher: 0.4, pragmatist: 0.9, synthesizer: 0.7
      },
      reasoningStyle: {
        analytical_depth: 0.8, creative_exploration: 0.5,
        pragmatic_focus: 0.9, systematic_approach: 0.9
      },
      memoryStrategy: {
        project_scope_preference: 0.8, pattern_recognition_weight: 0.8,
        cross_domain_learning: 0.6
      },
      contextualFactors: {
        complexity_tolerance: 0.6, performance_priority: 0.9,
        security_awareness: 0.9, maintainability_focus: 0.9
      }
    },
    
    // Data Science & AI
    'pytorch': {
      preferredPersonas: {
        strategist: 0.9, engineer: 0.7, skeptic: 0.8, creative: 0.8,
        analyst: 0.9, philosopher: 0.7, pragmatist: 0.7, synthesizer: 0.8
      },
      reasoningStyle: {
        analytical_depth: 0.9, creative_exploration: 0.8,
        pragmatic_focus: 0.7, systematic_approach: 0.8
      },
      memoryStrategy: {
        project_scope_preference: 0.6, pattern_recognition_weight: 0.9,
        cross_domain_learning: 0.9
      },
      contextualFactors: {
        complexity_tolerance: 0.9, performance_priority: 0.8,
        security_awareness: 0.6, maintainability_focus: 0.7
      }
    },
    
    // DevOps & Infrastructure
    'docker': {
      preferredPersonas: {
        strategist: 0.8, engineer: 0.9, skeptic: 0.9, creative: 0.5,
        analyst: 0.7, philosopher: 0.4, pragmatist: 0.9, synthesizer: 0.7
      },
      reasoningStyle: {
        analytical_depth: 0.8, creative_exploration: 0.5,
        pragmatic_focus: 0.9, systematic_approach: 0.9
      },
      memoryStrategy: {
        project_scope_preference: 0.7, pattern_recognition_weight: 0.8,
        cross_domain_learning: 0.8
      },
      contextualFactors: {
        complexity_tolerance: 0.7, performance_priority: 0.9,
        security_awareness: 0.9, maintainability_focus: 0.9
      }
    },
    
    // Default strategy for unknown technologies
    'default': {
      preferredPersonas: {
        strategist: 0.7, engineer: 0.8, skeptic: 0.7, creative: 0.6,
        analyst: 0.7, philosopher: 0.5, pragmatist: 0.8, synthesizer: 0.7
      },
      reasoningStyle: {
        analytical_depth: 0.7, creative_exploration: 0.6,
        pragmatic_focus: 0.8, systematic_approach: 0.7
      },
      memoryStrategy: {
        project_scope_preference: 0.6, pattern_recognition_weight: 0.7,
        cross_domain_learning: 0.7
      },
      contextualFactors: {
        complexity_tolerance: 0.7, performance_priority: 0.7,
        security_awareness: 0.7, maintainability_focus: 0.8
      }
    }
  };
  
  /**
   * Get cognitive strategy for a technology stack
   */
  static getStrategyForTechnologies(technologies: string[]): TechnologyCognitiveStrategy {
    if (!technologies || technologies.length === 0) {
      return this.TECHNOLOGY_STRATEGIES.default;
    }
    
    // Create cache key
    const cacheKey = technologies.sort().join(',');
    
    // Check cache first
    if (this.STRATEGY_CACHE.has(cacheKey)) {
      return this.STRATEGY_CACHE.get(cacheKey)!;
    }
    
    // Combine strategies from multiple technologies
    const strategy = this.combineStrategies(
      technologies.map(tech => this.getSingleTechnologyStrategy(tech))
    );
    
    // Cache the result
    this.STRATEGY_CACHE.set(cacheKey, strategy);
    
    return strategy;
  }
  
  /**
   * Get strategy for a single technology
   */
  private static getSingleTechnologyStrategy(technology: string): TechnologyCognitiveStrategy {
    const normalizedTech = technology.toLowerCase();
    return this.TECHNOLOGY_STRATEGIES[normalizedTech] || this.TECHNOLOGY_STRATEGIES.default;
  }
  
  /**
   * Combine multiple technology strategies using weighted averaging
   */
  private static combineStrategies(strategies: TechnologyCognitiveStrategy[]): TechnologyCognitiveStrategy {
    if (strategies.length === 0) {
      return this.TECHNOLOGY_STRATEGIES.default;
    }
    
    if (strategies.length === 1) {
      return strategies[0];
    }
    
    // Weight newer/more specific technologies higher
    const weights = strategies.map((_, index) => 1 / (index + 1));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    
    const combined: TechnologyCognitiveStrategy = {
      preferredPersonas: {
        strategist: 0, engineer: 0, skeptic: 0, creative: 0,
        analyst: 0, philosopher: 0, pragmatist: 0, synthesizer: 0
      },
      reasoningStyle: {
        analytical_depth: 0, creative_exploration: 0,
        pragmatic_focus: 0, systematic_approach: 0
      },
      memoryStrategy: {
        project_scope_preference: 0, pattern_recognition_weight: 0,
        cross_domain_learning: 0
      },
      contextualFactors: {
        complexity_tolerance: 0, performance_priority: 0,
        security_awareness: 0, maintainability_focus: 0
      }
    };
    
    // Weighted average of all strategies
    strategies.forEach((strategy, index) => {
      const weight = weights[index] / totalWeight;
      
      // Combine persona preferences
      Object.keys(combined.preferredPersonas).forEach(persona => {
        combined.preferredPersonas[persona as keyof typeof combined.preferredPersonas] += 
          strategy.preferredPersonas[persona as keyof typeof strategy.preferredPersonas] * weight;
      });
      
      // Combine reasoning style
      Object.keys(combined.reasoningStyle).forEach(style => {
        combined.reasoningStyle[style as keyof typeof combined.reasoningStyle] += 
          strategy.reasoningStyle[style as keyof typeof strategy.reasoningStyle] * weight;
      });
      
      // Combine memory strategy
      Object.keys(combined.memoryStrategy).forEach(memory => {
        combined.memoryStrategy[memory as keyof typeof combined.memoryStrategy] += 
          strategy.memoryStrategy[memory as keyof typeof strategy.memoryStrategy] * weight;
      });
      
      // Combine contextual factors
      Object.keys(combined.contextualFactors).forEach(factor => {
        combined.contextualFactors[factor as keyof typeof combined.contextualFactors] += 
          strategy.contextualFactors[factor as keyof typeof strategy.contextualFactors] * weight;
      });
    });
    
    return combined;
  }
  
  /**
   * Clear strategy cache (useful for testing)
   */
  static clearCache(): void {
    this.STRATEGY_CACHE.clear();
  }
}

/**
 * Project lifecycle phase detector
 */
export class ProjectLifecycleDetector {
  /**
   * Detect project lifecycle phase based on project characteristics and recent activity
   */
  static detectLifecyclePhase(
    project: Project,
    recentActivity?: {
      recent_thoughts: string[];
      recent_patterns: string[];
      session_objectives: string[];
    }
  ): ProjectLifecyclePhase {
    // Analyze project metadata for lifecycle indicators
    const metadata = project.project_metadata || {};
    
    // Check for explicit phase indication
    if (metadata.lifecycle_phase) {
      return metadata.lifecycle_phase as ProjectLifecyclePhase;
    }
    
    // Detect phase from activity patterns
    if (recentActivity) {
      const activityText = [
        ...recentActivity.recent_thoughts,
        ...recentActivity.recent_patterns,
        ...recentActivity.session_objectives
      ].join(' ').toLowerCase();
      
      // Planning phase indicators
      if (this.containsKeywords(activityText, [
        'architecture', 'design', 'plan', 'structure', 'requirements',
        'specification', 'blueprint', 'wireframe', 'mockup'
      ])) {
        return ProjectLifecyclePhase.PLANNING;
      }
      
      // Testing phase indicators
      if (this.containsKeywords(activityText, [
        'test', 'testing', 'debug', 'debugging', 'bug', 'error',
        'fix', 'validation', 'verification', 'qa'
      ])) {
        return ProjectLifecyclePhase.TESTING;
      }
      
      // Research phase indicators
      if (this.containsKeywords(activityText, [
        'research', 'experiment', 'explore', 'investigate', 'study',
        'analyze', 'prototype', 'proof of concept', 'spike'
      ])) {
        return ProjectLifecyclePhase.RESEARCH;
      }
      
      // Maintenance phase indicators
      if (this.containsKeywords(activityText, [
        'optimize', 'refactor', 'maintain', 'update', 'upgrade',
        'performance', 'cleanup', 'improve', 'enhance'
      ])) {
        return ProjectLifecyclePhase.MAINTENANCE;
      }
    }
    
    // Default to development phase
    return ProjectLifecyclePhase.DEVELOPMENT;
  }
  
  /**
   * Check if text contains any of the specified keywords
   */
  private static containsKeywords(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }
}

/**
 * Factory for creating project-enhanced cognitive contexts
 */
export class ProjectCognitiveContextFactory {
  /**
   * Create enhanced cognitive context with project information
   */
  static async createContext(
    baseContext: CognitiveContext,
    project?: Project,
    memoryStore?: any
  ): Promise<ProjectCognitiveContext> {
    // Start with base context
    const enhancedContext: ProjectCognitiveContext = {
      ...baseContext
    };
    
    // Add project information if available
    if (project) {
      // Detect lifecycle phase
      const lifecyclePhase = ProjectLifecycleDetector.detectLifecyclePhase(project);
      
      enhancedContext.project = {
        id: project.id,
        name: project.project_name,
        directory_path: project.directory_path,
        technology_stack: project.technology_stack || [],
        project_type: project.project_type || 'unknown',
        programming_languages: project.programming_languages || [],
        cognitive_settings: project.cognitive_settings || {},
        lifecycle_phase: lifecyclePhase,
        complexity_estimate: await this.estimateProjectComplexity(project)
      };
      
      // Get technology-specific cognitive strategy
      enhancedContext.technologyStrategy = TechnologyCognitiveStrategyMapper
        .getStrategyForTechnologies(project.technology_stack || []);
      
      // Add project memory context if memory store is available
      if (memoryStore) {
        enhancedContext.projectMemoryContext = await this.buildProjectMemoryContext(
          project.id, memoryStore
        );
        
        enhancedContext.similarProjects = await this.findSimilarProjects(
          project, memoryStore
        );
      }
    }
    
    return enhancedContext;
  }
  
  /**
   * Estimate project complexity based on technology stack and metadata
   */
  private static async estimateProjectComplexity(project: Project): Promise<number> {
    let complexity = 0.5; // Base complexity
    
    // Technology stack complexity
    const techCount = (project.technology_stack || []).length;
    complexity += Math.min(techCount * 0.1, 0.3); // Max 0.3 from tech diversity
    
    // Programming language complexity
    const langCount = (project.programming_languages || []).length;
    complexity += Math.min(langCount * 0.05, 0.2); // Max 0.2 from language diversity
    
    // Project type complexity
    const complexProjectTypes = ['ai-system', 'distributed-system', 'ml-platform'];
    if (complexProjectTypes.includes(project.project_type || '')) {
      complexity += 0.2;
    }
    
    // Metadata indicators
    const metadata = project.project_metadata || {};
    if (metadata.complexity === 'high') complexity += 0.2;
    if (metadata.complexity === 'low') complexity -= 0.2;
    
    return Math.max(0.1, Math.min(1.0, complexity));
  }
  
  /**
   * Build project memory context from stored data
   */
  private static async buildProjectMemoryContext(
    projectId: string,
    memoryStore: any
  ): Promise<any> {
    try {
      // Get recent project-specific patterns and insights
      const recentThoughts = await memoryStore.queryThoughts?.({
        project_id: projectId,
        limit: 20,
        sort_by: 'timestamp',
        sort_order: 'desc'
      }) || [];
      
      const patterns = recentThoughts
        .flatMap((thought: any) => thought.patterns_detected || [])
        .filter((pattern: string, index: number, arr: string[]) => arr.indexOf(pattern) === index)
        .slice(0, 10);
      
      return {
        recent_patterns: patterns,
        successful_strategies: [], // TODO: Extract from successful sessions
        common_challenges: [],     // TODO: Extract from failed attempts
        learning_insights: []      // TODO: Extract from metacognitive analysis
      };
    } catch (error) {
      console.error('Error building project memory context:', error);
      return {
        recent_patterns: [],
        successful_strategies: [],
        common_challenges: [],
        learning_insights: []
      };
    }
  }
  
  /**
   * Find similar projects for cross-project learning
   */
  private static async findSimilarProjects(
    project: Project,
    memoryStore: any
  ): Promise<any[]> {
    try {
      if (!memoryStore.queryProjects) {
        return [];
      }
      
      // Find projects with overlapping technology stacks
      const allProjects = await memoryStore.queryProjects({
        is_active: true,
        limit: 50
      });
      
      return allProjects
        .filter((p: Project) => p.id !== project.id)
        .map((p: Project) => ({
          project_id: p.id,
          project_name: p.project_name,
          similarity_score: this.calculateProjectSimilarity(project, p),
          successful_patterns: [] // TODO: Extract patterns from successful sessions
        }))
        .filter((p: any) => p.similarity_score > 0.3)
        .sort((a: any, b: any) => b.similarity_score - a.similarity_score)
        .slice(0, 5);
    } catch (error) {
      console.error('Error finding similar projects:', error);
      return [];
    }
  }
  
  /**
   * Calculate similarity between two projects
   */
  private static calculateProjectSimilarity(project1: Project, project2: Project): number {
    const tech1 = new Set(project1.technology_stack || []);
    const tech2 = new Set(project2.technology_stack || []);
    
    if (tech1.size === 0 && tech2.size === 0) return 0;
    if (tech1.size === 0 || tech2.size === 0) return 0;
    
    const intersection = new Set([...tech1].filter(x => tech2.has(x)));
    const union = new Set([...tech1, ...tech2]);
    
    const techSimilarity = intersection.size / union.size;
    
    // Bonus for same project type
    const typeSimilarity = project1.project_type === project2.project_type ? 0.2 : 0;
    
    return Math.min(1.0, techSimilarity + typeSimilarity);
  }
}