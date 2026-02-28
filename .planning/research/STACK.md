# Technology Stack

**Project:** Sentinel Suite v0.1 -- Platform Core
**Researched:** 2026-02-28
**Overall Confidence:** MEDIUM (training data through mid-2025; no live verification available -- versions should be confirmed via `npm view <pkg> version` before scaffolding)

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| NestJS | ^11.x | Backend framework | Modular architecture with DI, decorators, guards, interceptors maps directly to multi-module security platform. Enterprise patterns (CQRS, microservices-ready) align with DOE-grade requirements. Best TypeScript backend framework for this use case -- no real competition for enterprise Node.js. | HIGH |
| Next.js | ^15.x | Frontend framework | App Router with RSC for admin/web interfaces. Strong TypeScript support. tRPC integration is first-class. | HIGH |
| Nx | ^20.x | Monorepo orchestration | Task caching, dependency graph, affected commands. Only real choice for NestJS+Next.js monorepo at scale. TurboRepo lacks NestJS plugin ecosystem. | HIGH |
| pnpm | ^9.x | Package manager | Disk-efficient, strict dependency resolution, workspace protocol. Required by project constraints. | HIGH |
| TypeScript | ^5.7 | Language | Strict mode enabled. `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` for security-critical code. | HIGH |

### Database

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| PostgreSQL | 16+ | Primary database | Row-level security for logical multi-tenancy, schemas for DB-per-tenant, JSONB for flexible metadata, strong audit/compliance ecosystem. Required by project constraints. | HIGH |
| Drizzle ORM | ^0.38+ | ORM / query builder | **See detailed rationale below.** SQL-first approach with full TypeScript inference. Superior multi-tenant support via dynamic schema switching. No code generation step. Lightweight, composable, gives full control over queries -- critical for RLS policies and schema-per-tenant patterns. | MEDIUM |
| drizzle-kit | ^0.30+ | Migrations | Generates SQL migrations from schema changes. Supports multiple schemas natively. | MEDIUM |
| Redis (via ioredis) | 7+ / ^5.x | Session store, caching | Fast session lookups, rate limiting, cache layer. Bull/BullMQ job queue backing store. | HIGH |

### Infrastructure

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Docker | 24+ | Containerization | Required for both SaaS and self-hosted DOE deployment. Multi-stage builds for minimal images. | HIGH |
| Docker Compose | 2.x | Local development | Orchestrates PostgreSQL, Redis, API, workers locally. | HIGH |
| Vitest | ^2.x | Testing | Fast, native ESM, TypeScript-first. Jest-compatible API but significantly faster. Nx has Vitest plugin. | HIGH |
| Biome | ^1.9+ | Linting/formatting | Replaces ESLint + Prettier. Single tool, extremely fast (Rust-based). Consistent formatting without config wars. | MEDIUM |

### API Layer

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| tRPC | ^11.x | Type-safe API | End-to-end type safety between Next.js and NestJS. Eliminates API contract drift. v11 (previously v11 was expected as next major after v10) brings improved performance. Required by project constraints. | MEDIUM |
| @trpc/server | ^11.x | Server adapter | NestJS integration via custom adapter or nestjs-trpc. | MEDIUM |
| @trpc/client | ^11.x | Client SDK | React Query integration for Next.js frontend. | MEDIUM |
| trpc-nestjs-adapter | latest | NestJS bridge | Connects tRPC router to NestJS HTTP adapter. Handles DI context forwarding. | LOW |
| Zod | ^3.24+ | Schema validation | Runtime validation for tRPC inputs. Shared between frontend/backend via packages/validators. Also used for environment variable validation. | HIGH |

