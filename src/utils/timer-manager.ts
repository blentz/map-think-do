/**
 * @fileoverview Central Timer Management System
 * 
 * Prevents timer accumulation and provides coordinated cleanup for all intervals/timeouts
 * across the cognitive system to prevent memory leaks and CPU consumption issues.
 */

export interface TimerHandle {
  id: string;
  type: 'interval' | 'timeout';
  timer: NodeJS.Timeout;
  callback: () => void;
  delay: number;
  created: Date;
  lastExecuted?: Date;
  executionCount: number;
  // New fields for lifecycle management
  maxExecutions?: number;
  ttlMs?: number; // Time-to-live in milliseconds
  memoryPressureLimit?: number; // 0-1, stop when memory usage exceeds this
  streamCompleted?: boolean; // For thought stream completion
}

/**
 * Centralized timer management to prevent timer accumulation and memory leaks
 */
export class TimerManager {
  private static instance: TimerManager;
  private timers = new Map<string, TimerHandle>();
  private nextId = 1;
  private isShuttingDown = false;

  private constructor() {}

  static getInstance(): TimerManager {
    if (!TimerManager.instance) {
      TimerManager.instance = new TimerManager();
    }
    return TimerManager.instance;
  }

  /**
   * Create a managed interval that will be automatically tracked and cleaned up
   */
  setInterval(
    callback: () => void, 
    delay: number, 
    name?: string,
    options?: {
      maxExecutions?: number;
      ttlMs?: number;
      memoryPressureLimit?: number;
    }
  ): string {
    if (this.isShuttingDown) {
      console.warn('Timer manager is shutting down, ignoring setInterval request');
      return '';
    }

    const id = name || `interval_${this.nextId++}`;
    
    // Clear any existing timer with the same name
    if (this.timers.has(id)) {
      this.clearTimer(id);
    }

    const wrappedCallback = () => {
      const handle = this.timers.get(id);
      if (!handle) return;
      
      // Check if timer should be terminated before execution
      if (this.shouldTerminateTimer(handle)) {
        console.log(`🕐 Auto-terminating timer: ${id} (${this.getTerminationReason(handle)})`);
        this.clearTimer(id);
        return;
      }
      
      handle.lastExecuted = new Date();
      handle.executionCount++;
      
      try {
        callback();
      } catch (error) {
        console.error(`Timer ${id} callback error:`, error);
      }
      
      // Check termination conditions after execution
      if (this.shouldTerminateTimer(handle)) {
        console.log(`🕐 Auto-terminating timer: ${id} (${this.getTerminationReason(handle)})`);
        this.clearTimer(id);
      }
    };

    const timer = setInterval(wrappedCallback, delay);
    
    const handle: TimerHandle = {
      id,
      type: 'interval',
      timer,
      callback,
      delay,
      created: new Date(),
      executionCount: 0,
      maxExecutions: options?.maxExecutions,
      ttlMs: options?.ttlMs,
      memoryPressureLimit: options?.memoryPressureLimit,
      streamCompleted: false,
    };

    this.timers.set(id, handle);
    
    if (process.env.DEBUG_TIMERS) {
      console.log(`🕐 Timer created: ${id} (${delay}ms interval)`);
    }

    return id;
  }

  /**
   * Create a managed timeout that will be automatically tracked and cleaned up
   */
  setTimeout(callback: () => void, delay: number, name?: string): string {
    if (this.isShuttingDown) {
      console.warn('Timer manager is shutting down, ignoring setTimeout request');
      return '';
    }

    const id = name || `timeout_${this.nextId++}`;
    
    // Clear any existing timer with the same name
    if (this.timers.has(id)) {
      this.clearTimer(id);
    }

    const wrappedCallback = () => {
      const handle = this.timers.get(id);
      if (handle) {
        handle.lastExecuted = new Date();
        handle.executionCount++;
        // Remove timeout after execution
        this.timers.delete(id);
        try {
          callback();
        } catch (error) {
          console.error(`Timer ${id} callback error:`, error);
        }
      }
    };

    const timer = setTimeout(wrappedCallback, delay);
    
    const handle: TimerHandle = {
      id,
      type: 'timeout',
      timer,
      callback,
      delay,
      created: new Date(),
      executionCount: 0,
    };

    this.timers.set(id, handle);
    
    if (process.env.DEBUG_TIMERS) {
      console.log(`⏰ Timeout created: ${id} (${delay}ms)`);
    }

    return id;
  }

