import { Tracer, Attributes } from '@opentelemetry/api';

export interface PhoenixConfig {
  endpoint: string;
  serviceName: string;
  environment: string;
  samplingRate: number;
  enabled: boolean;
}

export interface CognitiveSpanAttributes extends Attributes {
  'mcp.tool'?: string;
  'mcp.request_id'?: string;
  'mcp.session_id'?: string;
  'cognitive.persona'?: string;
  'cognitive.metacognitive_awareness'?: number;
  'cognitive.creative_pressure'?: number;
  'cognitive.breakthrough_likelihood'?: number;
  'cognitive.insight_potential'?: number;
  'cognitive.thought_number'?: number;
  'cognitive.total_thoughts'?: number;
  'cognitive.plugin'?: string;
  'cognitive.event_type'?: string;
  [key: string]: any;
}

export interface DatabaseSpanAttributes extends Attributes {
  'db.system': string;
  'db.name': string;
  'db.operation': string;
  'db.statement'?: string;
  'db.rows_affected'?: number;
  'db.pool.size'?: number;
  'db.pool.active'?: number;
  [key: string]: any;
}

export interface TelemetryContext {
  tracer: Tracer;
  config: PhoenixConfig;
}

export interface InstrumentationOptions {
  enabled: boolean;
  samplingRate: number;
  captureDetails: boolean;
}