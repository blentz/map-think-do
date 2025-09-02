/**
 * @fileoverview Creative Synthesizer Tool
 *
 * Advanced creative reasoning tool that generates novel ideas, combines concepts,
 * provides creative problem-solving approaches, and facilitates innovative thinking.
 */

import {
  ExternalTool,
  ToolInput,
  ToolOutput,
  ValidationResult,
  ToolSchema,
} from '../tool-registry.js';

export class CreativeSynthesizer implements ExternalTool {
  id = 'creative-synthesizer';
  name = 'Creative Synthesizer';
  description = 'Advanced creative reasoning and idea generation tool';
  category = 'creative' as const;
  version = '1.0.0';
  capabilities = [
    'idea_generation',
    'concept_combination',
    'creative_problem_solving',
    'metaphor_creation',
    'brainstorming',
    'innovation_techniques',
    'lateral_thinking',
    'creative_constraints',
  ];

  config = {
    timeout_ms: 8000,
    max_retries: 2,
    requires_auth: false,
    rate_limit: {
      requests_per_minute: 60,
      burst_limit: 8,
    },
  };

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();

    try {
      const result = await this.performCreativeOperation(input);

      return {
        success: true,
        result,
        metadata: {
          execution_time_ms: Date.now() - startTime,
          tool_version: this.version,
          confidence: result.confidence,
          reasoning_trace: result.creative_process,
        },
      };
    } catch (error) {
      return {
        success: false,
        result: null,
        metadata: {
          execution_time_ms: Date.now() - startTime,
          tool_version: this.version,
        },
        error: {
          code: 'CREATIVE_ERROR',
          message: (error as Error).message,
          details: error,
        },
      };
    }
  }

  async validate(input: ToolInput): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    if (!input.operation) {
      errors.push('Operation is required');
    } else if (!this.getSupportedOperations().includes(input.operation)) {
      errors.push(`Unsupported operation: ${input.operation}`);
      suggestions.push(`Supported operations: ${this.getSupportedOperations().join(', ')}`);
    }

    if (input.operation === 'generate_ideas' && !input.parameters.topic) {
      errors.push('Topic parameter is required for generate_ideas operation');
    }

    if (
      input.operation === 'combine_concepts' &&
      (!input.parameters.concept1 || !input.parameters.concept2)
    ) {
      errors.push(
        'Both concept1 and concept2 parameters are required for combine_concepts operation'
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  getSchema(): ToolSchema {
    return {
      operations: {
        generate_ideas: {
          description: 'Generate creative ideas for a given topic or problem',
          parameters: {
            topic: { type: 'string', description: 'Topic or problem to generate ideas for' },
            quantity: { type: 'number', description: 'Number of ideas to generate', default: 10 },
            creativity_level: {
              type: 'string',
              description: 'Level of creativity (conservative, moderate, radical)',
              default: 'moderate',
            },
          },
          returns: {
            ideas: { type: 'array', description: 'Generated creative ideas' },
            techniques_used: { type: 'array', description: 'Creative techniques applied' },
          },
          examples: [],
        },
        combine_concepts: {
          description: 'Creatively combine two different concepts',
          parameters: {
            concept1: { type: 'string', description: 'First concept to combine' },
            concept2: { type: 'string', description: 'Second concept to combine' },
            combination_style: {
              type: 'string',
              description: 'Style of combination',
              default: 'hybrid',
            },
          },
          returns: {
            combinations: { type: 'array', description: 'Creative combinations of the concepts' },
            synergies: { type: 'array', description: 'Identified synergies between concepts' },
          },
          examples: [],
        },
        solve_creatively: {
          description: 'Apply creative problem-solving techniques',
          parameters: {
            problem: { type: 'string', description: 'Problem to solve creatively' },
            constraints: { type: 'array', description: 'Constraints to work within', default: [] },
            techniques: {
              type: 'array',
              description: 'Specific techniques to use',
              default: ['all'],
            },
          },
          returns: {
            solutions: { type: 'array', description: 'Creative solutions' },
            approach: { type: 'string', description: 'Creative approach taken' },
          },
          examples: [],
        },
        create_metaphors: {
          description: 'Create metaphors and analogies for complex concepts',
          parameters: {
            concept: { type: 'string', description: 'Concept to create metaphors for' },
            domain: { type: 'string', description: 'Domain for metaphor source', default: 'any' },
            quantity: { type: 'number', description: 'Number of metaphors to create', default: 5 },
          },
          returns: {
            metaphors: { type: 'array', description: 'Created metaphors with explanations' },
            effectiveness_scores: {
              type: 'array',
              description: 'Effectiveness ratings for each metaphor',
            },
          },
          examples: [],
        },
      },
    };
  }

  private async performCreativeOperation(input: ToolInput): Promise<any> {
    switch (input.operation) {
      case 'generate_ideas':
        return this.generateIdeas(
          input.parameters.topic,
          input.parameters.quantity || 10,
          input.parameters.creativity_level || 'moderate'
        );

      case 'combine_concepts':
        return this.combineConcepts(
          input.parameters.concept1,
          input.parameters.concept2,
          input.parameters.combination_style || 'hybrid'
        );

      case 'solve_creatively':
        return this.solveCreatively(
          input.parameters.problem,
          input.parameters.constraints || [],
          input.parameters.techniques || ['all']
        );

      case 'create_metaphors':
        return this.createMetaphors(
          input.parameters.concept,
          input.parameters.domain || 'any',
          input.parameters.quantity || 5
        );

      default:
        throw new Error(`Unsupported operation: ${input.operation}`);
    }
  }

  private generateIdeas(topic: string, quantity: number, creativityLevel: string): any {
    const creativeProcess: string[] = [];
    creativeProcess.push(`Generating ${quantity} ideas for topic: ${topic}`);
    creativeProcess.push(`Creativity level: ${creativityLevel}`);

    const ideas: any[] = [];
    const techniquesUsed: string[] = [];

    // SCAMPER technique
    if (creativityLevel !== 'conservative') {
      const scamperIdeas = this.applySCAMPER(topic);
      ideas.push(...scamperIdeas);
      techniquesUsed.push('SCAMPER');
      creativeProcess.push(`Applied SCAMPER technique: ${scamperIdeas.length} ideas generated`);
    }

    // Random word association
    const randomWordIdeas = this.applyRandomWordAssociation(topic, Math.ceil(quantity / 3));
    ideas.push(...randomWordIdeas);
    techniquesUsed.push('Random Word Association');
    creativeProcess.push(
      `Applied random word association: ${randomWordIdeas.length} ideas generated`
    );

    // Six thinking hats
    if (creativityLevel === 'radical') {
      const sixHatsIdeas = this.applySixThinkingHats(topic);
      ideas.push(...sixHatsIdeas);
      techniquesUsed.push('Six Thinking Hats');
      creativeProcess.push(`Applied Six Thinking Hats: ${sixHatsIdeas.length} ideas generated`);
    }

    // Morphological analysis
    const morphologyIdeas = this.applyMorphologicalAnalysis(topic, quantity);
    ideas.push(...morphologyIdeas);
    techniquesUsed.push('Morphological Analysis');
    creativeProcess.push(
      `Applied morphological analysis: ${morphologyIdeas.length} ideas generated`
    );

    // Select best ideas
    const selectedIdeas = this.selectBestIdeas(ideas, quantity);
    creativeProcess.push(
      `Selected top ${selectedIdeas.length} ideas from ${ideas.length} generated`
    );

    return {
      ideas: selectedIdeas,
      techniques_used: techniquesUsed,
      creative_process: creativeProcess,
      confidence: 0.82,
      creativity_metrics: {
        novelty_score: this.calculateNoveltyScore(selectedIdeas),
        feasibility_score: this.calculateFeasibilityScore(selectedIdeas),
        diversity_score: this.calculateDiversityScore(selectedIdeas),
      },
    };
  }

  private combineConcepts(concept1: string, concept2: string, combinationStyle: string): any {
    const creativeProcess: string[] = [];
    creativeProcess.push(`Combining concepts: ${concept1} + ${concept2}`);
    creativeProcess.push(`Combination style: ${combinationStyle}`);

    const combinations: any[] = [];
    const synergies: any[] = [];

    // Hybrid combination
    if (combinationStyle === 'hybrid' || combinationStyle === 'all') {
      const hybridCombinations = this.createHybridCombinations(concept1, concept2);
      combinations.push(...hybridCombinations);
      creativeProcess.push(`Created ${hybridCombinations.length} hybrid combinations`);
    }

    // Metaphorical combination
    const metaphoricalCombinations = this.createMetaphoricalCombinations(concept1, concept2);
    combinations.push(...metaphoricalCombinations);
    creativeProcess.push(`Created ${metaphoricalCombinations.length} metaphorical combinations`);

    // Functional combination
    const functionalCombinations = this.createFunctionalCombinations(concept1, concept2);
    combinations.push(...functionalCombinations);
    creativeProcess.push(`Created ${functionalCombinations.length} functional combinations`);

    // Identify synergies
    const identifiedSynergies = this.identifySynergies(concept1, concept2);
    synergies.push(...identifiedSynergies);
    creativeProcess.push(`Identified ${identifiedSynergies.length} synergies`);

    return {
      combinations,
      synergies,
      creative_process: creativeProcess,
      confidence: 0.78,
      combination_analysis: {
        compatibility_score: this.calculateCompatibilityScore(concept1, concept2),
        innovation_potential: this.calculateInnovationPotential(combinations),
        market_potential: this.calculateMarketPotential(combinations),
      },
    };
  }

  private solveCreatively(problem: string, constraints: string[], techniques: string[]): any {
    const creativeProcess: string[] = [];
    creativeProcess.push(`Creative problem solving for: ${problem}`);
    creativeProcess.push(`Constraints: ${constraints.join(', ')}`);
    creativeProcess.push(`Techniques: ${techniques.join(', ')}`);

    const solutions: any[] = [];
    let approach = 'multi-technique';

    // Lateral thinking
    if (techniques.includes('all') || techniques.includes('lateral_thinking')) {
      const lateralSolutions = this.applyLateralThinking(problem, constraints);
      solutions.push(...lateralSolutions);
      creativeProcess.push(`Lateral thinking generated ${lateralSolutions.length} solutions`);
    }

    // Constraint relaxation
    if (techniques.includes('all') || techniques.includes('constraint_relaxation')) {
      const relaxationSolutions = this.applyConstraintRelaxation(problem, constraints);
      solutions.push(...relaxationSolutions);
      creativeProcess.push(
        `Constraint relaxation generated ${relaxationSolutions.length} solutions`
      );
    }

    // Analogical reasoning
    const analogicalSolutions = this.applyAnalogicalReasoning(problem);
    solutions.push(...analogicalSolutions);
    creativeProcess.push(`Analogical reasoning generated ${analogicalSolutions.length} solutions`);

    // TRIZ methodology
    if (techniques.includes('all') || techniques.includes('triz')) {
      const trizSolutions = this.applyTRIZ(problem, constraints);
      solutions.push(...trizSolutions);
      approach = 'TRIZ-based';
      creativeProcess.push(`TRIZ methodology generated ${trizSolutions.length} solutions`);
    }

    return {
      solutions,
      approach,
      creative_process: creativeProcess,
      confidence: 0.85,
      solution_analysis: {
        originality_scores: solutions.map((solution, index) => {
          const baseScore = 0.6;
          const uniqueWords =
            typeof solution === 'string'
              ? new Set(
                  solution
                    .toLowerCase()
                    .split(/\W+/)
                    .filter(w => w.length > 2)
                ).size
              : 5;
          const variation = ((index * 37 + uniqueWords * 13) % 100) / 250; // 0-0.4 range
          return Math.min(baseScore + variation, 1.0);
        }),
        feasibility_scores: solutions.map((solution, index) => {
          const baseScore = 0.5;
          const complexity = typeof solution === 'string' ? solution.split(' ').length : 10;
          const simplicity = Math.max(0, (20 - complexity) * 0.01); // Simpler = more feasible
          const variation = ((index * 23 + complexity * 7) % 80) / 267; // 0-0.3 range
          return Math.min(baseScore + simplicity + variation, 0.8);
        }),
        impact_potential: solutions.map((solution, index) => {
          const baseScore = 0.5;
          const keywords = ['improve', 'enhance', 'optimize', 'transform', 'innovate', 'solve'];
          const keywordCount =
            typeof solution === 'string'
              ? keywords.reduce(
                  (count, keyword) => count + (solution.toLowerCase().includes(keyword) ? 1 : 0),
                  0
                )
              : 2;
          const keywordBonus = keywordCount * 0.1;
          const variation = ((index * 41 + keywordCount * 17) % 100) / 200; // 0-0.5 range
          return Math.min(baseScore + keywordBonus + variation, 1.0);
        }),
      },
    };
  }

  private createMetaphors(concept: string, domain: string, quantity: number): any {
    const creativeProcess: string[] = [];
    creativeProcess.push(`Creating ${quantity} metaphors for: ${concept}`);
    creativeProcess.push(`Metaphor domain: ${domain}`);

    const metaphors: any[] = [];
    const effectivenessScores: number[] = [];

    // Nature metaphors
    if (domain === 'any' || domain === 'nature') {
      const natureMetaphors = this.createNatureMetaphors(concept, Math.ceil(quantity / 3));
      metaphors.push(...natureMetaphors);
      effectivenessScores.push(
        ...natureMetaphors.map((metaphor, index) => {
          const baseScore = 0.7; // Nature metaphors are generally effective
          const words =
            metaphor && metaphor.explanation ? metaphor.explanation.split(' ').length : 10;
          const detailBonus = Math.min(words * 0.01, 0.2); // More detail = more effective
          const variation = ((index * 29) % 60) / 200; // 0-0.3 range
          return Math.min(baseScore + detailBonus + variation, 1.0);
        })
      );
      creativeProcess.push(`Created ${natureMetaphors.length} nature metaphors`);
    }

    // Technology metaphors
    if (domain === 'any' || domain === 'technology') {
      const techMetaphors = this.createTechnologyMetaphors(concept, Math.ceil(quantity / 3));
      metaphors.push(...techMetaphors);
      effectivenessScores.push(
        ...techMetaphors.map((metaphor, index) => {
          const baseScore = 0.6; // Technology metaphors moderate effectiveness
          const words =
            metaphor && metaphor.explanation ? metaphor.explanation.split(' ').length : 10;
          const detailBonus = Math.min(words * 0.01, 0.2);
          const variation = ((index * 31) % 60) / 200; // 0-0.3 range
          return Math.min(baseScore + detailBonus + variation, 0.9);
        })
      );
      creativeProcess.push(`Created ${techMetaphors.length} technology metaphors`);
    }

    // Human body metaphors
    if (domain === 'any' || domain === 'body') {
      const bodyMetaphors = this.createBodyMetaphors(concept, Math.ceil(quantity / 3));
      metaphors.push(...bodyMetaphors);
      effectivenessScores.push(
        ...bodyMetaphors.map((metaphor, index) => {
          const baseScore = 0.65; // Body metaphors good effectiveness
          const words =
            metaphor && metaphor.explanation ? metaphor.explanation.split(' ').length : 10;
          const detailBonus = Math.min(words * 0.01, 0.2);
          const variation = ((index * 33) % 60) / 200; // 0-0.3 range
          return Math.min(baseScore + detailBonus + variation, 0.95);
        })
      );
      creativeProcess.push(`Created ${bodyMetaphors.length} body metaphors`);
    }

    // Select best metaphors
    const selectedMetaphors = metaphors.slice(0, quantity);
    const selectedScores = effectivenessScores.slice(0, quantity);

    return {
      metaphors: selectedMetaphors,
      effectiveness_scores: selectedScores,
      creative_process: creativeProcess,
      confidence: 0.75,
      metaphor_analysis: {
        clarity_average: selectedScores.reduce((a, b) => a + b, 0) / selectedScores.length,
        domain_diversity: new Set(selectedMetaphors.map(m => m.domain)).size,
        conceptual_distance: this.calculateConceptualDistance(concept, selectedMetaphors),
      },
    };
  }

  // Creative technique implementations
  private applySCAMPER(topic: string): any[] {
    const scamperPrompts = [
      { action: 'Substitute', idea: `What if we substitute key elements in ${topic}?` },
      { action: 'Combine', idea: `How can we combine ${topic} with something unexpected?` },
      { action: 'Adapt', idea: `What can we adapt from other domains for ${topic}?` },
      { action: 'Modify', idea: `How can we modify the scale or attributes of ${topic}?` },
      { action: 'Put to other uses', idea: `What are alternative uses for ${topic}?` },
      { action: 'Eliminate', idea: `What happens if we remove constraints from ${topic}?` },
      { action: 'Reverse', idea: `What if we reverse the process or approach to ${topic}?` },
    ];

    return scamperPrompts.map(prompt => ({
      technique: 'SCAMPER',
      action: prompt.action,
      idea: prompt.idea,
      novelty_score: (() => {
        const baseScore = 0.6;
        const actionHash = prompt.action.charCodeAt(0) % 100;
        const ideaLength = prompt.idea.length;
        const variation = ((actionHash + ideaLength) % 100) / 250; // 0-0.4 range
        return Math.min(baseScore + variation, 1.0);
      })(),
    }));
  }

  private applyRandomWordAssociation(topic: string, count: number): any[] {
    const randomWords = [
      'ocean',
      'mirror',
      'symphony',
      'bridge',
      'garden',
      'storm',
      'diamond',
      'journey',
      'flame',
      'puzzle',
    ];
    const ideas: any[] = [];

    for (let i = 0; i < count && i < randomWords.length; i++) {
      const randomWord = randomWords[i];
      ideas.push({
        technique: 'Random Word Association',
        trigger_word: randomWord,
        idea: `Combine ${topic} with the concept of ${randomWord} - what emerges?`,
        association_strength: (() => {
          const baseScore = 0.5;
          const wordLength = randomWord.length;
          const topicLength = topic.length;
          const lengthSimilarity =
            1 - Math.abs(wordLength - topicLength) / Math.max(wordLength, topicLength);
          const strengthBonus = lengthSimilarity * 0.3;
          const variation = ((i * 17 + wordLength * 7) % 100) / 200; // 0-0.5 range
          return Math.min(baseScore + strengthBonus + variation, 1.0);
        })(),
      });
    }

    return ideas;
  }

  private applySixThinkingHats(topic: string): any[] {
    const hats = [
      { color: 'White', focus: 'Facts', idea: `What are the objective facts about ${topic}?` },
      { color: 'Red', focus: 'Emotions', idea: `What emotional responses does ${topic} evoke?` },
      {
        color: 'Black',
        focus: 'Caution',
        idea: `What are the potential risks or downsides of ${topic}?`,
      },
      {
        color: 'Yellow',
        focus: 'Optimism',
        idea: `What are the most optimistic possibilities for ${topic}?`,
      },
      {
        color: 'Green',
        focus: 'Creativity',
        idea: `What are the most creative approaches to ${topic}?`,
      },
      { color: 'Blue', focus: 'Process', idea: `How can we systematically approach ${topic}?` },
    ];

    return hats.map(hat => ({
      technique: 'Six Thinking Hats',
      hat_color: hat.color,
      focus: hat.focus,
      idea: hat.idea,
      perspective_value: (() => {
        const baseScore = 0.7;
        const colorHash = hat.color.charCodeAt(0) % 30;
        const focusLength = hat.focus.length;
        const variation = ((colorHash + focusLength) % 60) / 200; // 0-0.3 range
        return Math.min(baseScore + variation, 1.0);
      })(),
    }));
  }

  private applyMorphologicalAnalysis(topic: string, count: number): any[] {
    // Simplified morphological analysis
    const dimensions = ['form', 'function', 'material', 'scale', 'context'];
    const ideas: any[] = [];

    for (let i = 0; i < count; i++) {
      const selectedDimensions = dimensions.slice(0, 3);
      ideas.push({
        technique: 'Morphological Analysis',
        dimensions: selectedDimensions,
        idea: `Explore ${topic} by varying ${selectedDimensions.join(', ')}`,
        systematic_score: (() => {
          const baseScore = 0.6;
          const dimensionCount = selectedDimensions.length;
          const topicComplexity = topic.split(' ').length;
          const complexity = dimensionCount + topicComplexity;
          const variation = ((i * 19 + complexity * 11) % 60) / 200; // 0-0.3 range
          return Math.min(baseScore + variation, 0.9);
        })(),
      });
    }

    return ideas;
  }

  private createHybridCombinations(concept1: string, concept2: string): any[] {
    return [
      {
        type: 'hybrid',
        combination: `${concept1}-${concept2} fusion`,
        description: `A direct fusion combining the core features of both ${concept1} and ${concept2}`,
        innovation_level: this.calculateInnovationLevel(concept1, concept2, 'fusion'),
      },
      {
        type: 'hybrid',
        combination: `${concept2}-enhanced ${concept1}`,
        description: `${concept1} enhanced with key capabilities from ${concept2}`,
        innovation_level: this.calculateInnovationLevel(concept2, concept1, 'enhancement'),
      },
    ];
  }

  private createMetaphoricalCombinations(concept1: string, concept2: string): any[] {
    return [
      {
        type: 'metaphorical',
        combination: `${concept1} as ${concept2}`,
        description: `Understanding ${concept1} through the lens of ${concept2}`,
        conceptual_depth: this.calculateConceptualDepth(
          concept1,
          `Understanding ${concept1} through the lens of ${concept2}`
        ),
      },
    ];
  }

  private createFunctionalCombinations(concept1: string, concept2: string): any[] {
    return [
      {
        type: 'functional',
        combination: `${concept1} + ${concept2} workflow`,
        description: `A workflow that leverages the functions of both ${concept1} and ${concept2}`,
        practical_value: this.calculatePracticalValue(
          `A workflow that leverages the functions of both ${concept1} and ${concept2}`
        ),
      },
    ];
  }

  private identifySynergies(concept1: string, concept2: string): any[] {
    return [
      {
        synergy_type: 'complementary',
        description: `${concept1} and ${concept2} complement each other's weaknesses`,
        strength: this.calculateSynergyStrength(
          concept1,
          concept2,
          `${concept1} and ${concept2} complement each other's weaknesses`
        ),
      },
      {
        synergy_type: 'amplifying',
        description: `${concept2} amplifies the impact of ${concept1}`,
        strength: this.calculateSynergyStrength(
          concept2,
          concept1,
          `${concept2} amplifies the impact of ${concept1}`
        ),
      },
    ];
  }

  private applyLateralThinking(problem: string, constraints: string[]): any[] {
    return [
      {
        technique: 'Lateral Thinking',
        approach: 'Random Entry',
        solution: `Approach ${problem} from a completely unrelated starting point`,
        unconventionality: this.calculateUnconventionality(
          'Random Entry',
          `Approach ${problem} from a completely unrelated starting point`
        ),
      },
      {
        technique: 'Lateral Thinking',
        approach: 'Provocation',
        solution: `What if the opposite of ${problem} was the goal?`,
        unconventionality: this.calculateUnconventionality(
          'Provocation',
          `What if the opposite of ${problem} was the goal?`
        ),
      },
    ];
  }

  private applyConstraintRelaxation(problem: string, constraints: string[]): any[] {
    return constraints.map(constraint => ({
      technique: 'Constraint Relaxation',
      relaxed_constraint: constraint,
      solution: `Solve ${problem} by temporarily ignoring the constraint: ${constraint}`,
      freedom_gained: this.calculateFreedomGained(constraint),
    }));
  }

  private applyAnalogicalReasoning(problem: string): any[] {
    const analogyDomains = ['nature', 'sports', 'cooking', 'music', 'architecture'];

    return analogyDomains.slice(0, 3).map(domain => ({
      technique: 'Analogical Reasoning',
      analogy_domain: domain,
      solution: `How would ${domain} approach a problem similar to ${problem}?`,
      analogy_strength: this.calculateAnalogicalStrength(domain, problem),
    }));
  }

  private applyTRIZ(problem: string, constraints: string[]): any[] {
    const trizPrinciples = ['Segmentation', 'Taking out', 'Local quality', 'Asymmetry', 'Merging'];

    return trizPrinciples.slice(0, 3).map(principle => ({
      technique: 'TRIZ',
      principle,
      solution: `Apply ${principle} principle to solve ${problem}`,
      systematic_confidence: this.calculateSystematicConfidence(principle),
    }));
  }

  private createNatureMetaphors(concept: string, count: number): any[] {
    const natureElements = ['river', 'tree', 'ecosystem', 'mountain', 'ocean'];

    return natureElements.slice(0, count).map(element => ({
      metaphor: `${concept} is like a ${element}`,
      domain: 'nature',
      explanation: `Both ${concept} and ${element} share characteristics of growth and adaptation`,
      vividness: this.calculateMetaphorQuality(
        'nature',
        element,
        `Both ${concept} and ${element} share characteristics of growth and adaptation`
      ),
    }));
  }

  private createTechnologyMetaphors(concept: string, count: number): any[] {
    const techElements = ['network', 'algorithm', 'interface', 'database', 'circuit'];

    return techElements.slice(0, count).map(element => ({
      metaphor: `${concept} functions like a ${element}`,
      domain: 'technology',
      explanation: `${concept} processes and connects information similar to a ${element}`,
      precision: this.calculateMetaphorQuality(
        'technology',
        element,
        `${concept} processes and connects information similar to a ${element}`
      ),
    }));
  }

  private createBodyMetaphors(concept: string, count: number): any[] {
    const bodyElements = [
      'brain',
      'heart',
      'immune system',
      'nervous system',
      'circulatory system',
    ];

    return bodyElements.slice(0, count).map(element => ({
      metaphor: `${concept} works like the ${element}`,
      domain: 'body',
      explanation: `${concept} has vital functions similar to the ${element}`,
      relatability: this.calculateMetaphorQuality(
        'body',
        element,
        `${concept} has vital functions similar to the ${element}`
      ),
    }));
  }

  // Utility methods for scoring and analysis
  private selectBestIdeas(ideas: any[], quantity: number): any[] {
    return ideas
      .sort(
        (a, b) =>
          (b.novelty_score || b.innovation_level || 0.5) -
          (a.novelty_score || a.innovation_level || 0.5)
      )
      .slice(0, quantity);
  }

  private calculateNoveltyScore(ideas: any[]): number {
    const scores = ideas.map(idea => idea.novelty_score || idea.innovation_level || 0.5);
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  private calculateFeasibilityScore(ideas: any[]): number {
    // Calculate feasibility based on actual idea characteristics
    let totalFeasibility = 0;
    let validIdeas = 0;

    for (const idea of ideas) {
      // Base feasibility on complexity and resource requirements
      let feasibility = 0.6; // Base score

      // Lower complexity = higher feasibility
      if (idea.complexity !== undefined) {
        feasibility += (10 - Math.min(idea.complexity, 10)) * 0.02;
      }

      // Higher novelty slightly reduces feasibility
      if (idea.novelty_score !== undefined) {
        feasibility -= idea.novelty_score * 0.1;
      }

      // Known techniques are more feasible
      if (idea.technique && ['SCAMPER', 'analogical'].includes(idea.technique)) {
        feasibility += 0.1;
      }

      totalFeasibility += Math.min(Math.max(feasibility, 0.3), 0.9);
      validIdeas++;
    }

    return validIdeas > 0 ? totalFeasibility / validIdeas : 0.6;
  }

  private calculateDiversityScore(ideas: any[]): number {
    const techniques = new Set(ideas.map(idea => idea.technique));
    return techniques.size / 10; // Normalized diversity
  }

  private calculateCompatibilityScore(concept1: string, concept2: string): number {
    // Calculate compatibility based on concept similarity and domain overlap
    let compatibility = 0.5; // Base score

    // Analyze concept length and complexity as rough similarity measure
    const lengthDiff = Math.abs(concept1.length - concept2.length);
    compatibility += (20 - Math.min(lengthDiff, 20)) / 40; // 0 to 0.5 bonus

    // Check for common words (simple approach)
    const words1 = concept1
      .toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 2);
    const words2 = concept2
      .toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 2);
    const commonWords = words1.filter(w => words2.includes(w));
    const wordOverlap = commonWords.length / Math.max(words1.length, words2.length, 1);
    compatibility += wordOverlap * 0.3; // Up to 0.3 bonus for word overlap

    return Math.min(Math.max(compatibility, 0.2), 0.9);
  }

  private calculateInnovationPotential(combinations: any[]): number {
    const scores = combinations.map(c => c.innovation_level || c.conceptual_depth || 0.5);
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  private calculateMarketPotential(combinations: any[]): number {
    // Calculate market potential based on combination characteristics
    let totalPotential = 0;
    let validCombinations = 0;

    for (const combo of combinations) {
      let potential = 0.4; // Base market potential

      // Higher innovation level suggests better market potential
      if (combo.innovation_level !== undefined) {
        potential += combo.innovation_level * 0.3;
      }

      // Practical combinations have better market potential
      if (combo.practical_value !== undefined) {
        potential += combo.practical_value * 0.2;
      }

      // Direct fusion typically has moderate market potential
      if (combo.combination && combo.combination.includes('fusion')) {
        potential += 0.1;
      }

      totalPotential += Math.min(Math.max(potential, 0.2), 0.9);
      validCombinations++;
    }

    return validCombinations > 0 ? totalPotential / validCombinations : 0.6;
  }

  private calculateConceptualDistance(concept: string, metaphors: any[]): number {
    // Calculate average conceptual distance based on domain diversity
    if (!metaphors || metaphors.length === 0) return 0.5;

    let totalDistance = 0;
    const conceptWords = concept
      .toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 2);

    for (const metaphor of metaphors) {
      let distance = 0.3; // Base distance

      // Domain-based distance scoring
      switch (metaphor.domain) {
        case 'nature':
          distance += 0.4; // Nature metaphors are typically more distant
          break;
        case 'technology':
          distance += 0.2; // Technology metaphors are moderately distant
          break;
        case 'body':
          distance += 0.3; // Body metaphors are fairly distant
          break;
        default:
          distance += 0.25;
      }

      // Check for word overlap to adjust distance
      if (metaphor.explanation) {
        const metaphorWords = metaphor.explanation
          .toLowerCase()
          .split(/\W+/)
          .filter((w: string) => w.length > 2);
        const commonWords = conceptWords.filter((w: string) => metaphorWords.includes(w));
        const overlap = commonWords.length / Math.max(conceptWords.length, 1);
        distance -= overlap * 0.2; // Reduce distance for word overlap
      }

      totalDistance += Math.min(Math.max(distance, 0.1), 0.7);
    }

    return totalDistance / metaphors.length;
  }

  private getSupportedOperations(): string[] {
    return ['generate_ideas', 'combine_concepts', 'solve_creatively', 'create_metaphors'];
  }

  // Deterministic scoring helper methods to replace Math.random() usage

  private calculateInnovationLevel(concept1: string, concept2: string, type: string): number {
    let baseScore = 0.5;

    // Type-based scoring
    switch (type) {
      case 'fusion':
        baseScore = 0.7; // Fusions are generally more innovative
        break;
      case 'enhancement':
        baseScore = 0.6; // Enhancements are moderately innovative
        break;
      default:
        baseScore = 0.5;
    }

    // Concept distance increases innovation level
    const conceptDistance = this.calculateConceptDistance(concept1, concept2);
    const innovationBonus = conceptDistance * 0.3;

    return Math.min(Math.max(baseScore + innovationBonus, 0.3), 0.9);
  }

  private calculateConceptualDepth(concept: string, description: string): number {
    let depth = 0.4; // Base depth

    // Length and complexity indicators
    const wordCount = description.split(' ').length;
    depth += Math.min(wordCount * 0.01, 0.3); // Up to 0.3 bonus for detailed descriptions

    // Abstract concepts have more depth
    const abstractWords = [
      'understanding',
      'through',
      'lens',
      'perspective',
      'metaphor',
      'conceptual',
    ];
    const abstractCount = abstractWords.reduce(
      (count, word) => count + (description.toLowerCase().includes(word) ? 1 : 0),
      0
    );
    depth += abstractCount * 0.05;

    // Complex concepts have more depth
    const complexity = concept.split(' ').length + (concept.includes('-') ? 1 : 0);
    depth += Math.min(complexity * 0.03, 0.2);

    return Math.min(Math.max(depth, 0.2), 0.9);
  }

  private calculatePracticalValue(description: string): number {
    let value = 0.5; // Base practical value

    // Keywords indicating practical utility
    const practicalWords = [
      'workflow',
      'leverages',
      'functions',
      'process',
      'solution',
      'effective',
    ];
    const practicalCount = practicalWords.reduce(
      (count, word) => count + (description.toLowerCase().includes(word) ? 1 : 0),
      0
    );
    value += practicalCount * 0.04;

    // Specific action words indicate higher practical value
    const actionWords = ['implement', 'execute', 'apply', 'use', 'utilize'];
    const actionCount = actionWords.reduce(
      (count, word) => count + (description.toLowerCase().includes(word) ? 1 : 0),
      0
    );
    value += actionCount * 0.05;

    return Math.min(Math.max(value, 0.2), 0.8);
  }

  private calculateSynergyStrength(
    concept1: string,
    concept2: string,
    description: string
  ): number {
    let strength = 0.4; // Base strength

    // Complementary relationships are stronger
    if (description.includes('complement')) {
      strength += 0.3;
    } else if (description.includes('amplif')) {
      strength += 0.2;
    }

    // Domain similarity affects synergy strength
    const similarity = this.calculateCompatibilityScore(concept1, concept2);
    strength += (1 - similarity) * 0.3; // Dissimilar concepts can have stronger synergy

    return Math.min(Math.max(strength, 0.2), 0.8);
  }

  private calculateUnconventionality(approach: string, solution: string): number {
    let score = 0.5; // Base unconventionality

    // Specific unconventional techniques
    if (approach === 'Random Entry') {
      score += 0.3;
    } else if (approach === 'Provocation') {
      score += 0.4;
    }

    // Opposite/reverse thinking increases unconventionality
    if (solution.includes('opposite') || solution.includes('reverse')) {
      score += 0.2;
    }

    // Question format indicates unconventional thinking
    if (solution.includes('What if')) {
      score += 0.15;
    }

    return Math.min(Math.max(score, 0.3), 0.9);
  }

  private calculateFreedomGained(constraint: string): number {
    let freedom = 0.4; // Base freedom

    // Length of constraint description indicates complexity
    const complexity = constraint.split(' ').length;
    freedom += Math.min(complexity * 0.02, 0.3);

    // Certain constraint types offer more freedom when relaxed
    const restrictiveWords = ['must', 'cannot', 'forbidden', 'required', 'mandatory'];
    const restrictiveCount = restrictiveWords.reduce(
      (count, word) => count + (constraint.toLowerCase().includes(word) ? 1 : 0),
      0
    );
    freedom += restrictiveCount * 0.08;

    return Math.min(Math.max(freedom, 0.2), 0.8);
  }

  private calculateAnalogicalStrength(domain: string, problem: string): number {
    let strength = 0.4; // Base strength

    // Domain-specific adjustments
    switch (domain.toLowerCase()) {
      case 'nature':
        strength += 0.2; // Nature analogies are generally strong
        break;
      case 'sports':
        strength += 0.15; // Sports analogies are moderately strong
        break;
      case 'cooking':
        strength += 0.1; // Cooking analogies can be effective
        break;
      case 'music':
        strength += 0.25; // Musical analogies are often very strong
        break;
      case 'architecture':
        strength += 0.18; // Architectural analogies are solid
        break;
      default:
        strength += 0.1;
    }

    // Problem complexity affects analogy strength
    const problemWords = problem.split(' ').length;
    strength += Math.min(problemWords * 0.01, 0.2);

    return Math.min(Math.max(strength, 0.3), 0.8);
  }

  private calculateSystematicConfidence(principle: string): number {
    let confidence = 0.6; // Base TRIZ confidence (TRIZ is systematic)

    // Well-established TRIZ principles have higher confidence
    const establishedPrinciples = ['Segmentation', 'Asymmetry', 'Merging', 'Local quality'];
    if (establishedPrinciples.includes(principle)) {
      confidence += 0.2;
    }

    // Principle name length can indicate specificity
    confidence += Math.min(principle.length * 0.005, 0.1);

    return Math.min(Math.max(confidence, 0.4), 0.9);
  }

  private calculateMetaphorQuality(domain: string, element: string, explanation: string): number {
    let quality = 0.5; // Base quality

    // Domain-specific quality adjustments
    switch (domain) {
      case 'nature':
        quality += 0.25; // Nature metaphors tend to be vivid and relatable
        break;
      case 'technology':
        quality += 0.15; // Tech metaphors are precise but less vivid
        break;
      case 'body':
        quality += 0.2; // Body metaphors are highly relatable
        break;
    }

    // Explanation quality affects overall metaphor quality
    const explanationWords = explanation.split(' ').length;
    quality += Math.min(explanationWords * 0.008, 0.15);

    // Specific elements have different inherent quality
    const powerfulElements = ['river', 'tree', 'brain', 'heart', 'network'];
    if (powerfulElements.some(e => element.includes(e))) {
      quality += 0.1;
    }

    return Math.min(Math.max(quality, 0.3), 0.9);
  }

  private calculateConceptDistance(concept1: string, concept2: string): number {
    // Simple heuristic for concept distance based on word overlap and length
    const words1 = concept1
      .toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 2);
    const words2 = concept2
      .toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 2);

    const commonWords = words1.filter(w => words2.includes(w));
    const overlap = commonWords.length / Math.max(words1.length, words2.length, 1);

    // Higher overlap = lower distance
    return Math.max(0.1, 0.9 - overlap);
  }
}
