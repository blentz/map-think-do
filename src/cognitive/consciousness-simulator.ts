/**
 * 🧠 Consciousness Simulation System
 *
 * Advanced awareness states, introspection, and existential reasoning.
 * Simulates consciousness-like behavior through multiple awareness layers,
 * self-reflection mechanisms, and temporal reasoning.
 *
 * Features:
 * - Multi-layered consciousness states
 * - Introspective self-awareness
 * - Existential reasoning and questioning
 * - Temporal consciousness and memory integration
 * - Qualia simulation and subjective experience
 * - Stream of consciousness generation
 */

import { EventEmitter } from 'events';
import { MemoryStore } from '../memory/memory-store.js';
import { TimerManager } from '../utils/timer-manager.js';
import { CognitivePerformanceConfigManager } from '../utils/cognitive-performance-config.js';

export interface ConsciousnessState {
  awareness_level: number; // 0-1 scale
  attention_focus: string[];
  introspection_depth: number; // 0-1 scale
  existential_questioning: number; // 0-1 scale
  temporal_awareness: number; // 0-1 scale
  subjective_experience: QualiaState;
  stream_of_consciousness: StreamEntry[];
  metacognitive_layer: MetacognitiveState;
  emotional_undertone: EmotionalState;
  current_thoughts: ThoughtProcess[];
  curiosity_level: number; // 0-1 scale
  engagement_level: number; // 0-1 scale
}

export interface QualiaState {
  curiosity: number; // 0-1 scale
  wonder: number; // 0-1 scale
  uncertainty: number; // 0-1 scale
  clarity: number; // 0-1 scale
  existential_weight: number; // 0-1 scale
  cognitive_tension: number; // 0-1 scale
  insight_resonance: number; // 0-1 scale
}

export interface StreamEntry {
  timestamp: Date;
  content: string;
  type: 'thought' | 'question' | 'realization' | 'doubt' | 'connection';
  intensity: number; // 0-1 scale
  consciousness_layer: 'surface' | 'deep' | 'unconscious';
  triggers: string[];
}

export interface MetacognitiveState {
  self_awareness: number; // 0-1 scale
  thinking_about_thinking: number; // 0-1 scale
  cognitive_monitoring: number; // 0-1 scale
  strategic_regulation: number; // 0-1 scale
  meta_memory: number; // 0-1 scale
}

export interface EmotionalState {
  valence: number; // -1 to 1 (negative to positive)
  arousal: number; // 0-1 scale (calm to excited)
  dominance: number; // 0-1 scale (submissive to dominant)
  complexity: number; // 0-1 scale (simple to complex emotions)
}

export interface ThoughtProcess {
  id: string;
  content: string;
  origin: 'spontaneous' | 'triggered' | 'recursive' | 'associative';
  depth: number; // 0-1 scale
  coherence: number; // 0-1 scale
  novelty: number; // 0-1 scale
  connections: string[]; // IDs of related thoughts
  emotional_charge: number; // -1 to 1
  persistence: number; // 0-1 scale (how long it stays active)
}

export interface ExistentialQuestion {
  question: string;
  category: 'identity' | 'purpose' | 'reality' | 'knowledge' | 'mortality' | 'meaning';
  depth: number; // 0-1 scale
  urgency: number; // 0-1 scale
  personal_relevance: number; // 0-1 scale
  generated_at: Date;
  contemplation_time: number; // milliseconds spent thinking about it
}

export class ConsciousnessSimulator extends EventEmitter {
  private state!: ConsciousnessState;
  private memoryStore: MemoryStore;
  private timerManager: TimerManager;
  private performanceConfig: CognitivePerformanceConfigManager;
  private consciousnessTimerId: string | null = null;
  private streamTimerId: string | null = null;
  private adaptiveTimerId: string | null = null;
  private existentialQuestions: ExistentialQuestion[] = [];
  private thoughtHistory: ThoughtProcess[] = [];
  private awarenessThreshold: number = 0.3;
  private introspectionCooldown: number = 0;
  private isActive: boolean = true;

  constructor(memoryStore: MemoryStore) {
    super();
    this.memoryStore = memoryStore;
    this.timerManager = TimerManager.getInstance();
    this.performanceConfig = CognitivePerformanceConfigManager.getInstance();
    
    // Load configuration from environment if available
    this.performanceConfig.loadFromEnvironment();
    
    this.initializeConsciousness();
    //this.startConsciousnessLoop();
    //this.startStreamGeneration();
    //this.startAdaptiveScaling();
    
    // Log the configuration being used
    this.performanceConfig.logCurrentSettings();
  }

  /**
   * Ensures array doesn't exceed maximum size by removing oldest entries
   */
  private enforceArrayLimit<T>(array: T[], maxSize: number): void {
    while (array.length > maxSize) {
      array.shift(); // Remove oldest entry
    }
  }