### Authentication & Authorization

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @nestjs/passport + passport | ^11.x / ^0.7 | Authentication strategies | NestJS-native integration. Modular strategy pattern supports username/password now, SSO/SAML/CAC later. Proven in enterprise. | HIGH |
| passport-local | ^1.x | Username/password auth | v0.1 authentication strategy. Simple, well-tested. | HIGH |
| CASL | ^6.x | Authorization (RBAC+ABAC) | **The** library for hybrid RBAC+ABAC in JavaScript. Defines abilities declaratively. Supports attribute-based conditions (location, time, tenant). NestJS integration via @casl/ability. Actively maintained. Nothing else comes close for this use case. | HIGH |
| @casl/ability | ^6.x | Core CASL engine | Defines and checks permissions. | HIGH |
| @casl/prisma or custom Drizzle adapter | ^6.x | DB query filtering | Translates CASL abilities into database WHERE clauses. (If using Drizzle, a thin custom adapter is needed -- see Pitfalls.) | MEDIUM |
| bcrypt (via bcryptjs) | ^2.x | Password hashing | Pure JS implementation. No native compilation issues in Docker. Cost factor 12+. | HIGH |
| @nestjs/jwt | ^11.x | JWT token handling | Access tokens for API auth. Short-lived (15min) with refresh token rotation. | HIGH |

### Session & Token Management

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| express-session + connect-redis | ^1.x / ^8.x | Server-side sessions | Redis-backed sessions for web UI. Stateful session allows instant revocation (critical for security platform). | HIGH |
| JWT (via @nestjs/jwt) | -- | API access tokens | Short-lived access tokens (15min) + opaque refresh tokens stored in DB. Dual approach: sessions for web, JWT for API/M2M. | HIGH |

### Audit Logging

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Custom NestJS interceptor + PostgreSQL | -- | Audit trail | NestJS interceptor captures who/what/when/where on every mutation. Writes to append-only audit table with PostgreSQL `INSERT`-only grants (no UPDATE/DELETE). Immutability enforced at DB level. | HIGH |
| PostgreSQL partitioning | -- | Audit table management | Partition audit_logs by month for query performance and retention management. | MEDIUM |

### Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| @nestjs/config | ^4.x | Configuration management | Always. Typed, validated env config via Zod schemas. | HIGH |
| @nestjs/throttler | ^6.x | Rate limiting | Always. Protects auth endpoints from brute force. Redis-backed for distributed rate limiting. | HIGH |
| @nestjs/schedule | ^5.x | Cron jobs | Session cleanup, audit log rotation, tenant health checks. | HIGH |
| helmet | ^8.x | HTTP security headers | Always. Sets CSP, HSTS, X-Frame-Options etc. | HIGH |
| nestjs-cls | ^4.x | Continuation-local storage | Always. Propagates tenant context, user context, request ID through async call chains without passing parameters. Critical for multi-tenant request scoping. | HIGH |
| nanoid | ^5.x | ID generation | Always. URL-safe unique IDs for public-facing identifiers. UUIDs for DB primary keys via `gen_random_uuid()`. | MEDIUM |
| pino + nestjs-pino | ^9.x / ^4.x | Structured logging | Always. JSON structured logs with request context. 5x faster than winston. | HIGH |
| class-transformer | ^0.5.x | DTO transformation | NestJS request/response serialization. Pairs with class-validator for non-tRPC endpoints. | MEDIUM |
| @nestjs/swagger | ^8.x | OpenAPI documentation | Optional REST endpoints (health checks, webhooks). tRPC endpoints self-document via TypeScript types. | LOW |
| BullMQ | ^5.x | Job queue | Background audit log processing, email sending, tenant provisioning. Redis-backed. | HIGH |

---

## Detailed Decision Rationale

### ORM: Drizzle over Prisma over TypeORM

This is the most consequential technology decision for v0.1.

**Why Drizzle:**

1. **Multi-tenant schema switching:** Drizzle allows dynamic `SET search_path` and schema-qualified queries natively. You construct queries with `schema.tableName` syntax. For database-per-tenant (DOE), you create a new Drizzle instance per connection. For logical isolation, you use PostgreSQL schemas. Prisma requires `$executeRawUnsafe('SET search_path TO ...')` which is fragile and poorly typed.

