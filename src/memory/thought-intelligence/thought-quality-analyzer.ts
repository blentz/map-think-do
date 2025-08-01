/**
 * @fileoverview Thought Quality Analyzer
 *
 * Analyzes stored thought chains to evaluate reasoning quality, cognitive development,
 * and learning effectiveness. Implements a 3-tier analysis system following established
 * patterns from the prompt intelligence system.
 */

import { MemoryStore, StoredThought } from '../memory-store.js';

export interface ThoughtQualityMetrics {
  // Tier 1: Technical Quality (Infrastructure)
  parameter_adherence: number; // Thought protocol compliance (0-1)
  sequential_integrity: number; // Proper numbering/flow (0-1)
  branching_effectiveness: number; // Branch success rate (0-1)
  revision_improvement: number; // Quality gain from revisions (0-1)

  // Tier 2: Cognitive Quality (AI Components)
  logical_coherence: number; // Chain reasoning consistency (0-1)
  depth_progression: number; // Complexity increase across thoughts (0-1)
  metacognitive_awareness: number; // Self-reflection quality (0-1)
  creative_synthesis: number; // Novel connection generation (0-1)

  // Tier 3: Learning Quality (Advanced Capabilities)
  pattern_recognition: number; // Recurring theme detection (0-1)
  cross_session_transfer: number; // Knowledge application (0-1)
  failure_mode_avoidance: number; // Learning from mistakes (0-1)
  adaptation_speed: number; // Reasoning improvement rate (0-1)
}

export interface ThoughtAnalysisResult {
  session_id: string;
  thought_chain_ids: string[];
  metrics: ThoughtQualityMetrics;
  analysis_confidence: number;
  processing_time_ms: number;
  tier_scores: {
    tier1_score: number;
    tier2_score: number;
    tier3_score: number;
    overall_score: number;
  };
  metadata: {
    thought_chain_length: number;
    revision_count: number;
    branch_count: number;
    analysis_version: string;
  };
}

export interface ThoughtChainContext {
  session_id: string;
  thoughts: StoredThought[];
  session_data?: any;
  similar_sessions?: any[];
}

/**
 * Core thought quality analyzer implementing 3-tier analysis system
 */
export class ThoughtQualityAnalyzer {
  private memoryStore: MemoryStore;

  constructor(memoryStore: MemoryStore) {
    this.memoryStore = memoryStore;
  }

  /**
   * Analyze a complete thought chain for quality metrics
   */
  async analyzeThoughtChain(context: ThoughtChainContext): Promise<ThoughtAnalysisResult> {
    const startTime = Date.now();

    try {
      // Validate input
      this.validateThoughtChain(context);

      // Calculate all metrics
      const metrics = await this.calculateAllMetrics(context);

      // Calculate tier scores
      const tierScores = this.calculateTierScores(metrics);

      // Calculate metadata
      const metadata = this.calculateMetadata(context);

      // Calculate confidence
      const analysisConfidence = this.calculateAnalysisConfidence(context, metrics);

      const processingTime = Date.now() - startTime;

      return {
        session_id: context.session_id,
        thought_chain_ids: context.thoughts.map(t => t.id),
        metrics,
        analysis_confidence: analysisConfidence,
        processing_time_ms: processingTime,
        tier_scores: tierScores,
        metadata,
      };
    } catch (error) {
      console.warn(`Thought analysis failed for session ${context.session_id}:`, error);
      return this.createFallbackAnalysis(context, Date.now() - startTime, error);
    }
  }

  /**
   * Calculate all quality metrics for a thought chain
   */
  private async calculateAllMetrics(context: ThoughtChainContext): Promise<ThoughtQualityMetrics> {
    const thoughts = context.thoughts;

    return {
      // Tier 1: Technical Quality
      parameter_adherence: await this.calculateParameterAdherence(thoughts),
      sequential_integrity: await this.calculateSequentialIntegrity(thoughts),
      branching_effectiveness: await this.calculateBranchingEffectiveness(thoughts),
      revision_improvement: await this.calculateRevisionImprovement(thoughts),

      // Tier 2: Cognitive Quality
      logical_coherence: await this.calculateLogicalCoherence(thoughts),
      depth_progression: await this.calculateDepthProgression(thoughts),
      metacognitive_awareness: await this.calculateMetacognitiveAwareness(thoughts),
      creative_synthesis: await this.calculateCreativeSynthesis(thoughts),

      // Tier 3: Learning Quality
      pattern_recognition: await this.calculatePatternRecognition(context),
      cross_session_transfer: await this.calculateCrossSessionTransfer(context),
      failure_mode_avoidance: await this.calculateFailureModeAvoidance(context),
      adaptation_speed: await this.calculateAdaptationSpeed(context),
    };
  }

  // =============================================================================
  // TIER 1: TECHNICAL QUALITY ANALYSIS
  // =============================================================================

  /**
   * Calculate parameter adherence - how well thoughts follow protocol
   */
  private async calculateParameterAdherence(thoughts: StoredThought[]): Promise<number> {
    let adherenceScore = 0;
    let totalChecks = 0;

    for (const thought of thoughts) {
      totalChecks += 5; // 5 protocol checks per thought

      // Check required fields are present
      if (thought.thought && thought.thought.trim().length > 0) adherenceScore += 1;
      if (thought.thought_number && thought.thought_number > 0) adherenceScore += 1;
      if (thought.total_thoughts && thought.total_thoughts > 0) adherenceScore += 1;
      if (typeof thought.next_thought_needed === 'boolean') adherenceScore += 1;
      if (thought.timestamp) adherenceScore += 1;
    }

    return totalChecks > 0 ? adherenceScore / totalChecks : 0;
  }