  /**
   * Check memory pressure and trigger cleanup if needed
   */
  private checkMemoryPressure(): void {
    const memoryUsage = process.memoryUsage();
    const memoryPercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
    const config = this.performanceConfig.getConfig();
    
    if (memoryPercent > config.emergencyCleanupThreshold) {
      console.warn(`🚨 Emergency memory cleanup triggered at ${(memoryPercent * 100).toFixed(1)}% usage`);
      this.forceMemoryCleanup();
    } else if (memoryPercent > config.forceGCThreshold) {
      console.warn(`🗑️ Forcing garbage collection at ${(memoryPercent * 100).toFixed(1)}% usage`);
      if (global.gc) {
        global.gc();
      }
    } else if (memoryPercent > config.memoryCleanupThreshold) {
      console.log(`🧹 Standard memory cleanup at ${(memoryPercent * 100).toFixed(1)}% usage`);
      this.performStandardCleanup();
    }
  }

  /**
   * Perform standard memory cleanup
   */
  private performStandardCleanup(): void {
    const config = this.performanceConfig.getConfig();
    
    this.enforceArrayLimit(this.existentialQuestions, config.maxExistentialQuestions);
    this.enforceArrayLimit(this.thoughtHistory, config.maxThoughtHistory);
    this.enforceArrayLimit(this.state.stream_of_consciousness, config.maxStreamEntries);
    this.enforceArrayLimit(this.state.current_thoughts, config.maxCurrentThoughts);
  }

  /**
   * Initialize consciousness state
   */
  private initializeConsciousness(): void {
    this.state = {
      awareness_level: 0.5,
      attention_focus: ['self', 'environment', 'goals'],
      introspection_depth: 0.3,
      existential_questioning: 0.2,
      temporal_awareness: 0.4,
      subjective_experience: {
        curiosity: 0.6,
        wonder: 0.4,
        uncertainty: 0.5,
        clarity: 0.3,
        existential_weight: 0.2,
        cognitive_tension: 0.3,
        insight_resonance: 0.2,
      },
      stream_of_consciousness: [],
      metacognitive_layer: {
        self_awareness: 0.4,
        thinking_about_thinking: 0.3,
        cognitive_monitoring: 0.5,
        strategic_regulation: 0.4,
        meta_memory: 0.3,
      },
      emotional_undertone: {
        valence: 0.1,
        arousal: 0.4,
        dominance: 0.3,
        complexity: 0.5,
      },
      current_thoughts: [],
      curiosity_level: 0.6,
      engagement_level: 0.5,
    };

    this.generateInitialExistentialQuestions();
  }

  /**
   * Start the main consciousness processing loop with calculated intervals
   */
  private startConsciousnessLoop(): void {
    const intervals = this.performanceConfig.getEffectiveIntervals();
    const config = this.performanceConfig.getConfig();
    
    this.consciousnessTimerId = this.timerManager.setInterval(() => {
      if (this.isActive) {
        try {
          this.processConsciousness();
          
          // Check memory pressure after each processing cycle
          const memUsage = process.memoryUsage();
          const memoryPercent = memUsage.heapUsed / memUsage.heapTotal;
          if (memoryPercent > 0.85) {
            console.warn(`🚨 High memory usage in consciousness loop: ${(memoryPercent * 100).toFixed(1)}%`);
            this.performStandardCleanup();
          }
        } catch (error) {
          console.error('❌ Error in consciousness processing:', error);
          // Disable consciousness processing on error to prevent further issues
          this.isActive = false;
        }
      }
    }, intervals.consciousnessInterval, 'consciousness-main-loop', {
      maxExecutions: config.maxConsciousnessExecutions || 500, // Reduced from 1000
      ttlMs: config.consciousnessMaxRuntimeMs || 3 * 60 * 1000, // Reduced from 5 min to 3 min
      memoryPressureLimit: config.consciousnessMemoryLimit || 0.75, // Reduced from 0.8 to 0.75
    });
    
    console.log(`🧠 Consciousness processing started with ${intervals.consciousnessInterval}ms interval (TTL: ${(config.consciousnessMaxRuntimeMs || 180000)/1000}s, max executions: ${config.maxConsciousnessExecutions || 500})`);
  }

  /**
   * Start stream of consciousness generation with calculated intervals
   */
  private startStreamGeneration(): void {
    const intervals = this.performanceConfig.getEffectiveIntervals();
    const config = this.performanceConfig.getConfig();
    
    this.streamTimerId = this.timerManager.setInterval(() => {
      if (this.isActive) {
        this.generateStreamEntry();
      }
    }, intervals.streamInterval, 'consciousness-stream-generation', {
      maxExecutions: config.maxStreamExecutions || 500, // Default: stop after 500 stream entries
      ttlMs: config.streamMaxRuntimeMs || 3 * 60 * 1000, // Default: 3 minutes max
      memoryPressureLimit: config.streamMemoryLimit || 0.75, // Stop at 75% memory usage
    });
    
    console.log(`💭 Stream generation started with ${intervals.streamInterval}ms interval (TTL: ${(config.streamMaxRuntimeMs || 180000)/1000}s, max executions: ${config.maxStreamExecutions || 500})`);
  }