2. **No code generation:** Prisma requires `prisma generate` after every schema change, which adds a build step, complicates CI/CD, and creates `.prisma/client` artifacts. Drizzle schemas are just TypeScript -- import and use. This matters in an Nx monorepo where build caching and dependency graph clarity are critical.

3. **SQL-first composability:** Drizzle lets you write raw SQL fragments inline with the query builder. For Row-Level Security policies, audit triggers, and complex multi-tenant queries, you need this control. Prisma abstracts SQL away, which is a liability when you need RLS policies like `CREATE POLICY tenant_isolation ON table USING (tenant_id = current_setting('app.tenant_id'))`.

4. **Performance:** Drizzle generates queries directly -- no query engine layer like Prisma's Rust binary. For a security platform handling thousands of audit log writes, this matters.

5. **Type inference:** Drizzle infers types from the schema definition. Select fields, joins, and conditions are fully typed without generated client code.

**Why not Prisma:**

- Code generation adds monorepo complexity (build order dependencies, cache invalidation)
- Poor dynamic schema support for multi-tenant patterns
- Prisma Client binary (~15MB) bloats Docker images
- `$queryRaw` and `$executeRaw` lose type safety -- you end up in escape hatches frequently for RLS/multi-tenant work
- Relation queries are convenient but hide N+1 problems behind magic

**Why not TypeORM:**

- Decorator-heavy approach creates circular dependency issues in large codebases
- Active Record pattern fights NestJS's DI/repository pattern
- Migration system is fragile and poorly maintained
- TypeScript support is bolted on, not native -- type inference is weak
- Community momentum has shifted away; fewer updates, more open issues
- The NestJS docs still reference it but ecosystem sentiment has moved to Prisma/Drizzle

**CASL + Drizzle gap:** CASL has `@casl/prisma` for translating abilities to Prisma queries but no official Drizzle adapter. You will need a thin custom adapter (~100-200 lines) that converts CASL conditions to Drizzle `where` clauses. This is the primary risk of choosing Drizzle over Prisma. The adapter is straightforward since CASL conditions are plain objects, but it is custom code that must be maintained.

**Confidence:** MEDIUM -- Drizzle is the right architectural fit but is younger than Prisma. Verify current Drizzle version and NestJS integration maturity before committing. If `drizzle-orm` is below v1.0 at scaffolding time, evaluate whether the API surface is stable enough. As of training data (mid-2025), Drizzle 0.3x was stable and widely adopted but not yet v1.

### Module Organization: `packages/` Libraries + `apps/api/src/modules/`

**Recommendation:** Domain modules live inside `apps/api/src/modules/` as NestJS modules. Shared code (types, validators, DB schema) lives in `packages/`.

**Why not top-level `modules/`:**

1. **Nx project graph:** Nx understands `apps/` and `packages/` (or `libs/`) natively. A top-level `modules/` folder requires custom project graph plugins or manual `project.json` files in each module. This creates friction.

2. **NestJS module system:** NestJS modules are decorators on classes that register providers, controllers, and imports. They must be compiled and loaded together as part of the NestJS application. Putting them outside `apps/api/` means configuring TypeScript paths, Nx build targets, and barrel exports -- all for code that only the API app consumes.

3. **Shared code goes to packages:** If a module's types, validators, or DB schema are needed by the frontend, extract those to `packages/shared`, `packages/validators`, or `packages/db`. The NestJS-specific code (controllers, services, guards) stays in the app.

**Structure:**

```
apps/api/src/modules/
  auth/
    auth.module.ts
    auth.service.ts
    auth.controller.ts    # or auth.router.ts for tRPC
    guards/
    strategies/
    dto/
  tenancy/
    tenancy.module.ts
    tenant.service.ts
    tenant-context.middleware.ts
  audit/
    audit.module.ts
    audit.service.ts
    audit.interceptor.ts
  users/
    users.module.ts
    users.service.ts

packages/
  db/           # Drizzle schema, migrations, connection utilities
  shared/       # Shared types, constants, enums
  validators/   # Zod schemas shared between frontend and backend
  auth/         # Auth types, permission definitions (used by frontend for UI guards)
```

