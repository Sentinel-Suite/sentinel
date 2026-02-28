# Phase 1: Monorepo Foundation - Research

**Researched:** 2026-02-28
**Domain:** Nx monorepo scaffolding, NestJS API, Next.js frontends, Docker dev environment, observability, tooling
**Confidence:** HIGH

## Summary

Phase 1 establishes the entire developer experience foundation for Sentinel Suite: an Nx monorepo with pnpm workspaces hosting NestJS (API), Next.js (web + admin), stub apps (worker + docs), shared packages, Docker Compose local infrastructure, structured logging with Pino, a full observability stack (Grafana + Loki + Prometheus + Jaeger), and Biome-based linting/formatting.

The ecosystem is mature and well-documented. Nx 22 (current stable) supports pnpm workspaces natively with `@nx/nest` and `@nx/next` plugins that infer build/dev/serve tasks automatically. NestJS 11 (current stable) integrates cleanly with `nestjs-pino` for request-scoped structured logging with correlation IDs. Drizzle ORM provides lightweight, type-safe PostgreSQL access with explicit multi-database support via separate `drizzle()` instances. Biome v2 has native monorepo support with `"extends": "//"` nested config syntax. The observability stack (Pino -> Loki, OpenTelemetry -> Jaeger, Prometheus -> Grafana) is a proven production pattern with official transport packages.

The primary risk area is Docker Compose complexity -- the full profile includes 12+ services (Postgres, Redis, pgAdmin, Flagsmith, GlitchTip, Mailpit, Traefik, Grafana, Loki, Prometheus, Jaeger, plus the apps). This must be carefully layered via compose profiles to keep the core experience fast (`docker compose --profile core up`) while the full stack is available when needed.

**Primary recommendation:** Use Nx 22 with `--preset=ts` and pnpm workspaces. Generate apps with `@nx/nest` and `@nx/next` plugins. Use Docker Compose profiles to layer infrastructure complexity. Initialize all packages with barrel exports from day one so the dependency graph is valid.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Next.js (App Router) for both apps/web and apps/admin
- Tailwind CSS + shadcn/ui for styling (components in packages/ui)
- TanStack Query + Zustand for state management
- React Hook Form + Zod for form handling
- tRPC client for internal apps, generated REST SDK for external consumers (both in packages/api-client)
- NestJS for apps/api
- Drizzle ORM for packages/db (multi-database architecture -- at least 2 databases: control + tenant)
- BullMQ for background jobs (Redis as broker)
- Pino for structured logging
- Nextra (Next.js-based) for apps/docs -- stub only in Phase 1
- BullMQ for apps/worker -- stub only in Phase 1
- Node.js 22 LTS minimum target
- TypeScript strict mode with noUncheckedIndexedAccess
- Shared tsconfig base configs: root tsconfig.base.json, separate configs for Node (API), React (Web/Admin), library packages
- PostgreSQL 16, Redis 7
- Vitest for unit/integration tests, Playwright for E2E tests
- Functional in Phase 1: apps/api, apps/web, apps/admin
- Stubs for later: apps/worker, apps/docs
- Functional packages: packages/config (Zod env validation), packages/db (Drizzle setup + connection), packages/shared (Result type + error types)
- Stub packages: packages/api-client, packages/ui, packages/validators, packages/auth -- barrel exports only
- API: health endpoint + system info endpoint
- Web and Admin: landing page showing app name, API connection status, environment info
- Sentry-compatible error tracking (self-hosted in Docker Compose)
- Flagsmith self-hosted in Docker Compose for feature flags
- Persistent volumes for Postgres and Redis
- Convenience scripts: docker compose down + volume prune, wipe + re-run migrations
- All ports configurable via .env, defaulting to 3500 range
- pgAdmin in Docker + Drizzle Studio via pnpm script
- Traefik reverse proxy for hostname-based routing (api.localhost, web.localhost, admin.localhost)
- Mailpit SMTP catcher in Docker Compose
- Docker Compose profiles: core (Postgres, Redis) and full (adds everything else)
- Custom bridge network: sentinel-net
- Makefile for Docker/infra operations, pnpm scripts for app operations
- Debug log level in dev, Info in production (LOG_LEVEL env var)
- pino-pretty for dev logs, raw JSON in production
- Request context: correlationId (UUID), tenantId, userId, requestPath, method
- Full observability: Pino -> Loki -> Grafana, OpenTelemetry -> Jaeger -> Grafana, NestJS metrics -> Prometheus -> Grafana
- @sentinel/ scope for all packages
- Fixed/unified versioning
- Conventional Commits via commitlint + husky
- Husky + lint-staged for pre-commit hooks (Biome lint/format on staged files)
- GitHub Actions CI: lint, type-check, test on push/PR
- Comprehensive .gitignore, .env.example, VSCode settings, EditorConfig
- Root README, CONTRIBUTING.md
- Dependabot, SECURITY.md, .npmrc strict audit

