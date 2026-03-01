---
phase: 01-monorepo-foundation
plan: 03
subsystem: api
tags: [nestjs, pino, opentelemetry, terminus, ioredis, health-check, correlation-id, nextjs, tailwind]

# Dependency graph
requires:
  - phase: 01-monorepo-foundation/01
    provides: Nx workspace structure, app stubs (api, web, admin), TypeScript configs
  - phase: 01-monorepo-foundation/02
    provides: "@sentinel/config env validation, @sentinel/db Drizzle client, Docker Compose infrastructure"
provides:
  - NestJS API with Pino structured logging and OpenTelemetry tracing
  - Health check endpoints (GET /health, GET /api/system) with Terminus
  - Custom health indicators for PostgreSQL (Drizzle) and Redis (ioredis)
  - Correlation ID middleware (x-correlation-id header propagation)
  - Web landing page with real-time API connection status
  - Admin landing page with real-time API connection status
affects: [02-tenancy, 03-api-layer, all-future-phases]

# Tech tracking
tech-stack:
  added: ["nestjs-pino@4", "pino@9", "pino-http@10", "pino-pretty@13", "@nestjs/terminus@11", "nestjs-otel@6", "@opentelemetry/sdk-node@0.57", "@opentelemetry/auto-instrumentations-node@0.56", "@opentelemetry/exporter-trace-otlp-http@0.57", "@opentelemetry/exporter-prometheus@0.57", "ioredis@5", "drizzle-orm@0.45", "pino-loki@2"]
  patterns: [otel-first-import, pino-structured-logging, terminus-health-checks, correlation-id-middleware, client-side-api-polling]

key-files:
  created:
    - apps/api/src/tracing.ts
    - apps/api/src/health/health.module.ts
    - apps/api/src/health/health.controller.ts
    - apps/api/src/health/indicators/database.health.ts
    - apps/api/src/health/indicators/redis.health.ts
    - apps/api/src/common/middleware/correlation-id.middleware.ts
    - apps/web/next-env.d.ts
    - apps/admin/next-env.d.ts
  modified:
    - apps/api/package.json
    - apps/api/src/main.ts
    - apps/api/src/app.module.ts
    - apps/api/tsconfig.json
    - apps/web/src/app/page.tsx
    - apps/web/src/app/layout.tsx
    - apps/web/tsconfig.json
    - apps/admin/src/app/page.tsx
    - apps/admin/src/app/layout.tsx
    - apps/admin/tsconfig.json
    - .env.example
    - pnpm-lock.yaml

key-decisions:
  - "API tsconfig uses ESNext module + Bundler moduleResolution (same pattern as library packages) for ESM compat with tsc type-checking while NestJS CLI handles actual builds"
  - "biome-ignore comments used for NestJS DI imports instead of disabling useImportType globally -- keeps the rule active for non-NestJS code"
  - "OpenTelemetry tracing.ts reads process.env directly (not @sentinel/config) because it must load before any NestJS/module imports"
  - "Redis health indicator uses lazyConnect and short timeouts to avoid blocking startup when Redis is unavailable"

patterns-established:
  - "OTel-first import: tracing.ts must be the first import in main.ts for full auto-instrumentation"
  - "Health check pattern: custom HealthIndicator extending @nestjs/terminus for each service"
  - "Correlation ID: middleware generates UUID if x-correlation-id header absent, propagates to response"
  - "Frontend API polling: client components fetch /api/health and /api/system on mount + interval"
  - "NestJS + Biome: use biome-ignore for DI constructor parameter imports (emitDecoratorMetadata requires runtime class refs)"

requirements-completed: [INFR-05]

# Metrics
duration: 15min
completed: 2026-03-01
---

# Phase 1 Plan 3: API Bootstrap and Landing Pages Summary

**NestJS API with Pino structured logging, OpenTelemetry tracing, Terminus health checks (Postgres + Redis), correlation ID middleware, and Next.js landing pages displaying real-time API connection status**

## Performance

- **Duration:** 15 min
- **Started:** 2026-02-28T23:49:42Z
- **Completed:** 2026-03-01T00:05:26Z
- **Tasks:** 2
- **Files modified:** 20

