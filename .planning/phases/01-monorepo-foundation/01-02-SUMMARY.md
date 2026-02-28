---
phase: 01-monorepo-foundation
plan: 02
subsystem: infra
tags: [t3-env, zod, drizzle-orm, postgres, redis, docker-compose, grafana, prometheus, loki, jaeger, traefik, makefile]

# Dependency graph
requires:
  - phase: 01-monorepo-foundation/01
    provides: Nx workspace structure, package stubs, TypeScript configs, pnpm workspaces
provides:
  - Zod-validated environment configuration via @t3-oss/env-core (@sentinel/config)
  - Drizzle ORM database client with control DB instance and tenant factory (@sentinel/db)
  - Control database schema (system_info table) for health check verification
  - Docker Compose infrastructure with core (Postgres + Redis) and full (11 services) profiles
  - Grafana auto-provisioned with Loki, Prometheus, and Jaeger datasources + overview dashboard
  - Makefile with 8 Docker convenience targets (up, up-full, down, clean, reset-db, logs, ps, help)
affects: [01-03, 02-tenancy, 03-api-layer, all-future-phases]

# Tech tracking
tech-stack:
  added: ["@t3-oss/env-core@0.13", "zod@4.3", "drizzle-orm@0.45", "pg@8.19", "drizzle-kit@0.31"]
  patterns: [t3-env-server-validation, drizzle-multi-db-pattern, docker-compose-profiles, makefile-docker-ops]

key-files:
  created:
    - packages/config/src/env.ts
    - packages/db/src/client.ts
    - packages/db/src/schema/control.ts
    - packages/db/drizzle.control.config.ts
    - docker/docker-compose.yml
    - docker/init-scripts/01-create-databases.sql
    - docker/grafana/provisioning/datasources/datasources.yml
    - docker/grafana/provisioning/dashboards/dashboards.yml
    - docker/grafana/dashboards/sentinel-overview.json
    - docker/prometheus/prometheus.yml
    - docker/loki/loki-config.yml
    - docker/traefik/traefik.yml
    - Makefile
  modified:
    - packages/config/package.json
    - packages/config/src/index.ts
    - packages/config/tsconfig.json
    - packages/db/package.json
    - packages/db/src/index.ts
    - packages/db/tsconfig.json
    - .env.example

key-decisions:
  - "Library packages use module: ESNext + moduleResolution: Bundler to support ESM-only deps (t3-env, drizzle) while consumed by CJS apps"
  - "Drizzle Kit config excluded from tsconfig include -- standalone tool config used by drizzle-kit directly"
  - "Zod v4 selected (compatible with t3-env 0.13.10 via StandardSchema)"

patterns-established:
  - "Environment validation: import { env } from @sentinel/config provides typed, validated env vars"
  - "Database client pattern: controlDb singleton + createTenantDb factory + closeConnections for shutdown"
  - "Docker profiles: core (Postgres + Redis) for fast dev, full for complete stack"
  - "Makefile targets: make up / make up-full / make down / make clean / make reset-db"

requirements-completed: [INFR-03, INFR-04]

# Metrics
duration: 8min
completed: 2026-02-28
---

# Phase 1 Plan 2: Config, Database, and Docker Infrastructure Summary

**Zod-validated env config via @t3-oss/env-core, Drizzle ORM multi-database client with control schema, and Docker Compose with 11 services across core/full profiles**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-28T23:37:33Z
- **Completed:** 2026-02-28T23:45:52Z
- **Tasks:** 2
- **Files modified:** 20

## Accomplishments
- @sentinel/config validates 12 server environment variables at import time with clear Zod error messages for missing/invalid values
- @sentinel/db provides controlDb (Drizzle instance), createTenantDb factory for Phase 2+ multi-tenancy, and closeConnections for graceful shutdown
- Docker Compose core profile starts Postgres 16 + Redis 7 with health checks, persistent volumes, and init script for multi-database creation
- Docker Compose full profile adds 9 more services: Traefik, Grafana, Loki, Prometheus, Jaeger, GlitchTip, Flagsmith, Mailpit, pgAdmin
- Grafana auto-provisions all three observability datasources and ships with a Sentinel Overview dashboard (4 panels)
- Makefile provides 8 self-documenting targets for all Docker operations

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement @sentinel/config and @sentinel/db** - `8128bf3` (feat)
2. **Task 2: Create Docker Compose infrastructure and Makefile** - `46b1dbe` (feat)

## Files Created/Modified
- `packages/config/src/env.ts` - Zod-validated environment variables via @t3-oss/env-core createEnv (12 server vars)
- `packages/config/src/index.ts` - Barrel export for env and Env type
- `packages/config/package.json` - Added @t3-oss/env-core, zod, @types/node dependencies
- `packages/config/tsconfig.json` - Set ESNext module + Bundler resolution for ESM compat
- `packages/db/src/client.ts` - Drizzle ORM client: controlDb instance, createTenantDb factory, closeConnections
- `packages/db/src/schema/control.ts` - system_info pgTable for health check verification
- `packages/db/src/index.ts` - Barrel exports for all db functionality
- `packages/db/drizzle.control.config.ts` - Drizzle Kit config for control database migrations
- `packages/db/package.json` - Added drizzle-orm, pg, drizzle-kit, scripts
- `packages/db/tsconfig.json` - Set ESNext module + Bundler resolution, disabled composite
- `docker/docker-compose.yml` - 11 services with core/full profiles, sentinel-net network, volumes
- `docker/init-scripts/01-create-databases.sql` - Creates glitchtip and flagsmith databases
- `docker/grafana/provisioning/datasources/datasources.yml` - Loki, Prometheus, Jaeger datasources
- `docker/grafana/provisioning/dashboards/dashboards.yml` - Dashboard file provider config
- `docker/grafana/dashboards/sentinel-overview.json` - 4-panel overview: request rate, logs, traces, response time
- `docker/prometheus/prometheus.yml` - Scrape config targeting sentinel-api:9464
- `docker/loki/loki-config.yml` - Loki with filesystem storage, schema v13
- `docker/traefik/traefik.yml` - Docker provider, web entrypoint, dashboard enabled
- `Makefile` - 8 targets: up, up-full, down, clean, reset-db, logs, ps, help
- `.env.example` - Reorganized with grouped sections matching Docker services

