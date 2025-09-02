import { PhoenixConfig } from './types.js';
import { createHash } from 'crypto';

export class TelemetryConfig {
  private static instance: TelemetryConfig;
  private config: PhoenixConfig;
  private samplingCounter: number = 0;

  private constructor() {
    this.config = {
      endpoint: process.env.PHOENIX_ENDPOINT || 'http://localhost:6006',
      serviceName: process.env.TELEMETRY_SERVICE_NAME || 'sentient-agi-mcp-server',
      projectName: process.env.PHOENIX_PROJECT_NAME || 'sentient-agi-reasoning',
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

  public getProjectName(): string {
    return this.config.projectName;
  }

  public updateConfig(updates: Partial<PhoenixConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  public shouldSample(identifier?: string): boolean {
    if (!this.isEnabled()) return false;

    const samplingRate = this.getSamplingRate();

    // If sampling rate is 1.0, always sample
    if (samplingRate >= 1.0) return true;

    // If sampling rate is 0.0, never sample
    if (samplingRate <= 0.0) return false;

    // Use deterministic sampling based on identifier or counter
    if (identifier) {
      // Hash-based deterministic sampling for consistent decisions on same input
      const hash = createHash('md5').update(identifier).digest('hex');
      const hashValue = parseInt(hash.substring(0, 8), 16);
      const normalizedValue = (hashValue % 1000000) / 1000000;
      return normalizedValue < samplingRate;
    } else {
      // Counter-based deterministic sampling for sequential decisions
      this.samplingCounter++;
      const threshold = Math.floor(1 / samplingRate);
      return this.samplingCounter % threshold === 0;
    }
  }
}