### Claude's Discretion
- Sentry clone choice (GlitchTip vs alternatives -- lean toward lightest Docker option)
- Flagsmith integration pattern (server-side only vs server+client)
- Dev mode approach (everything in Docker vs hybrid) -- user prefers compose up/down convenience
- Database initial migration scope (config + connection, multi-DB aware from start)
- Loading skeletons and error states for initial landing pages
- Exact port assignments within 3500 range

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFR-01 | Nx monorepo scaffolded with pnpm (apps/api, apps/web, apps/admin, apps/worker, apps/docs) | Nx 22 with `--preset=ts`, pnpm workspaces, `@nx/nest` and `@nx/next` plugins for app generation |
| INFR-02 | Shared packages created (api-client, config, db, shared, ui, validators, auth) | `@nx/js:lib` generator for packages, `workspace:*` protocol for cross-references, barrel exports |
| INFR-03 | Environment configuration with Zod schema validation | `@t3-oss/env-core` with Zod schemas for type-safe, runtime-validated environment variables |
| INFR-04 | Docker Compose for local development (PostgreSQL, Redis) | Docker Compose profiles (core/full), persistent volumes, configurable ports, Traefik routing |
| INFR-05 | Structured logging with Pino (JSON, request context, correlation IDs) | `nestjs-pino` with `pinoHttp`, `genReqId` for correlation IDs, `assign()` for request context |
| INFR-07 | Biome linting and formatting configured across monorepo | Biome v2 with root config + nested `"extends": "//"` per package, lint-staged integration |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Nx | 22.x | Monorepo orchestration, task caching, code generation | Industry standard for JS/TS monorepos; inferred tasks, dependency graph, intelligent caching |
| pnpm | 9.x | Package manager with workspaces | Fastest installs, strict dependency isolation, `workspace:*` protocol, native Nx integration |
| NestJS | 11.x | Backend API framework | Progressive Node.js framework; modules, DI, guards, interceptors, pipes; official plugins for everything |
| Next.js | 15.x | Frontend framework (web + admin apps) | App Router, RSC, file-based routing; `@nx/next` plugin for monorepo integration |
| Drizzle ORM | 0.45.x (stable) | Database ORM for PostgreSQL | Type-safe SQL, lightweight, no codegen, explicit multi-database support, migration tooling via drizzle-kit |
| Pino | 9.x/10.x | Structured JSON logging | Fastest Node.js logger, worker-thread transports, child loggers, native JSON output |
| Biome | 2.x | Linting + formatting | Rust-powered (100x faster than ESLint), native monorepo support, single tool replaces ESLint + Prettier |
| TypeScript | 5.x | Type system | Strict mode with `noUncheckedIndexedAccess`, project references for monorepo |
| Docker Compose | 2.x | Local infrastructure orchestration | Profiles for layered complexity, persistent volumes, custom networks |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nestjs-pino | 4.x | NestJS Pino integration | Request-scoped structured logging with automatic context in every log line |
| @t3-oss/env-core | 0.12.x | Environment variable validation | Type-safe env vars with Zod schemas, runtime validation, clear error messages |
| pino-pretty | 13.x | Human-readable dev logs | Development only -- colorized, formatted log output |
| pino-loki | 2.x+ | Pino -> Grafana Loki transport | Ship logs to Loki for aggregation and Grafana visualization |
| @opentelemetry/sdk-node | 0.x/1.x | OpenTelemetry SDK | Distributed tracing and metrics collection |
| @opentelemetry/auto-instrumentations-node | 0.x | Auto-instrumentation | Automatic HTTP, Express, pg, Redis instrumentation without code changes |
| @nestjs/terminus | 11.x | Health checks | `/health` and `/ready` endpoints for Docker/monitoring |
| @nestjs/bullmq | 11.x | BullMQ NestJS integration | Queue registration, processor decorators (stub in Phase 1) |
| nestjs-otel | 6.x | OpenTelemetry NestJS module | Metrics decorators, Prometheus exporter integration |
| Traefik | 3.x | Reverse proxy | Hostname-based routing (api.localhost, web.localhost, admin.localhost) |
| GlitchTip | latest | Error tracking (Sentry alternative) | Self-hosted, Sentry SDK compatible, lightweight (Django + Redis + Postgres) |
| Flagsmith | latest | Feature flags | Self-hosted, REST API, server-side SDK for NestJS |
| Grafana | latest | Observability dashboards | Unified visualization for logs (Loki), metrics (Prometheus), traces (Jaeger) |
| Loki | latest | Log aggregation | Receives logs from pino-loki, queryable via Grafana |
| Prometheus | latest | Metrics scraping | Scrapes NestJS metrics endpoint, stores time-series data |
| Jaeger | latest | Distributed tracing | Receives OpenTelemetry traces, visualized in Grafana |
| Mailpit | latest | SMTP catcher | Local email testing, web UI for viewing sent emails |
| pgAdmin | latest | Database administration | Visual PostgreSQL management in browser |
| commitlint | 19.x | Commit message linting | Enforce Conventional Commits format |
| husky | 9.x | Git hooks | Pre-commit (lint-staged) and commit-msg (commitlint) hooks |
| lint-staged | 15.x | Staged file linting | Run Biome on staged files only during pre-commit |
| Nextra | 4.x | Documentation site (stub) | Next.js-based, App Router only, stub in Phase 1 |
| shadcn/ui | latest | UI component library (stub) | Tailwind CSS components, monorepo setup in packages/ui |
| Vitest | 3.x | Test framework | Unit/integration testing across all packages |
| Playwright | latest | E2E testing | Browser automation, setup in Phase 1 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| GlitchTip | Sentry self-hosted | Sentry requires Kafka, Zookeeper, ClickHouse -- 10+ containers vs GlitchTip's 3; GlitchTip uses Sentry SDKs |
| GlitchTip | Highlight.io | More features but heavier; GlitchTip is lightest option per user preference |
| pino-loki | Promtail (file-based) | Promtail reads log files; pino-loki ships direct from Node.js without filesystem dependency |
| nestjs-pino | NestJS built-in ConsoleLogger | ConsoleLogger added JSON support in v11, but nestjs-pino provides automatic request context in every log and `assign()` for cross-cutting concerns |
| @t3-oss/env-core | Custom Zod validation | t3-env handles empty strings, client/server separation, clear error formatting out of the box |

