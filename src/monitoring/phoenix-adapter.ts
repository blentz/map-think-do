import { trace, context, Span, SpanKind } from '@opentelemetry/api';
import { PrometheusMetricsExporter, CognitiveMetrics } from './prometheus-metrics.js';
import { PhoenixTelemetryService } from '../telemetry/phoenix-client.js';
import { TelemetryConfig } from '../telemetry/telemetry-config.js';

export class PhoenixMetricsAdapter {
  private static instance: PhoenixMetricsAdapter;
  private prometheusExporter: PrometheusMetricsExporter | null = null;
  private phoenixService: PhoenixTelemetryService;
  private config: TelemetryConfig;
  private tracer = trace.getTracer('metrics-bridge');
  private exportInterval: NodeJS.Timeout | null = null;
  private lastExportTime: number = 0;

  private constructor() {
    this.phoenixService = PhoenixTelemetryService.getInstance();
    this.config = TelemetryConfig.getInstance();
  }

  public static getInstance(): PhoenixMetricsAdapter {
    if (!PhoenixMetricsAdapter.instance) {
      PhoenixMetricsAdapter.instance = new PhoenixMetricsAdapter();
    }
    return PhoenixMetricsAdapter.instance;
  }

  public setPrometheusExporter(exporter: PrometheusMetricsExporter): void {
    this.prometheusExporter = exporter;
    console.error('🔗 Phoenix adapter connected to Prometheus exporter');
  }

  public async startMetricsBridge(intervalMs: number = 30000): Promise<void> {
    if (!this.config.isEnabled()) {
      console.error('📊 Telemetry is disabled, metrics bridge not started');
      return;
    }

    if (!this.prometheusExporter) {
      console.error('⚠️ Prometheus exporter not set, cannot start metrics bridge');
      return;
    }

    console.error(`🌉 Starting Phoenix metrics bridge (interval: ${intervalMs}ms)`);

    if (this.exportInterval) {
      clearInterval(this.exportInterval);
    }

    this.exportInterval = setInterval(async () => {
      await this.exportMetricsToPhoenix();
    }, intervalMs);

    await this.exportMetricsToPhoenix();
  }

