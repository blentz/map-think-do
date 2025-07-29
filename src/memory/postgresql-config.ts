/**
 * @fileoverview PostgreSQL Configuration Management for Sentient AGI Reasoning Server
 *
 * Provides robust configuration management for PostgreSQL connections with support for:
 * - Environment-based configuration with fallbacks
 * - Connection pooling optimization
 * - Development and production environments
 * - SSL configuration and security settings
 */

import { PoolConfig } from 'pg';

/**
 * PostgreSQL configuration interface
 */
export interface PostgreSQLConfig extends PoolConfig {
  // Connection settings
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;

  // Pool configuration
  max: number;
  min: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;

  // Advanced settings
  keepAlive: boolean;
  keepAliveInitialDelayMillis: number;
  ssl: boolean | object;

  // Feature flags
  enableTimeSeries: boolean;
  enableVectorSearch: boolean;
  enableGraphQueries: boolean;

  // Performance settings
  statementTimeout: number;
  queryTimeout: number;
  lockTimeout: number;

  // Development settings
  debug: boolean;
  logQueries: boolean;
}

/**
 * Default PostgreSQL configuration values
 */
const DEFAULT_CONFIG: PostgreSQLConfig = {
  // Connection settings
  host: 'localhost',
  port: 5432,
  database: 'map_think_do',
  user: 'mtd_user',
  password: 'p4ssw0rd',

  // Pool configuration optimized for cognitive workloads and memory usage
  max: 10, // Reduced max connections to prevent OOM
  min: 2, // Minimum connections maintained
  idleTimeoutMillis: 15000, // 15 seconds idle timeout (reduced)
  connectionTimeoutMillis: 5000, // 5 seconds connection timeout (reduced)

  // Advanced connection settings
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000, // 10 seconds keep-alive delay
  ssl: false, // Disable SSL for development

  // Feature flags
  enableTimeSeries: true, // Enable TimescaleDB features
  enableVectorSearch: false, // pgvector not available by default
  enableGraphQueries: false, // Apache AGE not available by default

  // Performance settings (in milliseconds) - reduced to prevent long-running queries
  statementTimeout: 60000, // 1 minute (reduced from 5 minutes)
  queryTimeout: 30000, // 30 seconds (reduced from 1 minute)
  lockTimeout: 15000, // 15 seconds (reduced)

  // Development settings
  debug: false,
  logQueries: false,
};

/**
 * PostgreSQL configuration management class
 */
export class PostgreSQLConfigs {
  /**
   * Create configuration from environment variables with defaults
   */
  static fromEnvironment(): PostgreSQLConfig {
    const config: PostgreSQLConfig = {
      // Connection settings from environment
      host: process.env.POSTGRES_HOST || DEFAULT_CONFIG.host,
      port: parseInt(process.env.POSTGRES_PORT || String(DEFAULT_CONFIG.port), 10),
      database: process.env.POSTGRES_DB || DEFAULT_CONFIG.database,
      user: process.env.POSTGRES_USER || DEFAULT_CONFIG.user,
      password: process.env.POSTGRES_PASSWORD || DEFAULT_CONFIG.password,

      // Pool configuration
      max: parseInt(process.env.POSTGRES_POOL_MAX || String(DEFAULT_CONFIG.max), 10),
      min: parseInt(process.env.POSTGRES_POOL_MIN || String(DEFAULT_CONFIG.min), 10),
      idleTimeoutMillis: parseInt(
        process.env.POSTGRES_IDLE_TIMEOUT || String(DEFAULT_CONFIG.idleTimeoutMillis),
        10
      ),
      connectionTimeoutMillis: parseInt(
        process.env.POSTGRES_CONNECTION_TIMEOUT || String(DEFAULT_CONFIG.connectionTimeoutMillis),
        10
      ),

      // Advanced settings
      keepAlive: process.env.POSTGRES_KEEP_ALIVE !== 'false',
      keepAliveInitialDelayMillis: parseInt(
        process.env.POSTGRES_KEEP_ALIVE_DELAY || String(DEFAULT_CONFIG.keepAliveInitialDelayMillis),
        10
      ),
      ssl: this.parseSSLConfig(process.env.POSTGRES_SSL),

      // Feature flags
      enableTimeSeries: process.env.POSTGRES_ENABLE_TIMESERIES !== 'false',
      enableVectorSearch: process.env.POSTGRES_ENABLE_VECTOR === 'true',
      enableGraphQueries: process.env.POSTGRES_ENABLE_GRAPH === 'true',

      // Performance settings
      statementTimeout: parseInt(
        process.env.POSTGRES_STATEMENT_TIMEOUT || String(DEFAULT_CONFIG.statementTimeout),
        10
      ),
      queryTimeout: parseInt(
        process.env.POSTGRES_QUERY_TIMEOUT || String(DEFAULT_CONFIG.queryTimeout),
        10
      ),
      lockTimeout: parseInt(
        process.env.POSTGRES_LOCK_TIMEOUT || String(DEFAULT_CONFIG.lockTimeout),
        10
      ),

      // Development settings
      debug: process.env.POSTGRES_DEBUG === 'true',
      logQueries: process.env.POSTGRES_LOG_QUERIES === 'true',
    };

    return config;
  }