**Confidence:** HIGH -- This follows standard Nx + NestJS conventions.

### Authentication: Passport.js with Custom Guards

**Why Passport.js:**

1. **Strategy pattern:** Start with `passport-local` (username/password), add `passport-jwt` for API tokens. Later milestones add `passport-saml`, `passport-openidconnect`, and custom CAC/PIV strategies. The strategy pattern means new auth methods are additive, not refactoring.

2. **NestJS first-class support:** `@nestjs/passport` wraps Passport cleanly with `AuthGuard` decorators. Well-documented, battle-tested.

3. **Not over-engineering:** A custom auth implementation from scratch is tempting for a security platform but introduces risk. Passport handles the session serialization, strategy chaining, and error handling that you would have to reimplement.

**Why not Auth.js (NextAuth):** Auth.js is frontend-focused. For a NestJS backend that must be the authority for auth decisions (not the frontend), Passport on the backend is correct. Auth.js can complement it later for the Next.js frontend session, but the backend must own authentication.

**Why not Keycloak/Ory:** External auth services add deployment complexity for self-hosted DOE installations. v0.1 needs to prove the auth model with minimal dependencies. Keycloak is Java-heavy and overkill for v0.1. Ory (Hydra/Kratos) is excellent but adds infrastructure requirements that conflict with "Docker self-hosted for DOE facilities."

**Confidence:** HIGH -- Passport.js + NestJS is the standard enterprise pattern.

### Authorization: CASL for Hybrid RBAC+ABAC

**Why CASL:**

1. **Declarative ability definitions:** Define what a user can do with subjects and conditions:
   ```typescript
   can('read', 'Report', { siteId: { $in: user.assignedSites } })
   can('manage', 'User', { tenantId: user.tenantId, role: { $ne: 'super_admin' } })
   ```

2. **Attribute-based conditions:** Location, time-of-day, tenant, clearance level -- all expressible as conditions on abilities. This is the ABAC in hybrid RBAC+ABAC.

3. **Role composition:** Roles map to sets of abilities. A "Site Security Manager" gets a different ability set than "Regional Director." RBAC is the organizational model; ABAC is the enforcement model.

4. **Frontend integration:** CASL abilities serialize to JSON and can be sent to the frontend for UI-level permission checks (show/hide buttons, menu items). Same permission logic, both sides.

5. **No real alternative:** For JavaScript RBAC+ABAC, CASL is the only mature, maintained library. `accesscontrol` is abandoned. `casbin` (Node.js port) is less TypeScript-native and uses policy files rather than code-defined abilities.

**Confidence:** HIGH -- CASL is the clear choice.

### Session Management: Hybrid JWT + Server-Side Sessions

**Approach:**

- **Web UI (Next.js):** Server-side sessions via `express-session` + Redis. Session ID in httpOnly, secure, sameSite cookie. Allows instant session revocation (critical for security platform -- if an account is compromised, kill all sessions immediately).
- **API/M2M:** Short-lived JWT access tokens (15 minutes) + opaque refresh tokens stored in database. Refresh token rotation with automatic revocation of the family on reuse detection.
- **Session table in PostgreSQL:** Tracks all active sessions with metadata (IP, user agent, last activity). Displayed in user's "Active Sessions" view. Audit-logged on creation and destruction.
- **Redis session store:** `connect-redis` adapter for express-session. Sessions expire after configurable inactivity timeout (default 30 minutes for DOE compliance).

**Why not JWT-only:** JWTs cannot be revoked without a revocation list, which defeats the purpose. For a security platform, instant session termination is non-negotiable. Server-side sessions with Redis provide this.

**Why not sessions-only (no JWT):** API-to-API communication (worker processes, future M2M) needs stateless tokens. JWT is correct for these use cases.

