# Phase 2: Database & Tenant Core - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Provision tenants and enforce data isolation so every query is automatically scoped to the requesting tenant. Covers: tenant registry in control database, RLS-based isolation on shared-tier tenant database, multi-strategy tenant resolution, tenant lifecycle state machine, async provisioning pipeline, and foundational notification provider pattern. Requirements: TNCY-01, TNCY-02, TNCY-03, TNCY-08.

</domain>

<decisions>
## Implementation Decisions

### Tenant Resolution Strategy
- Multi-strategy resolution: Subdomain (primary) > Header > JWT claim
- Slug-based subdomains auto-generated from tenant name, customizable if available
- Multiple subdomains per tenant: one primary (canonical), others are aliases
- Aliases serve transparently (no redirect) — supports white-labeling
- Reserved subdomain list: hardcoded system set (api, admin, app, www, dev, local, docs, status, mail, support, help, billing) + DB reservations (subdomain record with null tenant_id)
- Standard DNS naming rules: lowercase alphanumeric + hyphens, no leading/trailing hyphens, 3-63 chars
- Resolution validates tenant exists AND is active in one step
- API routes return 403 on resolution failure; web routes redirect to landing/login
- BASE_DOMAIN configurable via environment variable
- `*.localhost` with port for local development (e.g., acme.localhost:3500)
- Decorator system: `@Public`, `@Admin`, `@Unauthenticated` from prior architectural discussions
- RLS session variable (SET app.current_tenant_id) set at connection acquisition, NOT during resolution

### Control Database Schema
- Tenant table: primarily normalized columns + JSONB extensions field
- Phase 2 core fields: id, name, slug, status, isolation_tier, nullable connection config (for dedicated-DB tenants)
- Isolation tier enum: shared / dedicated / self-hosted (only shared implemented in Phase 2; dedicated/self-hosted are schema stubs for Phase 9)
- Separate subdomain table: subdomain (unique), tenant_id (nullable for reservations), is_primary (boolean), timestamps
- Provisioning_events table: append-only log of tenant operations (created, activated, suspended, deactivated, config changed)
- Separate tenant_settings table: typed columns (data_retention_days, allow_platform_admin_access, allow_platform_admin_impersonation) + JSONB extensions
- Standard audit columns on ALL tables across the platform: created_at, created_by, modified_at, modified_by, deleted_at (soft delete)
- Configurable retention per tenant
- Keep existing system_info table as-is
- Same drizzle-kit with separate config files per DB target (drizzle.control.config.ts exists, add drizzle.tenant.config.ts)

### RLS Enforcement
- SET app.current_tenant_id custom Postgres config parameter per connection
- Every table in tenant DB has tenant_id column — nullable on shared/reference tables
- Records with NULL tenant_id are platform-wide defaults (created by platform admin); tenants see their own records + shared ones
- Default-deny RLS policy: no rows returned if app.current_tenant_id is not set
- Drizzle transaction wrapper: SET tenant context at start, RESET at end of each transaction
- Auto-inject wrapper handles: tenant_id insertion, audit columns (created_by, modified_by, created_at, modified_at), soft-delete filtering (WHERE deleted_at IS NULL by default)
- `includeDeleted` option for admin/audit queries that need to see soft-deleted records

### Tenant Lifecycle & Status Transitions
- States: provisioning > active > suspended > deactivated
- Validated state machine: only allowed transitions (provisioning→active, active→suspended, active→deactivated, suspended→active, suspended→deactivated)
- Suspended = read-only access; Deactivated = zero access (all requests rejected)
- Data retained per tenant's configured retention policy after deactivation, then auto-purged
- Required reason text for all status transitions (stored in provisioning_events)
- Configurable suspension message visible to tenant admin/contact only; regular users see generic message

### Provisioning API
- Dedicated TenantModule (apps/api/src/tenant/)
- Both tRPC and REST from the start (dual API pattern)
- Full CRUD + dedicated status transition endpoints
- Async provisioning: POST returns 202 + job_id; separate GET /jobs/:id for status polling
- BullMQ (Redis-backed) for provisioning jobs, processed by worker app
- Provisioning workflow: create tenant record → create subdomain(s) → create tenant_settings with defaults → create admin user → queue invite notification → log provisioning event → set status active
- Contact email included in provisioning request for admin user invite
- Cursor-based pagination + filters (status, tier, name search) on tenant list
- Subdomain management as nested resource: POST/GET/DELETE /tenants/:id/subdomains
- Validation schemas in packages/validators (shared across apps)
- Separate jobs endpoint reusable for future async operations

### Notification Provider Pattern
- Shared package: packages/notifications
- Channel-based interface: sendEmail(to, template, data), sendSMS(to, template, data)
- Template-based notifications: named templates with variable interpolation (e.g., 'tenant-invite', 'tenant-suspended')
- Console provider first: outputs via Pino structured logging
- Platform-wide provider configuration (per-tenant deferred to SaaS phase)
- Full delivery tracking: notification table with status lifecycle (queued → sent → delivered/failed/bounced) + webhook support for provider callbacks
- Notification delivery table lives in control database
- Notification sending as separate BullMQ job (decoupled from provisioning flow)

