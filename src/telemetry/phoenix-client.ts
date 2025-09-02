import { TelemetryConfig } from './telemetry-config.js';
import { trace, Tracer, SpanKind } from '@opentelemetry/api';

export class PhoenixTelemetryService {
  private static instance: PhoenixTelemetryService;
  private initialized: boolean = false;
  private tracer: Tracer | null = null;
  private config: TelemetryConfig;

  private constructor() {
    this.config = TelemetryConfig.getInstance();
  }

  public static getInstance(): PhoenixTelemetryService {
    if (!PhoenixTelemetryService.instance) {
      PhoenixTelemetryService.instance = new PhoenixTelemetryService();
    }
    return PhoenixTelemetryService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!this.config.isEnabled()) {
      // Use proper logging instead of console.error for info messages
      return;
    }

    try {
      const serviceName = this.config.getServiceName();

      this.tracer = trace.getTracer(serviceName, '1.0.0');
      this.initialized = true;

      await this.testConnection();
    } catch (error) {
      // Only use console.error for actual errors, not info messages
      console.error('Failed to initialize Phoenix telemetry:', error);
      this.initialized = false;
    }
  }

  private async testConnection(): Promise<void> {
    if (!this.tracer) return;

    const span = this.tracer.startSpan('phoenix.test.connection');
    span.setAttribute('test', true);
    span.setAttribute('service.name', this.config.getServiceName());
    span.end();

    // Test connection completed - span sent to Phoenix
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public getTracer(): Tracer | null {
    return this.tracer;
  }

  public async shutdown(): Promise<void> {
    if (!this.initialized) return;

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      this.initialized = false;
      this.tracer = null;
    } catch (error) {
      console.error('Error during Phoenix telemetry shutdown:', error);
    }
  }

  public recordMetric(name: string, value: number, attributes?: Record<string, any>): void {
    if (!this.initialized || !this.tracer) return;

    // Get the active span to create a child span
    const activeSpan = trace.getActiveSpan();

    // Create span options with parent if available
    const spanOptions: any = {
      kind: SpanKind.INTERNAL,
      attributes: {
        'metric.name': name,
        'metric.value': value,
      },
    };

    // If there's an active span, make this a child span
    if (activeSpan) {
      spanOptions.parent = activeSpan.spanContext();
    }

    const span = this.tracer.startSpan(`metric.${name}`, spanOptions);

    if (attributes) {
      Object.entries(attributes).forEach(([key, val]) => {
        span.setAttribute(key, val);
      });
    }

    span.end();
  }

  public recordEvent(eventName: string, attributes?: Record<string, any>): void {
    if (!this.initialized || !this.tracer) return;

    // Get the active span to create a child span
    const activeSpan = trace.getActiveSpan();

    // Create span options with parent if available
    const spanOptions: any = {
      kind: SpanKind.INTERNAL,
      attributes: {
        'event.name': eventName,
      },
    };

    // If there's an active span, make this a child span
    if (activeSpan) {
      spanOptions.parent = activeSpan.spanContext();
    }

    const span = this.tracer.startSpan(`event.${eventName}`, spanOptions);

    if (attributes) {
      Object.entries(attributes).forEach(([key, val]) => {
        span.setAttribute(key, val);
      });
    }

    span.end();
  }
}
