/**
 * MCP-Compatible Logging Utility
 *
 * This module provides simple logging functions that are compatible with the MCP protocol.
 * All output goes to stderr via console.error to avoid interfering with stdout.
 *
 * Usage:
 * - Replace console.error('info message') with mcpLog.info('info message')
 * - Replace console.error('warning message') with mcpLog.warn('warning message')
 * - Keep console.error('actual error') as mcpLog.error('actual error')
 */

export interface McpLogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  critical(message: string, ...args: any[]): void;
}

class McpLoggerImpl implements McpLogger {
  debug(message: string, ...args: any[]): void {
    console.error(`🔍 ${message}`, ...args);
  }

  info(message: string, ...args: any[]): void {
    console.error(`ℹ️  ${message}`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.error(`⚠️  ${message}`, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`❌ ${message}`, ...args);
  }

  critical(message: string, ...args: any[]): void {
    console.error(`🚨 CRITICAL: ${message}`, ...args);
  }
}

// Export singleton instance
export const mcpLog = new McpLoggerImpl();

// Convenience functions for easier migration
export const debug = (message: string, ...args: any[]) => mcpLog.debug(message, ...args);
export const info = (message: string, ...args: any[]) => mcpLog.info(message, ...args);
export const warn = (message: string, ...args: any[]) => mcpLog.warn(message, ...args);
export const error = (message: string, ...args: any[]) => mcpLog.error(message, ...args);
export const critical = (message: string, ...args: any[]) => mcpLog.critical(message, ...args);