**Installation (core packages):**
```bash
# Monorepo tooling
pnpm add -D nx @nx/js @nx/nest @nx/next @nx/workspace

# API (apps/api)
pnpm add @nestjs/core @nestjs/common @nestjs/platform-express @nestjs/terminus @nestjs/bullmq
pnpm add nestjs-pino pino pino-http
pnpm add -D pino-pretty

# Database (packages/db)
pnpm add drizzle-orm pg
pnpm add -D drizzle-kit @types/pg

# Environment (packages/config)
pnpm add @t3-oss/env-core zod

# Observability
pnpm add @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
pnpm add @opentelemetry/exporter-trace-otlp-http @opentelemetry/exporter-prometheus
pnpm add nestjs-otel pino-loki

# Linting/Formatting
pnpm add -D @biomejs/biome

# Git hooks
pnpm add -D husky lint-staged @commitlint/cli @commitlint/config-conventional

# Testing
pnpm add -D vitest @vitest/coverage-v8 playwright @playwright/test

# Frontend (apps/web, apps/admin)
pnpm add next react react-dom
pnpm add -D tailwindcss @tailwindcss/postcss postcss
```

## Architecture Patterns

### Recommended Project Structure
```
sentinel-suite/
├── apps/
│   ├── api/                    # NestJS backend (functional)
│   │   ├── src/
│   │   │   ├── app.module.ts
│   │   │   ├── main.ts         # Bootstrap with Pino logger, OTel SDK
│   │   │   ├── health/         # Health + system info endpoints
│   │   │   └── common/         # Filters, interceptors, middleware
│   │   ├── project.json
│   │   ├── tsconfig.json       # Extends tsconfig.node.json
│   │   └── package.json
│   ├── web/                    # Next.js public app (functional)
│   │   ├── src/app/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx        # Landing page with API status
│   │   ├── next.config.ts
│   │   ├── project.json
│   │   └── package.json
│   ├── admin/                  # Next.js admin app (functional)
│   │   ├── src/app/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx        # Landing page with API status
│   │   ├── next.config.ts
│   │   ├── project.json
│   │   └── package.json
│   ├── worker/                 # BullMQ worker (stub)
│   │   ├── src/index.ts        # Entry point placeholder
│   │   └── package.json
│   └── docs/                   # Nextra docs site (stub)
│       ├── src/app/
│       └── package.json
├── packages/
│   ├── config/                 # @sentinel/config (functional)
│   │   ├── src/
│   │   │   ├── index.ts        # Barrel export
│   │   │   └── env.ts          # Zod env schemas + t3-env createEnv
│   │   └── package.json
│   ├── db/                     # @sentinel/db (functional)
│   │   ├── src/
│   │   │   ├── index.ts        # Barrel export
│   │   │   ├── client.ts       # Drizzle instances (control + tenant)
│   │   │   └── schema/         # Drizzle schema definitions
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   ├── shared/                 # @sentinel/shared (functional)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── result.ts       # Result<T, E> type
│   │   │   └── errors.ts       # Typed error classes
│   │   └── package.json
│   ├── api-client/             # @sentinel/api-client (stub)
│   ├── ui/                     # @sentinel/ui (stub)
│   ├── validators/             # @sentinel/validators (stub)
│   └── auth/                   # @sentinel/auth (stub)
├── docker/
│   ├── docker-compose.yml      # Core + full profiles
│   ├── docker-compose.override.yml  # Dev-specific overrides
│   ├── grafana/
│   │   ├── provisioning/       # Datasource + dashboard auto-provisioning
│   │   └── dashboards/
│   ├── prometheus/
│   │   └── prometheus.yml      # Scrape config
│   ├── loki/
│   │   └── loki-config.yml
│   └── traefik/
│       └── traefik.yml         # Static config
├── scripts/                    # Convenience scripts
├── Makefile                    # Docker/infra operations
├── nx.json                     # Nx configuration
├── pnpm-workspace.yaml         # Workspace definition
├── tsconfig.base.json          # Root TypeScript config
├── tsconfig.node.json          # Node.js (API) extends base
├── tsconfig.react.json         # React (Web/Admin) extends base
├── biome.json                  # Root Biome config
├── commitlint.config.cjs       # Conventional Commits config
├── .env.example                # All env vars documented
├── .editorconfig
└── package.json                # Root scripts
```

### Pattern 1: Nx Plugin-Based Task Inference
**What:** Nx plugins (`@nx/next`, `@nx/nest`) automatically infer `build`, `dev`, `serve`, `lint`, `test` tasks from project configuration files (next.config.ts, nest-cli.json). No manual target definitions needed.
**When to use:** Always -- this is the modern Nx approach (Nx 18+).
**Example:**
```json
// nx.json
{
  "plugins": [
    {
      "plugin": "@nx/next/plugin",
      "options": {
        "buildTargetName": "build",
        "devTargetName": "dev",
        "startTargetName": "start"
      }
    },
    {
      "plugin": "@nx/nest/plugin",
      "options": {
        "buildTargetName": "build",
        "serveTargetName": "serve"
      }
    }
  ]
}
```

