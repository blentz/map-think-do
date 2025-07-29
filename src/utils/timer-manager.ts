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
  setInterval(callback: () => void, delay: number, name?: string): string {
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
      if (handle) {
        handle.lastExecuted = new Date();
        handle.executionCount++;
        try {
          callback();
        } catch (error) {
          console.error(`Timer ${id} callback error:`, error);
        }
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
  clearAll(): void {
    console.log(`🧹 Clearing ${this.timers.size} active timers...`);
    
    for (const [id, handle] of this.timers.entries()) {
      if (handle.type === 'interval') {
        clearInterval(handle.timer);
      } else {
        clearTimeout(handle.timer);
      }
      
      if (process.env.DEBUG_TIMERS) {
        console.log(`🗑️ Cleared timer: ${id} (executed ${handle.executionCount} times)`);
      }
    }

    this.timers.clear();
    console.log('✅ All timers cleared');
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
}