/**
 * Resource lifecycle management for native objects
 * Implements automatic cleanup and tracking to prevent memory leaks
 */

import { EventEmitter } from 'events';

/**
 * Interface for native resources that need lifecycle management
 */
export interface NativeResource {
  readonly id: string;
  readonly type: string;
  cleanup(): Promise<void>;
  getMemoryUsage?(): number;
}

/**
 * Resource tracking information
 */
interface ResourceInfo {
  resource: NativeResource;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  memoryUsage?: number;
}

/**
 * Resource lifecycle manager
 */
export class ResourceLifecycleManager extends EventEmitter {
  private resources = new Map<string, ResourceInfo>();
  private cleanupInterval?: NodeJS.Timeout;
  private readonly cleanupIntervalMs: number;
  private readonly maxIdleTime: number;
  private readonly maxResources: number;

  constructor(options: {
    cleanupIntervalMs?: number;
    maxIdleTime?: number;
    maxResources?: number;
  } = {}) {
    super();
    
    this.cleanupIntervalMs = options.cleanupIntervalMs || 60000; // 1 minute
    this.maxIdleTime = options.maxIdleTime || 300000; // 5 minutes
    this.maxResources = options.maxResources || 100;
    
    this.startCleanupTimer();
  }

  /**
   * Register a native resource for lifecycle management
   */
  register(resource: NativeResource): void {
    if (this.resources.has(resource.id)) {
      console.warn(`⚠️ Resource ${resource.id} already registered, replacing`);
      this.unregister(resource.id);
    }

    const info: ResourceInfo = {
      resource,
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 1,
      memoryUsage: resource.getMemoryUsage?.()
    };

    this.resources.set(resource.id, info);
    
    // Check if we're over the limit
    if (this.resources.size > this.maxResources) {
      console.warn(`🚨 Resource limit exceeded: ${this.resources.size}/${this.maxResources}`);
      this.performEmergencyCleanup();
    }

    this.emit('resource_registered', { id: resource.id, type: resource.type });
  }

  /**
   * Unregister and cleanup a resource
   */
  async unregister(resourceId: string): Promise<void> {
    const info = this.resources.get(resourceId);
    if (!info) {
      return;
    }

    try {
      await info.resource.cleanup();
      this.resources.delete(resourceId);
      this.emit('resource_unregistered', { id: resourceId, type: info.resource.type });
    } catch (error) {
      console.error(`❌ Failed to cleanup resource ${resourceId}:`, error);
      // Still remove from tracking even if cleanup failed
      this.resources.delete(resourceId);
      this.emit('resource_cleanup_failed', { id: resourceId, error });
    }
  }

  /**
   * Mark a resource as accessed (updates last accessed time)
   */
  access(resourceId: string): void {
    const info = this.resources.get(resourceId);
    if (info) {
      info.lastAccessed = new Date();
      info.accessCount++;
      
      // Update memory usage if available
      if (info.resource.getMemoryUsage) {
        info.memoryUsage = info.resource.getMemoryUsage();
      }
    }
  }

  /**
   * Get resource statistics
   */
  getStats() {
    const now = new Date();
    const resourceStats = Array.from(this.resources.values()).map(info => ({
      id: info.resource.id,
      type: info.resource.type,
      ageMs: now.getTime() - info.createdAt.getTime(),
      idleMs: now.getTime() - info.lastAccessed.getTime(),
      accessCount: info.accessCount,
      memoryUsage: info.memoryUsage || 0
    }));

    const totalMemory = resourceStats.reduce((sum, stat) => sum + stat.memoryUsage, 0);
    const oldResources = resourceStats.filter(stat => stat.idleMs > this.maxIdleTime);

    return {
      totalResources: this.resources.size,
      totalMemoryUsage: totalMemory,
      oldResourceCount: oldResources.length,
      resourcesByType: this.getResourceCountsByType(),
      oldestResource: resourceStats.reduce((oldest, current) => 
        current.ageMs > oldest.ageMs ? current : oldest, resourceStats[0] || null
      ),
      resourceStats
    };
  }

  /**
   * Perform routine cleanup of idle resources
   */
  async performRoutineCleanup(): Promise<number> {
    const now = new Date();
    const toCleanup: string[] = [];

    for (const [id, info] of this.resources) {
      const idleTime = now.getTime() - info.lastAccessed.getTime();
      if (idleTime > this.maxIdleTime) {
        toCleanup.push(id);
      }
    }

    if (toCleanup.length > 0) {
      console.log(`🧹 Cleaning up ${toCleanup.length} idle resources`);
      
      for (const id of toCleanup) {
        await this.unregister(id);
      }
    }

    return toCleanup.length;
  }

  /**
   * Emergency cleanup when resource limit is exceeded
   */
  private async performEmergencyCleanup(): Promise<void> {
    console.error('🚨 Emergency resource cleanup initiated');
    
    // Clean up oldest 25% of resources
    const resourceEntries = Array.from(this.resources.entries());
    resourceEntries.sort((a, b) => a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime());
    
    const cleanupCount = Math.floor(resourceEntries.length * 0.25);
    const toCleanup = resourceEntries.slice(0, cleanupCount);
    
    for (const [id] of toCleanup) {
      await this.unregister(id);
    }
    
    console.error(`🧹 Emergency cleanup completed: removed ${cleanupCount} resources`);
  }

  /**
   * Dispose all resources and stop management
   */
  async dispose(): Promise<void> {
    // Stop cleanup timer
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    // Cleanup all remaining resources
    const resourceIds = Array.from(this.resources.keys());
    console.log(`🗑️ Disposing ${resourceIds.length} remaining resources`);
    
    for (const id of resourceIds) {
      await this.unregister(id);
    }

    this.removeAllListeners();
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        const cleanedUp = await this.performRoutineCleanup();
        if (cleanedUp > 0) {
          const stats = this.getStats();
          console.log(`🔄 Resource cleanup: ${cleanedUp} cleaned, ${stats.totalResources} remaining`);
        }
      } catch (error) {
        console.error('❌ Error during routine resource cleanup:', error);
      }
    }, this.cleanupIntervalMs);
  }

  /**
   * Get count of resources by type
   */
  private getResourceCountsByType(): Record<string, number> {
    const counts: Record<string, number> = {};
    
    for (const info of this.resources.values()) {
      const type = info.resource.type;
      counts[type] = (counts[type] || 0) + 1;
    }
    
    return counts;
  }
}

/**
 * Base class for native resources
 */
export abstract class ManagedNativeResource implements NativeResource {
  public readonly id: string;
  public readonly type: string;
  private disposed = false;

  constructor(type: string, id?: string) {
    this.type = type;
    this.id = id || `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if resource is disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Abstract cleanup method - must be implemented by subclasses
   */
  abstract cleanup(): Promise<void>;

  /**
   * Optional memory usage tracking
   */
  getMemoryUsage?(): number;

  /**
   * Mark resource as disposed
   */
  protected markDisposed(): void {
    this.disposed = true;
  }
}

/**
 * Global resource manager instance
 */
export const globalResourceManager = new ResourceLifecycleManager({
  cleanupIntervalMs: 60000,  // 1 minute
  maxIdleTime: 300000,       // 5 minutes
  maxResources: 200          // Maximum tracked resources
});