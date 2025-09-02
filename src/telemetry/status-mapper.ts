import { SpanStatusCode as OTelStatusCode } from '@opentelemetry/api';

export enum MCPStatusCode {
  OK = 0,
  PARTIAL_SUCCESS = 1,
  ERROR = 2,
  INVALID_ARGUMENT = 3,
  DEADLINE_EXCEEDED = 4,
  NOT_FOUND = 5,
  ALREADY_EXISTS = 6,
  PERMISSION_DENIED = 7,
  RESOURCE_EXHAUSTED = 8,
  FAILED_PRECONDITION = 9,
  ABORTED = 10,
  INTERNAL = 11,
  UNAVAILABLE = 12,
  UNIMPLEMENTED = 13,
}

export class StatusMapper {
  // Optimized lookup tables for O(1) access
  private readonly otelStatusMap: Record<MCPStatusCode, OTelStatusCode> = {
    [MCPStatusCode.OK]: OTelStatusCode.OK,
    [MCPStatusCode.PARTIAL_SUCCESS]: OTelStatusCode.OK,
    [MCPStatusCode.ERROR]: OTelStatusCode.ERROR,
    [MCPStatusCode.INVALID_ARGUMENT]: OTelStatusCode.ERROR,
    [MCPStatusCode.DEADLINE_EXCEEDED]: OTelStatusCode.ERROR,
    [MCPStatusCode.NOT_FOUND]: OTelStatusCode.ERROR,
    [MCPStatusCode.ALREADY_EXISTS]: OTelStatusCode.ERROR,
    [MCPStatusCode.PERMISSION_DENIED]: OTelStatusCode.ERROR,
    [MCPStatusCode.RESOURCE_EXHAUSTED]: OTelStatusCode.ERROR,
    [MCPStatusCode.FAILED_PRECONDITION]: OTelStatusCode.ERROR,
    [MCPStatusCode.ABORTED]: OTelStatusCode.ERROR,
    [MCPStatusCode.INTERNAL]: OTelStatusCode.ERROR,
    [MCPStatusCode.UNAVAILABLE]: OTelStatusCode.ERROR,
    [MCPStatusCode.UNIMPLEMENTED]: OTelStatusCode.ERROR,
  };

  private readonly statusMessages: Record<MCPStatusCode, string> = {
    [MCPStatusCode.OK]: 'Operation completed successfully',
    [MCPStatusCode.PARTIAL_SUCCESS]: 'Operation partially completed',
    [MCPStatusCode.ERROR]: 'Operation failed with error',
    [MCPStatusCode.INVALID_ARGUMENT]: 'Invalid input provided',
    [MCPStatusCode.DEADLINE_EXCEEDED]: 'Operation timed out',
    [MCPStatusCode.NOT_FOUND]: 'Resource not found',
    [MCPStatusCode.ALREADY_EXISTS]: 'Resource already exists',
    [MCPStatusCode.PERMISSION_DENIED]: 'Permission denied',
    [MCPStatusCode.RESOURCE_EXHAUSTED]: 'Resource limit exceeded',
    [MCPStatusCode.FAILED_PRECONDITION]: 'Precondition not met',
    [MCPStatusCode.ABORTED]: 'Operation aborted',
    [MCPStatusCode.INTERNAL]: 'Internal error occurred',
    [MCPStatusCode.UNAVAILABLE]: 'Service unavailable',
    [MCPStatusCode.UNIMPLEMENTED]: 'Operation not implemented',
  };

  // Cache for computed status mappings to avoid repeated computation
  private statusCache = new Map<string, MCPStatusCode>();
  private readonly maxCacheSize = 200;

  /**
   * Maps application status to OpenTelemetry status (O(1) lookup)
   */
  mapToOTelStatus(status: MCPStatusCode): OTelStatusCode {
    return this.otelStatusMap[status] || OTelStatusCode.UNSET;
  }

  /**
   * Maps cognitive operation results to status codes with caching
   */
  mapCognitiveStatus(result: {
    success: boolean;
    partial?: boolean;
    timeout?: boolean;
    error?: Error;
  }): MCPStatusCode {
    // Create cache key from result properties
    const cacheKey = `cognitive:${result.success}:${!!result.partial}:${!!result.timeout}:${!!result.error}`;

    if (this.statusCache.has(cacheKey)) {
      return this.statusCache.get(cacheKey)!;
    }

    let status: MCPStatusCode;
    if (result.timeout) status = MCPStatusCode.DEADLINE_EXCEEDED;
    else if (result.error) status = MCPStatusCode.ERROR;
    else if (result.partial) status = MCPStatusCode.PARTIAL_SUCCESS;
    else if (result.success) status = MCPStatusCode.OK;
    else status = MCPStatusCode.ERROR;

    this.cacheResult(cacheKey, status);
    return status;
  }