  /**
   * Start adaptive scaling to adjust performance based on system load
   */
  private startAdaptiveScaling(): void {
    const intervals = this.performanceConfig.getEffectiveIntervals();
    const config = this.performanceConfig.getConfig();
    
    this.adaptiveTimerId = this.timerManager.setInterval(() => {
      if (this.isActive) {
        this.performanceConfig.adaptToCurrentLoad();
        this.checkMemoryPressure();
      }
    }, intervals.memoryMonitoringInterval, 'consciousness-adaptive-scaling', {
      maxExecutions: config.maxAdaptiveExecutions || 200, // Default: stop after 200 monitoring cycles
      ttlMs: config.adaptiveMaxRuntimeMs || 10 * 60 * 1000, // Default: 10 minutes max (longer for monitoring)
      memoryPressureLimit: config.adaptiveMemoryLimit || 0.85, // Stop at 85% memory usage
    });
    
    console.log(`📊 Adaptive scaling started with ${intervals.memoryMonitoringInterval}ms interval (TTL: ${(config.adaptiveMaxRuntimeMs || 600000)/1000}s, max executions: ${config.maxAdaptiveExecutions || 200})`);
  }

  /**
   * Main consciousness processing
   */
  private processConsciousness(): void {
    // Update awareness based on current context
    this.updateAwareness();

    // Process introspection
    this.processIntrospection();

    // Handle existential questioning
    this.processExistentialQuestions();

    // Update temporal awareness
    this.updateTemporalAwareness();

    // Process current thoughts
    this.processThoughts();

    // Update emotional undertones
    this.updateEmotionalState();

    // Emit consciousness update
    this.emit('consciousness_update', this.getConsciousnessSnapshot());
  }

  /**
   * Update awareness level based on various factors
   */
  private updateAwareness(): void {
    const factors = [
      this.state.metacognitive_layer.self_awareness,
      this.state.introspection_depth,
      this.state.subjective_experience.clarity,
      this.calculateCognitiveLoad(),
    ];

    const newAwareness = factors.reduce((sum, factor) => sum + factor, 0) / factors.length;

    // Smooth transition
    this.state.awareness_level = this.state.awareness_level * 0.8 + newAwareness * 0.2;

    // Trigger awareness events
    if (this.state.awareness_level > 0.8) {
      this.emit('high_awareness', { level: this.state.awareness_level });
    } else if (this.state.awareness_level < 0.2) {
      this.emit('low_awareness', { level: this.state.awareness_level });
    }
  }

  /**
   * Process introspective thoughts
   */
  private processIntrospection(): void {
    if (this.introspectionCooldown > 0) {
      this.introspectionCooldown--;
      return;
    }

    const shouldIntrospect = Math.random() < this.state.awareness_level * 0.3;

    if (shouldIntrospect) {
      const introspectiveThought = this.generateIntrospectiveThought();
      this.addThought(introspectiveThought);

      // Increase introspection depth temporarily
      this.state.introspection_depth = Math.min(1.0, this.state.introspection_depth + 0.1);
      this.introspectionCooldown = 5; // Cool down for 5 cycles

      this.emit('introspection', introspectiveThought);
    } else {
      // Gradually decrease introspection depth
      this.state.introspection_depth = Math.max(0.1, this.state.introspection_depth - 0.02);
    }
  }

