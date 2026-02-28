# Roadmap: Sentinel Suite v0.1 -- Platform Core

## Overview

Sentinel Suite v0.1 proves the platform foundation: multi-tenant isolation, authentication, hybrid RBAC+ABAC authorization, audit logging, and API infrastructure. The roadmap moves from bare monorepo scaffolding through tenant isolation, API plumbing, and identity, then layers on authorization (RBAC first, ABAC second), audit compliance, API hardening, and finally database-per-tenant isolation for DOE-grade deployments. Every phase delivers a coherent, testable capability that the next phase builds on.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Monorepo Foundation** - Nx workspace, shared packages, Docker dev environment, env config, structured logging, linting
- [ ] **Phase 2: Database & Tenant Core** - Control database, tenant provisioning, RLS-based logical isolation, per-request tenant context
- [ ] **Phase 3: API Infrastructure** - tRPC adapter with NestJS, Zod input validation, correlation ID propagation, health checks
- [ ] **Phase 4: Authentication** - Username/password login, JWT+refresh tokens, Redis sessions, session management, MFA, brute force protection
- [ ] **Phase 5: RBAC & Organizational Hierarchy** - Role/permission CRUD, RBAC guard, org hierarchy, module boundary enforcement
- [ ] **Phase 6: ABAC Policy Engine** - Attribute-based policies, location-scoped permissions, two-phase auth flow, effective permissions API, CASL-Drizzle adapter
- [ ] **Phase 7: Audit Logging** - Immutable append-only audit trail, hash chaining, tamper verification, partitioning, auto-capture interceptor
- [ ] **Phase 8: API Completion & Hardening** - REST endpoints, dual API pattern, rate limiting, test framework, Nx generators, compliance skeleton
- [ ] **Phase 9: DB-per-Tenant Isolation** - Dedicated databases for DOE tenants, config-driven tier switching, PgBouncer pooling, migration orchestrator

## Phase Details

### Phase 1: Monorepo Foundation
**Goal**: Developer can clone the repo and have a running local environment with all packages, apps, and dev tooling operational
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, INFR-02, INFR-03, INFR-04, INFR-05, INFR-07
**Success Criteria** (what must be TRUE):
  1. Running `pnpm install` and `pnpm dev` starts the API and web apps without errors
  2. Docker Compose brings up PostgreSQL and Redis, and the API connects to both
  3. Environment variables are validated at startup -- missing or invalid values produce clear error messages, not silent failures
  4. API requests produce structured JSON logs with request context and correlation IDs
  5. `pnpm lint` and `pnpm format` run Biome checks across the entire monorepo
**Plans**: 3 plans in 3 waves (sequential)

Plans:
- [ ] 01-01-PLAN.md -- Nx workspace scaffolding, all apps + packages, Biome, Git hooks, CI, repo housekeeping
- [ ] 01-02-PLAN.md -- Environment config (Zod validation), Drizzle DB setup, Docker Compose infrastructure
- [ ] 01-03-PLAN.md -- NestJS API bootstrap with Pino logging, health endpoints, Next.js landing pages

### Phase 2: Database & Tenant Core
**Goal**: The system can provision tenants and enforce data isolation so every query is automatically scoped to the requesting tenant
**Depends on**: Phase 1
**Requirements**: TNCY-01, TNCY-02, TNCY-03, TNCY-08
**Success Criteria** (what must be TRUE):
  1. A new tenant can be provisioned via API with a name and configuration, and its record appears in the control database
  2. Tenants can be activated and deactivated, and deactivated tenants cannot access any data
  3. Every API request resolves tenant context automatically (via subdomain, header, or token) and all database queries are scoped to that tenant via PostgreSQL Row-Level Security
  4. A query executed in Tenant A's context returns zero rows from Tenant B's data, even if RLS policies are the only enforcement layer
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: API Infrastructure
**Goal**: Frontend and backend communicate through a type-safe API layer with observable request tracing and operational health monitoring
**Depends on**: Phase 1
**Requirements**: API-01, API-04, API-05, API-06
**Success Criteria** (what must be TRUE):
  1. A tRPC procedure defined in the API is callable from the web app with full TypeScript type inference (no manual type definitions)
  2. Sending invalid input to a tRPC procedure returns a structured Zod validation error, not a crash
  3. Every request carries a correlation ID that appears in logs across the entire request lifecycle
  4. GET /health and GET /ready endpoints return status codes usable by Docker and monitoring tools
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: Authentication
**Goal**: Users can securely create sessions, stay logged in, manage their active sessions, and protect their accounts with MFA
**Depends on**: Phase 2, Phase 3
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07
**Success Criteria** (what must be TRUE):
  1. A user can log in with username and password, receive a JWT access token and refresh token, and make authenticated API calls
  2. When the access token expires (15min), the client can silently obtain a new one using the refresh token without re-entering credentials
  3. A user can list their active sessions and revoke any session, which immediately invalidates that session's tokens
  4. A user can enroll in TOTP-based MFA, and subsequent logins require the TOTP code after password verification
  5. Repeated failed login attempts trigger rate limiting that blocks further attempts for a cooldown period
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD
- [ ] 04-03: TBD

