import { Injectable } from "@nestjs/common";
import { HealthCheckError, HealthIndicator } from "@nestjs/terminus";
import { controlDb } from "@sentinel/db";
import { sql } from "drizzle-orm";

@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  async isHealthy() {
    try {
      await controlDb.execute(sql`SELECT 1`);
      return this.getStatus("database", true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown database error";
      throw new HealthCheckError(
        "Database check failed",
        this.getStatus("database", false, { error: message }),
      );
    }
  }
}
