import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { TypeormInstrumentation } from '@opentelemetry/instrumentation-typeorm';
import { NodeSDK } from '@opentelemetry/sdk-node';

let sdk: NodeSDK | null = null;

export async function initTelemetry() {
  const enabled =
    (process.env.OTEL_ENABLED ?? 'false').toLowerCase() === 'true';

  if (!enabled) {
    return;
  }

  const exporter = new OTLPTraceExporter({
    url:
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
      'http://localhost:4318/v1/traces',
    headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
      ? parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS)
      : undefined,
  });

  sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'gigpayday-server',
    traceExporter: exporter,
    instrumentations: [
      getNodeAutoInstrumentations(),
      new TypeormInstrumentation(),
    ],
  });

  sdk.start();
}

export async function shutdownTelemetry() {
  if (!sdk) {
    return;
  }

  await sdk.shutdown();
  sdk = null;
}

function parseHeaders(input: string): Record<string, string> {
  // format: key1=value1,key2=value2
  return input
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, pair) => {
      const [key, ...rest] = pair.split('=');
      const value = rest.join('=').trim();
      if (!key || !value) {
        return acc;
      }
      acc[key.trim()] = value;
      return acc;
    }, {});
}