  /**
   * Calculate sequential integrity - proper thought numbering and flow
   */
  private async calculateSequentialIntegrity(thoughts: StoredThought[]): Promise<number> {
    if (thoughts.length === 0) return 0;

    // Sort by timestamp to ensure proper order
    const sortedThoughts = [...thoughts].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let integrityScore = 0;
    let totalChecks = 0;

    for (let i = 0; i < sortedThoughts.length; i++) {
      const thought = sortedThoughts[i];
      totalChecks += 2;

      // Check thought number consistency
      if (thought.thought_number === i + 1) integrityScore += 1;

      // Check total_thoughts consistency
      if (thought.total_thoughts >= thought.thought_number) integrityScore += 1;
    }

    return totalChecks > 0 ? integrityScore / totalChecks : 0;
  }

  /**
   * Calculate branching effectiveness - success rate of branched thoughts
   */
  private async calculateBranchingEffectiveness(thoughts: StoredThought[]): Promise<number> {
    const branchedThoughts = thoughts.filter(t => t.branch_from_thought || t.branch_id);

    if (branchedThoughts.length === 0) return 0.85; // Default good score for no branching

    let effectivenesScore = 0;

    for (const branchedThought of branchedThoughts) {
      // Score based on content quality and logical flow
      const contentScore = this.scoreThoughtContent(branchedThought.thought);
      const flowScore = this.scoreBranchingFlow(branchedThought, thoughts);

      effectivenesScore += (contentScore + flowScore) / 2;
    }

    return branchedThoughts.length > 0 ? effectivenesScore / branchedThoughts.length : 0;
  }

  /**
   * Calculate revision improvement - quality gains from revisions
   */
  private async calculateRevisionImprovement(thoughts: StoredThought[]): Promise<number> {
    const revisions = thoughts.filter(t => t.is_revision && t.revises_thought);

    if (revisions.length === 0) return 0.75; // Default good score for no revisions needed

    let improvementScore = 0;

    for (const revision of revisions) {
      const originalThought = thoughts.find(t => t.thought_number === revision.revises_thought);
      if (originalThought) {
        const originalScore = this.scoreThoughtContent(originalThought.thought);
        const revisionScore = this.scoreThoughtContent(revision.thought);
        const improvement = Math.max(0, revisionScore - originalScore);
        improvementScore += improvement;
      }
    }

    return revisions.length > 0 ? Math.min(improvementScore / revisions.length, 1.0) : 0;
  }

  // =============================================================================
  // TIER 2: COGNITIVE QUALITY ANALYSIS
  // =============================================================================

  /**
   * Calculate logical coherence - consistency of reasoning chain
   */
  private async calculateLogicalCoherence(thoughts: StoredThought[]): Promise<number> {
    if (thoughts.length === 0) return 0;

    const sortedThoughts = [...thoughts].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let coherenceScore = 0;

    for (let i = 0; i < sortedThoughts.length; i++) {
      const thought = sortedThoughts[i];
      const thoughtCoherence = this.analyzeThoughtCoherence(thought.thought);

      // Check logical flow with previous thought
      if (i > 0) {
        const flowCoherence = this.analyzeLogicalFlow(
          sortedThoughts[i - 1].thought,
          thought.thought
        );
        coherenceScore += (thoughtCoherence + flowCoherence) / 2;
      } else {
        coherenceScore += thoughtCoherence;
      }
    }

    return coherenceScore / sortedThoughts.length;
  }

  /**
   * Calculate depth progression - complexity increase across thought chain
   */
  private async calculateDepthProgression(thoughts: StoredThought[]): Promise<number> {
    if (thoughts.length < 2) return 0.5; // Default for single thoughts

    const sortedThoughts = [...thoughts].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Use provided complexity values if available, otherwise analyze text
    const complexityScores = sortedThoughts.map(t => {
      if (typeof (t as any).complexity === 'number') {
        // Normalize provided complexity to 0-1 range (assuming max ~10)
        return Math.min((t as any).complexity / 10, 1.0);
      }
      return this.analyzeThoughtComplexity(t.thought);
    });

    // Calculate progression using linear regression
    const progression = this.calculateProgressionTrend(complexityScores);

    // Enhanced scoring for clear progression
    let progressionScore = 0.5; // Base score

    // Check for consistent increase
    let increases = 0;
    let decreases = 0;
    for (let i = 1; i < complexityScores.length; i++) {
      const change = complexityScores[i] - complexityScores[i - 1];
      if (change > 0.05) increases++;
      else if (change < -0.05) decreases++;
    }

    // Reward consistent progression
    if (increases > decreases) {
      const progressionRatio = increases / (increases + decreases);
      progressionScore += progressionRatio * 0.4;
    }

    // Add linear regression score (scaled)
    if (progression > 0) {
      progressionScore += Math.min(progression * 2, 0.3);
    }

    // Bonus for strong progression (>50% increase from first to last)
    const firstComplexity = complexityScores[0];
    const lastComplexity = complexityScores[complexityScores.length - 1];
    if (lastComplexity > firstComplexity * 1.5) {
      progressionScore += 0.2;
    }

    return Math.max(0, Math.min(1, progressionScore));
  }

