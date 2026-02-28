# Research Summary: Sentinel Suite v0.1 -- Platform Core

**Domain:** Multi-tenant enterprise security platform foundation
**Researched:** 2026-02-28
**Overall Confidence:** MEDIUM (training data through mid-2025; no live version verification available)

---

## Executive Summary

Sentinel Suite v0.1 is a greenfield platform core for a multi-tenant security and compliance platform. The v0.1 scope is deliberately limited to infrastructure: authentication, authorization (hybrid RBAC+ABAC), tiered multi-tenancy, audit logging, and API infrastructure. No domain features (incident reports, patrol tracking, etc.) are built in v0.1 -- the goal is to prove the foundation so every future module inherits DOE-grade access control and audit compliance from day one.

The recommended stack is NestJS + Nx + PostgreSQL + Drizzle ORM + tRPC + CASL, deployed in Docker. This stack was chosen because NestJS provides the modular architecture needed for a platform that will eventually span 17 modules, Drizzle gives the SQL-level control required for multi-tenant PostgreSQL patterns (RLS, schema switching), tRPC eliminates API contract drift between frontend and backend, and CASL is the only mature JavaScript library that supports hybrid RBAC+ABAC authorization with attribute-based conditions.

The architecture follows a modular monolith pattern -- NestJS modules inside `apps/api/src/modules/` with shared code in `packages/`. This is the correct architecture for a solo developer: microservices would add operational overhead without team-size or traffic justification. Well-bounded NestJS modules can be extracted to services later if needed.

The most significant risks are: (1) cross-tenant data leakage from missing query scoping, mitigated by PostgreSQL Row-Level Security as the enforcement layer; (2) authorization model ossifying around pure RBAC when hybrid RBAC+ABAC is required, mitigated by using CASL's policy engine from day one; (3) tRPC + NestJS integration friction due to the two frameworks having different middleware paradigms, mitigated by using tRPC middleware that calls NestJS services rather than trying to use NestJS guards on tRPC routes; and (4) solo developer pattern inconsistency amplified by AI-assisted development, mitigated by conventions documentation, strict linting, and automated integration tests.

## Key Findings

**Stack:** NestJS 11.x + Nx 20.x + PostgreSQL 16+ + Drizzle ORM + tRPC + CASL + Redis + Vitest + Biome. Drizzle over Prisma because multi-tenant schema switching and SQL-level control are critical; no code generation step simplifies the Nx monorepo build graph.

**Architecture:** Modular monolith. Domain modules in `apps/api/src/modules/`. Shared packages in `packages/` (db, shared, validators, auth, config). Three-database topology: control DB (tenant registry), dedicated DBs (DOE tenants), shared DB with RLS (commercial tenants). Request pipeline: Tenant Middleware -> Auth Guard -> RBAC Guard -> ABAC Guard -> Handler -> Audit Interceptor.

