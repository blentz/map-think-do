import { PhoenixConfig } from './types.js';

export class TelemetryConfig {
  private static instance: TelemetryConfig;
  private config: PhoenixConfig;

  private constructor() {
    this.config = {
      endpoint: process.env.PHOENIX_ENDPOINT || 'http://localhost:6006',
      serviceName: process.env.TELEMETRY_SERVICE_NAME || 'sentient-agi-mcp-server',
      environment: process.env.NODE_ENV || 'development',
      samplingRate: parseFloat(process.env.TELEMETRY_SAMPLING_RATE || '1.0'),
      enabled: process.env.TELEMETRY_ENABLED !== 'false',
    };
  }

  public static getInstance(): TelemetryConfig {
    if (!TelemetryConfig.instance) {
      TelemetryConfig.instance = new TelemetryConfig();
    }
    return TelemetryConfig.instance;
  }

  public getConfig(): PhoenixConfig {
    return { ...this.config };
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  public getSamplingRate(): number {
    return Math.max(0, Math.min(1, this.config.samplingRate));
  }

  public getEndpoint(): string {
    return `${this.config.endpoint}/v1/traces`;
  }

  public getServiceName(): string {
    return this.config.serviceName;
  }

  public getEnvironment(): string {
    return this.config.environment;
  }

  public updateConfig(updates: Partial<PhoenixConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  public shouldSample(): boolean {
    if (!this.isEnabled()) return false;
    return Math.random() < this.getSamplingRate();
  }
}