### Pattern 2: nestjs-pino Request Context Logging
**What:** Every log line automatically includes request context (correlation ID, method, URL). Additional context (tenantId, userId) added via `assign()`.
**When to use:** All NestJS request handling -- configured once in AppModule.
**Example:**
```typescript
// Source: Context7 nestjs-pino docs
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || (process.env.NODE_ENV !== 'production' ? 'debug' : 'info'),
        transport: process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
        genReqId: (req) => req.headers['x-correlation-id'] || crypto.randomUUID(),
        customProps: (req) => ({
          correlationId: req.id,
        }),
      },
    }),
  ],
})
export class AppModule {}

// Bootstrap
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  await app.listen(3000);
}
```

### Pattern 3: Drizzle Multi-Database Instances
**What:** Separate `drizzle()` instances for control DB and tenant DBs, each with their own connection pool and schema.
**When to use:** Multi-database architecture -- create one instance per database connection.
**Example:**
```typescript
// packages/db/src/client.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as controlSchema from './schema/control';

// Control database -- system catalog, tenant registry
const controlPool = new Pool({
  connectionString: process.env.CONTROL_DATABASE_URL,
});
export const controlDb = drizzle({ client: controlPool, schema: controlSchema });

// Tenant database factory -- per-tenant connections (Phase 2+)
export function createTenantDb(connectionUrl: string) {
  const pool = new Pool({ connectionString: connectionUrl });
  return drizzle({ client: pool });
}
```

### Pattern 4: t3-env Environment Validation
**What:** Type-safe environment variables validated at startup with clear error messages for missing/invalid values.
**When to use:** packages/config -- imported by all apps at startup.
**Example:**
```typescript
// packages/config/src/env.ts
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('debug'),
    CONTROL_DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    API_PORT: z.coerce.number().default(3500),
    WEB_PORT: z.coerce.number().default(3501),
    ADMIN_PORT: z.coerce.number().default(3502),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
```

### Pattern 5: Biome Monorepo Configuration
**What:** Root biome.json sets base rules; nested configs in packages/apps extend root with `"extends": "//"`.
**When to use:** Every package/app that needs specific overrides.
**Example:**
```json
// Root biome.json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "organizeImports": { "enabled": true },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "files": {
    "ignore": ["node_modules", "dist", ".next", ".nx", "coverage"]
  }
}

// packages/db/biome.json (nested)
{
  "extends": ["//"
  ]
}
```

### Pattern 6: Docker Compose Profiles
**What:** Layered infrastructure with `core` profile (Postgres + Redis) and `full` profile (everything else). Default profile starts minimal, full profile adds observability and tooling.
**When to use:** Always -- users run `docker compose --profile core up` for fast starts or `docker compose --profile full up` for complete stack.
**Example:**
```yaml
# docker/docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    profiles: [core, full]
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-sentinel}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-sentinel}
      POSTGRES_DB: ${POSTGRES_DB:-sentinel_control}
    ports:
      - "${POSTGRES_PORT:-3510}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - sentinel-net

  redis:
    image: redis:7-alpine
    profiles: [core, full]
    ports:
      - "${REDIS_PORT:-3511}:6379"
    volumes:
      - redis_data:/data
    networks:
      - sentinel-net

  traefik:
    image: traefik:v3.3
    profiles: [full]
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entryPoints.web.address=:80"
      - "--api.insecure=true"
    ports:
      - "80:80"
      - "${TRAEFIK_DASHBOARD_PORT:-3580}:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - sentinel-net

  grafana:
    image: grafana/grafana:latest
    profiles: [full]
    ports:
      - "${GRAFANA_PORT:-3530}:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
    networks:
      - sentinel-net

  loki:
    image: grafana/loki:latest
    profiles: [full]
    ports:
      - "${LOKI_PORT:-3531}:3100"
    volumes:
      - ./loki/loki-config.yml:/etc/loki/config.yaml
    networks:
      - sentinel-net

  prometheus:
    image: prom/prometheus:latest
    profiles: [full]
    ports:
      - "${PROMETHEUS_PORT:-3532}:9090"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
    networks:
      - sentinel-net

  jaeger:
    image: jaegertracing/jaeger:latest
    profiles: [full]
    ports:
      - "${JAEGER_UI_PORT:-3533}:16686"
      - "${JAEGER_OTLP_PORT:-4318}:4318"
    networks:
      - sentinel-net

  glitchtip:
    image: glitchtip/glitchtip:latest
    profiles: [full]
    depends_on:
      - postgres
      - redis
    environment:
      DATABASE_URL: postgres://${POSTGRES_USER:-sentinel}:${POSTGRES_PASSWORD:-sentinel}@postgres:5432/glitchtip
      SECRET_KEY: ${GLITCHTIP_SECRET_KEY:-change-me-in-production}
      REDIS_URL: redis://redis:6379/1
      GLITCHTIP_DOMAIN: http://localhost:${GLITCHTIP_PORT:-3540}
    ports:
      - "${GLITCHTIP_PORT:-3540}:8000"
    networks:
      - sentinel-net

  flagsmith:
    image: flagsmith/flagsmith:latest
    profiles: [full]
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgres://${POSTGRES_USER:-sentinel}:${POSTGRES_PASSWORD:-sentinel}@postgres:5432/flagsmith
      DJANGO_ALLOWED_HOSTS: "*"
    ports:
      - "${FLAGSMITH_PORT:-3541}:8000"
    networks:
      - sentinel-net

  mailpit:
    image: axllent/mailpit:latest
    profiles: [full]
    ports:
      - "${MAILPIT_SMTP_PORT:-3525}:1025"
      - "${MAILPIT_UI_PORT:-3526}:8025"
    networks:
      - sentinel-net

  pgadmin:
    image: dpage/pgadmin4:latest
    profiles: [full]
    environment:
      PGADMIN_DEFAULT_EMAIL: ${PGADMIN_EMAIL:-admin@sentinel.local}
      PGADMIN_DEFAULT_PASSWORD: ${PGADMIN_PASSWORD:-admin}
    ports:
      - "${PGADMIN_PORT:-3550}:80"
    networks:
      - sentinel-net

volumes:
  postgres_data:
  redis_data:
  grafana_data:

networks:
  sentinel-net:
    name: sentinel-net
    driver: bridge
```