  /**
   * Calculate metacognitive awareness - self-reflection quality
   */
  private async calculateMetacognitiveAwareness(thoughts: StoredThought[]): Promise<number> {
    let awarenessScore = 0;

    for (const thought of thoughts) {
      awarenessScore += this.analyzeMetacognitiveContent(thought.thought);
    }

    return thoughts.length > 0 ? awarenessScore / thoughts.length : 0;
  }

  /**
   * Calculate creative synthesis - novel connection generation
   */
  private async calculateCreativeSynthesis(thoughts: StoredThought[]): Promise<number> {
    let synthesisScore = 0;

    for (const thought of thoughts) {
      synthesisScore += this.analyzeCreativeContent(thought.thought);
    }

    return thoughts.length > 0 ? synthesisScore / thoughts.length : 0;
  }

  // =============================================================================
  // TIER 3: LEARNING EFFECTIVENESS ANALYSIS
  // =============================================================================

  /**
   * Calculate pattern recognition - recurring theme detection
   */
  private async calculatePatternRecognition(context: ThoughtChainContext): Promise<number> {
    let patternScore = 0.4; // Improved base score

    // Analyze patterns within the current session
    const patterns = this.detectThoughtPatterns(context.thoughts);

    // Enhanced scoring based on pattern detection and utilization
    const patternUtilization = this.scorePatternUtilization(context.thoughts, patterns);
    patternScore += patternUtilization * 0.3;

    // Look for explicit pattern recognition language
    let explicitPatternRecognition = 0;
    for (const thought of context.thoughts) {
      const patternLanguage =
        /\b(pattern|patterns|recurring|repeated|same.*as|similar.*to|consistent|systematic|approach.*approach|method.*method)\b/gi;
      const matches = (thought.thought.match(patternLanguage) || []).length;
      explicitPatternRecognition += matches;
    }
    patternScore += Math.min(explicitPatternRecognition * 0.08, 0.24);

    // Reward word repetition as pattern indication (like "approach approach approach")
    const wordRepetitionScore = this.analyzeWordRepetition(context.thoughts);
    patternScore += wordRepetitionScore * 0.2;

    // Check for learning from previous experiences
    let learningFromPrevious = 0;
    for (const thought of context.thoughts) {
      const learningLanguage =
        /\b(learned from|previous.*problems|previous.*solutions|previous.*successful|from my.*experience|same.*patterns)\b/gi;
      const matches = (thought.thought.match(learningLanguage) || []).length;
      learningFromPrevious += matches;
    }
    patternScore += Math.min(learningFromPrevious * 0.1, 0.2);

    return Math.min(patternScore, 1.0);
  }

  /**
   * Calculate cross-session transfer - knowledge application across sessions
   */
  private async calculateCrossSessionTransfer(context: ThoughtChainContext): Promise<number> {
    if (!context.similar_sessions || context.similar_sessions.length === 0) {
      return 0.5; // Default score when no similar sessions available
    }

    // Analyze knowledge transfer from similar sessions
    const transferScore = this.analyzeKnowledgeTransfer(context.thoughts, context.similar_sessions);

    return transferScore;
  }

  /**
   * Calculate failure mode avoidance - learning from mistakes
   */
  private async calculateFailureModeAvoidance(context: ThoughtChainContext): Promise<number> {
    // Analyze for repeated mistakes or improved approaches
    const failureAnalysis = this.analyzeFailureAvoidance(context);
    return failureAnalysis;
  }

  /**
   * Calculate adaptation speed - reasoning improvement rate
   */
  private async calculateAdaptationSpeed(context: ThoughtChainContext): Promise<number> {
    if (context.thoughts.length < 3) return 0.5; // Default for short chains

    // Analyze improvement rate across the thought chain
    const adaptationRate = this.analyzeAdaptationRate(context.thoughts);

    return adaptationRate;
  }

  // =============================================================================
  // HELPER METHODS FOR CONTENT ANALYSIS
  // =============================================================================

  private scoreThoughtContent(thought: string): number {
    let score = 0.3; // Base score

    // Score based on length and complexity
    const wordCount = thought.split(/\s+/).length;
    if (wordCount >= 10 && wordCount <= 100) score += 0.2;

    // Score based on logical indicators
    const logicalIndicators = /\b(because|therefore|however|since|thus|consequently)\b/gi;
    const matches = (thought.match(logicalIndicators) || []).length;
    score += Math.min(matches * 0.1, 0.3);

    // Score based on specificity
    const specificityPatterns = /\b(\d+\.\d+|\d+%|specific|exactly|precisely)\b/gi;
    const specificityMatches = (thought.match(specificityPatterns) || []).length;
    score += Math.min(specificityMatches * 0.05, 0.2);

    return Math.min(score, 1.0);
  }

  private scoreBranchingFlow(branchedThought: StoredThought, allThoughts: StoredThought[]): number {
    // Analyze how well the branch integrates with the overall flow
    const parentThought = allThoughts.find(
      t => t.thought_number === branchedThought.branch_from_thought
    );
    if (!parentThought) return 0.5;

    // Basic flow analysis - can be enhanced with more sophisticated NLP
    const relevanceScore = this.calculateTextSimilarity(
      parentThought.thought,
      branchedThought.thought
    );

    return Math.min(relevanceScore * 2, 1.0); // Scale and clamp
  }