  /**
   * Clear a specific timer by ID
   */
  clearTimer(id: string): boolean {
    const handle = this.timers.get(id);
    if (!handle) {
      return false;
    }

    if (handle.type === 'interval') {
      clearInterval(handle.timer);
    } else {
      clearTimeout(handle.timer);
    }

    this.timers.delete(id);
    
    if (process.env.DEBUG_TIMERS) {
      console.log(`🗑️ Timer cleared: ${id}`);
    }

    return true;
  }

  /**
   * Clear all timers (for shutdown)
   */
  clearAll(reason = 'shutdown'): void {
    console.log(`🧹 Clearing ${this.timers.size} active timers (${reason})...`);
    
    let clearedCount = 0;
    let errorCount = 0;
    
    for (const [id, handle] of this.timers.entries()) {
      try {
        if (handle.type === 'interval') {
          clearInterval(handle.timer);
        } else {
          clearTimeout(handle.timer);
        }
        clearedCount++;
        
        if (process.env.DEBUG_TIMERS) {
          console.log(`🗑️ Cleared timer: ${id} (executed ${handle.executionCount} times)`);
        }
      } catch (error) {
        errorCount++;
        console.warn(`⚠️ Error clearing timer ${id}:`, error);
      }
    }

    this.timers.clear();
    
    if (errorCount > 0) {
      console.log(`✅ Timers cleared: ${clearedCount} successful, ${errorCount} errors`);
    } else {
      console.log(`✅ All ${clearedCount} timers cleared successfully`);
    }
  }

  /**
   * Get statistics about active timers
   */
  getStats(): {
    totalTimers: number;
    intervals: number;
    timeouts: number;
    oldestTimer: Date | null;
    totalExecutions: number;
  } {
    let intervals = 0;
    let timeouts = 0;
    let totalExecutions = 0;
    let oldestTimer: Date | null = null;

    for (const handle of this.timers.values()) {
      if (handle.type === 'interval') {
        intervals++;
      } else {
        timeouts++;
      }
      
      totalExecutions += handle.executionCount;
      
      if (!oldestTimer || handle.created < oldestTimer) {
        oldestTimer = handle.created;
      }
    }

    return {
      totalTimers: this.timers.size,
      intervals,
      timeouts,
      oldestTimer,
      totalExecutions,
    };
  }

  /**
   * Get detailed information about all active timers
   */
  getActiveTimers(): TimerHandle[] {
    return Array.from(this.timers.values());
  }

  /**
   * Find potentially problematic timers (old or high execution count)
   */
  findProblematicTimers(): {
    longRunning: TimerHandle[];
    highExecution: TimerHandle[];
  } {
    const now = new Date();
    const longRunningThreshold = 5 * 60 * 1000; // 5 minutes
    const highExecutionThreshold = 1000;

    const longRunning: TimerHandle[] = [];
    const highExecution: TimerHandle[] = [];

    for (const handle of this.timers.values()) {
      const age = now.getTime() - handle.created.getTime();
      
      if (age > longRunningThreshold) {
        longRunning.push(handle);
      }
      
      if (handle.executionCount > highExecutionThreshold) {
        highExecution.push(handle);
      }
    }

    return { longRunning, highExecution };
  }

  /**
   * Prepare for shutdown - stop accepting new timers
   */
  prepareShutdown(): void {
    this.isShuttingDown = true;
    console.log('🔄 Timer manager preparing for shutdown...');
    
    // Automatically start cleanup process after a brief delay
    setTimeout(() => {
      if (this.timers.size > 0) {
        console.log(`⚠️ Force clearing ${this.timers.size} remaining timers during shutdown`);
        this.clearAll('forced_shutdown');
      }
    }, 1000); // Give 1 second for graceful cleanup
  }

  /**
   * Emergency cleanup when memory pressure is high
   */
  emergencyCleanup(): void {
    console.warn('🚨 Emergency timer cleanup due to memory pressure');
    
    const stats = this.getStats();
    const problematicTimers = this.findProblematicTimers();
    
    // Clear long-running timers first
    for (const timer of problematicTimers.longRunning) {
      console.warn(`🗑️ Emergency clearing long-running timer: ${timer.id}`);
      this.clearTimer(timer.id);
    }
    
    // Clear high-execution timers
    for (const timer of problematicTimers.highExecution) {
      console.warn(`🗑️ Emergency clearing high-execution timer: ${timer.id}`);
      this.clearTimer(timer.id);
    }
    
    // If still too many timers, clear all intervals (keep timeouts)
    if (this.timers.size > 10) {
      const intervalIds = Array.from(this.timers.entries())
        .filter(([_, handle]) => handle.type === 'interval')
        .map(([id]) => id);
        
      console.warn(`🗑️ Emergency clearing ${intervalIds.length} intervals`);
      intervalIds.forEach(id => this.clearTimer(id));
    }
    
    console.log(`✅ Emergency cleanup complete. Remaining timers: ${this.timers.size}`);
  }

