import { env } from "@sentinel/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as controlSchema from "./schema/control";

// Control database -- system catalog, tenant registry
const controlPool = new Pool({
  connectionString: env.CONTROL_DATABASE_URL,
});

export const controlDb = drizzle({
  client: controlPool,
  schema: controlSchema,
});

// Tenant database factory -- per-tenant connections (Phase 2+)
const tenantPools: Pool[] = [];

export function createTenantDb(connectionUrl: string) {
  const pool = new Pool({ connectionString: connectionUrl });
  tenantPools.push(pool);
  return drizzle({ client: pool });
}

// Graceful shutdown -- close all database connections
export async function closeConnections(): Promise<void> {
  await controlPool.end();
  await Promise.all(tenantPools.map((pool) => pool.end()));
}