  private analyzeThoughtCoherence(thought: string): number {
    let coherence = 0.5; // Improved base coherence for substantial thoughts

    if (!thought || thought.trim().length < 10) return 0.2;

    // Enhanced logical connectors detection
    const basicConnectors = /\b(and|but|however|therefore|because|since|if|then|so|thus)\b/gi;
    const advancedConnectors =
      /\b(furthermore|moreover|consequently|nevertheless|specifically|particularly|essentially|ultimately|alternatively|simultaneously|additionally)\b/gi;
    const analysisWords =
      /\b(analyze|consider|examine|evaluate|recognize|realize|understand|implement|approach|solution|problem|factor)\b/gi;

    const basicConnectorCount = (thought.match(basicConnectors) || []).length;
    const advancedConnectorCount = (thought.match(advancedConnectors) || []).length;
    const analysisWordCount = (thought.match(analysisWords) || []).length;

    coherence += Math.min(basicConnectorCount * 0.06, 0.18);
    coherence += Math.min(advancedConnectorCount * 0.08, 0.16);
    coherence += Math.min(analysisWordCount * 0.04, 0.12);

    // Improved structure assessment
    const sentences = thought.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length >= 1 && sentences.length <= 8) {
      const structureBonus = sentences.length >= 2 ? 0.15 : 0.08;
      coherence += structureBonus;
    }

    // Enhanced coherence patterns
    const coherencePatterns =
      /\b(first|second|third|initially|then|next|finally|in conclusion|as a result|this leads to|building on|reflecting on)\b/gi;
    const patternCount = (thought.match(coherencePatterns) || []).length;
    coherence += Math.min(patternCount * 0.08, 0.16);

    // Improved topic consistency - reward focused reasoning
    const meaningfulWords = thought.toLowerCase().match(/\b\w{4,}\b/g) || [];
    if (meaningfulWords.length > 0) {
      const avgWordLength =
        meaningfulWords.reduce((sum: number, word: string) => sum + word.length, 0) / meaningfulWords.length;
      if (avgWordLength > 5.5) coherence += 0.1; // Sophisticated vocabulary

      // Look for conceptual consistency rather than penalizing diversity
      const conceptualWords =
        thought.match(
          /\b(approach|method|strategy|solution|analysis|implementation|consideration|evaluation|recognition|synthesis)\b/gi
        ) || [];
      coherence += Math.min(conceptualWords.length * 0.03, 0.09);
    }

