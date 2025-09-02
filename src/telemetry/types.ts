import { Tracer, Attributes } from '@opentelemetry/api';

export interface PhoenixConfig {
  endpoint: string;
  serviceName: string;
  projectName: string;
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

export interface LLMImpactMetrics {
  thoughtLatency: number;
  tokenCount: number;
  cost: number;
  confidenceScore: number;
  breakthroughLikelihood: number;
  cognitiveEfficiency: number;
  thoughtQuality: number;
  learningVelocity: number;
  conceptualDepth: number;
  problemSolvingEffectiveness: number;
}

export interface CognitiveState {
  thought_count?: number;
  current_complexity?: number;
  confidence_trajectory?: number[];
  metacognitive_awareness?: number;
  creative_pressure?: number;
  analytical_depth?: number;
  self_doubt_level?: number;
  curiosity_level?: number;
  frustration_level?: number;
  engagement_level?: number;
  cognitive_efficiency?: number;
  insight_potential?: number;
  breakthrough_likelihood?: number;
  recent_success_rate?: number;
  improvement_trajectory?: number;
}
