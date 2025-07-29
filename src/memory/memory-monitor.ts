/**
 * @fileoverview Memory Monitor for PostgreSQL Memory Store
 *
 * Provides real-time monitoring of memory usage to prevent OOM issues
 */

export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private memoryThreshold = 0.8; // 80% memory usage threshold
  private enabled = false;

  private constructor() {}

  static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }

  /**
   * Start memory monitoring
   */
  startMonitoring(intervalMs = 30000): void {
    if (this.monitoringInterval || !this.enabled) {
      return;
    }

    console.log('Starting memory monitoring...');
    this.monitoringInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, intervalMs);
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('Memory monitoring stopped');
    }
  }

  /**
   * Enable memory monitoring
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Check current memory usage
   */
  private checkMemoryUsage(): void {
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapTotal;
    const usedMemory = memoryUsage.heapUsed;
    const memoryPercent = usedMemory / totalMemory;

    if (memoryPercent > this.memoryThreshold) {
      console.warn(`High memory usage detected: ${Math.round(memoryPercent * 100)}%`);
      console.warn(
        `Used: ${Math.round(usedMemory / 1024 / 1024)}MB, Total: ${Math.round(totalMemory / 1024 / 1024)}MB`
      );

      // Force garbage collection if available
      if (global.gc) {
        console.log('Forcing garbage collection...');
        global.gc();
      }
    }
  }

  /**
   * Get current memory statistics
   */
  getMemoryStats(): {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    usagePercent: number;
  } {
    const memoryUsage = process.memoryUsage();
    return {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      rss: memoryUsage.rss,
      usagePercent: memoryUsage.heapUsed / memoryUsage.heapTotal,
    };
  }

  /**
   * Check if memory usage is above threshold
   */
  isMemoryHigh(): boolean {
    const stats = this.getMemoryStats();
    return stats.usagePercent > this.memoryThreshold;
  }

  /**
   * Set memory threshold (0-1)
   */
  setThreshold(threshold: number): void {
    if (threshold > 0 && threshold <= 1) {
      this.memoryThreshold = threshold;
    }
  }
}
