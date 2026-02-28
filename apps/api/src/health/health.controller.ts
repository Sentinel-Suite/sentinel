import { Controller, Get } from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS DI requires runtime class references via emitDecoratorMetadata
import { HealthCheck, HealthCheckService, MemoryHealthIndicator } from "@nestjs/terminus";
import { env } from "@sentinel/config";
// biome-ignore lint/style/useImportType: NestJS DI requires runtime class references via emitDecoratorMetadata
import { DatabaseHealthIndicator } from "./indicators/database.health";
// biome-ignore lint/style/useImportType: NestJS DI requires runtime class references via emitDecoratorMetadata
import { RedisHealthIndicator } from "./indicators/redis.health";

@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly database: DatabaseHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get("health")
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.database.isHealthy(),
      () => this.redis.isHealthy(),
      () => this.memory.checkHeap("memory_heap", 150 * 1024 * 1024),
    ]);
  }

  @Get("system")
  async system() {
    let postgresStatus = "disconnected";
    let redisStatus = "disconnected";

    try {
      const dbResult = await this.database.isHealthy();
      if (dbResult.database?.status === "up") {
        postgresStatus = "connected";
      }
    } catch {
      postgresStatus = "disconnected";
    }

    try {
      const redisResult = await this.redis.isHealthy();
      if (redisResult.redis?.status === "up") {
        redisStatus = "connected";
      }
    } catch {
      redisStatus = "disconnected";
    }

    return {
      environment: env.NODE_ENV,
      version: "0.0.0",
      uptime: process.uptime(),
      services: {
        postgres: postgresStatus,
        redis: redisStatus,
      },
      ports: {
        api: env.API_PORT,
        web: env.WEB_PORT,
        admin: env.ADMIN_PORT,
      },
    };
  }
}