### Pattern 7: OpenTelemetry SDK Initialization (must load before NestJS)
**What:** OpenTelemetry SDK must be initialized before any other imports to enable auto-instrumentation. Use a separate `tracing.ts` file loaded via `--require` or imported first in `main.ts`.
**When to use:** apps/api bootstrap.
**Example:**
```typescript
// apps/api/src/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: 'sentinel-api',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  }),
  metricReader: new PrometheusExporter({
    port: Number(process.env.METRICS_PORT) || 9464,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

process.on('SIGTERM', () => sdk.shutdown());
```

### Anti-Patterns to Avoid
- **Circular package dependencies:** Never have packages/db import from packages/config AND packages/config import from packages/db. Use a clear dependency direction: shared <- config <- db <- api.
- **Importing from `src/` paths across packages:** Always import from package barrel exports (`@sentinel/config`), never from internal paths (`../../packages/config/src/env`).
- **Hardcoded ports in compose:** Every port must be parameterized via `${VAR:-default}` syntax.
- **Single drizzle.config.ts for multiple databases:** Each database needs its own drizzle config or the config must support multiple schemas/outputs.
- **Initializing OTel SDK after NestJS:** Auto-instrumentation must monkey-patch modules before they're imported. Always import/require `tracing.ts` first.
- **Using `pnpm add` without `--filter`:** In a monorepo, always specify which workspace package gets the dependency: `pnpm add --filter @sentinel/api nestjs-pino`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Environment validation | Custom Zod wrapper with process.env | `@t3-oss/env-core` | Handles empty strings, client/server separation, formatted error messages, type inference |
| Request ID propagation | Custom middleware for correlation IDs | `nestjs-pino` with `genReqId` | Automatic request ID generation, propagation across child loggers, response logging |
| Health checks | Custom `/health` endpoint | `@nestjs/terminus` | Database health, Redis health, custom indicators, Kubernetes-compatible |
| Log shipping to Loki | Custom HTTP transport or file tailing | `pino-loki` | Batching, retry logic, level mapping, worker-thread execution |
| Git commit enforcement | Custom git hooks | `husky` + `commitlint` + `lint-staged` | Proven toolchain, conventional commit parsing, pre-commit formatting |
| Reverse proxy for dev | Manual port management or nginx config | Traefik with Docker provider | Auto-discovers containers via labels, zero-config hostname routing |
| Monorepo task orchestration | Custom scripts to run tasks across packages | Nx task pipeline | Dependency graph, caching, parallel execution, affected commands |
| Auto-instrumentation | Manual OpenTelemetry spans in every handler | `@opentelemetry/auto-instrumentations-node` | Instruments HTTP, pg, Redis, Express automatically without code changes |

**Key insight:** Phase 1 is almost entirely "glue and configuration" -- connecting proven libraries together. The value is in correct wiring, not custom code. Every time you're tempted to write more than 20 lines for infrastructure concerns, there's probably a package that does it better.

## Common Pitfalls

### Pitfall 1: Nx Workspace Generator vs Manual Setup
**What goes wrong:** Developers manually create apps/packages instead of using Nx generators, resulting in missing project.json, incorrect tsconfig references, and broken dependency graph.
**Why it happens:** Seems faster to copy-paste a folder structure.
**How to avoid:** Always use `nx g @nx/nest:app`, `nx g @nx/next:app`, `nx g @nx/js:lib`. These generators wire up tsconfig references, project.json, and dependencies correctly.
**Warning signs:** `nx graph` shows disconnected nodes; `nx affected` doesn't detect changes in shared packages.

### Pitfall 2: pnpm Workspace Protocol Misconfiguration
**What goes wrong:** Using version numbers instead of `workspace:*` for internal packages causes pnpm to look for packages in the registry instead of locally.
**Why it happens:** Copy-pasting from non-monorepo examples.
**How to avoid:** All internal `@sentinel/*` dependencies must use `"@sentinel/config": "workspace:*"` in package.json.
**Warning signs:** `pnpm install` tries to fetch `@sentinel/config` from npm and fails.

