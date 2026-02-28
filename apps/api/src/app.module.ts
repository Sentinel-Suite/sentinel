import crypto from "node:crypto";
import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { env } from "@sentinel/config";
import { OpenTelemetryModule } from "nestjs-otel";
import { LoggerModule } from "nestjs-pino";
import { CorrelationIdMiddleware } from "./common/middleware/correlation-id.middleware";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.LOG_LEVEL,
        transport:
          env.NODE_ENV !== "production"
            ? {
                target: "pino-pretty",
                options: { colorize: true, singleLine: true },
              }
            : undefined,
        genReqId: (req) => (req.headers["x-correlation-id"] as string) ?? crypto.randomUUID(),
        customProps: (req) => ({
          correlationId: req.id,
        }),
      },
    }),
    OpenTelemetryModule.forRoot({
      metrics: {
        hostMetrics: true,
        apiMetrics: { enable: true },
      },
    }),
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}
