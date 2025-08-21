import { trace, context, SpanStatusCode, Span, SpanKind } from '@opentelemetry/api';
import { DatabaseSpanAttributes } from './types.js';
import { TelemetryConfig } from './telemetry-config.js';
import { Pool } from 'pg';

export class DatabaseInstrumentation {
  private static instance: DatabaseInstrumentation;
  private tracer = trace.getTracer('database');
  private config = TelemetryConfig.getInstance();
  private queryCounter = 0;

  private constructor() {}

  public static getInstance(): DatabaseInstrumentation {
    if (!DatabaseInstrumentation.instance) {
      DatabaseInstrumentation.instance = new DatabaseInstrumentation();
    }
    return DatabaseInstrumentation.instance;
  }

  public instrumentQuery<T = any>(
    queryFn: () => Promise<T>,
    operation: string,
    statement?: string
  ): Promise<T> {
    if (!this.config.isEnabled()) {
      return queryFn();
    }

    const spanName = `db.${operation}`;
    const span = this.tracer.startSpan(spanName, {
      kind: SpanKind.CLIENT,
      attributes: {
        'db.system': 'postgresql',
        'db.name': 'map_think_do',
        'db.operation': operation,
      } as DatabaseSpanAttributes,
    });

    if (statement) {
      const sanitizedStatement = this.sanitizeStatement(statement);
      span.setAttribute('db.statement', sanitizedStatement);
    }

    this.queryCounter++;
    span.setAttribute('db.query_id', this.queryCounter);

    return context.with(trace.setSpan(context.active(), span), async () => {
      const startTime = performance.now();
      
      try {
        const result = await queryFn();
        const duration = performance.now() - startTime;
        
        span.setAttribute('db.duration_ms', duration);
        
        if (result && typeof result === 'object') {
          if ('rowCount' in result) {
            span.setAttribute('db.rows_affected', (result as any).rowCount);
          }
          if ('rows' in result && Array.isArray((result as any).rows)) {
            span.setAttribute('db.rows_returned', (result as any).rows.length);
          }
        }

        span.setStatus({ code: SpanStatusCode.OK });
        span.addEvent('db.query.completed', {
          duration_ms: duration,
          success: true,
        });
        
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorCode = (error as any).code || 'UNKNOWN';
        
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: errorMessage,
        });
        span.setAttribute('db.error_code', errorCode);
        span.addEvent('db.query.error', {
          error: errorMessage,
          error_code: errorCode,
        });
        
        throw error;
      } finally {
        span.end();
      }
    });
  }

  public instrumentPool(pool: Pool): Pool {
    if (!this.config.isEnabled()) {
      return pool;
    }

    const originalQuery = pool.query.bind(pool);
    
    pool.query = ((...args: any[]): any => {
      const [queryTextOrConfig] = args;
      
      let queryText: string;
      let operation: string = 'query';
      
      if (typeof queryTextOrConfig === 'string') {
        queryText = queryTextOrConfig;
      } else if (queryTextOrConfig && typeof queryTextOrConfig === 'object' && 'text' in queryTextOrConfig) {
        queryText = queryTextOrConfig.text;
      } else {
        queryText = 'unknown';
      }

      operation = this.extractOperation(queryText);

      return this.instrumentQuery(
        () => (originalQuery as any)(...args),
        operation,
        queryText
      );
    }) as any;

    const originalConnect = pool.connect.bind(pool);
    pool.connect = (async (...args: any[]): Promise<any> => {
      const span = this.tracer.startSpan('db.connect', {
        kind: SpanKind.CLIENT,
        attributes: {
          'db.system': 'postgresql',
          'db.name': 'map_think_do',
          'db.operation': 'connect',
        },
      });

      try {
        const client = await (originalConnect as any)(...args);
        
        span.setAttribute('db.pool.size', pool.totalCount);
        span.setAttribute('db.pool.idle', pool.idleCount);
        span.setAttribute('db.pool.waiting', pool.waitingCount);
        
        span.setStatus({ code: SpanStatusCode.OK });
        return client;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        span.end();
      }
    }) as any;

    return pool;
  }

  private sanitizeStatement(statement: string): string {
    let sanitized = statement.substring(0, 1000);
    
    sanitized = sanitized.replace(/\$\d+/g, '?');
    
    sanitized = sanitized.replace(/VALUES\s*\([^)]+\)/gi, 'VALUES (...)');
    
    sanitized = sanitized.replace(/IN\s*\([^)]+\)/gi, 'IN (...)');
    
    return sanitized;
  }

  private extractOperation(queryText: string): string {
    const normalizedQuery = queryText.trim().toUpperCase();
    
    if (normalizedQuery.startsWith('SELECT')) return 'select';
    if (normalizedQuery.startsWith('INSERT')) return 'insert';
    if (normalizedQuery.startsWith('UPDATE')) return 'update';
    if (normalizedQuery.startsWith('DELETE')) return 'delete';
    if (normalizedQuery.startsWith('CREATE')) return 'create';
    if (normalizedQuery.startsWith('DROP')) return 'drop';
    if (normalizedQuery.startsWith('ALTER')) return 'alter';
    if (normalizedQuery.startsWith('BEGIN')) return 'transaction';
    if (normalizedQuery.startsWith('COMMIT')) return 'commit';
    if (normalizedQuery.startsWith('ROLLBACK')) return 'rollback';
    
    return 'query';
  }

  public recordPoolMetrics(pool: Pool): void {
    if (!this.config.isEnabled()) return;

    const currentSpan = trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.setAttribute('db.pool.size', pool.totalCount);
      currentSpan.setAttribute('db.pool.idle', pool.idleCount);
      currentSpan.setAttribute('db.pool.waiting', pool.waitingCount);
    }

    const span = this.tracer.startSpan('db.pool.metrics', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'db.system': 'postgresql',
        'db.pool.size': pool.totalCount,
        'db.pool.idle': pool.idleCount,
        'db.pool.waiting': pool.waitingCount,
      },
    });
    span.end();
  }

  public createTransactionSpan(name: string = 'transaction'): Span {
    return this.tracer.startSpan(`db.${name}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        'db.system': 'postgresql',
        'db.name': 'map_think_do',
        'db.operation': 'transaction',
      },
    });
  }
}