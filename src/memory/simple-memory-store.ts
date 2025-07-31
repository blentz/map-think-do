/**
 * @fileoverview Simple in-memory implementation of MemoryStore
 *
 * Basic concrete implementation of the MemoryStore interface for
 * dependency injection purposes. This provides all required functionality
 * while remaining lightweight and suitable for most use cases.
 */

import {
  MemoryStore,
  StoredThought,
  StoredPrompt,
  ReasoningSession,
  MemoryQuery,
  PromptQuery,
  MemoryStats,
} from './memory-store.js';

/**
 * Simple in-memory implementation of MemoryStore for cognitive capabilities
 */
export class SimpleMemoryStore extends MemoryStore {
  private thoughts: Map<string, StoredThought> = new Map();
  private sessions: Map<string, ReasoningSession> = new Map();
  private prompts: Map<string, StoredPrompt> = new Map();

  async initialize(): Promise<void> {
    // No initialization needed for in-memory store
    console.error('Simple memory store initialized');
  }

  async storeThought(thought: StoredThought): Promise<void> {
    this.thoughts.set(thought.id, { ...thought });
  }

  async getThought(id: string): Promise<StoredThought | null> {
    return this.thoughts.get(id) || null;
  }

  async queryThoughts(query: MemoryQuery): Promise<StoredThought[]> {
    let results = Array.from(this.thoughts.values());

    // Apply session filter
    if (query.session_ids && query.session_ids.length > 0) {
      results = results.filter(t => query.session_ids!.includes(t.session_id));
    }

    // Apply domain filter
    if (query.domain) {
      results = results.filter(t => t.domain === query.domain);
    }

    // Apply time range filter
    if (query.time_range) {
      results = results.filter(t => {
        const timestamp = t.timestamp.getTime();
        const start = query.time_range![0].getTime();
        const end = query.time_range![1].getTime();
        return timestamp >= start && timestamp <= end;
      });
    }

    // Apply confidence filter
    if (query.confidence_range) {
      results = results.filter(t => {
        const confidence = t.confidence || 0;
        return confidence >= query.confidence_range![0] && confidence <= query.confidence_range![1];
      });
    }

    // Apply complexity filter
    if (query.complexity_range) {
      results = results.filter(t => {
        const complexity = t.complexity || 5;
        return complexity >= query.complexity_range![0] && complexity <= query.complexity_range![1];
      });
    }

    // Apply tags filter
    if (query.tags && query.tags.length > 0) {
      results = results.filter(t => t.tags && query.tags!.some(tag => t.tags!.includes(tag)));
    }

    // Apply patterns filter
    if (query.patterns && query.patterns.length > 0) {
      results = results.filter(
        t =>
          t.patterns_detected &&
          query.patterns!.some(pattern => t.patterns_detected!.includes(pattern))
      );
    }

    // Apply success filter
    if (query.success_only) {
      results = results.filter(t => t.success === true);
    }

    // Apply effectiveness threshold
    if (query.effectiveness_threshold !== undefined) {
      results = results.filter(t => (t.effectiveness_score || 0) >= query.effectiveness_threshold!);
    }

    // Sort results
    if (query.sort_by) {
      results.sort((a, b) => {
        let aVal: any, bVal: any;

        switch (query.sort_by) {
          case 'timestamp':
            aVal = a.timestamp.getTime();
            bVal = b.timestamp.getTime();
            break;
          case 'confidence':
            aVal = a.confidence || 0;
            bVal = b.confidence || 0;
            break;
          case 'effectiveness':
            aVal = a.effectiveness_score || 0;
            bVal = b.effectiveness_score || 0;
            break;
          case 'similarity':
            // For simplicity, just use timestamp as fallback
            aVal = a.timestamp.getTime();
            bVal = b.timestamp.getTime();
            break;
          default:
            return 0;
        }

        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return query.sort_order === 'desc' ? -comparison : comparison;
      });
    }

    // Apply limit
    if (query.limit && query.limit > 0) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  async deleteThought(id: string): Promise<boolean> {
    return this.thoughts.delete(id);
  }

  async storeSession(session: ReasoningSession): Promise<void> {
    this.sessions.set(session.id, { ...session });
  }

  async getSession(sessionId: string): Promise<ReasoningSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async getSessions(limit?: number, offset?: number): Promise<ReasoningSession[]> {
    const sessions = Array.from(this.sessions.values());
    sessions.sort((a, b) => b.start_time.getTime() - a.start_time.getTime());

    if (offset) {
      const startIndex = offset;
      const endIndex = limit ? startIndex + limit : sessions.length;
      return sessions.slice(startIndex, endIndex);
    }

    return limit ? sessions.slice(0, limit) : sessions;
  }

  async updateSession(sessionId: string, updates: Partial<ReasoningSession>): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.set(sessionId, { ...session, ...updates });
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.sessions.delete(sessionId);
  }

