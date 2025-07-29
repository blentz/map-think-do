/**
 * @fileoverview Memory Store Migration Utilities
 *
 * Provides utilities for migrating data between different memory store implementations,
 * particularly from InMemoryStore to PostgreSQLMemoryStore for persistent storage.
 */

import { MemoryStore, StoredThought, ReasoningSession, MemoryQuery } from '../memory-store.js';

/**
 * Migration statistics and progress tracking
 */
export interface MigrationStats {
  thoughts: {
    total: number;
    migrated: number;
    failed: number;
    skipped: number;
  };
  sessions: {
    total: number;
    migrated: number;
    failed: number;
    skipped: number;
  };
  startTime: Date;
  endTime?: Date;
  duration?: number;
  errors: string[];
}

/**
 * Migration options for customizing the migration process
 */
export interface MigrationOptions {
  // Batch processing
  batchSize?: number;
  delayBetweenBatches?: number;

  // Data filtering
  skipOlderThan?: Date;
  includeOnlyDomains?: string[];
  excludeDomains?: string[];

  // Error handling
  continueOnError?: boolean;
  maxRetries?: number;

  // Progress reporting
  progressCallback?: (stats: MigrationStats) => void;
  progressInterval?: number;

  // Validation
  validateAfterMigration?: boolean;
  skipDuplicates?: boolean;
}

/**
 * Memory Store Migrator - handles data migration between memory stores
 */
export class MemoryStoreMigrator {
  private readonly sourceStore: MemoryStore;
  private readonly targetStore: MemoryStore;
  private readonly options: Required<MigrationOptions>;

  constructor(sourceStore: MemoryStore, targetStore: MemoryStore, options: MigrationOptions = {}) {
    this.sourceStore = sourceStore;
    this.targetStore = targetStore;

    // Set default options
    this.options = {
      batchSize: 100,
      delayBetweenBatches: 100,
      skipOlderThan: undefined,
      includeOnlyDomains: undefined,
      excludeDomains: undefined,
      continueOnError: true,
      maxRetries: 3,
      progressCallback: undefined,
      progressInterval: 1000,
      validateAfterMigration: true,
      skipDuplicates: true,
      ...options,
    } as Required<MigrationOptions>;
  }