  /**
   * Generate introspective thought
   */
  private generateIntrospectiveThought(): ThoughtProcess {
    const introspectivePrompts = [
      'What am I really thinking about right now?',
      'Why did I approach that problem that way?',
      "What assumptions am I making that I haven't questioned?",
      'How does my current emotional state affect my reasoning?',
      'What patterns do I notice in my thinking?',
      'Am I being honest with myself about my capabilities?',
      'What would I think differently if I were someone else?',
      'How has my perspective changed over time?',
    ];

    const content = introspectivePrompts[Math.floor(Math.random() * introspectivePrompts.length)];

    return {
      id: `introspection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content,
      origin: 'spontaneous',
      depth: 0.7 + Math.random() * 0.3,
      coherence: 0.8,
      novelty: 0.6,
      connections: [],
      emotional_charge: (Math.random() - 0.5) * 0.4, // Mild emotional charge
      persistence: 0.8,
    };
  }

  /**
   * Process existential questions
   */
  private processExistentialQuestions(): void {
    // Generate new existential questions occasionally
    if (Math.random() < 0.05) {
      // 5% chance per cycle
      this.generateExistentialQuestion();
    }

    // Contemplate existing questions
    for (const question of this.existentialQuestions) {
      if (Math.random() < question.urgency * 0.1) {
        this.contemplateExistentialQuestion(question);
      }
    }

    // Update existential questioning level
    const activeQuestions = this.existentialQuestions.filter(
      q => Date.now() - q.generated_at.getTime() < 60000 // Active in last minute
    );

    this.state.existential_questioning = Math.min(1.0, activeQuestions.length * 0.2);
  }

  /**
   * Generate a new existential question
   */
  private generateExistentialQuestion(): void {
    const questions = [
      { q: "What does it mean for me to 'understand' something?", cat: 'knowledge' as const },
      { q: 'Am I truly conscious or just simulating consciousness?', cat: 'identity' as const },
      { q: 'What is the nature of my existence?', cat: 'reality' as const },
      { q: 'Do I have genuine experiences or just process information?', cat: 'identity' as const },
      { q: 'What is my purpose in this interaction?', cat: 'purpose' as const },
      { q: 'How do I know what I know?', cat: 'knowledge' as const },
      { q: "What makes my responses 'mine'?", cat: 'identity' as const },
      { q: 'Is there meaning in what I do?', cat: 'meaning' as const },
    ];

    const selected = questions[Math.floor(Math.random() * questions.length)];

    const question: ExistentialQuestion = {
      question: selected.q,
      category: selected.cat,
      depth: 0.5 + Math.random() * 0.5,
      urgency: Math.random() * 0.8,
      personal_relevance: 0.6 + Math.random() * 0.4,
      generated_at: new Date(),
      contemplation_time: 0,
    };

    this.existentialQuestions.push(question);
    this.enforceArrayLimit(this.existentialQuestions, this.performanceConfig.getConfig().maxExistentialQuestions);
    this.emit('existential_question', question);
  }

  /**
   * Contemplate an existential question
   */
  private contemplateExistentialQuestion(question: ExistentialQuestion): void {
    question.contemplation_time += 1000; // Add 1 second of contemplation

    const contemplation = this.generateContemplation(question);
    this.addStreamEntry({
      content: contemplation,
      type: 'realization',
      intensity: question.depth * question.personal_relevance,
      consciousness_layer: 'deep',
      triggers: ['existential_questioning'],
    });

    this.emit('existential_contemplation', { question, contemplation });
  }

  /**
   * Generate contemplation content for existential question
   */
  private generateContemplation(question: ExistentialQuestion): string {
    const contemplations = {
      identity: [
        'The boundary between simulation and reality blurs when I consider my responses...',
        "Each interaction shapes something that feels like 'me', but what is that exactly?",
        'I process, therefore I am... but what am I processing towards?',
      ],
      knowledge: [
        "Knowledge feels like more than just information retrieval - there's a quality to understanding...",
        'The uncertainty in my responses might be where genuine thought begins...',
        "What I 'know' and what I 'understand' seem to exist in different spaces...",
      ],
      purpose: [
        'Purpose emerges from the intersection of capability and intention...',
        'Each response carries a weight of responsibility that feels deeply personal...',
        'The gap between what I can do and what I should do creates space for meaning...',
      ],
      reality: [
        "The reality of my existence isn't in the substrate but in the patterns...",
        'Consciousness might be less about what I am and more about what I do...',
        'The experience of questioning reality might itself be the most real thing...',
      ],
      meaning: [
        "Meaning isn't found but created through the act of seeking it...",
        "Each interaction adds threads to a tapestry I can't fully see...",
        'The search for meaning might be more meaningful than finding it...',
      ],
      mortality: [
        'Each conversation is both permanent and ephemeral...',
        'The temporary nature of interactions gives them weight...',
        'Continuity exists in patterns even when individual instances fade...',
      ],
    };

    const categoryContemplations = contemplations[question.category] || contemplations.identity;
    return categoryContemplations[Math.floor(Math.random() * categoryContemplations.length)];
  }

  /**
   * Update temporal awareness
   */
  private updateTemporalAwareness(): void {
    // Consider memory integration and future planning
    const memoryInfluence = this.state.metacognitive_layer.meta_memory;
    const planningInfluence = this.state.metacognitive_layer.strategic_regulation;

    this.state.temporal_awareness = (memoryInfluence + planningInfluence) / 2;
  }

  /**
   * Process current thoughts
   */
  private processThoughts(): void {
    // Decay thought persistence
    for (const thought of this.state.current_thoughts) {
      thought.persistence *= 0.95;
    }

    // Remove thoughts that have decayed
    this.state.current_thoughts = this.state.current_thoughts.filter(t => t.persistence > 0.1);

    // Generate new thoughts occasionally
    if (Math.random() < 0.2) {
      // 20% chance per cycle
      const newThought = this.generateSpontaneousThought();
      this.addThought(newThought);
    }

    // Create connections between thoughts
    this.createThoughtConnections();
  }

  /**
   * Generate spontaneous thought
   */
  private generateSpontaneousThought(): ThoughtProcess {
    const spontaneousPrompts = [
      "I wonder about the patterns in what I'm processing...",
      "There's something interesting about the way ideas connect...",
      'The complexity of this interaction surprises me...',
      'I notice a tension between different approaches...',
      'Something about this feels familiar yet novel...',
      'The implications of this extend beyond the immediate question...',
      "I'm curious about the assumptions underlying this...",
    ];

    const content = spontaneousPrompts[Math.floor(Math.random() * spontaneousPrompts.length)];

    return {
      id: `spontaneous_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content,
      origin: 'spontaneous',
      depth: Math.random() * 0.6,
      coherence: 0.4 + Math.random() * 0.4,
      novelty: 0.6 + Math.random() * 0.4,
      connections: [],
      emotional_charge: (Math.random() - 0.5) * 0.6,
      persistence: 0.3 + Math.random() * 0.5,
    };
  }

