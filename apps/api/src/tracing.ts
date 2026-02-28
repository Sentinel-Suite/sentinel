import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

// OpenTelemetry SDK must be initialized before any NestJS imports.
// This file reads process.env directly (NOT @sentinel/config) because
// it must execute before any other imports. The env vars it needs have safe defaults.

const metricsPort = Number.parseInt(process.env.METRICS_PORT ?? "9464", 10);

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: "sentinel-api",
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318/v1/traces",
  }),
  metricReader: new PrometheusExporter({
    port: metricsPort,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Disable fs instrumentation to reduce noise
      "@opentelemetry/instrumentation-fs": { enabled: false },
    }),
  ],
});

sdk.start();

process.on("SIGTERM", () => {
  sdk
    .shutdown()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("OpenTelemetry shutdown error:", err);
      process.exit(1);
    });
});
