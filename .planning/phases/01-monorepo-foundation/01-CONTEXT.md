# Phase 1: Monorepo Foundation - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Nx monorepo scaffolding with apps, shared packages, Docker dev environment, environment configuration, structured logging, full observability stack, and linting. A developer can clone the repo, run setup commands, and have a fully operational local environment with all tooling.

</domain>

<decisions>
## Implementation Decisions

### Frontend Stack
- Next.js (App Router) for both apps/web and apps/admin
- Tailwind CSS + shadcn/ui for styling (components in packages/ui)
- TanStack Query + Zustand for state management
- React Hook Form + Zod for form handling
- tRPC client for internal apps, generated REST SDK for external consumers (both in packages/api-client)

### Backend Stack
- NestJS for apps/api
- Drizzle ORM for packages/db (multi-database architecture — at least 2 databases: control + tenant)
- BullMQ for background jobs (Redis as broker)
- Pino for structured logging

### Documentation & Worker
- Nextra (Next.js-based) for apps/docs — stub only in Phase 1
- BullMQ for apps/worker — stub only in Phase 1

### Runtime & Language
- Node.js 22 LTS minimum target
- TypeScript strict mode with noUncheckedIndexedAccess
- Shared tsconfig base configs: root tsconfig.base.json, separate configs for Node (API), React (Web/Admin), library packages

### Database & Cache
- PostgreSQL 16
- Redis 7

### Testing
- Vitest for unit/integration tests
- Playwright for E2E tests (setup in Phase 1, used as features are built)

### App Scaffolding Depth
- **Functional in Phase 1:** apps/api, apps/web, apps/admin — all boot and serve content
- **Stubs for later:** apps/worker, apps/docs — documented with package.json + entry point, not functional
- **Functional packages:** packages/config (Zod env validation), packages/db (Drizzle setup + connection), packages/shared (Result type + error types)
- **Stub packages:** packages/api-client, packages/ui, packages/validators, packages/auth — barrel exports only
- API initial surface: health endpoint + system info endpoint (env, versions, connected services)
- Web and Admin initial UI: landing page showing app name, API connection status, environment info

### Sentry & Feature Flags
- Sentry-compatible error tracking (self-hosted in Docker Compose) — Claude's discretion on which clone (GlitchTip vs alternatives)
- Flagsmith self-hosted in Docker Compose for feature flags
- Flagsmith integration pattern: Claude's discretion (server-side only vs server+client SDKs)

### Docker Dev Environment
- Persistent volumes for Postgres and Redis
- Convenience scripts: docker compose down + volume prune (clean slate), and wipe + re-run migrations
- All ports configurable via .env, defaulting to 3500 range
- Dev mode: Claude's discretion — user prefers single `docker compose up/down` for convenience
- pgAdmin in Docker + Drizzle Studio available via pnpm script
- Traefik reverse proxy for hostname-based routing (api.localhost, web.localhost, admin.localhost)
- Mailpit SMTP catcher in Docker Compose
- Redis serves as message broker (no separate broker needed)
- Docker Compose profiles: core (Postgres, Redis) and full (adds pgAdmin, Flagsmith, Sentry clone, Mailpit, Traefik, Grafana stack)
- Custom bridge network: sentinel-net
- Makefile for Docker/infra operations, pnpm scripts for app operations

### Docker Compose Services Summary
- **Core profile:** PostgreSQL 16, Redis 7
- **Full profile adds:** pgAdmin, Flagsmith, Sentry clone, Mailpit, Traefik, Grafana, Loki, Prometheus, Jaeger

### Logging & Observability
- Debug log level in dev, Info in production (LOG_LEVEL env var)
- pino-pretty for human-readable dev logs, raw JSON in production
- Request context in every log: correlationId (UUID), tenantId, userId, requestPath, method
- Full observability stack:
  - Pino → Loki (log aggregation) → Grafana (visualization)
  - OpenTelemetry SDK → Jaeger (distributed tracing) → Grafana
  - NestJS metrics endpoint → Prometheus (metrics scraping) → Grafana

### Package Conventions
- @sentinel/ scope for all packages (e.g., @sentinel/db, @sentinel/config)
- Fixed/unified versioning across all packages

### Git & CI
- Conventional Commits (feat:, fix:, chore:) enforced via commitlint + husky
- Husky + lint-staged for pre-commit hooks (Biome lint/format on staged files)
- GitHub Actions CI: lint, type-check, test on push/PR

### Repo Housekeeping
- Comprehensive .gitignore (Node, Next.js, Nx, Docker, IDE, env, OS files)
- .env.example with every variable, default values, and inline comments
- VSCode settings + recommended extensions (Biome, Tailwind IntelliSense, Nx Console) + EditorConfig
- Root README: prerequisites, clone + setup, architecture diagram, package descriptions, available scripts
- CONTRIBUTING.md with branch naming, PR template, code review checklist, package creation guidelines
- Dependabot for automated dependency updates + SECURITY.md vulnerability reporting process + .npmrc strict audit
- No license for now

### Claude's Discretion
- Sentry clone choice (GlitchTip vs alternatives — lean toward lightest Docker option)
- Flagsmith integration pattern (server-side only vs server+client)
- Dev mode approach (everything in Docker vs hybrid) — user prefers compose up/down convenience
- Database initial migration scope (config + connection, multi-DB aware from start)
- Loading skeletons and error states for initial landing pages
- Exact port assignments within 3500 range

</decisions>

<specifics>
## Specific Ideas

- "This is at least a 2 database application" — multi-database architecture from the start (control DB + tenant DBs)
- Sentry and Flagsmith from the beginning so they don't get forgotten
- Self-hosted for both Sentry clone and Flagsmith — mirrors production deployment
- User prefers single `docker compose up/down` over managing individual processes
- Ports should be configurable per-service via .env with a 3500 range default grouping
- Need scripts for: clean slate (compose down + volume prune) and DB reset (wipe + re-run migrations)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, empty repository

### Established Patterns
- None yet — Phase 1 establishes all foundational patterns

### Integration Points
- Not applicable for Phase 1 — this phase creates the integration points

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-monorepo-foundation*
*Context gathered: 2026-02-28*