## Accomplishments
- NestJS API bootstraps with Pino structured logging (JSON in production, pretty-print in dev) and OpenTelemetry SDK for distributed tracing
- GET /health returns Terminus-format health status checking PostgreSQL (via Drizzle SQL), Redis (via ioredis ping), and memory heap (150MB limit)
- GET /api/system returns environment info, uptime, service connectivity status, and port assignments
- Correlation IDs auto-generated as UUIDs or propagated from x-correlation-id request header on every request
- Web landing page at localhost:3501 displays "Sentinel Suite" with live API connection indicator and service status
- Admin landing page at localhost:3502 displays "Sentinel Suite - Admin Console" with same status features plus admin badge

## Task Commits

Each task was committed atomically:

1. **Task 1: Bootstrap NestJS API with Pino logging, OTel tracing, and health endpoints** - `7c2ba93` (feat)
2. **Task 2: Create Next.js landing pages for web and admin with API connection status** - `8742eb1` (feat)

## Files Created/Modified
- `apps/api/src/tracing.ts` - OpenTelemetry SDK initialization (NodeSDK with OTLP trace exporter and Prometheus metrics)
- `apps/api/src/main.ts` - NestJS bootstrap with bufferLogs, Pino logger, CORS, /api prefix
- `apps/api/src/app.module.ts` - AppModule with LoggerModule, OpenTelemetryModule, HealthModule, correlation ID middleware
- `apps/api/src/health/health.module.ts` - Health module registering Terminus, controller, and indicators
- `apps/api/src/health/health.controller.ts` - /health (Terminus check) and /api/system (env info) endpoints
- `apps/api/src/health/indicators/database.health.ts` - Custom Drizzle health indicator (SELECT 1 via controlDb)
- `apps/api/src/health/indicators/redis.health.ts` - Custom Redis health indicator (ioredis ping)
- `apps/api/src/common/middleware/correlation-id.middleware.ts` - UUID generation/propagation for x-correlation-id
- `apps/api/package.json` - Added 13 runtime and 2 dev dependencies
- `apps/api/tsconfig.json` - Added ESNext module, Bundler resolution, empty paths override
- `apps/web/src/app/page.tsx` - Client component with API health polling, status indicators, service cards
- `apps/web/src/app/layout.tsx` - Updated metadata and Tailwind body classes
- `apps/web/tsconfig.json` - Added empty paths override for tsc/next build compatibility
- `apps/admin/src/app/page.tsx` - Admin console with same status features plus admin badge
- `apps/admin/src/app/layout.tsx` - Updated metadata and Tailwind body classes
- `apps/admin/tsconfig.json` - Added empty paths override for tsc/next build compatibility
- `.env.example` - Added NEXT_PUBLIC_API_URL for frontend API configuration
- `pnpm-lock.yaml` - Updated lockfile with new dependencies

## Decisions Made
- **API tsconfig module resolution:** Set `module: ESNext` and `moduleResolution: Bundler` in the API tsconfig, following the same pattern established for library packages in Plan 02. This resolves ESM/CJS boundary issues with @t3-oss/env-core while NestJS CLI handles actual module bundling for runtime.
- **Biome + NestJS DI compatibility:** Used `biome-ignore lint/style/useImportType` comments on NestJS controller DI imports rather than disabling the rule globally. NestJS's `emitDecoratorMetadata` requires runtime class references in constructor parameters, which `import type` would erase. The per-file ignore keeps the rule active for non-NestJS code.
- **drizzle-orm as direct API dependency:** Added drizzle-orm to the API's package.json because the database health indicator directly imports `sql` from drizzle-orm. In pnpm strict mode, transitive dependencies through @sentinel/db are not accessible.
- **Redis lazyConnect:** RedisHealthIndicator uses `lazyConnect: true` with a 3-second timeout to prevent the API from blocking on startup if Redis is unavailable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed nestjs-otel export name (OtelModule -> OpenTelemetryModule)**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** Plan referenced `OtelModule` from nestjs-otel but the actual export is `OpenTelemetryModule`
- **Fix:** Changed import and usage to `OpenTelemetryModule`
- **Files modified:** apps/api/src/app.module.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** 7c2ba93 (Task 1 commit)