  /**
   * Create configuration for testing with isolated database
   */
  static testing(): PostgreSQLConfig {
    return {
      ...DEFAULT_CONFIG,
      database: process.env.POSTGRES_TEST_DB || 'map_think_do_test',
      max: 5, // Smaller pool for testing
      min: 1,
      debug: true,
      logQueries: true,
    };
  }

  /**
   * Create production-optimized configuration
   */
  static production(): PostgreSQLConfig {
    return {
      ...this.fromEnvironment(),
      ssl: true, // Require SSL in production
      max: 50, // Larger pool for production
      min: 10,
      debug: false,
      logQueries: false,
    };
  }

  /**
   * Parse SSL configuration from environment
   */
  private static parseSSLConfig(sslEnv?: string): boolean | object {
    if (!sslEnv || sslEnv === 'false') {
      return false;
    }

    if (sslEnv === 'true') {
      return true;
    }

    // Try to parse as JSON for advanced SSL configuration
    try {
      return JSON.parse(sslEnv);
    } catch {
      return sslEnv === 'require' || sslEnv === 'prefer';
    }
  }

  /**
   * Validate configuration and throw descriptive errors
   */
  static validate(config: PostgreSQLConfig): void {
    const errors: string[] = [];

    // Required connection settings
    if (!config.host) errors.push('host is required');
    if (!config.port || config.port < 1 || config.port > 65535) {
      errors.push('port must be between 1 and 65535');
    }
    if (!config.database) errors.push('database is required');
    if (!config.user) errors.push('user is required');
    if (!config.password) errors.push('password is required');

    // Pool configuration validation
    if (config.max < 1) errors.push('max pool size must be at least 1');
    if (config.min < 0) errors.push('min pool size cannot be negative');
    if (config.min > config.max) errors.push('min pool size cannot exceed max pool size');

    // Timeout validation
    if (config.idleTimeoutMillis < 1000) errors.push('idleTimeoutMillis should be at least 1000ms');
    if (config.connectionTimeoutMillis < 1000)
      errors.push('connectionTimeoutMillis should be at least 1000ms');
    if (config.statementTimeout < 1000) errors.push('statementTimeout should be at least 1000ms');

    if (errors.length > 0) {
      throw new Error(`PostgreSQL configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  /**
   * Create connection string from configuration
   */
  static toConnectionString(config: PostgreSQLConfig): string {
    const params = new URLSearchParams();

    // Add optional parameters
    if (config.ssl) {
      params.set('sslmode', typeof config.ssl === 'object' ? 'require' : 'require');
    }
    if ((config as any).application_name) {
      params.set('application_name', (config as any).application_name);
    }

    // Performance parameters
    params.set('statement_timeout', String(config.statementTimeout));
    params.set('lock_timeout', String(config.lockTimeout));

    const queryString = params.toString();
    const query = queryString ? `?${queryString}` : '';

    return `postgresql://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}${query}`;
  }

  /**
   * Create a safe configuration object for logging (without password)
   */
  static sanitizeForLogging(config: PostgreSQLConfig): Partial<PostgreSQLConfig> {
    const { password, ...safeConfig } = config;
    return {
      ...safeConfig,
      password: '***redacted***',
    };
  }
}

/**
 * Environment variable documentation
 */
export const ENVIRONMENT_VARIABLES = {
  // Connection settings
  POSTGRES_HOST: 'PostgreSQL server hostname (default: localhost)',
  POSTGRES_PORT: 'PostgreSQL server port (default: 5432)',
  POSTGRES_DB: 'Database name (default: map_think_do)',
  POSTGRES_USER: 'Database username (default: mtd_user)',
  POSTGRES_PASSWORD: 'Database password (default: p4ssw0rd)',

  // Pool configuration
  POSTGRES_POOL_MAX: 'Maximum connections in pool (default: 20)',
  POSTGRES_POOL_MIN: 'Minimum connections in pool (default: 5)',
  POSTGRES_IDLE_TIMEOUT: 'Idle connection timeout in ms (default: 30000)',
  POSTGRES_CONNECTION_TIMEOUT: 'Connection timeout in ms (default: 10000)',

  // Security
  POSTGRES_SSL: 'SSL configuration: false, true, or JSON object (default: false)',
  POSTGRES_KEEP_ALIVE: 'Enable TCP keep-alive (default: true)',

  // Features
  POSTGRES_ENABLE_TIMESERIES: 'Enable TimescaleDB features (default: true)',
  POSTGRES_ENABLE_VECTOR: 'Enable pgvector search (default: false)',
  POSTGRES_ENABLE_GRAPH: 'Enable Apache AGE graph queries (default: false)',

  // Performance
  POSTGRES_STATEMENT_TIMEOUT: 'Statement timeout in ms (default: 300000)',
  POSTGRES_QUERY_TIMEOUT: 'Query timeout in ms (default: 60000)',
  POSTGRES_LOCK_TIMEOUT: 'Lock timeout in ms (default: 30000)',

  // Development
  POSTGRES_DEBUG: 'Enable debug logging (default: false)',
  POSTGRES_LOG_QUERIES: 'Log all queries (default: false)',
} as const;
