import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { SEMRESATTRS_PROJECT_NAME } from '@arizeai/openinference-semantic-conventions';
import { TelemetryConfig } from './telemetry-config.js';
import { PhoenixTelemetryService } from './phoenix-client.js';
import { mcpLog } from '../utils/mcp-logger.js';

let tracerProvider: NodeTracerProvider | null = null;

export async function initializeTelemetry(): Promise<void> {
  const config = TelemetryConfig.getInstance();

  if (!config.isEnabled()) {
    mcpLog.info('📊 Telemetry is disabled');
    return;
  }

  try {
    mcpLog.info('🔧 Initializing OpenTelemetry...');

    const resource = resourceFromAttributes({
      [SEMRESATTRS_SERVICE_NAME]: config.getServiceName(),
      [SEMRESATTRS_SERVICE_VERSION]: '1.0.0',
      [SEMRESATTRS_PROJECT_NAME]: config.getProjectName(),
      'service.environment': config.getEnvironment(),
      'service.instance.id': `${config.getServiceName()}-${Date.now()}`,
      'telemetry.sdk.name': 'opentelemetry',
      'telemetry.sdk.language': 'nodejs',
      'telemetry.sdk.version': '1.0.0',
    });

    const otlpExporter = new OTLPTraceExporter({
      url: config.getEndpoint(),
      headers: {},
    });

    const spanProcessor = new BatchSpanProcessor(otlpExporter, {
      maxQueueSize: 2048,
      maxExportBatchSize: 512,
      scheduledDelayMillis: 5000,
      exportTimeoutMillis: 30000,
    });

    // Create tracer provider with resource and processors
    tracerProvider = new NodeTracerProvider({
      resource,
      spanProcessors: [spanProcessor],
    });

    if (config.getEnvironment() === 'development') {
      mcpLog.debug('🔍 Adding console exporter for development');
      const consoleExporter = new ConsoleSpanExporter();
      const consoleProcessor = new SimpleSpanProcessor(consoleExporter);
      (tracerProvider as any).addSpanProcessor?.(consoleProcessor);
    }

    tracerProvider.register();

    registerInstrumentations({
      instrumentations: [],
    });

    const phoenixService = PhoenixTelemetryService.getInstance();
    await phoenixService.initialize();

    mcpLog.info('✅ OpenTelemetry initialized successfully');
    mcpLog.info(`📡 Sending traces to: ${config.getEndpoint()}`);
    mcpLog.info(`🏷️  Service name: ${config.getServiceName()}`);
    mcpLog.info(`📋 Project name: ${config.getProjectName()}`);
    mcpLog.info(`📊 Sampling rate: ${config.getSamplingRate()}`);
  } catch (error) {
    mcpLog.error('❌ Failed to initialize OpenTelemetry:', error);
    throw error;
  }
}

export async function shutdownTelemetry(): Promise<void> {
  mcpLog.info('🛑 Shutting down telemetry...');

  try {
    const phoenixService = PhoenixTelemetryService.getInstance();
    await phoenixService.shutdown();

    if (tracerProvider) {
      await tracerProvider.shutdown();
      tracerProvider = null;
    }

    mcpLog.info('✅ Telemetry shutdown complete');
  } catch (error) {
    mcpLog.error('❌ Error during telemetry shutdown:', error);
  }
}

export function getTracerProvider(): NodeTracerProvider | null {
  return tracerProvider;
}

process.on('SIGTERM', async () => {
  await shutdownTelemetry();
});

process.on('SIGINT', async () => {
  await shutdownTelemetry();
});