**Critical Pitfall:** Cross-tenant data leakage. PostgreSQL RLS must be the enforcement layer, not application-level WHERE clauses alone. Every cache key must include tenant ID. Background jobs must explicitly set tenant context. Automated cross-tenant access tests in CI.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Phase 1: Foundation & Infrastructure** -- Nx monorepo scaffolding, packages structure, database setup (Drizzle schema, connection factory, migration runner), tenant provisioning with logical isolation (shared DB + RLS), tRPC adapter setup, environment configuration, structured logging.
   - Addresses: Monorepo structure, database layer, tenant isolation, API infrastructure
   - Avoids: Module boundary spaghetti (Pitfall #5), Nx configuration entropy (Pitfall #9), premature DB-per-tenant implementation (Pitfall #7)

2. **Phase 2: Identity & Authentication** -- User entity and CRUD, Passport.js with local strategy, JWT access/refresh tokens, Redis-backed sessions, session management (list, revoke), TOTP MFA enrollment.
   - Addresses: Authentication, session management, MFA
   - Avoids: JWT-only auth without revocation capability

3. **Phase 3: Authorization & Audit** -- CASL-based RBAC permission engine, role management CRUD, organizational hierarchy (Company > Region > Site), ABAC policy engine with location-scoped conditions, immutable audit logging interceptor with hash chaining.
   - Addresses: Hybrid RBAC+ABAC, audit compliance, location-scoped permissions
   - Avoids: Role-based thinking without policy engine (Pitfall #2), mutable audit logs (Pitfall #3), policy explosion (Pitfall #10)

4. **Phase 4: Integration & Hardening** -- tRPC router wiring for all features, rate limiting, health checks, cross-tenant isolation test suite, compliance-as-code test mapping, packages/api-client for frontend type safety, Docker containerization.
   - Addresses: End-to-end type safety, operational readiness, compliance verification
   - Avoids: tRPC-NestJS middleware duplication (Pitfall #6), compliance documentation without code (Pitfall #12)

5. **Phase 5: DB-per-Tenant Tier** (if time allows in v0.1, otherwise v0.2) -- Connection pool management for dedicated databases, migration orchestrator for multi-DB, PgBouncer setup, tenant tier switching logic.
   - Addresses: DOE-grade database isolation
   - Avoids: Premature dual-tier development (Pitfall #7)

**Phase ordering rationale:**
- Foundation must come first because every other component operates within a tenant context and uses the database layer
- Authentication before authorization because RBAC/ABAC needs authenticated user identity to evaluate
- Audit logging alongside authorization (Phase 3) because DOE compliance requires logging from the start -- not deferred
- tRPC router wiring in Phase 4 (not Phase 1) because the procedures need auth, authz, and audit to be meaningful -- only the tRPC adapter setup goes in Phase 1
- DB-per-tenant last because logical isolation (RLS) is the harder security model and serves most tenants; DB-per-tenant can follow once the abstraction layer is proven

**Research flags for phases:**
- Phase 1: Verify tRPC version (v10 vs v11) and NestJS-tRPC adapter maturity before scaffolding
- Phase 1: Verify Drizzle ORM version and API stability (may have reached v1.0)
- Phase 2: Verify @nestjs/passport version compatibility with current NestJS
- Phase 3: Verify CASL version and confirm no official Drizzle adapter exists (custom adapter needed)
- Phase 4: Likely needs deeper research into compliance-as-code patterns for NIST 800-53
- Phase 5: Needs deeper research into PgBouncer configuration for multi-database routing

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack (core: NestJS, PostgreSQL, Redis) | HIGH | Mature, stable, well-documented technologies |
| Stack (ORM: Drizzle) | MEDIUM | Architecturally correct but younger project; verify version/API stability |
| Stack (API: tRPC + NestJS) | LOW-MEDIUM | tRPC version uncertain (v10 vs v11); NestJS integration patterns less established than standalone tRPC |
| Stack (Auth: Passport.js + CASL) | HIGH | Standard enterprise patterns; CASL is the clear choice for RBAC+ABAC |
| Features | HIGH | Well-understood domain; requirements clearly documented in PROJECT.md |
| Architecture (modular monolith) | HIGH | Standard pattern for greenfield NestJS with solo developer |
| Architecture (multi-tenant topology) | MEDIUM | Three-database topology is established; NestJS-specific implementation details need empirical validation |
| Architecture (tRPC-NestJS integration) | MEDIUM | Fewer established patterns; may need custom adapter work |
| Pitfalls | HIGH | Well-documented failure modes in multi-tenant, compliance, and NestJS domains |

## Gaps to Address

- **tRPC version and NestJS adapter:** Cannot confirm whether tRPC v11 has shipped or if v10 is still current. The `nestjs-trpc` adapter maturity is unknown. Must verify before scaffolding.
- **Drizzle ORM version:** Cannot confirm current version or whether API has changed. Must run `npm view drizzle-orm version` before committing to specific API patterns.
- **CASL + Drizzle integration:** No official `@casl/drizzle` adapter exists (per training data). A custom adapter (~100-200 lines) will be needed. The implementation approach should be validated with current CASL docs.
- **Biome maturity:** Biome is recommended over ESLint+Prettier but is younger. Verify plugin ecosystem covers NestJS needs (import sorting, unused imports, etc.). Fallback to ESLint+Prettier if gaps found.
- **NestJS version:** Cannot confirm if NestJS 11 has shipped. Architecture patterns are stable across v9-v11 but verify breaking changes.
- **Compliance-as-code patterns:** NIST 800-53 control mapping to automated tests is an area that needs phase-specific research when building the compliance test suite.
- **Next.js version and App Router maturity:** Frontend research was out of scope for this stack-focused research. The web/admin apps will need their own research for Next.js patterns, component library, and tRPC client setup.
