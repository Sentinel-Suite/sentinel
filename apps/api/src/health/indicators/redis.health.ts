import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { HealthCheckError, HealthIndicator } from "@nestjs/terminus";
import { env } from "@sentinel/config";
import Redis from "ioredis";

@Injectable()
export class RedisHealthIndicator extends HealthIndicator implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor() {
    super();
    this.redis = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
  }

  async isHealthy() {
    try {
      await this.redis.ping();
      return this.getStatus("redis", true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Redis error";
      throw new HealthCheckError(
        "Redis check failed",
        this.getStatus("redis", false, { error: message }),
      );
    }
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