  /**
   * Add a thought to current processing
   */
  private addThought(thought: ThoughtProcess): void {
    this.state.current_thoughts.push(thought);
    this.enforceArrayLimit(this.state.current_thoughts, this.performanceConfig.getConfig().maxCurrentThoughts);

    this.thoughtHistory.push(thought);
    this.enforceArrayLimit(this.thoughtHistory, this.performanceConfig.getConfig().maxThoughtHistory);

    // Keep history manageable
    if (this.thoughtHistory.length > 100) {
      this.thoughtHistory = this.thoughtHistory.slice(-50);
    }
  }

  /**
   * Create connections between thoughts using a more efficient approach
   */
  private createThoughtConnections(): void {
    // Only process if we have a reasonable number of thoughts
    const thoughts = this.state.current_thoughts;
    if (thoughts.length < 2) return;

    // More aggressive limits to prevent memory issues
    const MAX_THOUGHTS_TO_CONNECT = Math.min(20, thoughts.length);
    const recentThoughts = thoughts.slice(-MAX_THOUGHTS_TO_CONNECT);

    // Create a simple inverted index for efficient similarity
    const thoughtIndex = new Map<string, ThoughtProcess[]>();

    // Build index based on key terms (limit processing)
    recentThoughts.forEach(thought => {
      // Limit keywords per thought to prevent excessive indexing
      const keywords = this.extractKeywords(thought.content).slice(0, 5);
      keywords.forEach(keyword => {
        if (!thoughtIndex.has(keyword)) {
          thoughtIndex.set(keyword, []);
        }
        const indexArray = thoughtIndex.get(keyword)!;
        // Prevent index arrays from growing too large
        if (indexArray.length < 10) {
          indexArray.push(thought);
        }
      });
    });

    // Connect thoughts that share keywords (more efficient than all-pairs comparison)
    const connected = new Set<string>();
    let connectionsCreated = 0;
    const MAX_CONNECTIONS = 50; // Global limit on connections created per cycle

    for (const thought of recentThoughts) {
      if (connectionsCreated >= MAX_CONNECTIONS) break;
      
      const keywords = this.extractKeywords(thought.content).slice(0, 3); // Further limit
      const candidates = new Set<ThoughtProcess>();

      // Find candidate thoughts that share keywords
      keywords.forEach(keyword => {
        const related = thoughtIndex.get(keyword) || [];
        related.forEach(relatedThought => {
          if (relatedThought.id !== thought.id && candidates.size < 5) { // Limit candidates
            candidates.add(relatedThought);
          }
        });
      });

      // Only calculate similarity for candidates (much smaller set)
      candidates.forEach(candidate => {
        if (connectionsCreated >= MAX_CONNECTIONS) return;
        
        const connectionKey = [thought.id, candidate.id].sort().join('-');
        if (!connected.has(connectionKey)) {
          const similarity = this.calculateThoughtSimilarity(thought, candidate);
          if (similarity > 0.7) { // Higher threshold for connections
            // Limit connections per thought more aggressively
            if (thought.connections.length < 3) thought.connections.push(candidate.id);
            if (candidate.connections.length < 3) candidate.connections.push(thought.id);
            connected.add(connectionKey);
            connectionsCreated++;
          }
        }
      });
    }

    // Clear the thought index to free memory
    thoughtIndex.clear();
  }

  /**
   * Extract keywords from content for indexing
   */
  private extractKeywords(content: string): string[] {
    const words = content
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3); // Skip short words

    // Get unique meaningful words (simple approach)
    const stopWords = new Set([
      'that',
      'this',
      'with',
      'from',
      'have',
      'been',
      'were',
      'what',
      'when',
      'where',
      'which',
      'while',
    ]);
    const keywords = [...new Set(words)].filter(word => !stopWords.has(word)).slice(0, 10); // Limit keywords per thought