### Pitfall 3: OpenTelemetry Initialization Order
**What goes wrong:** Auto-instrumentation doesn't capture traces because the SDK was initialized after HTTP/pg/Redis modules were imported.
**Why it happens:** OTel works by monkey-patching module exports; if modules are already loaded, patching has no effect.
**How to avoid:** Import `./tracing` as the very first import in `main.ts`, or use `node --require ./tracing.js` flag. Verify in Jaeger that spans appear.
**Warning signs:** Jaeger shows no traces, or only custom manual spans appear but no HTTP/database spans.

### Pitfall 4: Docker Compose Port Conflicts
**What goes wrong:** Multiple services bind to the same host port, causing container startup failures.
**Why it happens:** Default ports overlap (multiple services default to 8080, 3000, etc.).
**How to avoid:** Assign all services unique ports in the 3500 range. Use `${VAR:-default}` syntax so users can override. Document all ports in `.env.example`.
**Warning signs:** `docker compose up` fails with "port already in use" errors.

### Pitfall 5: Biome Monorepo Config Not Extending Root
**What goes wrong:** Nested biome.json files don't inherit root rules, causing inconsistent formatting across packages.
**Why it happens:** In Biome v1, there was no clean extension mechanism. In v2, the `"extends": "//"` syntax is new and easy to miss.
**How to avoid:** Every nested biome.json must have `"extends": ["//"]` (Biome v2 syntax). Run `pnpm biome check .` from root to verify consistency.
**Warning signs:** Different formatting in different packages; Biome reports different rule violations depending on which directory you run from.

### Pitfall 6: GlitchTip/Flagsmith Sharing Postgres Without Separate DBs
**What goes wrong:** GlitchTip and Flagsmith share the main application Postgres database, causing migration conflicts and table name collisions.
**Why it happens:** Using a single `DATABASE_URL` for everything.
**How to avoid:** Create separate databases within the same Postgres instance for each service. Use an init script in the Postgres container to create `glitchtip`, `flagsmith`, and `sentinel_control` databases on startup.
**Warning signs:** Migration errors mentioning tables that don't belong to your application schema.

### Pitfall 7: Missing `bufferLogs: true` in NestJS Bootstrap
**What goes wrong:** Early bootstrap logs (before Pino is configured) go through the default NestJS logger, producing unstructured text output mixed with JSON logs.
**Why it happens:** NestJS instantiates a default logger before DI is ready.
**How to avoid:** Pass `{ bufferLogs: true }` to `NestFactory.create()`, then call `app.useLogger(app.get(Logger))` to flush buffered logs through Pino.
**Warning signs:** First few log lines in console are plain text while the rest are JSON.

### Pitfall 8: Drizzle Kit Config for Multiple Databases
**What goes wrong:** A single `drizzle.config.ts` can only point to one database, so migrations for control and tenant DBs get mixed together.
**Why it happens:** Drizzle Kit's `defineConfig` takes a single `dbCredentials` object.
**How to avoid:** Create separate config files: `drizzle.control.config.ts` and `drizzle.tenant.config.ts` (or use a wrapper script). Run migrations with `drizzle-kit push --config=drizzle.control.config.ts`.
**Warning signs:** Migrations for tenant tables appear in the control database output directory.

## Code Examples

### NestJS Health Check with Terminus
```typescript
// Source: NestJS official docs (docs.nestjs.com/recipes/terminus)
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck, HealthCheckService,
  TypeOrmHealthIndicator, MemoryHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator, // Replace with custom Drizzle check
    private memory: MemoryHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
    ]);
  }
}
```

Note: Since we use Drizzle (not TypeORM), a custom health indicator that runs `SELECT 1` via the Drizzle client is needed. `@nestjs/terminus` provides `HealthIndicator` base class for this.

### pnpm-workspace.yaml
```yaml
# Source: Nx docs (nx.dev/docs/concepts/typescript-project-linking)
packages:
  - 'apps/*'
  - 'packages/*'
```

### tsconfig.base.json (Root)
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true,
    "paths": {
      "@sentinel/*": ["packages/*/src"]
    }
  },
  "exclude": ["node_modules", "dist"]
}
```

### Pino Multi-Transport (Dev + Loki)
```typescript
// Source: Context7 pinojs/pino and pino-loki docs
import pino from 'pino';

// Production: JSON to stdout + Loki
const productionTransport = pino.transport({
  targets: [
    { target: 'pino/file', options: { destination: 1 } }, // stdout
    {
      target: 'pino-loki',
      options: {
        host: process.env.LOKI_URL || 'http://localhost:3100',
        labels: { application: 'sentinel-api' },
        batching: true,
        interval: 5,
      },
    },
  ],
});
```

### Makefile for Docker Operations
```makefile
# Docker infrastructure operations
.PHONY: up down clean reset-db logs

up: ## Start core infrastructure (Postgres + Redis)
	docker compose -f docker/docker-compose.yml --profile core up -d

up-full: ## Start full infrastructure (all services)
	docker compose -f docker/docker-compose.yml --profile full up -d

down: ## Stop all infrastructure
	docker compose -f docker/docker-compose.yml down

clean: ## Stop all + remove volumes (clean slate)
	docker compose -f docker/docker-compose.yml down -v --remove-orphans