    return Math.min(coherence, 1.0);
  }

  private analyzeLogicalFlow(previousThought: string, currentThought: string): number {
    let flowScore = 0.4; // Base flow score

    // Enhanced similarity analysis - focus on conceptual overlap
    const conceptSimilarity = this.calculateConceptualSimilarity(previousThought, currentThought);
    flowScore += conceptSimilarity * 0.3;

    // Improved progression indicators
    const progression = this.analyzeProgressionIndicators(currentThought);
    flowScore += progression * 0.2;

    // Check for explicit references to previous thought
    const references =
      /\b(building on|based on|following|previous|earlier|above|as mentioned|this|that|these|those|my previous|from this|therefore|consequently|as a result)\b/gi;
    const referenceCount = (currentThought.match(references) || []).length;
    flowScore += Math.min(referenceCount * 0.08, 0.16);

    // Check for logical development patterns
    const developmentPatterns =
      /\b(realize|understand|recognize|conclude|deduce|infer|extend|expand|elaborate|refine|improve|enhance)\b/gi;
    const developmentCount = (currentThought.match(developmentPatterns) || []).length;
    flowScore += Math.min(developmentCount * 0.06, 0.12);

    // Check for causal relationships
    const causalPatterns =
      /\b(because|since|due to|leads to|results in|causes|enables|requires|depends on)\b/gi;
    const causalCount = (currentThought.match(causalPatterns) || []).length;
    flowScore += Math.min(causalCount * 0.05, 0.1);

    return Math.min(flowScore, 1.0);
  }

  private analyzeThoughtComplexity(thought: string): number {
    let complexity = 0.3; // Base complexity

    // Length-based complexity
    const wordCount = thought.split(/\s+/).length;
    complexity += Math.min(wordCount / 200, 0.3);

    // Concept density
    const conceptWords =
      /\b(analyze|synthesize|evaluate|implement|consider|determine|establish)\b/gi;
    const concepts = (thought.match(conceptWords) || []).length;
    complexity += Math.min(concepts * 0.1, 0.2);

    // Technical terminology
    const techTerms = /\b(algorithm|framework|architecture|methodology|paradigm|optimization)\b/gi;
    const techCount = (thought.match(techTerms) || []).length;
    complexity += Math.min(techCount * 0.05, 0.2);

    return Math.min(complexity, 1.0);
  }

  private analyzeMetacognitiveContent(thought: string): number {
    let metacognition = 0.3; // Improved base score

    // Explicit metacognitive language (highest value)
    const explicitMetacognitive =
      /\b(metacognitive|metacognition|reasoning process|thinking process|cognitive process|self-reflection|self-awareness|awareness of|conscious of)\b/gi;
    const explicitMatches = (thought.match(explicitMetacognitive) || []).length;
    metacognition += Math.min(explicitMatches * 0.25, 0.5);

    // Enhanced self-reference indicators
    const selfRef =
      /\b(I think|I believe|I realize|I understand|I can see|I recognize|my approach|my analysis|my reasoning|my method|my strategy)\b/gi;
    const selfMatches = (thought.match(selfRef) || []).length;
    metacognition += Math.min(selfMatches * 0.08, 0.24);

    // Advanced reflection indicators
    const advancedReflection =
      /\b(reflecting on|reflecting about|looking back|reconsidering|reevaluating|stepping back|examining my|analyzing my|reviewing my)\b/gi;
    const basicReflection = /\b(reflect|consider|evaluate|assess|review|reconsider)\b/gi;
    const advancedMatches = (thought.match(advancedReflection) || []).length;
    const basicMatches = (thought.match(basicReflection) || []).length;
    metacognition += Math.min(advancedMatches * 0.15, 0.3);
    metacognition += Math.min(basicMatches * 0.06, 0.18);

    // Process awareness indicators
    const processAwareness =
      /\b(approach has evolved|thinking has changed|process has|my understanding|learning from|building on my|evolved from|progressed from)\b/gi;
    const processMatches = (thought.match(processAwareness) || []).length;
    metacognition += Math.min(processMatches * 0.12, 0.24);

    // Quality judgment and evaluation
    const qualityJudgment =
      /\b(helps me|allows me to|enables me to|this understanding|this realization|this awareness|this insight)\b/gi;
    const qualityMatches = (thought.match(qualityJudgment) || []).length;
    metacognition += Math.min(qualityMatches * 0.08, 0.16);

    // Reduced penalty for uncertainty (metacognition often involves acknowledging uncertainty)
    const uncertainty = /\b(might|could|perhaps|maybe|uncertain|question|wonder)\b/gi;
    const uncertaintyMatches = (thought.match(uncertainty) || []).length;
    metacognition += Math.min(uncertaintyMatches * 0.03, 0.12);

    return Math.min(metacognition, 1.0);
  }

  private analyzeCreativeContent(thought: string): number {
    let creativity = 0.3; // Improved base score

    // Explicit creative synthesis language (highest value)
    const explicitCreative =
      /\b(creative synthesis|synthesis of|creative combination|novel synthesis|innovative synthesis|creative integration|synthesis represents|creative approach)\b/gi;
    const explicitMatches = (thought.match(explicitCreative) || []).length;
    creativity += Math.min(explicitMatches * 0.3, 0.6);

    // Enhanced novel approach indicators
    const novelty =
      /\b(innovative|creative|novel|unique|original|alternative|new approach|novel approach|groundbreaking|pioneering|inventive|ingenious)\b/gi;
    const noveltyMatches = (thought.match(novelty) || []).length;
    creativity += Math.min(noveltyMatches * 0.12, 0.36);

    // Cross-domain synthesis indicators
    const crossDomain =
      /\b(combines|combining|integrates|integrating|merges|merging|blends|blending|unites|uniting|connects|connecting|bridges|bridging)\b/gi;
    const crossDomainMatches = (thought.match(crossDomain) || []).length;
    creativity += Math.min(crossDomainMatches * 0.1, 0.2);

    // Domain-specific creative terms
    const domainCreative =
      /\b(technical and.*considerations|UX.*considerations|multi-layered|sophisticated approach|multifaceted|interdisciplinary|holistic)\b/gi;
    const domainMatches = (thought.match(domainCreative) || []).length;
    creativity += Math.min(domainMatches * 0.15, 0.3);

    // Enhanced metaphors and analogies
    const metaphors =
      /\b(like|similar to|analogous|resembles|as if|metaphor|metaphorically|symbolically)\b/gi;
    const metaphorMatches = (thought.match(metaphors) || []).length;
    creativity += Math.min(metaphorMatches * 0.08, 0.16);

    // Multiple perspectives and alternatives
    const perspectives =
      /\b(alternatively|another way|different approach|various approaches|multiple ways|diverse methods|range of options)\b/gi;
    const perspectiveMatches = (thought.match(perspectives) || []).length;
    creativity += Math.min(perspectiveMatches * 0.08, 0.16);

    // Innovation and breakthrough language
    const breakthrough =
      /\b(breakthrough|revolutionary|transformative|paradigm|paradigm shift|game-changing|cutting-edge)\b/gi;
    const breakthroughMatches = (thought.match(breakthrough) || []).length;
    creativity += Math.min(breakthroughMatches * 0.1, 0.2);

    return Math.min(creativity, 1.0);
  }

  // =============================================================================
  // PATTERN AND LEARNING ANALYSIS METHODS
  // =============================================================================

  private detectThoughtPatterns(thoughts: StoredThought[]): string[] {
    // Simplified pattern detection - can be enhanced with more sophisticated analysis
    const patterns: string[] = [];
    const thoughtTexts = thoughts.map(t => t.thought.toLowerCase());

    // Common phrase patterns
    const commonPhrases = this.extractCommonPhrases(thoughtTexts);
    patterns.push(...commonPhrases);

    // Reasoning pattern detection
    const reasoningPatterns = this.detectReasoningPatterns(thoughtTexts);
    patterns.push(...reasoningPatterns);

    return patterns;
  }

  private scorePatternUtilization(thoughts: StoredThought[], patterns: string[]): number {
    if (patterns.length === 0) return 0.5;

    let utilizationScore = 0;

    for (const pattern of patterns) {
      const utilization = this.measurePatternUtilization(thoughts, pattern);
      utilizationScore += utilization;
    }

    return Math.min(utilizationScore / patterns.length, 1.0);
  }

  private analyzeKnowledgeTransfer(
    currentThoughts: StoredThought[],
    similarSessions: any[]
  ): number {
    let transferScore = 0.4; // Improved base score

    if (!similarSessions || similarSessions.length === 0) {
      return transferScore; // Still give reasonable score when no similar sessions
    }

    // Enhanced concept extraction and overlap analysis
    const currentConcepts = this.extractConcepts(currentThoughts.map(t => t.thought));
    const currentText = currentThoughts.map(t => t.thought.toLowerCase()).join(' ');

    for (const session of similarSessions) {
      if (session.thoughts) {
        const sessionConcepts = this.extractConcepts(session.thoughts.map((t: any) => t.thought));
        const overlap = this.calculateConceptOverlap(currentConcepts, sessionConcepts);
        transferScore += overlap * 0.15; // Increased weight for concept overlap

        // Look for explicit transfer language
        let transferLanguage = 0;
        for (const thought of currentThoughts) {
          const transferIndicators =
            /\b(apply.*from|learned from|based on previous|from similar|previous.*problems|previous.*solutions|same.*approach|similar.*approach)\b/gi;
          const matches = (thought.thought.match(transferIndicators) || []).length;
          transferLanguage += matches;
        }
        transferScore += Math.min(transferLanguage * 0.1, 0.2);

        // Enhanced word-level transfer detection
        const sessionText = session.thoughts.map((t: any) => t.thought.toLowerCase()).join(' ');
        const commonWords = this.findCommonMeaningfulWords(currentText, sessionText);
        const wordTransferScore = Math.min(commonWords.length * 0.05, 0.15);
        transferScore += wordTransferScore;
      }
    }

    return Math.min(transferScore, 1.0);
  }

  private analyzeFailureAvoidance(context: ThoughtChainContext): number {
    let avoidanceScore = 0.5; // Improved base score

    // Look for error correction patterns
    const corrections = context.thoughts.filter(t => t.is_revision);
    if (corrections.length > 0) {
      avoidanceScore += Math.min(corrections.length * 0.1, 0.2);
    }

    // Enhanced learning and improvement indicators
    let improvementLanguage = 0;
    for (const thought of context.thoughts) {
      // Explicit avoidance language (highest value)
      const avoidanceLanguage =
        /\b(avoid.*mistake|avoided.*error|successfully avoided|prevent.*failure|learned from.*mistake|won't repeat|improved.*approach)\b/gi;
      const avoidanceMatches = (thought.thought.match(avoidanceLanguage) || []).length;
      improvementLanguage += avoidanceMatches * 3; // High weight for explicit avoidance

      // General improvement language
      const learningIndicators =
        /\b(learn|improve|correct|fix|avoid|prevent|better|enhanced|refined|optimized)\b/gi;
      const learningMatches = (thought.thought.match(learningIndicators) || []).length;
      improvementLanguage += learningMatches;

      // Past experience references
      const pastExperience =
        /\b(last time|previously|before|earlier|past.*experience|from.*experience|learned.*from)\b/gi;
      const pastMatches = (thought.thought.match(pastExperience) || []).length;
      improvementLanguage += pastMatches * 2; // Medium weight for past experience

      // Success indicators (suggests avoiding previous failures)
      const successIndicators =
        /\b(successfully|effective|working well|better result|improved.*outcome)\b/gi;
      const successMatches = (thought.thought.match(successIndicators) || []).length;
      improvementLanguage += successMatches;
    }

    avoidanceScore += Math.min(improvementLanguage * 0.04, 0.32);

    // Check for methodological improvements
    let methodologyImprovement = 0;
    for (const thought of context.thoughts) {
      const methodologyLanguage =
        /\b(improved.*method|better.*approach|refined.*strategy|enhanced.*technique|more.*effective)\b/gi;
      const matches = (thought.thought.match(methodologyLanguage) || []).length;
      methodologyImprovement += matches;
    }
    avoidanceScore += Math.min(methodologyImprovement * 0.08, 0.16);

    // Bonus for explicit contrast with previous approaches
    let contrastLanguage = 0;
    for (const thought of context.thoughts) {
      const contrastIndicators =
        /\b(instead of|rather than|unlike.*before|different.*from|better than.*previous)\b/gi;
      const matches = (thought.thought.match(contrastIndicators) || []).length;
      contrastLanguage += matches;
    }
    avoidanceScore += Math.min(contrastLanguage * 0.06, 0.12);

    return Math.min(avoidanceScore, 1.0);
  }

  private analyzeAdaptationRate(thoughts: StoredThought[]): number {
    if (thoughts.length < 3) return 0.5;

    const sortedThoughts = [...thoughts].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Calculate quality improvement over time
    const qualityScores = sortedThoughts.map(t => this.scoreThoughtContent(t.thought));
    const adaptationRate = this.calculateProgressionTrend(qualityScores);

    // Normalize to 0-1 range
    return Math.max(0, Math.min(1, (adaptationRate + 0.2) / 0.4));
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private calculateProgressionTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const xValues = Array.from({ length: n }, (_, i) => i);
    const xMean = xValues.reduce((sum, x) => sum + x, 0) / n;
    const yMean = values.reduce((sum, y) => sum + y, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (xValues[i] - xMean) * (values[i] - yMean);
      denominator += (xValues[i] - xMean) ** 2;
    }

    return denominator !== 0 ? numerator / denominator : 0;
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simplified text similarity using word overlap
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculateConceptualSimilarity(text1: string, text2: string): number {
    // Focus on meaningful concepts rather than all words
    const conceptPattern =
      /\b(problem|solution|approach|method|strategy|analysis|implementation|consideration|evaluation|recognition|synthesis|requirement|factor|aspect|element|component|system|process|technique|principle|framework)\b/gi;

    const concepts1 = new Set((text1.match(conceptPattern) || []).map(c => c.toLowerCase()));
    const concepts2 = new Set((text2.match(conceptPattern) || []).map(c => c.toLowerCase()));

    if (concepts1.size === 0 && concepts2.size === 0) {
      // Fall back to meaningful word similarity if no concepts found
      const meaningfulWords1 = new Set(
        (text1.match(/\b\w{5,}\b/g) || []).map(w => w.toLowerCase())
      );
      const meaningfulWords2 = new Set(
        (text2.match(/\b\w{5,}\b/g) || []).map(w => w.toLowerCase())
      );

      const intersection = new Set([...meaningfulWords1].filter(w => meaningfulWords2.has(w)));
      const union = new Set([...meaningfulWords1, ...meaningfulWords2]);

      return union.size > 0 ? intersection.size / union.size : 0;
    }

    const intersection = new Set([...concepts1].filter(c => concepts2.has(c)));
    const union = new Set([...concepts1, ...concepts2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private analyzeProgressionIndicators(thought: string): number {
    // Look for progression indicators in thought
    const progressionWords =
      /\b(next|then|following|subsequently|building|expanding|continuing)\b/gi;
    const matches = (thought.match(progressionWords) || []).length;

    return Math.min(matches * 0.2, 0.8);
  }

  private analyzeWordRepetition(thoughts: StoredThought[]): number {
    let repetitionScore = 0;

    for (const thought of thoughts) {
      const words = thought.thought.toLowerCase().split(/\s+/);
      const wordCounts: { [key: string]: number } = {};

      // Count word occurrences
      for (const word of words) {
        if (word.length > 3) {
          // Only count meaningful words
          wordCounts[word] = (wordCounts[word] || 0) + 1;
        }
      }

      // Score based on repeated words within the same thought
      for (const [word, count] of Object.entries(wordCounts)) {
        if (count > 1) {
          // Higher score for more repetitions, especially for meaningful words
          repetitionScore += Math.min((count - 1) * 0.2, 0.4);
        }
      }
    }

    // Also check for repeated words across different thoughts
    const allWords = thoughts
      .map(t => t.thought.toLowerCase())
      .join(' ')
      .split(/\s+/);
    const globalWordCounts: { [key: string]: number } = {};

    for (const word of allWords) {
      if (word.length > 4) {
        // Only count longer words for cross-thought patterns
        globalWordCounts[word] = (globalWordCounts[word] || 0) + 1;
      }
    }

    for (const [word, count] of Object.entries(globalWordCounts)) {
      if (count > 1) {
        repetitionScore += Math.min((count - 1) * 0.1, 0.3);
      }
    }

    return Math.min(repetitionScore, 1.0);
  }

  private findCommonMeaningfulWords(text1: string, text2: string): string[] {
    const words1 = text1
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 4);
    const words2 = text2
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 4);

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    return [...set1].filter(word => set2.has(word));
  }

  private extractCommonPhrases(texts: string[]): string[] {
    // Simplified common phrase extraction
    const phrases: string[] = [];
    const allWords = texts.join(' ').toLowerCase().split(/\s+/);
    const wordFreq: { [key: string]: number } = {};

    for (const word of allWords) {
      if (word.length > 3) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    }

    // Return frequent words as patterns
    for (const [word, freq] of Object.entries(wordFreq)) {
      if (freq >= 2) {
        phrases.push(word);
      }
    }

    return phrases.slice(0, 10); // Limit to top 10
  }

  private detectReasoningPatterns(texts: string[]): string[] {
    const patterns: string[] = [];

    // Look for common reasoning patterns
    const reasoningPatterns = [
      'problem-solution',
      'cause-effect',
      'comparison',
      'sequential',
      'analytical',
    ];

    for (const text of texts) {
      if (text.includes('problem') && text.includes('solution')) {
        patterns.push('problem-solution');
      }
      if (text.includes('because') || text.includes('therefore')) {
        patterns.push('cause-effect');
      }
      // Add more pattern detection logic
    }

    return [...new Set(patterns)]; // Remove duplicates
  }

  private measurePatternUtilization(thoughts: StoredThought[], pattern: string): number {
    let utilization = 0;

    for (const thought of thoughts) {
      if (thought.thought.toLowerCase().includes(pattern.toLowerCase())) {
        utilization += 0.1;
      }
    }

    return Math.min(utilization, 1.0);
  }

  private extractConcepts(texts: string[]): string[] {
    const concepts: string[] = [];
    const conceptPattern = /\b[A-Z][a-z]*[A-Z][a-zA-Z]*\b/g; // CamelCase concepts

    for (const text of texts) {
      if (text && typeof text === 'string') {
        const matches = text.match(conceptPattern) || [];
        concepts.push(...matches);
      }
    }

    return [...new Set(concepts)]; // Remove duplicates
  }

  private calculateConceptOverlap(concepts1: string[], concepts2: string[]): number {
    const set1 = new Set(concepts1);
    const set2 = new Set(concepts2);
    const intersection = new Set([...set1].filter(c => set2.has(c)));
    const union = new Set([...set1, ...set2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculateTierScores(metrics: ThoughtQualityMetrics) {
    const tier1_score =
      (metrics.parameter_adherence +
        metrics.sequential_integrity +
        metrics.branching_effectiveness +
        metrics.revision_improvement) /
      4;

    const tier2_score =
      (metrics.logical_coherence +
        metrics.depth_progression +
        metrics.metacognitive_awareness +
        metrics.creative_synthesis) /
      4;

    const tier3_score =
      (metrics.pattern_recognition +
        metrics.cross_session_transfer +
        metrics.failure_mode_avoidance +
        metrics.adaptation_speed) /
      4;

    const overall_score = tier1_score * 0.3 + tier2_score * 0.4 + tier3_score * 0.3;

    return {
      tier1_score,
      tier2_score,
      tier3_score,
      overall_score,
    };
  }

  private calculateMetadata(context: ThoughtChainContext) {
    const revisionCount = context.thoughts.filter(t => t.is_revision).length;
    const branchCount = context.thoughts.filter(t => t.branch_from_thought || t.branch_id).length;

    return {
      thought_chain_length: context.thoughts.length,
      revision_count: revisionCount,
      branch_count: branchCount,
      analysis_version: '1.0.0',
    };
  }

  private calculateAnalysisConfidence(
    context: ThoughtChainContext,
    metrics: ThoughtQualityMetrics
  ): number {
    let confidence = 0.5; // Base confidence

    // Higher confidence with more thoughts
    confidence += Math.min(context.thoughts.length / 10, 0.3);

    // Confidence based on data completeness
    const completeness = this.calculateDataCompleteness(context.thoughts);
    confidence += completeness * 0.2;

    return Math.min(confidence, 0.95);
  }

  private calculateDataCompleteness(thoughts: StoredThought[]): number {
    let completeness = 0;
    let totalFields = 0;

    for (const thought of thoughts) {
      totalFields += 6; // Key fields to check

      if (thought.thought && thought.thought.trim().length > 0) completeness += 1;
      if (thought.thought_number) completeness += 1;
      if (thought.total_thoughts) completeness += 1;
      if (thought.timestamp) completeness += 1;
      if (thought.confidence !== null && thought.confidence !== undefined) completeness += 1;
      if (thought.domain) completeness += 1;
    }

    return totalFields > 0 ? completeness / totalFields : 0;
  }

  private validateThoughtChain(context: ThoughtChainContext): void {
    if (!context.session_id) {
      throw new Error('Session ID is required for thought analysis');
    }

    if (!context.thoughts || context.thoughts.length === 0) {
      throw new Error('At least one thought is required for analysis');
    }

    // Validate thought structure
    for (const thought of context.thoughts) {
      if (!thought.id || !thought.thought) {
        throw new Error('Invalid thought structure: missing required fields');
      }
    }
  }

  private createFallbackAnalysis(
    context: ThoughtChainContext,
    processingTime: number,
    error: any
  ): ThoughtAnalysisResult {
    console.warn(`Creating fallback analysis for session ${context.session_id}:`, error);

    // Return minimal analysis with low confidence
    const fallbackMetrics: ThoughtQualityMetrics = {
      parameter_adherence: 0.5,
      sequential_integrity: 0.5,
      branching_effectiveness: 0.5,
      revision_improvement: 0.5,
      logical_coherence: 0.5,
      depth_progression: 0.5,
      metacognitive_awareness: 0.5,
      creative_synthesis: 0.5,
      pattern_recognition: 0.5,
      cross_session_transfer: 0.5,
      failure_mode_avoidance: 0.5,
      adaptation_speed: 0.5,
    };

    return {
      session_id: context.session_id,
      thought_chain_ids: context.thoughts.map(t => t.id),
      metrics: fallbackMetrics,
      analysis_confidence: 0.1, // Very low confidence
      processing_time_ms: processingTime,
      tier_scores: {
        tier1_score: 0.5,
        tier2_score: 0.5,
        tier3_score: 0.5,
        overall_score: 0.5,
      },
      metadata: {
        thought_chain_length: context.thoughts.length,
        revision_count: 0,
        branch_count: 0,
        analysis_version: '1.0.0',
      },
    };
  }

  /**
   * Batch analyze multiple thought chains
   */
  async batchAnalyzeThoughtChains(
    contexts: ThoughtChainContext[]
  ): Promise<ThoughtAnalysisResult[]> {
    const results: ThoughtAnalysisResult[] = [];

    for (const context of contexts) {
      try {
        const result = await this.analyzeThoughtChain(context);
        results.push(result);
      } catch (error) {
        console.warn(`Batch analysis failed for session ${context.session_id}:`, error);
        const fallbackResult = this.createFallbackAnalysis(context, 0, error);
        results.push(fallbackResult);
      }
    }

    return results;
  }
}
