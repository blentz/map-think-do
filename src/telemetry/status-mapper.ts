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
  /**
   * Maps application status to OpenTelemetry status
   */
  mapToOTelStatus(status: MCPStatusCode): OTelStatusCode {
    switch (status) {
      case MCPStatusCode.OK:
      case MCPStatusCode.PARTIAL_SUCCESS:
        return OTelStatusCode.OK;
      case MCPStatusCode.ERROR:
      case MCPStatusCode.INVALID_ARGUMENT:
      case MCPStatusCode.DEADLINE_EXCEEDED:
      case MCPStatusCode.NOT_FOUND:
      case MCPStatusCode.ALREADY_EXISTS:
      case MCPStatusCode.PERMISSION_DENIED:
      case MCPStatusCode.RESOURCE_EXHAUSTED:
      case MCPStatusCode.FAILED_PRECONDITION:
      case MCPStatusCode.ABORTED:
      case MCPStatusCode.INTERNAL:
      case MCPStatusCode.UNAVAILABLE:
      case MCPStatusCode.UNIMPLEMENTED:
        return OTelStatusCode.ERROR;
      default:
        return OTelStatusCode.UNSET;
    }
  }

  /**
   * Maps cognitive operation results to status codes
   */
  mapCognitiveStatus(result: {
    success: boolean;
    partial?: boolean;
    timeout?: boolean;
    error?: Error;
  }): MCPStatusCode {
    if (result.timeout) return MCPStatusCode.DEADLINE_EXCEEDED;
    if (result.error) return MCPStatusCode.ERROR;
    if (result.partial) return MCPStatusCode.PARTIAL_SUCCESS;
    if (result.success) return MCPStatusCode.OK;
    return MCPStatusCode.ERROR;
  }

  /**
   * Maps tool execution results to status codes
   */
  mapToolStatus(result: {
    success: boolean;
    notFound?: boolean;
    invalidInput?: boolean;
    error?: Error;
  }): MCPStatusCode {
    if (result.notFound) return MCPStatusCode.NOT_FOUND;
    if (result.invalidInput) return MCPStatusCode.INVALID_ARGUMENT;
    if (result.error) return MCPStatusCode.ERROR;
    if (result.success) return MCPStatusCode.OK;
    return MCPStatusCode.ERROR;
  }

  /**
   * Maps memory operation results to status codes
   */
  mapMemoryStatus(result: {
    success: boolean;
    notFound?: boolean;
    conflict?: boolean;
    error?: Error;
  }): MCPStatusCode {
    if (result.notFound) return MCPStatusCode.NOT_FOUND;
    if (result.conflict) return MCPStatusCode.ALREADY_EXISTS;
    if (result.error) return MCPStatusCode.ERROR;
    if (result.success) return MCPStatusCode.OK;
    return MCPStatusCode.ERROR;
  }

  /**
   * Gets human-readable message for status code
   */
  getStatusMessage(code: MCPStatusCode): string {
    const messages: Record<MCPStatusCode, string> = {
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
    return messages[code] || 'Unknown status';
  }
}