reset-db: ## Wipe databases and re-run migrations
	docker compose -f docker/docker-compose.yml down -v --remove-orphans
	docker compose -f docker/docker-compose.yml --profile core up -d
	sleep 3
	pnpm --filter @sentinel/db run migrate

logs: ## Tail infrastructure logs
	docker compose -f docker/docker-compose.yml logs -f
```

### GitHub Actions CI
```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm type-check
      - run: pnpm test
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ESLint + Prettier | Biome v2 | 2024-2025 | 100x faster, single config, native monorepo support |
| Nx integrated with project.json targets | Nx plugin-inferred tasks | Nx 18+ (2024) | Less boilerplate, plugins auto-detect tasks from framework configs |
| winston/bunyan logging | Pino with worker-thread transports | Pino v7+ (2022) | 5x faster, non-blocking transports, automatic serialization |
| Custom env validation | @t3-oss/env-core with Zod | 2023+ | Type-safe, runtime-validated, standard in T3 ecosystem |
| Sentry self-hosted (20+ containers) | GlitchTip (3 containers) | 2023+ | Same SDK compatibility, 85% fewer containers |
| ELK stack (Elasticsearch + Logstash + Kibana) | Grafana + Loki + Promtail/pino-loki | 2022+ | Far less resource usage, Loki indexes labels not content |
| Manual OpenTelemetry spans | Auto-instrumentation SDK | OTel Node.js 0.40+ (2024) | Zero-code tracing for HTTP, pg, Redis, Express |
| NestJS v10 ConsoleLogger | NestJS v11 ConsoleLogger with JSON + nestjs-pino | NestJS 11 (2025) | Built-in JSON support, but nestjs-pino still preferred for request context |
| Husky v4 (auto-install) | Husky v9 (manual init) | 2024 | `npx husky init` replaces `husky install`, simpler setup |

**Deprecated/outdated:**
- **ESLint flat config migration**: ESLint 9+ requires flat config; Biome eliminates this concern entirely
- **Bull (v3)**: Replaced by BullMQ (v5+) with better TypeScript support, flows, and worker isolation
- **Nextra v3 (Pages Router)**: Nextra 4 requires App Router exclusively
- **pino-pretty as dependency in production**: Must be devDependency only; production uses raw JSON or transports

## Discretion Recommendations

### Sentry Clone: GlitchTip
**Recommendation:** Use GlitchTip. **Confidence: HIGH**
- 3 containers (web, Postgres, Redis) vs Sentry's 20+ (Kafka, Zookeeper, ClickHouse, etc.)
- Uses Sentry SDKs directly -- `@sentry/node` works unchanged
- Django-based, lightweight, actively maintained
- Can share the same Postgres/Redis instances (with separate databases)
- User preference: "lean toward lightest Docker option" -- GlitchTip is exactly this

### Flagsmith Integration: Server-Side Only
**Recommendation:** Server-side SDK only in Phase 1. **Confidence: HIGH**
- `flagsmith-nodejs` SDK in the API, feature flags evaluated server-side
- Client-side SDK adds complexity (client key management, caching, SSR hydration)
- Phase 1 has no client-side features that need flags -- it's infrastructure
- Client SDK can be added in later phases when needed

### Dev Mode: Hybrid (Infrastructure in Docker, Apps Native)
**Recommendation:** Docker for infrastructure, native Node for apps. **Confidence: HIGH**
- Infrastructure services (Postgres, Redis, Traefik, Grafana stack) run in Docker -- these are stateful and complex to install natively
- NestJS/Next.js apps run natively via `pnpm dev` -- this gives fast HMR, better debugging, instant restarts
- User wants `docker compose up/down` convenience -- this still works for infrastructure
- `pnpm dev` in root runs all apps concurrently via Nx `run-many`
- This is the standard monorepo pattern (Turborepo, Nx, Moon all recommend this)

### Database Migration Scope: Control DB Schema Only
**Recommendation:** Phase 1 creates Drizzle connection + empty control schema. **Confidence: HIGH**
- Define the connection pattern (control DB + tenant DB factory)
- Create a minimal control schema (e.g., `system_info` table for health check verification)
- Multi-database routing logic comes in Phase 2 (Tenancy)
- Migration scripts work: `drizzle-kit push --config=drizzle.control.config.ts`

### Port Assignments (3500 Range)
**Recommendation:** Systematic assignment by service type. **Confidence: HIGH**

| Service | Port | Env Var |
|---------|------|---------|
| API (NestJS) | 3500 | API_PORT |
| Web (Next.js) | 3501 | WEB_PORT |
| Admin (Next.js) | 3502 | ADMIN_PORT |
| Worker (BullMQ) | 3503 | WORKER_PORT |
| Docs (Nextra) | 3504 | DOCS_PORT |
| Postgres | 3510 | POSTGRES_PORT |
| Redis | 3511 | REDIS_PORT |
| Mailpit SMTP | 3525 | MAILPIT_SMTP_PORT |
| Mailpit UI | 3526 | MAILPIT_UI_PORT |
| Grafana | 3530 | GRAFANA_PORT |
| Loki | 3531 | LOKI_PORT |
| Prometheus | 3532 | PROMETHEUS_PORT |
| Jaeger UI | 3533 | JAEGER_UI_PORT |
| GlitchTip | 3540 | GLITCHTIP_PORT |
| Flagsmith | 3541 | FLAGSMITH_PORT |
| pgAdmin | 3550 | PGADMIN_PORT |
| Traefik HTTP | 80 | (standard) |
| Traefik Dashboard | 3580 | TRAEFIK_DASHBOARD_PORT |
| OTel OTLP | 4318 | JAEGER_OTLP_PORT |
| Metrics (Prometheus exporter) | 9464 | METRICS_PORT |