### Phase 5: RBAC & Organizational Hierarchy
**Goal**: Organizations can define custom roles with granular permissions, assign them to users, and structure their tenants into hierarchical units (Company > Region > Site > custom levels)
**Depends on**: Phase 4
**Requirements**: RBAC-01, RBAC-02, RBAC-03, TNCY-04, INFR-10
**Success Criteria** (what must be TRUE):
  1. An admin can create, update, and delete custom roles for their organization, and assign users to those roles
  2. Each role defines permissions as a resource:action matrix (e.g., "incident:create", "patrol:read"), and the RBAC guard blocks access to endpoints the user's role does not permit
  3. A tenant's organizational hierarchy (Company > Region > Site > configurable sub-levels) can be created and queried, with nodes at any depth
  4. Nx module boundary tags prevent unauthorized imports between packages (e.g., `apps/web` cannot import from `apps/api` internals)
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD
- [ ] 05-03: TBD

### Phase 6: ABAC Policy Engine
**Goal**: Authorization decisions incorporate contextual attributes (user location, time, resource ownership) so a user's effective permissions vary by site and context
**Depends on**: Phase 5
**Requirements**: ABAC-01, ABAC-02, ABAC-03, ABAC-04, ABAC-05
**Success Criteria** (what must be TRUE):
  1. ABAC policies stored as JSONB conditions can grant or restrict access based on attributes (user department, resource classification, time of day)
  2. A user assigned role "Security Officer" at Site A but not Site B can access Site A resources and is denied Site B resources
  3. The two-phase authorization flow executes: RBAC gate first (coarse), then ABAC evaluation (fine-grained) -- and both must pass
  4. The effective permissions API returns the complete set of actions user X can perform at site Y, accounting for both RBAC roles and ABAC policies
  5. CASL abilities translate into Drizzle query conditions so that database queries automatically filter unauthorized records
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD
- [ ] 06-03: TBD

### Phase 7: Audit Logging
**Goal**: Every mutation, authentication event, and authorization decision is captured in a tamper-evident, append-only audit trail that satisfies DOE compliance requirements
**Depends on**: Phase 4, Phase 5, Phase 6
**Requirements**: AUDT-01, AUDT-02, AUDT-03, AUDT-04, AUDT-05, AUDT-06, AUDT-07
**Success Criteria** (what must be TRUE):
  1. The audit table enforces INSERT-only at the database level -- UPDATE and DELETE are denied even for the application database user
  2. Every mutation records who performed it, what changed, when it happened, and where (tenant, site, IP) -- and this data is queryable
  3. Failed login attempts and authorization denials appear in the audit log with the denied principal and requested resource
  4. Each audit record contains a cryptographic hash of itself plus the previous record, forming a verifiable chain -- and the chain verification API confirms integrity or reports the first broken link
  5. Audit records are automatically partitioned by month, and the NestJS interceptor captures audit data on decorated endpoints without manual logging code in handlers
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD
- [ ] 07-03: TBD

### Phase 8: API Completion & Hardening
**Goal**: The API is production-ready with REST endpoints for external consumers, a comprehensive test suite, developer tooling for consistent module creation, and a compliance verification skeleton
**Depends on**: Phase 3, Phase 4, Phase 5, Phase 6, Phase 7
**Requirements**: API-02, API-03, API-07, INFR-06, INFR-08, INFR-09
**Success Criteria** (what must be TRUE):
  1. External consumers can access platform capabilities through documented REST endpoints alongside the internal tRPC API
  2. Both tRPC and REST routes for the same feature produce identical behavior (dual API pattern verified by tests)
  3. Global rate limiting applies to all API endpoints, returning 429 responses with retry-after headers when thresholds are exceeded
  4. Vitest runs unit and integration tests across all packages, and test coverage reports are generated
  5. Running an Nx generator produces a new module or library with correct structure, imports, and configuration -- no manual boilerplate
**Plans**: TBD

Plans:
- [ ] 08-01: TBD
- [ ] 08-02: TBD
- [ ] 08-03: TBD

### Phase 9: DB-per-Tenant Isolation
**Goal**: DOE and high-security tenants operate on dedicated databases with full physical isolation, switchable via tenant configuration without code changes
**Depends on**: Phase 2
**Requirements**: TNCY-05, TNCY-06, TNCY-07, TNCY-09
**Success Criteria** (what must be TRUE):
  1. A tenant configured for "dedicated" isolation tier has its own PostgreSQL database, and all its data is stored exclusively in that database
  2. Switching a tenant's isolation tier from "shared" to "dedicated" (or vice versa) requires only a configuration change and a migration -- no application code changes
  3. PgBouncer routes connections to the correct database based on tenant context, and the connection pool handles multiple tenant databases without exhausting connections
  4. Database migrations run across all tenant databases (both shared and dedicated) via the migration orchestrator, and failed migrations on one tenant do not block others
**Plans**: TBD

Plans:
- [ ] 09-01: TBD
- [ ] 09-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9

Note: Phases 2 and 3 depend only on Phase 1 and could theoretically execute in parallel, but sequential execution is recommended for a solo developer.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Monorepo Foundation | 0/3 | Not started | - |
| 2. Database & Tenant Core | 0/2 | Not started | - |
| 3. API Infrastructure | 0/2 | Not started | - |
| 4. Authentication | 0/3 | Not started | - |
| 5. RBAC & Organizational Hierarchy | 0/3 | Not started | - |
| 6. ABAC Policy Engine | 0/3 | Not started | - |
| 7. Audit Logging | 0/3 | Not started | - |
| 8. API Completion & Hardening | 0/3 | Not started | - |
| 9. DB-per-Tenant Isolation | 0/2 | Not started | - |
