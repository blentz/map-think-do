import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor, ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { SEMRESATTRS_PROJECT_NAME } from '@arizeai/openinference-semantic-conventions';
import { TelemetryConfig } from './telemetry-config.js';
import { PhoenixTelemetryService } from './phoenix-client.js';

let tracerProvider: NodeTracerProvider | null = null;

export async function initializeTelemetry(): Promise<void> {
  const config = TelemetryConfig.getInstance();
  
  if (!config.isEnabled()) {
    console.error('📊 Telemetry is disabled');
    return;
  }

  try {
    console.error('🔧 Initializing OpenTelemetry...');
    
    const resource = resourceFromAttributes({
      [SEMRESATTRS_SERVICE_NAME]: config.getServiceName(),
      [SEMRESATTRS_SERVICE_VERSION]: '1.0.0',
      [SEMRESATTRS_PROJECT_NAME]: 'sentient-agi-reasoning',
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
      console.error('🔍 Adding console exporter for development');
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

    console.error('✅ OpenTelemetry initialized successfully');
    console.error(`📡 Sending traces to: ${config.getEndpoint()}`);
    console.error(`🏷️  Service name: ${config.getServiceName()}`);
    console.error(`📊 Sampling rate: ${config.getSamplingRate()}`);
    
  } catch (error) {
    console.error('❌ Failed to initialize OpenTelemetry:', error);
    throw error;
  }
}

export async function shutdownTelemetry(): Promise<void> {
  console.error('🛑 Shutting down telemetry...');
  
  try {
    const phoenixService = PhoenixTelemetryService.getInstance();
    await phoenixService.shutdown();
    
    if (tracerProvider) {
      await tracerProvider.shutdown();
      tracerProvider = null;
    }
    
    console.error('✅ Telemetry shutdown complete');
  } catch (error) {
    console.error('❌ Error during telemetry shutdown:', error);
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