**2. [Rule 3 - Blocking] Added paths: {} override to API tsconfig**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** Inherited @sentinel/* paths from tsconfig.base.json caused TS5090 error when running tsc from API directory (same issue as Plan 02 packages)
- **Fix:** Added `"paths": {}` to apps/api/tsconfig.json
- **Files modified:** apps/api/tsconfig.json
- **Verification:** tsc --noEmit passes
- **Committed in:** 7c2ba93 (Task 1 commit)

**3. [Rule 3 - Blocking] Set ESNext module + Bundler resolution for API tsconfig**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** Node16 module system caused TS1479 when @sentinel/config imports ESM-only @t3-oss/env-core
- **Fix:** Set `module: ESNext` and `moduleResolution: Bundler` in API tsconfig
- **Files modified:** apps/api/tsconfig.json
- **Verification:** tsc --noEmit passes; NestJS CLI handles actual module bundling
- **Committed in:** 7c2ba93 (Task 1 commit)

**4. [Rule 3 - Blocking] Added drizzle-orm as direct API dependency**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** Database health indicator imports `sql` from drizzle-orm directly, but pnpm strict mode prevents accessing transitive deps through @sentinel/db
- **Fix:** Added `drizzle-orm: ^0.45.0` to apps/api/package.json
- **Files modified:** apps/api/package.json, pnpm-lock.yaml
- **Verification:** tsc --noEmit passes
- **Committed in:** 7c2ba93 (Task 1 commit)

**5. [Rule 1 - Bug] Fixed Biome lint issues (formatting, import ordering, useImportType)**
- **Found during:** Task 1 (Biome lint verification)
- **Issue:** New files had tab indentation (Biome expects spaces), unsorted imports, and useImportType rule conflicted with NestJS DI
- **Fix:** Ran biome check --write for auto-fixable issues; added biome-ignore comments for NestJS DI imports
- **Files modified:** All new API source files
- **Verification:** pnpm lint passes with 0 errors
- **Committed in:** 7c2ba93 (Task 1 commit)

**6. [Rule 3 - Blocking] Added paths: {} to web and admin tsconfigs**
- **Found during:** Task 2 (Next.js build)
- **Issue:** Same inherited paths issue caused Next.js build failure with TS5090
- **Fix:** Added `"paths": {}` to apps/web/tsconfig.json and apps/admin/tsconfig.json
- **Files modified:** apps/web/tsconfig.json, apps/admin/tsconfig.json
- **Verification:** next build passes for both apps
- **Committed in:** 8742eb1 (Task 2 commit)

---

**Total deviations:** 6 auto-fixed (2 bugs, 4 blocking)
**Impact on plan:** All auto-fixes necessary for TypeScript compilation, Next.js builds, and Biome compliance. No scope creep.

## Issues Encountered
- nestjs-otel package exports `OpenTelemetryModule`, not `OtelModule` as commonly referenced in older documentation. Discovered via runtime inspection of the package exports.
- NestJS emitDecoratorMetadata + Biome useImportType rule incompatibility: Biome suggests `import type` for constructor-injected classes, but NestJS DI requires runtime class references. Resolved with biome-ignore comments.
- Inherited `paths` in tsconfig.base.json continues to cause TS5090 errors in all sub-packages. This is a known pattern from Plan 02 that must be applied to every app/package tsconfig.

## User Setup Required

None - no external service configuration required. Run `make up && pnpm dev` to start the full stack.

## Next Phase Readiness
- API is ready to receive domain modules (Phase 2+) -- health check infrastructure, logging, and tracing are in place
- Health check pattern (custom HealthIndicator) is established for adding new service checks
- Correlation ID middleware is globally applied for request tracing across the stack
- Frontend apps are ready for feature development -- Tailwind CSS, API polling, and error handling patterns established
- Full developer experience: `make up && pnpm dev` starts Postgres, Redis, API, web, and admin

## Self-Check: PASSED

- All 12 key files verified present
- Both task commits (7c2ba93, 8742eb1) verified in git log
- TypeScript compilation passes for @sentinel/api
- Biome lint passes (61 files checked, 0 errors)
- Next.js builds pass for both @sentinel/web and @sentinel/admin

---
*Phase: 01-monorepo-foundation*
*Completed: 2026-03-01*
