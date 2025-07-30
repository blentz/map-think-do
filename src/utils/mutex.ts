/**
 * Enhanced mutex implementation with timeout and contention monitoring
 */
export class Mutex {
  private queue: Array<{tryLock: () => void, timeout?: NodeJS.Timeout}> = [];
  private locked = false;
  private lockAcquisitionCount = 0;
  private contentionCount = 0;
  private maxQueueSize = 0;
  private currentHolder?: string;

  async lock(timeoutMs: number = 5000, holderId?: string): Promise<() => void> {
    return new Promise((resolve, reject) => {
      const tryLock = () => {
        if (!this.locked) {
          this.locked = true;
          this.lockAcquisitionCount++;
          this.currentHolder = holderId;
          resolve(() => this.unlock());
        } else {
          this.contentionCount++;
          if (this.contentionCount % 100 === 0) {
            console.warn(`🔒 High mutex contention: ${this.contentionCount} contentions, queue: ${this.queue.length}`);
          }
        }
      };

      const timeout = setTimeout(() => {
        const queueIndex = this.queue.findIndex(item => item.tryLock === tryLock);
        if (queueIndex !== -1) {
          this.queue.splice(queueIndex, 1);
        }
        reject(new Error(`Mutex timeout after ${timeoutMs}ms. Holder: ${this.currentHolder}, Queue: ${this.queue.length}`));
      }, timeoutMs);

      const queueItem = { 
        tryLock: () => {
          clearTimeout(timeout);
          tryLock();
        },
        timeout
      };
      
      this.queue.push(queueItem);
      this.maxQueueSize = Math.max(this.maxQueueSize, this.queue.length);
      
      if (this.queue.length === 1) {
        queueItem.tryLock();
      }
    });
  }

  private unlock(): void {
    this.locked = false;
    this.currentHolder = undefined;
    const current = this.queue.shift();
    
    if (current?.timeout) {
      clearTimeout(current.timeout);
    }

    if (this.queue.length > 0) {
      const next = this.queue[0];
      setImmediate(() => next.tryLock());
    }
  }

  async withLock<T>(fn: () => Promise<T>, timeoutMs: number = 5000, holderId?: string): Promise<T> {
    const unlock = await this.lock(timeoutMs, holderId);
    try {
      return await fn();
    } finally {
      unlock();
    }
  }

  getStats() {
    return {
      isLocked: this.locked,
      queueSize: this.queue.length,
      lockAcquisitionCount: this.lockAcquisitionCount,
      contentionCount: this.contentionCount,
      maxQueueSize: this.maxQueueSize,
      currentHolder: this.currentHolder
    };
  }

  resetStats() {
    this.lockAcquisitionCount = 0;
    this.contentionCount = 0;
    this.maxQueueSize = 0;
  }
}

/**
 * Enhanced mutex registry with monitoring
 */
export class MutexRegistry {
  private mutexes = new Map<string, Mutex>();
  private statsInterval?: NodeJS.Timeout;

  constructor(enableMonitoring = true) {
    if (enableMonitoring) {
      this.startMonitoring();
    }
  }

  getMutex(key: string): Mutex {
    if (!this.mutexes.has(key)) {
      this.mutexes.set(key, new Mutex());
    }
    return this.mutexes.get(key)!;
  }

  clear(): void {
    this.stopMonitoring();
    this.mutexes.clear();
  }

  getAllStats() {
    const stats: Record<string, any> = {};
    for (const [key, mutex] of this.mutexes) {
      stats[key] = mutex.getStats();
    }
    return stats;
  }

  private startMonitoring() {
    this.statsInterval = setInterval(() => {
      const allStats = this.getAllStats();
      const highContentionMutexes = Object.entries(allStats)
        .filter(([, stats]) => stats.contentionCount > 50 || stats.queueSize > 10)
        .map(([key, stats]) => ({ key, ...stats }));
      
      if (highContentionMutexes.length > 0) {
        console.warn('🚨 High mutex contention:', highContentionMutexes);
      }
    }, 30000);
  }

  private stopMonitoring() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = undefined;
    }
  }

  resetAllStats() {
    for (const mutex of this.mutexes.values()) {
      mutex.resetStats();
    }
  }
}