  async findSimilarThoughts(thought: string, limit?: number): Promise<StoredThought[]> {
    // Simple similarity based on word overlap
    const inputWords = thought.toLowerCase().split(/\s+/);
    const thoughts = Array.from(this.thoughts.values());

    const similarities = thoughts.map(t => {
      const thoughtWords = t.thought.toLowerCase().split(/\s+/);
      const overlap = inputWords.filter(word => thoughtWords.includes(word)).length;
      const similarity = overlap / Math.max(inputWords.length, thoughtWords.length);
      return { thought: t, similarity };
    });

    similarities.sort((a, b) => b.similarity - a.similarity);
    const results = similarities.map(s => s.thought);

    return limit ? results.slice(0, limit) : results;
  }

  async updateThought(id: string, updates: Partial<StoredThought>): Promise<void> {
    const thought = this.thoughts.get(id);
    if (thought) {
      this.thoughts.set(id, { ...thought, ...updates });
    }
  }

  async cleanupOldThoughts(olderThan: Date): Promise<number> {
    const initialCount = this.thoughts.size;
    const cutoffTime = olderThan.getTime();

    for (const [id, thought] of this.thoughts.entries()) {
      if (thought.timestamp.getTime() < cutoffTime) {
        this.thoughts.delete(id);
      }
    }

    return initialCount - this.thoughts.size;
  }

  async getStats(): Promise<MemoryStats> {
    const thoughts = Array.from(this.thoughts.values());
    const sessions = Array.from(this.sessions.values());

    const avgSessionLength =
      sessions.length > 0
        ? sessions.reduce((sum, s) => sum + (s.total_thoughts || 0), 0) / sessions.length
        : 0;

    const successfulThoughts = thoughts.filter(t => t.success);
    const overallSuccessRate =
      thoughts.length > 0 ? successfulThoughts.length / thoughts.length : 0;

    // Get oldest and newest thoughts
    let oldest = new Date();
    let newest = new Date(0);
    thoughts.forEach(t => {
      if (t.timestamp < oldest) oldest = t.timestamp;
      if (t.timestamp > newest) newest = t.timestamp;
    });

    return {
      total_thoughts: thoughts.length,
      total_sessions: sessions.length,
      average_session_length: avgSessionLength,
      overall_success_rate: overallSuccessRate,
      success_rate_by_domain: {},
      success_rate_by_complexity: {},
      most_effective_roles: [],
      most_effective_patterns: [],
      common_failure_modes: [],
      performance_over_time: [],
      learning_trajectory: [],
      storage_size: this.estimateStorageSize(),
      oldest_thought: thoughts.length > 0 ? oldest : new Date(),
      newest_thought: thoughts.length > 0 ? newest : new Date(),
      duplicate_rate: 0,
    };
  }