## Decisions Made
- **ESNext module for library packages:** Config and db packages use `module: ESNext` + `moduleResolution: Bundler` in their tsconfigs to support ESM-only dependencies (@t3-oss/env-core) while being consumed by CJS NestJS apps. Bundler resolution is appropriate since these are internal packages consumed through transpilation, not directly by Node.js.
- **Zod v4 over v3:** Zod 4.3.6 installed (latest stable). Compatible with @t3-oss/env-core 0.13.10 via the StandardSchema universal interface.
- **Drizzle Kit config excluded from tsconfig:** The drizzle.control.config.ts is a standalone tool config for drizzle-kit CLI, not compiled as part of the library package. Keeping it out of tsconfig avoids rootDir conflicts.
- **paths: {} override in sub-package tsconfigs:** The root tsconfig.base.json defines `@sentinel/*` path mappings which resolve from the root but not from sub-packages. Library packages override with empty paths since pnpm workspace resolution handles cross-package imports.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added @types/node to config and db packages**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** tsconfig.node.json specifies `"types": ["node"]` but @types/node was not installed in config or db packages, causing TS2688 errors
- **Fix:** Added @types/node as devDependency to both packages
- **Files modified:** packages/config/package.json, packages/db/package.json
- **Verification:** tsc --noEmit passes for both packages
- **Committed in:** 8128bf3 (Task 1 commit)

**2. [Rule 3 - Blocking] Set ESNext module + Bundler moduleResolution for library packages**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** Root tsconfig uses Node16 module/resolution which enforces strict ESM/CJS boundaries. @t3-oss/env-core is ESM-only, causing TS1479 when imported from CJS context
- **Fix:** Set `module: ESNext` and `moduleResolution: Bundler` in config and db tsconfig overrides
- **Files modified:** packages/config/tsconfig.json, packages/db/tsconfig.json
- **Verification:** tsc --noEmit passes; Biome lint passes
- **Committed in:** 8128bf3 (Task 1 commit)

**3. [Rule 3 - Blocking] Override paths and composite in sub-package tsconfigs**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** Inherited `paths: { "@sentinel/*": ["packages/*/src"] }` from base tsconfig causes TS5090 when running tsc from within sub-package. Composite mode conflicts with drizzle config outside rootDir.
- **Fix:** Set `paths: {}` in both packages, `composite: false` in db package
- **Files modified:** packages/config/tsconfig.json, packages/db/tsconfig.json
- **Verification:** tsc --noEmit passes from sub-package context
- **Committed in:** 8128bf3 (Task 1 commit)

**4. [Rule 1 - Bug] Fixed Biome lint issues (formatting, import order, non-null assertion)**
- **Found during:** Task 1 (Lint verification)
- **Issue:** New source files had formatting differences from Biome's expected output, unsorted imports, and a non-null assertion in drizzle config
- **Fix:** Ran biome check --write for auto-fixable issues; replaced `!` with `as string` in drizzle config
- **Files modified:** packages/config/src/env.ts, packages/config/src/index.ts, packages/db/src/client.ts, packages/db/src/index.ts, packages/db/src/schema/control.ts, packages/db/drizzle.control.config.ts
- **Verification:** pnpm lint passes with 0 errors
- **Committed in:** 8128bf3 (Task 1 commit)

---

**Total deviations:** 4 auto-fixed (1 bug, 3 blocking)
**Impact on plan:** All auto-fixes were necessary for TypeScript compilation and Biome compliance. No scope creep.

## Issues Encountered
- TypeScript compilation from within sub-packages fails when root tsconfig defines paths without baseUrl. Resolved by overriding paths to empty in sub-package tsconfigs (pnpm workspace resolution handles cross-package imports).
- ESM/CJS boundary: @t3-oss/env-core 0.13.10 is ESM-only, but the project's Node16 module system treats .ts files as CJS. Resolved by using Bundler module resolution for library packages.

## User Setup Required

None - no external service configuration required. Docker must be installed for `make up` / `make up-full`.

## Next Phase Readiness
- @sentinel/config and @sentinel/db are ready for consumption by apps/api in Plan 03
- Docker infrastructure is ready for `make up` (core) or `make up-full` (full stack)
- Drizzle migration can be run after starting Postgres: `make up && pnpm --filter @sentinel/db run migrate`
- Control schema (system_info table) is ready for health check verification in Plan 03

## Self-Check: PASSED

- All 14 key files verified present
- Both task commits (8128bf3, 46b1dbe) verified in git log
- TypeScript compilation passes for both @sentinel/config and @sentinel/db
- Biome lint passes (55 files checked, 0 errors)
- Docker Compose validates for both core and full profiles
- Makefile help target lists all 8 targets

---
*Phase: 01-monorepo-foundation*
*Completed: 2026-02-28*