  private async exportMetricsToPhoenix(): Promise<void> {
    if (!this.prometheusExporter || !this.phoenixService.isInitialized()) {
      return;
    }

    const span = this.tracer.startSpan('metrics.export', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'metrics.source': 'prometheus',
        'metrics.target': 'phoenix',
      },
    });

    try {
      const metrics = await this.prometheusExporter.collectCognitiveMetrics();
      
      // Run exports within the span context so child spans are properly linked
      await context.with(trace.setSpan(context.active(), span), async () => {
        this.exportCoreMetrics(metrics, span);
        this.exportPerformanceMetrics(metrics, span);
        this.exportQualityMetrics(metrics, span);
        this.exportLoadMetrics(metrics, span);
        this.exportPatternMetrics(metrics, span);
        this.exportAlertMetrics(metrics, span);
        this.exportDomainMetrics(metrics, span);
      });

      const exportCount = Object.keys(metrics).length;
      span.setAttribute('metrics.exported_count', exportCount);
      span.setAttribute('metrics.export_timestamp', new Date().toISOString());
      
      this.lastExportTime = Date.now();
      
      console.error(`📊 Exported ${exportCount} metrics to Phoenix`);
    } catch (error) {
      span.recordException(error as Error);
      console.error('❌ Error exporting metrics to Phoenix:', error);
    } finally {
      span.end();
    }
  }

  private exportCoreMetrics(metrics: CognitiveMetrics, parentSpan: Span): void {
    // Child span will be automatically linked since we're in parent context
    const span = this.tracer.startSpan('metrics.core', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'metrics.category': 'core',
      },
    });

    try {
      this.phoenixService.recordMetric('total_thoughts', metrics.total_thoughts, {
        type: 'counter',
        category: 'core',
      });

      this.phoenixService.recordMetric('total_sessions', metrics.total_sessions, {
        type: 'counter',
        category: 'core',
      });

      this.phoenixService.recordMetric('active_sessions', metrics.active_sessions, {
        type: 'gauge',
        category: 'core',
      });

      span.setAttribute('metrics.core.total_thoughts', metrics.total_thoughts);
      span.setAttribute('metrics.core.total_sessions', metrics.total_sessions);
      span.setAttribute('metrics.core.active_sessions', metrics.active_sessions);
    } finally {
      span.end();
    }
  }

  private exportPerformanceMetrics(metrics: CognitiveMetrics, parentSpan: Span): void {
    // Child span will be automatically linked since we're in parent context
    const span = this.tracer.startSpan('metrics.performance', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'metrics.category': 'performance',
      },
    });

    try {
      this.phoenixService.recordMetric('average_confidence', metrics.average_confidence, {
        type: 'gauge',
        category: 'performance',
      });

      this.phoenixService.recordMetric('success_rate', metrics.success_rate, {
        type: 'gauge',
        category: 'performance',
      });

      this.phoenixService.recordMetric('average_complexity', metrics.average_complexity, {
        type: 'gauge',
        category: 'performance',
      });

      this.phoenixService.recordMetric('thoughts_per_minute', metrics.thoughts_per_minute, {
        type: 'gauge',
        category: 'performance',
      });

      span.setAttribute('metrics.performance.average_confidence', metrics.average_confidence);
      span.setAttribute('metrics.performance.success_rate', metrics.success_rate);
      span.setAttribute('metrics.performance.average_complexity', metrics.average_complexity);
      span.setAttribute('metrics.performance.thoughts_per_minute', metrics.thoughts_per_minute);
    } finally {
      span.end();
    }
  }

  private exportQualityMetrics(metrics: CognitiveMetrics, parentSpan: Span): void {
    // Child span will be automatically linked since we're in parent context
    const span = this.tracer.startSpan('metrics.quality', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'metrics.category': 'quality',
      },
    });

    try {
      this.phoenixService.recordMetric('revision_rate', metrics.revision_rate, {
        type: 'gauge',
        category: 'quality',
      });

      this.phoenixService.recordMetric('branch_rate', metrics.branch_rate, {
        type: 'gauge',
        category: 'quality',
      });

      this.phoenixService.recordMetric('effectiveness_score', metrics.effectiveness_score, {
        type: 'gauge',
        category: 'quality',
      });

      span.setAttribute('metrics.quality.revision_rate', metrics.revision_rate);
      span.setAttribute('metrics.quality.branch_rate', metrics.branch_rate);
      span.setAttribute('metrics.quality.effectiveness_score', metrics.effectiveness_score);
    } finally {
      span.end();
    }
  }

  private exportLoadMetrics(metrics: CognitiveMetrics, parentSpan: Span): void {
    // Child span will be automatically linked since we're in parent context
    const span = this.tracer.startSpan('metrics.load', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'metrics.category': 'load',
      },
    });

    try {
      this.phoenixService.recordMetric('cognitive_load_current', metrics.cognitive_load_current, {
        type: 'gauge',
        category: 'load',
      });

      this.phoenixService.recordMetric('memory_usage_percent', metrics.memory_usage_percent, {
        type: 'gauge',
        category: 'load',
      });

      this.phoenixService.recordMetric('processing_latency_ms', metrics.processing_latency_ms, {
        type: 'gauge',
        category: 'load',
      });

      span.setAttribute('metrics.load.cognitive_load_current', metrics.cognitive_load_current);
      span.setAttribute('metrics.load.memory_usage_percent', metrics.memory_usage_percent);
      span.setAttribute('metrics.load.processing_latency_ms', metrics.processing_latency_ms);
    } finally {
      span.end();
    }
  }

  private exportPatternMetrics(metrics: CognitiveMetrics, parentSpan: Span): void {
    // Child span will be automatically linked since we're in parent context
    const span = this.tracer.startSpan('metrics.patterns', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'metrics.category': 'patterns',
      },
    });

    try {
      this.phoenixService.recordMetric('pattern_count', metrics.pattern_count, {
        type: 'gauge',
        category: 'patterns',
      });

      this.phoenixService.recordMetric('pattern_effectiveness', metrics.pattern_effectiveness, {
        type: 'gauge',
        category: 'patterns',
      });

      span.setAttribute('metrics.patterns.pattern_count', metrics.pattern_count);
      span.setAttribute('metrics.patterns.pattern_effectiveness', metrics.pattern_effectiveness);
    } finally {
      span.end();
    }
  }

  private exportAlertMetrics(metrics: CognitiveMetrics, parentSpan: Span): void {
    // Child span will be automatically linked since we're in parent context
    const span = this.tracer.startSpan('metrics.alerts', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'metrics.category': 'alerts',
      },
    });

    try {
      this.phoenixService.recordMetric('alert_count', metrics.alert_count, {
        type: 'gauge',
        category: 'alerts',
      });

      this.phoenixService.recordMetric('critical_alert_count', metrics.critical_alert_count, {
        type: 'gauge',
        category: 'alerts',
      });

      span.setAttribute('metrics.alerts.alert_count', metrics.alert_count);
      span.setAttribute('metrics.alerts.critical_alert_count', metrics.critical_alert_count);

      if (metrics.critical_alert_count > 0) {
        this.phoenixService.recordEvent('critical_alert', {
          count: metrics.critical_alert_count,
          timestamp: new Date().toISOString(),
        });
      }
    } finally {
      span.end();
    }
  }

  private exportDomainMetrics(metrics: CognitiveMetrics, parentSpan: Span): void {
    // Child span will be automatically linked since we're in parent context
    const span = this.tracer.startSpan('metrics.domains', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'metrics.category': 'domains',
      },
    });

    try {
      const activeDomainCount = metrics.active_domains.length;
      this.phoenixService.recordMetric('active_domain_count', activeDomainCount, {
        type: 'gauge',
        category: 'domains',
      });

      span.setAttribute('metrics.domains.active_count', activeDomainCount);

      for (const [domain, count] of Object.entries(metrics.domain_distribution)) {
        this.phoenixService.recordMetric('thoughts_by_domain', count, {
          type: 'gauge',
          category: 'domains',
          domain,
        });
      }
    } finally {
      span.end();
    }
  }

  public stopMetricsBridge(): void {
    if (this.exportInterval) {
      clearInterval(this.exportInterval);
      this.exportInterval = null;
      console.error('🌉 Phoenix metrics bridge stopped');
    }
  }

  public getLastExportTime(): number {
    return this.lastExportTime;
  }

  public isActive(): boolean {
    return this.exportInterval !== null;
  }
}