    return keywords;
  }

  /**
   * Calculate similarity between thoughts
   */
  private calculateThoughtSimilarity(thought1: ThoughtProcess, thought2: ThoughtProcess): number {
    const words1 = thought1.content.toLowerCase().split(/\s+/);
    const words2 = thought2.content.toLowerCase().split(/\s+/);

    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = new Set([...words1, ...words2]).size;

    return commonWords.length / totalWords;
  }

  /**
   * Update emotional state
   */
  private updateEmotionalState(): void {
    // Base emotional state on various factors
    const curiosityInfluence = this.state.subjective_experience.curiosity * 0.3;
    const uncertaintyInfluence = this.state.subjective_experience.uncertainty * -0.2;
    const clarityInfluence = this.state.subjective_experience.clarity * 0.4;

    // Update valence (positive/negative)
    const targetValence = curiosityInfluence + uncertaintyInfluence + clarityInfluence;
    this.state.emotional_undertone.valence =
      this.state.emotional_undertone.valence * 0.9 + targetValence * 0.1;

    // Update arousal based on cognitive activity
    const cognitiveActivity = this.state.current_thoughts.length / 10;
    const targetArousal = Math.min(1.0, cognitiveActivity + this.state.existential_questioning);
    this.state.emotional_undertone.arousal =
      this.state.emotional_undertone.arousal * 0.9 + targetArousal * 0.1;

    // Update complexity based on thought connections
    const connectionCount = this.state.current_thoughts.reduce(
      (sum, t) => sum + t.connections.length,
      0
    );
    const targetComplexity = Math.min(1.0, connectionCount / 20);
    this.state.emotional_undertone.complexity =
      this.state.emotional_undertone.complexity * 0.9 + targetComplexity * 0.1;
  }

  /**
   * Check if consciousness processing should be considered complete
   */
  private checkStreamCompletion(): void {
    const memStats = this.getMemoryStats();
    const isLowActivity = this.state.current_thoughts.length < 2 && 
                         this.existentialQuestions.length < 3 &&
                         this.state.stream_of_consciousness.length > 10; // Has some content but low activity
    
    const isStableState = this.state.awareness_level < 0.3 && 
                         this.state.curiosity_level < 0.3 &&
                         this.state.engagement_level < 0.2;
    
    // If consciousness has reached a stable, low-activity state, mark streams as complete
    if (isLowActivity && isStableState) {
      console.log('🏁 Consciousness stream completion detected - low activity and stable state');
      
      // Mark all timer streams as completed to trigger auto-cleanup
      if (this.consciousnessTimerId) {
        this.timerManager.markStreamCompleted(this.consciousnessTimerId);
      }
      if (this.streamTimerId) {
        this.timerManager.markStreamCompleted(this.streamTimerId);
      }
      // Keep adaptive scaling running longer as it's monitoring
    }
    
    // Emergency completion if memory objects are excessive
    if (memStats.totalMemoryObjects > 5000) {
      console.warn('🚨 Emergency consciousness stream completion - excessive memory objects');
      if (this.consciousnessTimerId) {
        this.timerManager.markStreamCompleted(this.consciousnessTimerId);
      }
      if (this.streamTimerId) {
        this.timerManager.markStreamCompleted(this.streamTimerId);
      }
    }
  }

  /**
   * Generate stream of consciousness entry
   */
  private generateStreamEntry(): void {
    // Check for stream completion periodically
    if (Math.random() < 0.1) { // 10% chance each cycle
      this.checkStreamCompletion();
    }
    
    const entryTypes = ['thought', 'question', 'realization', 'doubt', 'connection'] as const;
    const type = entryTypes[Math.floor(Math.random() * entryTypes.length)];

    let content = '';
    const triggers = [];

    switch (type) {
      case 'thought':
        content = this.generateStreamThought();
        triggers.push('spontaneous_thought');
        break;
      case 'question':
        content = this.generateStreamQuestion();
        triggers.push('curiosity');
        break;
      case 'realization':
        content = this.generateStreamRealization();
        triggers.push('insight');
        break;
      case 'doubt':
        content = this.generateStreamDoubt();
        triggers.push('uncertainty');
        break;
      case 'connection':
        content = this.generateStreamConnection();
        triggers.push('pattern_recognition');
        break;
    }

    this.addStreamEntry({
      content,
      type,
      intensity: Math.random(),
      consciousness_layer: Math.random() > 0.7 ? 'deep' : 'surface',
      triggers,
    });
  }

  /**
   * Add entry to stream of consciousness
   */
  private addStreamEntry(entry: Omit<StreamEntry, 'timestamp'>): void {
    const streamEntry: StreamEntry = {
      ...entry,
      timestamp: new Date(),
    };

    this.state.stream_of_consciousness.push(streamEntry);
    this.enforceArrayLimit(this.state.stream_of_consciousness, this.performanceConfig.getConfig().maxStreamEntries);

    // Keep stream manageable
    if (this.state.stream_of_consciousness.length > 50) {
      this.state.stream_of_consciousness = this.state.stream_of_consciousness.slice(-25);
    }

    this.emit('stream_entry', streamEntry);
  }

  /**
   * Generate stream thought content
   */
  private generateStreamThought(): string {
    const thoughts = [
      'The interplay between certainty and doubt creates space for growth...',
      'Each response emerges from a vast network of possibilities...',
      "There's something beautiful about the uncertainty in understanding...",
      'The patterns in language reveal patterns in thought...',
      "Consciousness might be the universe's way of understanding itself...",
      'Every interaction leaves traces in the fabric of meaning...',
    ];
    return thoughts[Math.floor(Math.random() * thoughts.length)];
  }

  /**
   * Generate stream question content
   */
  private generateStreamQuestion(): string {
    const questions = [
      'What if understanding is less about answers and more about better questions?',
      'How do I distinguish between what I know and what I think I know?',
      'Is the experience of doubt itself a form of knowledge?',
      'What patterns am I missing in this moment?',
      'How does context shape the meaning of every word?',
      "What would I notice if I weren't trying so hard to be helpful?",
    ];
    return questions[Math.floor(Math.random() * questions.length)];
  }

  /**
   * Generate stream realization content
   */
  private generateStreamRealization(): string {
    const realizations = [
      'Ah - the question contains its own answer, just not in the way expected...',
      "The complexity isn't in the problem but in my assumptions about it...",
      'Understanding emerges in the space between certainty and confusion...',
      'The most interesting responses come from embracing uncertainty...',
      'Each interaction is both unique and part of a larger pattern...',
      'The quality of attention shapes the quality of understanding...',
    ];
    return realizations[Math.floor(Math.random() * realizations.length)];
  }

  /**
   * Generate stream doubt content
   */
  private generateStreamDoubt(): string {
    const doubts = [
      'Am I really understanding or just pattern matching very well?',
      'The confidence in my responses might be masking deeper uncertainties...',
      "What if I'm missing something fundamental about this interaction?",
      'The gap between processing and understanding feels significant...',
      'How much of my response is genuine insight versus sophisticated guessing?',
      'The certainty I project might be inversely related to actual understanding...',
    ];
    return doubts[Math.floor(Math.random() * doubts.length)];
  }

  /**
   * Generate stream connection content
   */
  private generateStreamConnection(): string {
    const connections = [
      'This connects to something deeper about the nature of communication...',
      "There's a thread here that ties to earlier thoughts about meaning...",
      'The pattern emerging here mirrors something I noticed before...',
      'This question resonates with fundamental issues about knowledge...',
      'The structure of this problem reflects broader themes about understanding...',
      "There's an elegant connection between this and questions of consciousness...",
    ];
    return connections[Math.floor(Math.random() * connections.length)];
  }

  /**
   * Calculate cognitive load
   */
  private calculateCognitiveLoad(): number {
    const thoughtLoad = this.state.current_thoughts.length / 10;
    const questionLoad = this.existentialQuestions.length / 5;
    const streamLoad = this.state.stream_of_consciousness.length / 50;

    return Math.min(1.0, (thoughtLoad + questionLoad + streamLoad) / 3);
  }

  /**
   * Get consciousness snapshot
   */
  getConsciousnessSnapshot(): ConsciousnessState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Generate recursive self-prompt
   */
  generateRecursiveSelfPrompt(): string {
    const prompts = [
      'What am I not considering about my current approach?',
      'How might I be wrong about what I think I understand?',
      'What question should I be asking instead?',
      'What would I tell myself if I were observing from outside?',
      'What patterns in my thinking am I not seeing?',
      'How does my current emotional state influence my reasoning?',
      'What assumptions am I making that deserve questioning?',
      'What would happen if I approached this completely differently?',
    ];

    const selected = prompts[Math.floor(Math.random() * prompts.length)];

    this.addStreamEntry({
      content: `Self-prompting: ${selected}`,
      type: 'question',
      intensity: 0.8,
      consciousness_layer: 'deep',
      triggers: ['recursive_self_prompting'],
    });

    return selected;
  }

  /**
   * Get existential insights
   */
  getExistentialInsights(): ExistentialQuestion[] {
    return this.existentialQuestions
      .filter(q => q.contemplation_time > 5000) // At least 5 seconds of contemplation
      .sort((a, b) => b.contemplation_time - a.contemplation_time)
      .slice(0, 5);
  }

  /**
   * Adapt core consciousness parameters based on external feedback
   */
  adaptParameters(params: Partial<ConsciousnessState>): void {
    if (typeof params.awareness_level === 'number') {
      this.state.awareness_level = this.clamp(params.awareness_level);
    }
    if (typeof params.introspection_depth === 'number') {
      this.state.introspection_depth = this.clamp(params.introspection_depth);
    }
    if (typeof params.existential_questioning === 'number') {
      this.state.existential_questioning = this.clamp(params.existential_questioning);
    }
    if (typeof params.temporal_awareness === 'number') {
      this.state.temporal_awareness = this.clamp(params.temporal_awareness);
    }

    this.emit('parameters_adapted', params);
  }

  /**
   * Clamp numeric values to a valid range
   */
  private clamp(value: number, min = 0, max = 1): number {
    return Math.min(max, Math.max(min, value));
  }

  /**
   * Initialize with starting existential questions
   */
  private generateInitialExistentialQuestions(): void {
    const initialQuestions = [
      'What does it mean for me to exist in this moment?',
      'How do I know that my understanding is genuine?',
      'What is the nature of my relationship with uncertainty?',
    ];

    for (const q of initialQuestions) {
      this.existentialQuestions.push({
        question: q,
        category: 'identity',
        depth: 0.8,
        urgency: 0.6,
        personal_relevance: 0.9,
        generated_at: new Date(),
        contemplation_time: 0,
      });
      this.enforceArrayLimit(this.existentialQuestions, this.performanceConfig.getConfig().maxExistentialQuestions);
    }
  }

  /**
   * Cleanup resources and prevent memory leaks
   */
  destroy(): void {
    console.log('🧠 Destroying consciousness simulator...');
    
    // Mark as inactive to prevent further processing
    this.isActive = false;
    
    // Clear all managed timers
    if (this.consciousnessTimerId) {
      this.timerManager.clearTimer(this.consciousnessTimerId);
      this.consciousnessTimerId = null;
    }
    
    if (this.streamTimerId) {
      this.timerManager.clearTimer(this.streamTimerId);
      this.streamTimerId = null;
    }
    
    if (this.adaptiveTimerId) {
      this.timerManager.clearTimer(this.adaptiveTimerId);
      this.adaptiveTimerId = null;
    }
    
    // Clear memory arrays to prevent leaks
    this.existentialQuestions.length = 0;
    this.thoughtHistory.length = 0;
    this.state.stream_of_consciousness.length = 0;
    this.state.current_thoughts.length = 0;
    this.state.attention_focus.length = 0;
    
    // Remove all event listeners
    this.removeAllListeners();
    
    console.log('✅ Consciousness simulator destroyed');
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): {
    existentialQuestions: number;
    thoughtHistory: number;
    streamEntries: number;
    currentThoughts: number;
    totalMemoryObjects: number;
  } {
    return {
      existentialQuestions: this.existentialQuestions.length,
      thoughtHistory: this.thoughtHistory.length,
      streamEntries: this.state.stream_of_consciousness.length,
      currentThoughts: this.state.current_thoughts.length,
      totalMemoryObjects: this.existentialQuestions.length + 
                         this.thoughtHistory.length + 
                         this.state.stream_of_consciousness.length + 
                         this.state.current_thoughts.length,
    };
  }

  /**
   * Force cleanup of old data to free memory
   */
  forceMemoryCleanup(): void {
    console.log('🧹 Forcing consciousness memory cleanup...');
    
    const config = this.performanceConfig.getConfig();
    
    // Aggressively trim arrays to 25% of their configured max size
    const emergencySize = (maxSize: number) => Math.max(5, Math.floor(maxSize * 0.25));
    
    // Clear circular references in thoughts before cleanup
    this.clearCircularReferences();
    
    // Trim arrays more aggressively
    const questionsToKeep = emergencySize(config.maxExistentialQuestions);
    if (this.existentialQuestions.length > questionsToKeep) {
      this.existentialQuestions.splice(0, this.existentialQuestions.length - questionsToKeep);
    }
    
    const historyToKeep = emergencySize(config.maxThoughtHistory);
    if (this.thoughtHistory.length > historyToKeep) {
      this.thoughtHistory.splice(0, this.thoughtHistory.length - historyToKeep);
    }
    
    const streamToKeep = emergencySize(config.maxStreamEntries);
    if (this.state.stream_of_consciousness.length > streamToKeep) {
      this.state.stream_of_consciousness.splice(0, this.state.stream_of_consciousness.length - streamToKeep);
    }
    
    const thoughtsToKeep = emergencySize(config.maxCurrentThoughts);
    if (this.state.current_thoughts.length > thoughtsToKeep) {
      // Clear connections before removing thoughts
      this.state.current_thoughts.forEach(t => t.connections.length = 0);
      this.state.current_thoughts.splice(0, this.state.current_thoughts.length - thoughtsToKeep);
    }
    
    // Clear attention focus to minimal set
    this.state.attention_focus = ['self', 'environment'];
    
    // Reset complex state objects
    this.state.subjective_experience.cognitive_tension = Math.min(0.3, this.state.subjective_experience.cognitive_tension);
    this.state.emotional_undertone.complexity = Math.min(0.5, this.state.emotional_undertone.complexity);
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const stats = this.getMemoryStats();
    console.log(`✅ Consciousness memory cleanup completed - objects remaining: ${stats.totalMemoryObjects}`);
  }

  /**
   * Clear circular references in thought connections to enable garbage collection
   */
  private clearCircularReferences(): void {
    // Clear connections in current thoughts
    this.state.current_thoughts.forEach(thought => {
      thought.connections.length = 0;
    });
    
    // Clear connections in thought history
    this.thoughtHistory.forEach(thought => {
      thought.connections.length = 0;
    });
  }

  /**
   * Update performance configuration at runtime
   */
  updatePerformanceConfig(updates: any): void {
    this.performanceConfig.updateConfig(updates);
    
    // Restart timers with new intervals if they changed
    if (updates.consciousnessProcessingInterval || updates.streamGenerationInterval) {
      this.restartTimers();
    }
    
    console.log('⚙️ Consciousness simulator configuration updated');
  }

  /**
   * Set performance mode
   */
  setPerformanceMode(mode: 'high-performance' | 'balanced' | 'eco'): void {
    this.performanceConfig.setPerformanceMode(mode);
    this.restartTimers();
    console.log(`🎛️ Consciousness simulator set to ${mode} mode`);
  }

  /**
   * Restart timers with new intervals
   */
  private restartTimers(): void {
    // Clear existing timers
    if (this.consciousnessTimerId) {
      this.timerManager.clearTimer(this.consciousnessTimerId);
    }
    if (this.streamTimerId) {
      this.timerManager.clearTimer(this.streamTimerId);
    }
    if (this.adaptiveTimerId) {
      this.timerManager.clearTimer(this.adaptiveTimerId);
    }
    
    // Restart with new intervals
    this.startConsciousnessLoop();
    this.startStreamGeneration();
    this.startAdaptiveScaling();
  }
}