## Open Questions

1. **Drizzle ORM version stability (stable vs beta)**
   - What we know: Stable is 0.45.x, beta is 1.0.0-beta.2 with architectural rewrite
   - What's unclear: Whether to use stable 0.45.x or the 1.0 beta for a greenfield project
   - Recommendation: Use stable 0.45.x. The beta has migration architecture changes that could shift. Pin version and upgrade when 1.0 stable releases.

2. **GlitchTip separate Postgres database vs separate instance**
   - What we know: GlitchTip needs its own database; it can run in the same Postgres instance with a separate DB
   - What's unclear: Whether init scripts for multi-DB creation are reliable across Postgres container restarts
   - Recommendation: Use a Postgres init script (`/docker-entrypoint-initdb.d/`) to create `sentinel_control`, `glitchtip`, and `flagsmith` databases. This is idempotent and standard.

3. **Nx 22 vs 21 plugin API stability**
   - What we know: Nx 22 is current (released late 2025). Plugin inference is the standard approach since Nx 18.
   - What's unclear: Whether any breaking changes in Nx 22 affect `@nx/nest` or `@nx/next` plugins
   - Recommendation: Use Nx 22. The plugin system is stable and well-documented. Pin Nx version in package.json.

4. **NestJS 11 ESM transition**
   - What we know: NestJS 12 (Q3 2026) will switch to ESM. NestJS 11 uses CJS.
   - What's unclear: Whether to start with ESM configuration now or wait
   - Recommendation: Stay with CJS for NestJS 11. The ESM migration will be a separate effort when NestJS 12 launches. Starting with ESM now risks compatibility issues with nestjs-pino, nestjs-otel, and other plugins.

## Sources

### Primary (HIGH confidence)
- Context7 `/websites/nx_dev` - Nx workspace setup, pnpm workspaces, plugin configuration, generators
- Context7 `/websites/nestjs` - NestJS logger, health checks, CLS module, deployment best practices
- Context7 `/iamolegga/nestjs-pino` - nestjs-pino setup, request context logging, correlation IDs, `assign()` method
- Context7 `/websites/rqbv2_drizzle-orm-fe_pages_dev` - Drizzle ORM PostgreSQL setup, drizzle-kit config, node-postgres driver
- Context7 `/pinojs/pino` - Pino transports, child loggers, pino-pretty, multi-target configuration, pino-loki
- Context7 `/websites/v1_biomejs_dev` - Biome configuration, monorepo overrides, ignore patterns, extends

### Secondary (MEDIUM confidence)
- [Nx Changelog](https://nx.dev/changelog) - Nx 22.x current version confirmed
- [NestJS 11 Announcement](https://trilon.io/blog/announcing-nestjs-11-whats-new) - NestJS 11 features, JSON logging, v12 ESM plans
- [Biome v2 Release Blog](https://biomejs.dev/blog/biome-v2/) - Biome v2 monorepo support, `"extends": "//"` syntax
- [GlitchTip Setup Guides](https://shape.host/resources/how-to-install-glitchtip-sentry-alternative-on-ubuntu-24-04) - GlitchTip Docker Compose configuration (Nov 2025)
- [Flagsmith Docker Docs](https://docs.flagsmith.com/deployment-self-hosting/hosting-guides/docker) - Flagsmith Docker Compose setup
- [OpenTelemetry Node.js Getting Started](https://opentelemetry.io/docs/languages/js/getting-started/nodejs/) - OTel SDK setup, auto-instrumentation
- [t3-env Core Docs](https://env.t3.gg/docs/core) - @t3-oss/env-core configuration
- [Traefik Docker Quick Start](https://doc.traefik.io/traefik/getting-started/quick-start/) - Traefik v3 Docker provider setup
- [shadcn/ui Monorepo Docs](https://ui.shadcn.com/docs/monorepo) - Official shadcn/ui monorepo setup
- [Nextra 4 Release](https://the-guild.dev/blog/nextra-4) - Nextra 4 App Router migration
- [Drizzle ORM v1 Beta](https://orm.drizzle.team/docs/latest-releases/drizzle-orm-v1beta2) - Drizzle ORM version status
- [pino-loki GitHub](https://github.com/Julien-R44/pino-loki) - pino-loki transport configuration
- [nestjs-otel GitHub](https://github.com/pragmaticivan/nestjs-otel) - OpenTelemetry NestJS module

### Tertiary (LOW confidence)
- None -- all findings verified with primary or secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via Context7 and official docs; versions confirmed on npm
- Architecture: HIGH - Patterns sourced from official Nx/NestJS/Drizzle docs and Context7 verified examples
- Pitfalls: HIGH - Common issues documented in official guides and multiple community sources
- Docker/Observability: MEDIUM - Docker Compose profiles and observability stack are well-established patterns but GlitchTip + Flagsmith sharing Postgres needs validation during implementation

**Research date:** 2026-02-28
**Valid until:** 2026-03-30 (30 days -- stable ecosystem, major versions locked)
