/**
 * Thread-safe resource pool to reduce contention
 */
export class ResourcePool<T> {
  private resources: T[] = [];
  private inUse = new Set<T>();
  private waiting: Array<(resource: T) => void> = [];
  private createResource: () => T;
  private destroyResource?: (resource: T) => void;
  private maxSize: number;

  constructor(
    createResource: () => T,
    maxSize: number = 10,
    destroyResource?: (resource: T) => void
  ) {
    this.createResource = createResource;
    this.maxSize = maxSize;
    this.destroyResource = destroyResource;
  }

  async acquire(): Promise<T> {
    return new Promise((resolve) => {
      const available = this.resources.find(r => !this.inUse.has(r));
      if (available) {
        this.inUse.add(available);
        resolve(available);
        return;
      }

      if (this.resources.length < this.maxSize) {
        const newResource = this.createResource();
        this.resources.push(newResource);
        this.inUse.add(newResource);
        resolve(newResource);
        return;
      }

      this.waiting.push(resolve);
    });
  }

  release(resource: T): void {
    this.inUse.delete(resource);
    
    if (this.waiting.length > 0) {
      const waiter = this.waiting.shift()!;
      this.inUse.add(resource);
      waiter(resource);
    }
  }

  dispose(): void {
    if (this.destroyResource) {
      for (const resource of this.resources) {
        this.destroyResource(resource);
      }
    }
    this.resources.length = 0;
    this.inUse.clear();
    this.waiting.length = 0;
  }

  getStats() {
    return {
      totalResources: this.resources.length,
      inUse: this.inUse.size,
      waiting: this.waiting.length,
      available: this.resources.length - this.inUse.size
    };
  }
}