**Confidence:** HIGH -- Hybrid approach is standard for security-critical applications.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| ORM | Drizzle | Prisma | Code generation complicates Nx monorepo; poor dynamic schema support for multi-tenancy; SQL escape hatches lose type safety |
| ORM | Drizzle | TypeORM | Weak TypeScript inference; fragile migrations; declining community momentum; decorator issues with DI |
| Auth | Passport.js | Custom implementation | Unnecessary risk; Passport handles edge cases (session serialization, strategy chaining) |
| Auth | Passport.js | Keycloak/Ory | Adds external Java/Go service; complicates self-hosted DOE deployment; overkill for v0.1 |
| AuthZ | CASL | Casbin (Node.js) | Policy files vs code-defined abilities; less TypeScript-native; more complex setup |
| AuthZ | CASL | accesscontrol | Abandoned/unmaintained |
| Testing | Vitest | Jest | Vitest is faster, native ESM, TypeScript-first. Jest config bloat in monorepo. Nx has vitest plugin. |
| Linting | Biome | ESLint + Prettier | Single tool vs two. Biome is 10-100x faster (Rust). Less config. Caveat: fewer plugins than ESLint ecosystem. |
| Logging | Pino | Winston | 5x faster, structured JSON by default, lower overhead. Winston is more configurable but slower. |
| Queue | BullMQ | Agenda/Bee | BullMQ is the standard for Node.js job queues. Redis-backed (already using Redis). Repeat jobs, rate limiting, concurrency control. |
| Package Manager | pnpm | npm/yarn | Strict dependency resolution prevents phantom deps. Workspace protocol. Disk efficient. Required by project constraints. |

---

## Version Verification Needed

**IMPORTANT:** The following versions are from training data (mid-2025). Before scaffolding, verify with `npm view <package> version`:

| Package | Stated Version | Verify Because |
|---------|---------------|----------------|
| drizzle-orm | ^0.38+ | May have reached v1.0 or changed API surface |
| @nestjs/core | ^11.x | NestJS 11 may or may not have shipped; verify latest major |
| nx | ^20.x | Nx ships frequently; may be v21+ |
| tRPC | ^11.x | tRPC v11 was in development; may still be v10 |
| @casl/ability | ^6.x | Stable but verify |
| next | ^15.x | Next.js 15 shipped; verify if 16 is out |
| biome | ^1.9+ | Young project, verify stability |

---

## Installation

```bash
# Initialize Nx workspace
npx create-nx-workspace@latest sentinel-suite --preset=ts --pm=pnpm

# Core NestJS (verify versions before running)
pnpm add @nestjs/core @nestjs/common @nestjs/platform-express rxjs reflect-metadata
pnpm add -D @nestjs/cli @nestjs/schematics @nestjs/testing

# Database
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit

# Auth
pnpm add @nestjs/passport passport passport-local @nestjs/jwt passport-jwt bcryptjs
pnpm add -D @types/passport-local @types/passport-jwt @types/bcryptjs

# Authorization
pnpm add @casl/ability

# Session
pnpm add express-session connect-redis ioredis
pnpm add -D @types/express-session

# API
pnpm add @trpc/server @trpc/client zod
pnpm add -D @trpc/react-query  # for Next.js frontend

# Utilities
pnpm add nestjs-cls nestjs-pino pino pino-pretty helmet
pnpm add @nestjs/config @nestjs/throttler @nestjs/schedule
pnpm add bullmq nanoid class-transformer class-validator

# Testing
pnpm add -D vitest @vitest/coverage-v8 supertest @types/supertest

# Linting
pnpm add -D @biomejs/biome
```

---

## Sources & Confidence Notes

All recommendations are based on training data through mid-2025. The NestJS, PostgreSQL, Passport.js, CASL, and Redis recommendations are HIGH confidence because these are mature, stable technologies with well-established patterns. The Drizzle ORM recommendation is MEDIUM confidence because while architecturally superior for this use case, it is a younger project that may have undergone API changes. tRPC version is LOW confidence -- verify whether v11 has shipped or if v10 is still current.

No live verification was available during this research session. **Before scaffolding, run `npm view <pkg> version` for all packages listed above.**