  /**
   * Force garbage collection if available
   */
  forceGC(): void {
    if (global.gc) {
      console.log('🗑️ Forcing garbage collection...');
      global.gc();
    }
  }

  /**
   * Log current timer status (for debugging)
   */
  logStatus(): void {
    const stats = this.getStats();
    const problematic = this.findProblematicTimers();

    console.log('🕐 Timer Manager Status:');
    console.log(`  Active timers: ${stats.totalTimers} (${stats.intervals} intervals, ${stats.timeouts} timeouts)`);
    console.log(`  Total executions: ${stats.totalExecutions}`);
    console.log(`  Oldest timer: ${stats.oldestTimer?.toISOString() || 'none'}`);
    
    if (problematic.longRunning.length > 0) {
      console.warn(`  ⚠️ Long-running timers: ${problematic.longRunning.length}`);
      problematic.longRunning.forEach(t => {
        const age = (Date.now() - t.created.getTime()) / 1000;
        console.warn(`    - ${t.id}: ${age.toFixed(1)}s old, ${t.executionCount} executions`);
      });
    }
    
    if (problematic.highExecution.length > 0) {
      console.warn(`  ⚠️ High-execution timers: ${problematic.highExecution.length}`);
      problematic.highExecution.forEach(t => {
        console.warn(`    - ${t.id}: ${t.executionCount} executions`);
      });
    }
  }

  /**
   * Check if a timer should be terminated based on its lifecycle conditions
   */
  private shouldTerminateTimer(handle: TimerHandle): boolean {
    const now = Date.now();
    
    // Check execution count limit
    if (handle.maxExecutions && handle.executionCount >= handle.maxExecutions) {
      return true;
    }
    
    // Check TTL (time-to-live)
    if (handle.ttlMs && (now - handle.created.getTime()) >= handle.ttlMs) {
      return true;
    }
    
    // Check memory pressure limit
    if (handle.memoryPressureLimit && this.getCurrentMemoryPressure() > handle.memoryPressureLimit) {
      return true;
    }
    
    // Check if stream is completed
    if (handle.streamCompleted) {
      return true;
    }
    
    return false;
  }

  /**
   * Get the reason why a timer would be terminated
   */
  private getTerminationReason(handle: TimerHandle): string {
    const now = Date.now();
    
    if (handle.maxExecutions && handle.executionCount >= handle.maxExecutions) {
      return `max executions reached (${handle.executionCount}/${handle.maxExecutions})`;
    }
    
    if (handle.ttlMs && (now - handle.created.getTime()) >= handle.ttlMs) {
      const ageSeconds = Math.round((now - handle.created.getTime()) / 1000);
      return `TTL expired (${ageSeconds}s/${Math.round(handle.ttlMs/1000)}s)`;
    }
    
    if (handle.memoryPressureLimit) {
      const currentPressure = this.getCurrentMemoryPressure();
      if (currentPressure > handle.memoryPressureLimit) {
        return `memory pressure limit (${(currentPressure*100).toFixed(1)}% > ${(handle.memoryPressureLimit*100).toFixed(1)}%)`;
      }
    }
    
    if (handle.streamCompleted) {
      return 'stream completed';
    }
    
    return 'unknown';
  }

  /**
   * Get current memory pressure (0-1 scale)
   */
  private getCurrentMemoryPressure(): number {
    try {
      const memUsage = process.memoryUsage();
      return memUsage.heapUsed / memUsage.heapTotal;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Mark a timer's stream as completed, triggering auto-cleanup
   */
  markStreamCompleted(timerId: string): boolean {
    const handle = this.timers.get(timerId);
    if (!handle) return false;
    
    handle.streamCompleted = true;
    
    if (process.env.DEBUG_TIMERS) {
      console.log(`🏁 Stream completed for timer: ${timerId}`);
    }
    
    return true;
  }

  /**
   * Update timer lifecycle parameters at runtime
   */
  updateTimerLifecycle(
    timerId: string, 
    updates: {
      maxExecutions?: number;
      ttlMs?: number;
      memoryPressureLimit?: number;
    }
  ): boolean {
    const handle = this.timers.get(timerId);
    if (!handle) return false;
    
    if (updates.maxExecutions !== undefined) {
      handle.maxExecutions = updates.maxExecutions;
    }
    if (updates.ttlMs !== undefined) {
      handle.ttlMs = updates.ttlMs;
    }
    if (updates.memoryPressureLimit !== undefined) {
      handle.memoryPressureLimit = updates.memoryPressureLimit;
    }
    
    return true;
  }
}