  /**
   * Maps tool execution results to status codes with caching
   */
  mapToolStatus(result: {
    success: boolean;
    notFound?: boolean;
    invalidInput?: boolean;
    error?: Error;
  }): MCPStatusCode {
    const cacheKey = `tool:${result.success}:${!!result.notFound}:${!!result.invalidInput}:${!!result.error}`;

    if (this.statusCache.has(cacheKey)) {
      return this.statusCache.get(cacheKey)!;
    }

    let status: MCPStatusCode;
    if (result.notFound) status = MCPStatusCode.NOT_FOUND;
    else if (result.invalidInput) status = MCPStatusCode.INVALID_ARGUMENT;
    else if (result.error) status = MCPStatusCode.ERROR;
    else if (result.success) status = MCPStatusCode.OK;
    else status = MCPStatusCode.ERROR;

    this.cacheResult(cacheKey, status);
    return status;
  }

  /**
   * Maps memory operation results to status codes with caching
   */
  mapMemoryStatus(result: {
    success: boolean;
    notFound?: boolean;
    conflict?: boolean;
    error?: Error;
  }): MCPStatusCode {
    const cacheKey = `memory:${result.success}:${!!result.notFound}:${!!result.conflict}:${!!result.error}`;

    if (this.statusCache.has(cacheKey)) {
      return this.statusCache.get(cacheKey)!;
    }

    let status: MCPStatusCode;
    if (result.notFound) status = MCPStatusCode.NOT_FOUND;
    else if (result.conflict) status = MCPStatusCode.ALREADY_EXISTS;
    else if (result.error) status = MCPStatusCode.ERROR;
    else if (result.success) status = MCPStatusCode.OK;
    else status = MCPStatusCode.ERROR;

    this.cacheResult(cacheKey, status);
    return status;
  }

  private cacheResult(key: string, status: MCPStatusCode): void {
    // Implement LRU eviction
    if (this.statusCache.size >= this.maxCacheSize) {
      const firstKey = this.statusCache.keys().next().value;
      if (firstKey !== undefined) {
        this.statusCache.delete(firstKey);
      }
    }
    this.statusCache.set(key, status);
  }

  /**
   * Gets human-readable message for status code (O(1) lookup)
   */
  getStatusMessage(code: MCPStatusCode): string {
    return this.statusMessages[code] || 'Unknown status';
  }

  /**
   * Enhanced error categorization for better observability
   */
  categorizeError(error: Error): {
    category: 'system' | 'user' | 'timeout' | 'resource' | 'network';
    severity: 'low' | 'medium' | 'high' | 'critical';
    statusCode: MCPStatusCode;
  } {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    // System errors
    if (
      message.includes('internal') ||
      message.includes('assert') ||
      stack.includes('node_modules')
    ) {
      return {
        category: 'system',
        severity: 'critical',
        statusCode: MCPStatusCode.INTERNAL,
      };
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('deadline')) {
      return {
        category: 'timeout',
        severity: 'medium',
        statusCode: MCPStatusCode.DEADLINE_EXCEEDED,
      };
    }

    // Resource errors
    if (message.includes('memory') || message.includes('resource') || message.includes('limit')) {
      return {
        category: 'resource',
        severity: 'high',
        statusCode: MCPStatusCode.RESOURCE_EXHAUSTED,
      };
    }

    // Network errors
    if (
      message.includes('connection') ||
      message.includes('network') ||
      message.includes('fetch')
    ) {
      return {
        category: 'network',
        severity: 'medium',
        statusCode: MCPStatusCode.UNAVAILABLE,
      };
    }

    // User/input errors
    if (
      message.includes('invalid') ||
      message.includes('argument') ||
      message.includes('parameter')
    ) {
      return {
        category: 'user',
        severity: 'low',
        statusCode: MCPStatusCode.INVALID_ARGUMENT,
      };
    }

    // Default to generic error
    return {
      category: 'system',
      severity: 'medium',
      statusCode: MCPStatusCode.ERROR,
    };
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.statusCache.size,
      maxSize: this.maxCacheSize,
      hitRate: 0, // Would need hit/miss counters for real implementation
    };
  }

  /**
   * Clear cache for memory optimization
   */
  clearCache(): void {
    this.statusCache.clear();
  }
}