  /**
   * Perform complete migration from source to target store
   */
  async migrate(): Promise<MigrationStats> {
    const stats: MigrationStats = {
      thoughts: { total: 0, migrated: 0, failed: 0, skipped: 0 },
      sessions: { total: 0, migrated: 0, failed: 0, skipped: 0 },
      startTime: new Date(),
      errors: [],
    };

    console.log('🚀 Starting memory store migration...');
    console.log(`Source: ${this.sourceStore.constructor.name}`);
    console.log(`Target: ${this.targetStore.constructor.name}`);

    try {
      // Migrate sessions first (thoughts reference sessions)
      console.log('📚 Migrating sessions...');
      await this.migrateSessions(stats);

      // Then migrate thoughts
      console.log('💭 Migrating thoughts...');
      await this.migrateThoughts(stats);

      // Validation
      if (this.options.validateAfterMigration) {
        console.log('✅ Validating migration...');
        await this.validateMigration(stats);
      }

      stats.endTime = new Date();
      stats.duration = stats.endTime.getTime() - stats.startTime.getTime();

      console.log('🎉 Migration completed successfully!');
      this.printMigrationSummary(stats);

      return stats;
    } catch (error) {
      stats.endTime = new Date();
      stats.duration = stats.endTime.getTime() - stats.startTime.getTime();
      stats.errors.push(
        `Migration failed: ${error instanceof Error ? error.message : String(error)}`
      );

      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Migrate all sessions from source to target
   */
  private async migrateSessions(stats: MigrationStats): Promise<void> {
    try {
      // Get all sessions from source
      const sessions = await this.sourceStore.getSessions();
      stats.sessions.total = sessions.length;

      console.log(`Found ${sessions.length} sessions to migrate`);

      // Process in batches
      for (let i = 0; i < sessions.length; i += this.options.batchSize) {
        const batch = sessions.slice(i, i + this.options.batchSize);

        for (const session of batch) {
          await this.migrateSession(session, stats);
        }

        // Progress reporting
        if (this.options.progressCallback && i % this.options.progressInterval === 0) {
          this.options.progressCallback(stats);
        }

        // Delay between batches to avoid overwhelming the target
        if (this.options.delayBetweenBatches > 0) {
          await this.delay(this.options.delayBetweenBatches);
        }
      }
    } catch (error) {
      const errorMsg = `Session migration failed: ${error instanceof Error ? error.message : String(error)}`;
      stats.errors.push(errorMsg);

      if (!this.options.continueOnError) {
        throw new Error(errorMsg);
      }
    }
  }

  /**
   * Migrate a single session with retry logic
   */
  private async migrateSession(session: ReasoningSession, stats: MigrationStats): Promise<void> {
    // Apply filters
    if (this.shouldSkipSession(session)) {
      stats.sessions.skipped++;
      return;
    }

    let retries = 0;
    while (retries <= this.options.maxRetries) {
      try {
        // Check for duplicates if requested
        if (this.options.skipDuplicates) {
          const existing = await this.targetStore.getSession(session.id);
          if (existing) {
            stats.sessions.skipped++;
            return;
          }
        }

        await this.targetStore.storeSession(session);
        stats.sessions.migrated++;
        return;
      } catch (error) {
        retries++;
        if (retries > this.options.maxRetries) {
          stats.sessions.failed++;
          const errorMsg = `Failed to migrate session ${session.id}: ${error instanceof Error ? error.message : String(error)}`;
          stats.errors.push(errorMsg);

          if (!this.options.continueOnError) {
            throw new Error(errorMsg);
          }
          return;
        }

        // Wait before retry
        await this.delay(Math.pow(2, retries) * 100);
      }
    }
  }

  /**
   * Migrate all thoughts from source to target
   */
  private async migrateThoughts(stats: MigrationStats): Promise<void> {
    try {
      // Query all thoughts in batches
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const query: MemoryQuery = {
          limit: this.options.batchSize,
          offset: offset,
          sort_by: 'timestamp',
          sort_order: 'asc',
        };

        // Apply domain filters
        if (this.options.includeOnlyDomains) {
          // Note: This would require multiple queries for each domain
          // Simplified implementation for now
        }

        const thoughts = await this.sourceStore.queryThoughts(query);

        if (thoughts.length === 0) {
          hasMore = false;
          break;
        }

        stats.thoughts.total += thoughts.length;

        for (const thought of thoughts) {
          await this.migrateThought(thought, stats);
        }

        // Progress reporting
        if (this.options.progressCallback) {
          this.options.progressCallback(stats);
        }

        // Delay between batches
        if (this.options.delayBetweenBatches > 0) {
          await this.delay(this.options.delayBetweenBatches);
        }

        offset += this.options.batchSize;
      }
    } catch (error) {
      const errorMsg = `Thought migration failed: ${error instanceof Error ? error.message : String(error)}`;
      stats.errors.push(errorMsg);

      if (!this.options.continueOnError) {
        throw new Error(errorMsg);
      }
    }
  }

  /**
   * Migrate a single thought with retry logic
   */
  private async migrateThought(thought: StoredThought, stats: MigrationStats): Promise<void> {
    // Apply filters
    if (this.shouldSkipThought(thought)) {
      stats.thoughts.skipped++;
      return;
    }

    let retries = 0;
    while (retries <= this.options.maxRetries) {
      try {
        // Check for duplicates if requested
        if (this.options.skipDuplicates) {
          const existing = await this.targetStore.getThought(thought.id);
          if (existing) {
            stats.thoughts.skipped++;
            return;
          }
        }

        await this.targetStore.storeThought(thought);
        stats.thoughts.migrated++;
        return;
      } catch (error) {
        retries++;
        if (retries > this.options.maxRetries) {
          stats.thoughts.failed++;
          const errorMsg = `Failed to migrate thought ${thought.id}: ${error instanceof Error ? error.message : String(error)}`;
          stats.errors.push(errorMsg);

          if (!this.options.continueOnError) {
            throw new Error(errorMsg);
          }
          return;
        }

        // Wait before retry
        await this.delay(Math.pow(2, retries) * 100);
      }
    }
  }

  /**
   * Validate migration by comparing counts and sampling data
   */
  private async validateMigration(stats: MigrationStats): Promise<void> {
    try {
      // Get stats from both stores
      const sourceStats = await this.sourceStore.getStats();
      const targetStats = await this.targetStore.getStats();

      // Compare totals
      const expectedThoughts = stats.thoughts.migrated;
      const expectedSessions = stats.sessions.migrated;

      if (targetStats.total_thoughts < expectedThoughts) {
        const error = `Thought count mismatch: expected ${expectedThoughts}, got ${targetStats.total_thoughts}`;
        stats.errors.push(error);
        console.warn(error);
      }

      if (targetStats.total_sessions < expectedSessions) {
        const error = `Session count mismatch: expected ${expectedSessions}, got ${targetStats.total_sessions}`;
        stats.errors.push(error);
        console.warn(error);
      }

      // Sample validation: check a few random records
      const sampleSessions = await this.sourceStore.getSessions(5);
      for (const session of sampleSessions) {
        const targetSession = await this.targetStore.getSession(session.id);
        if (!targetSession) {
          stats.errors.push(`Sample session ${session.id} not found in target`);
        }
      }

      console.log('✅ Migration validation completed');
    } catch (error) {
      const errorMsg = `Validation failed: ${error instanceof Error ? error.message : String(error)}`;
      stats.errors.push(errorMsg);
      console.warn(errorMsg);
    }
  }

  /**
   * Check if a session should be skipped based on filters
   */
  private shouldSkipSession(session: ReasoningSession): boolean {
    // Date filter
    if (this.options.skipOlderThan && session.start_time < this.options.skipOlderThan) {
      return true;
    }

    // Domain filters
    if (this.options.includeOnlyDomains && session.domain) {
      if (!this.options.includeOnlyDomains.includes(session.domain)) {
        return true;
      }
    }

    if (this.options.excludeDomains && session.domain) {
      if (this.options.excludeDomains.includes(session.domain)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a thought should be skipped based on filters
   */
  private shouldSkipThought(thought: StoredThought): boolean {
    // Date filter
    if (this.options.skipOlderThan && thought.timestamp < this.options.skipOlderThan) {
      return true;
    }

    // Domain filters
    if (this.options.includeOnlyDomains && thought.domain) {
      if (!this.options.includeOnlyDomains.includes(thought.domain)) {
        return true;
      }
    }

    if (this.options.excludeDomains && thought.domain) {
      if (this.options.excludeDomains.includes(thought.domain)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Print migration summary
   */
  private printMigrationSummary(stats: MigrationStats): void {
    console.log('\n📊 Migration Summary');
    console.log('='.repeat(50));
    console.log(`Duration: ${stats.duration}ms`);
    console.log(
      `Sessions: ${stats.sessions.migrated}/${stats.sessions.total} migrated (${stats.sessions.failed} failed, ${stats.sessions.skipped} skipped)`
    );
    console.log(
      `Thoughts: ${stats.thoughts.migrated}/${stats.thoughts.total} migrated (${stats.thoughts.failed} failed, ${stats.thoughts.skipped} skipped)`
    );

    if (stats.errors.length > 0) {
      console.log(`Errors: ${stats.errors.length}`);
      stats.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }
    console.log('='.repeat(50));
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Static method for quick migration with defaults
   */
  static async quickMigrate(
    sourceStore: MemoryStore,
    targetStore: MemoryStore,
    options: MigrationOptions = {}
  ): Promise<MigrationStats> {
    const migrator = new MemoryStoreMigrator(sourceStore, targetStore, options);
    return migrator.migrate();
  }
}

/**
 * Utility functions for common migration scenarios
 */
export class MigrationUtils {
  /**
   * Create a progress callback that logs to console
   */
  static createConsoleProgressCallback(intervalMs = 5000): (stats: MigrationStats) => void {
    let lastLog = 0;

    return (stats: MigrationStats) => {
      const now = Date.now();
      if (now - lastLog < intervalMs) return;

      const sessionsPercent =
        stats.sessions.total > 0
          ? (
              ((stats.sessions.migrated + stats.sessions.failed + stats.sessions.skipped) /
                stats.sessions.total) *
              100
            ).toFixed(1)
          : '0';

      const thoughtsPercent =
        stats.thoughts.total > 0
          ? (
              ((stats.thoughts.migrated + stats.thoughts.failed + stats.thoughts.skipped) /
                stats.thoughts.total) *
              100
            ).toFixed(1)
          : '0';

      console.log(`Progress: Sessions ${sessionsPercent}%, Thoughts ${thoughtsPercent}%`);
      lastLog = now;
    };
  }

  /**
   * Estimate migration time based on sample
   */
  static async estimateMigrationTime(
    sourceStore: MemoryStore,
    targetStore: MemoryStore,
    sampleSize = 10
  ): Promise<{ estimatedTimeMs: number; confidence: number }> {
    const startTime = Date.now();

    // Sample migration
    const sampleSessions = await sourceStore.getSessions(sampleSize);
    const sampleThoughts = await sourceStore.queryThoughts({ limit: sampleSize });

    let migratedSessions = 0;
    let migratedThoughts = 0;

    // Time session migrations
    for (const session of sampleSessions) {
      try {
        await targetStore.storeSession(session);
        migratedSessions++;
      } catch {
        // Ignore errors for estimation
      }
    }

    // Time thought migrations
    for (const thought of sampleThoughts) {
      try {
        await targetStore.storeThought(thought);
        migratedThoughts++;
      } catch {
        // Ignore errors for estimation
      }
    }

    const sampleTime = Date.now() - startTime;

    // Get total counts
    const stats = await sourceStore.getStats();
    const totalItems = stats.total_sessions + stats.total_thoughts;
    const sampleItems = migratedSessions + migratedThoughts;

    if (sampleItems === 0) {
      return { estimatedTimeMs: 0, confidence: 0 };
    }

    const timePerItem = sampleTime / sampleItems;
    const estimatedTimeMs = timePerItem * totalItems;

    // Confidence decreases with smaller sample sizes
    const confidence = Math.min(sampleItems / 20, 1);

    return { estimatedTimeMs, confidence };
  }
}
