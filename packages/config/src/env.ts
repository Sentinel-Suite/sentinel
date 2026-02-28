import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("debug"),
    CONTROL_DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    API_PORT: z.coerce.number().default(3500),
    WEB_PORT: z.coerce.number().default(3501),
    ADMIN_PORT: z.coerce.number().default(3502),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
    LOKI_URL: z.string().url().optional(),
    METRICS_PORT: z.coerce.number().default(9464),
    SENTRY_DSN: z.string().url().optional(),
    FLAGSMITH_SERVER_SIDE_KEY: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

export type Env = typeof env;