### Connection Pooling & DB Wiring
- Single shared connection pool for all shared-tier tenants
- Separate TENANT_DATABASE_URL environment variable (tenant data separate from control DB)
- Request-scoped provider via nestjs-cls: reads tenant from CLS context, returns configured Drizzle instance
- Drizzle transaction wrapper: SET app.current_tenant_id at start, RESET at end
- Pool configuration via env vars: DB_POOL_MAX, DB_POOL_IDLE_TIMEOUT (added to Zod env schema)
- Separate drizzle.tenant.config.ts for tenant DB migrations
- Extend existing HealthModule with DB health indicators for both control and tenant connections

### Testing Strategy
- Testcontainers: fresh PostgreSQL container per test suite for hermetic isolation
- Dedicated RLS isolation test suite: creates Tenant A data, switches to Tenant B context, asserts zero rows — validates success criteria #4
- Tenant test factory: createTestTenant() helper + withTenantContext(tenantId, fn) wrapper in shared test utils
- E2E tests via supertest: full HTTP lifecycle (POST /tenants → 202 → poll job → verify active)
- State machine test suite: tests every valid and invalid transition, verify suspended=read-only, deactivated=no-access

### Claude's Discretion
- Middleware vs guard for tenant resolution (considering @Public/@Admin/@Unauthenticated decorators)
- System context mechanism for provisioning operations (dedicated DB role vs special tenant ID)
- Redis caching for tenant resolution lookups (TTL, invalidation)
- What data to inject into request context (full tenant object vs ID only)
- nestjs-cls vs alternative for context propagation (requirements call for nestjs-cls)
- User-tenant mapping: whether to include in Phase 2 control DB or defer to Phase 4
- Audit columns: string identifier vs UUID for created_by/modified_by (auth comes in Phase 4)
- Override semantics for shared reference data (hide platform default vs coexist)
- Boot-time DNS/proxy validation approach
- RLS policy management via raw SQL migrations vs Drizzle custom SQL

</decisions>

<specifics>
## Specific Ideas

- Platform admin access should feel like "tech support" — not surveillance. Setting names: allow_platform_admin_access, allow_platform_admin_impersonation
- Subdomains with no associated tenant act as "reservations" — elegant pattern that also enables multi-subdomain support
- Multi-tenant users forced to log out and re-authenticate before switching tenants (no seamless switching)
- Provisioning should seed an admin user and send invite to the tenant contact email
- Notification provider pattern established early: console provider now, real providers later. Channel-based interface (email, SMS)
- "Reserved" subdomains include dev (where dev server lives) and local, plus standard SaaS set

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `controlDb` (packages/db/src/client.ts): Drizzle instance for control database, already configured
- `createTenantDb()` (packages/db/src/client.ts): Tenant database factory, stubbed for Phase 2+
- `CorrelationIdMiddleware` (apps/api/src/common/middleware/): Pattern for request-level middleware that tenant resolution can follow
- `@t3-oss/env-core` with Zod (packages/config/src/env.ts): Env validation pattern for new vars (BASE_DOMAIN, TENANT_DATABASE_URL, pool config)
- `system_info` schema (packages/db/src/schema/control.ts): Existing Drizzle schema pattern to extend with tenant tables
- `HealthModule` (apps/api/src/health/): Existing health check module to extend with DB indicators
- Pino logging infrastructure: Configured with structured JSON and correlation IDs

### Established Patterns
- NestJS module pattern: AppModule with middleware consumer — tenant module follows same structure
- Drizzle ORM with PostgreSQL: Schema-first approach with drizzle-kit for migrations
- Monorepo packages: Shared code in packages/ (db, config, validators, shared, auth)
- Docker Compose for local dev: PostgreSQL and Redis already running

### Integration Points
- `AppModule` (apps/api/src/app.module.ts): Import TenantModule, register tenant middleware
- `packages/config/src/env.ts`: Add BASE_DOMAIN, TENANT_DATABASE_URL, DB_POOL_MAX, DB_POOL_IDLE_TIMEOUT
- `packages/db/`: Add tenant schema files, tenant Drizzle config, extend client.ts
- `apps/worker/`: BullMQ job processors for provisioning and notification sending
- `packages/validators/`: Tenant input validation schemas (create, update, status transition)
- New package: `packages/notifications/` for provider pattern

</code_context>

<deferred>
## Deferred Ideas

- **Impersonation feature** — Needs RBAC (Phase 5). Platform admin impersonation with tenant admin opt-out. Architecture supports it via allow_platform_admin_impersonation setting
- **Multi-tenant user switching** — Needs auth (Phase 4). Users in multiple tenants forced to re-auth on switch. User-tenant mapping table design considered
- **Dedicated/self-hosted DB routing** — Phase 9 (TNCY-05/06/07). Schema supports isolation_tier enum and nullable connection config but routing implementation deferred
- **Per-tenant notification provider config** — Future SaaS phase. Platform-wide provider config for now
- **SaaS features on tenant table** — Billing, limits, contact info columns deferred to SaaS phase. Keep Phase 2 lean

</deferred>

---

*Phase: 02-database-tenant-core*
*Context gathered: 2026-02-28*