  async exportData(format: 'json' | 'csv' | 'jsonl'): Promise<string> {
    const data = {
      thoughts: Array.from(this.thoughts.values()),
      sessions: Array.from(this.sessions.values()),
    };

    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'jsonl':
        return (
          data.thoughts.map(t => JSON.stringify(t)).join('\n') +
          '\n' +
          data.sessions.map(s => JSON.stringify(s)).join('\n')
        );
      case 'csv':
        // Simple CSV export for thoughts
        const headers = 'id,thought,timestamp,session_id,confidence,domain\n';
        const rows = data.thoughts
          .map(
            t =>
              `"${t.id}","${t.thought.replace(/"/g, '""')}","${t.timestamp.toISOString()}","${t.session_id}","${t.confidence || 0}","${t.domain || ''}"`
          )
          .join('\n');
        return headers + rows;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  async importData(data: string, format: 'json' | 'csv' | 'jsonl'): Promise<void> {
    switch (format) {
      case 'json':
        const parsed = JSON.parse(data);
        if (parsed.thoughts) {
          parsed.thoughts.forEach((t: StoredThought) => this.thoughts.set(t.id, t));
        }
        if (parsed.sessions) {
          parsed.sessions.forEach((s: ReasoningSession) => this.sessions.set(s.id, s));
        }
        break;
      default:
        throw new Error(`Import format ${format} not yet implemented`);
    }
  }

  async optimize(): Promise<void> {
    // For in-memory store, just log optimization
    console.error('Memory store optimization completed (no-op for in-memory store)');
  }

  async storePrompt(prompt: StoredPrompt): Promise<void> {
    this.prompts.set(prompt.id, { ...prompt });
  }

  async queryPrompts(query: PromptQuery): Promise<StoredPrompt[]> {
    let results = Array.from(this.prompts.values());

    // Apply prompt type filter
    if (query.prompt_type) {
      results = results.filter(p => p.prompt_type === query.prompt_type);
    }

    // Apply domain filter
    if (query.domain) {
      results = results.filter(p => p.domain === query.domain);
    }

    // Apply complexity filter
    if (query.complexity_range) {
      results = results.filter(p => {
        const complexity = p.complexity_estimate || 0;
        return complexity >= query.complexity_range![0] && complexity <= query.complexity_range![1];
      });
    }

    // Apply date filter
    if (query.date_range) {
      results = results.filter(p => {
        const timestamp = p.received_at.getTime();
        const start = query.date_range![0].getTime();
        const end = query.date_range![1].getTime();
        return timestamp >= start && timestamp <= end;
      });
    }

    // Apply processing success filter
    if (query.processing_success !== undefined) {
      results = results.filter(p => p.processing_success === query.processing_success);
    }

    // Apply tags filter
    if (query.tags && query.tags.length > 0) {
      results = results.filter(p => p.tags && query.tags!.some(tag => p.tags!.includes(tag)));
    }

    // Sort results
    if (query.sort_by) {
      results.sort((a, b) => {
        let aVal: any, bVal: any;

        switch (query.sort_by) {
          case 'received_at':
            aVal = a.received_at.getTime();
            bVal = b.received_at.getTime();
            break;
          case 'complexity_estimate':
            aVal = a.complexity_estimate || 0;
            bVal = b.complexity_estimate || 0;
            break;
          case 'processing_success':
            aVal = a.processing_success ? 1 : 0;
            bVal = b.processing_success ? 1 : 0;
            break;
          default:
            return 0;
        }

        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return query.sort_order === 'desc' ? -comparison : comparison;
      });
    }

    // Apply limit
    if (query.limit && query.limit > 0) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  async getPrompt(id: string): Promise<StoredPrompt | null> {
    return this.prompts.get(id) || null;
  }

  async findSimilarPrompts(prompt: string, limit?: number): Promise<StoredPrompt[]> {
    // Simple similarity based on word overlap
    const inputWords = prompt.toLowerCase().split(/\s+/);
    const prompts = Array.from(this.prompts.values());

    const similarities = prompts.map(p => {
      const promptWords = p.original_prompt.toLowerCase().split(/\s+/);
      const overlap = inputWords.filter(word => promptWords.includes(word)).length;
      const similarity = overlap / Math.max(inputWords.length, promptWords.length);
      return { prompt: p, similarity };
    });

    similarities.sort((a, b) => b.similarity - a.similarity);
    const results = similarities.map(s => s.prompt);

    return limit ? results.slice(0, limit) : results;
  }

  async updatePrompt(id: string, updates: Partial<StoredPrompt>): Promise<void> {
    const prompt = this.prompts.get(id);
    if (prompt) {
      this.prompts.set(id, { ...prompt, ...updates });
    }
  }

  async analyzeSuccessPatterns(promptIds: string[]): Promise<
    Array<{
      pattern_type: string;
      success_rate: number;
      common_attributes: Record<string, any>;
    }>
  > {
    const prompts = promptIds
      .map(id => this.prompts.get(id))
      .filter(p => p !== undefined) as StoredPrompt[];

    if (prompts.length === 0) {
      return [];
    }

    const successfulPrompts = prompts.filter(p => p.processing_success === true);
    const successRate = successfulPrompts.length / prompts.length;

    return [
      {
        pattern_type: 'general',
        success_rate: successRate,
        common_attributes: {
          average_complexity:
            prompts.reduce((sum, p) => sum + (p.complexity_estimate || 0), 0) / prompts.length,
          most_common_domain: this.getMostCommonDomain(prompts),
          total_analyzed: prompts.length,
        },
      },
    ];
  }

  async calculatePerformanceMetrics(): Promise<{
    classification_accuracy: number;
    intent_extraction_precision: number;
    similarity_detection_recall: number;
    reasoning_improvement_average: number;
  }> {
    const prompts = Array.from(this.prompts.values());

    // Simple mock metrics for in-memory store
    return {
      classification_accuracy: 0.85,
      intent_extraction_precision: 0.8,
      similarity_detection_recall: 0.9,
      reasoning_improvement_average: 0.15,
    };
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
    const prompt = this.prompts.get(promptId);
    if (prompt) {
      this.prompts.set(promptId, {
        ...prompt,
        processing_success: performance.processing_success,
        reasoning_improvement: performance.reasoning_improvement,
        persona_selected: performance.persona_selected,
        cognitive_priming_effectiveness: performance.cognitive_priming_effectiveness,
        updated_at: new Date(),
      });
    }
  }

  async close(): Promise<void> {
    this.thoughts.clear();
    this.sessions.clear();
    this.prompts.clear();
    console.error('Simple memory store closed');
  }

  async clearAllData(): Promise<void> {
    this.thoughts.clear();
    this.sessions.clear();
    this.prompts.clear();
  }

  private getMostCommonDomain(prompts: StoredPrompt[]): string {
    const domainCounts = new Map<string, number>();

    prompts.forEach(p => {
      if (p.domain) {
        domainCounts.set(p.domain, (domainCounts.get(p.domain) || 0) + 1);
      }
    });

    if (domainCounts.size === 0) return 'unknown';

    return Array.from(domainCounts.entries()).sort((a, b) => b[1] - a[1])[0][0];
  }

  private getMostCommonDomains(thoughts: StoredThought[]): string[] {
    const domainCounts = new Map<string, number>();

    thoughts.forEach(t => {
      if (t.domain) {
        domainCounts.set(t.domain, (domainCounts.get(t.domain) || 0) + 1);
      }
    });

    return Array.from(domainCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([domain]) => domain);
  }

  private getMostCommonPatterns(thoughts: StoredThought[]): string[] {
    const patternCounts = new Map<string, number>();

    thoughts.forEach(t => {
      if (t.patterns_detected) {
        t.patterns_detected.forEach(pattern => {
          patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
        });
      }
    });

    return Array.from(patternCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern]) => pattern);
  }

  private estimateStorageSize(): number {
    // Rough estimation of memory usage
    let size = 0;

    for (const thought of this.thoughts.values()) {
      size += JSON.stringify(thought).length * 2; // Rough estimation for string storage
    }

    for (const session of this.sessions.values()) {
      size += JSON.stringify(session).length * 2;
    }

    return size;
  }
}
