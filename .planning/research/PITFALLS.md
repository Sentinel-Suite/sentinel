# Domain Pitfalls

**Domain:** Multi-tenant enterprise security platform (auth, tenancy, compliance audit logging)
**Project:** Sentinel Suite v0.1 — Platform Core
**Researched:** 2026-02-28
**Overall Confidence:** MEDIUM (training data only — web verification unavailable during research session)

---

## Critical Pitfalls

Mistakes that cause rewrites, security vulnerabilities, or compliance failures. Any one of these can invalidate months of work.

---

### Pitfall 1: Tenant Context Leakage (Cross-Tenant Data Access)

**What goes wrong:** A request intended for Tenant A accidentally reads or writes data belonging to Tenant B. This is the single most catastrophic bug in any multi-tenant system — it is a security breach, a compliance violation, and a trust-destroyer. In logical isolation (shared-schema) mode, every query must be scoped to the correct tenant. Developers forget this in edge cases: background jobs, migrations, reporting queries, seed scripts, error handlers that log tenant data to shared logs, or cached responses served to the wrong tenant.

**Why it happens:**
- Tenant context is threaded through request middleware but not enforced at the database layer
- Developers rely on "remembering" to add WHERE clauses instead of making it architecturally impossible to omit them
- NestJS request-scoped injection is used for tenant context, but background jobs (worker app) and event handlers have no HTTP request — the tenant context is lost
- Connection pool management fails: a connection returned to the pool still has `SET search_path` from the previous tenant (PostgreSQL schema-per-tenant)
- Caching layers (Redis, in-memory) use keys without tenant prefixes

**Consequences:**
- DOE/FISMA compliance failure — immediate disqualification
- Complete loss of trust if discovered by any tenant
- Legal liability under data protection regulations
- Forced architecture rewrite if tenant isolation was an afterthought

**Prevention:**
1. **Database-layer enforcement, not application-layer trust.** For logical isolation, use PostgreSQL Row-Level Security (RLS) policies that filter on `current_setting('app.current_tenant_id')`. Set this session variable at connection checkout, not in application code. Every query is automatically filtered — developers cannot accidentally skip it.
2. **For DB-per-tenant mode:** Use a connection-pool-per-tenant or a connection proxy (like PgBouncer with database routing). Never reuse a connection across tenants without resetting the session.
3. **Tenant context service must work outside HTTP context.** Design a `TenantContext` that can be explicitly set for background jobs, not just extracted from request headers. Use `AsyncLocalStorage` (Node.js CLS) to propagate tenant context across async boundaries without passing it through every function signature.
4. **Automated cross-tenant access tests.** Write integration tests that authenticate as Tenant A and attempt to access Tenant B's data. Run these in CI for every endpoint.
5. **Cache key namespacing.** Every cache key must include tenant ID as a prefix. Enforce this with a wrapper around the cache client, not developer discipline.

**Warning signs:**
- Any query in the codebase that does not have tenant scoping and is not explicitly documented as a cross-tenant admin query
- Background job handlers that accept a `tenantId` parameter but do not validate it against the authenticated context
- Redis keys without tenant prefixes
- Unit tests that work but integration tests fail with "wrong data" intermittently

**Phase mapping:** Phase 1 (foundation). Tenant isolation must be the first thing built and tested. Everything else depends on it. Build RLS policies and DB-per-tenant connection management before writing a single feature query.

**Confidence:** HIGH — this is the most widely documented multi-tenancy failure mode across all platforms.

---

### Pitfall 2: Authorization Model Designed Around Roles Instead of Policies

**What goes wrong:** The team builds a role-based system with hardcoded role checks (`if user.role === 'admin'`) scattered throughout the codebase. When ABAC requirements appear (location-scoped access, time-based access, classification-level access), the entire authorization layer must be rewritten because the enforcement points assume roles are the only dimension.

**Why it happens:**
- RBAC is simpler to reason about and most tutorials teach it first
- The developer starts with "admin, manager, officer" roles and plans to "add ABAC later"
- NestJS guards and decorators encourage `@Roles('admin')` patterns that hardcode role names
- The distinction between authentication (who are you?) and authorization (what can you do?) gets blurred — roles get checked in controllers instead of through a policy engine

**Consequences:**
- DOE location-scoped permissions become impossible without a rewrite
- Role explosion: dozens of roles created to approximate attribute-based rules (e.g., "site-A-day-shift-supervisor" instead of a policy combining site, shift, and rank attributes)
- Cannot implement "user can only see incidents at sites they're assigned to" without ugly role-per-site hacks
- Hybrid RBAC+ABAC becomes hybrid in name only — it's just RBAC with extra steps

**Prevention:**
1. **Design around policies, not roles.** A policy is a function: `(subject, action, resource, context) => permit | deny`. Roles are one attribute of the subject. Location, time, classification level, and org hierarchy are other attributes.
2. **Use a policy decision point (PDP) pattern.** All authorization checks go through a single service — `AuthorizationService.can(subject, action, resource)`. Controllers never check roles directly.
3. **Choose a policy engine early.** Options: CASL (JavaScript-native, good NestJS integration, handles both RBAC and ABAC), or build a custom engine using the XACML/ALFA pattern. CASL is the pragmatic choice for a solo developer. Avoid OPA/Rego unless you need external policy management — it adds operational complexity.
4. **Model permissions as fine-grained actions on resources, not coarse role flags.** Instead of `isAdmin: boolean`, define `{ action: 'incident:read', resource: 'incident', conditions: { siteId: { $in: user.assignedSites } } }`.
5. **NestJS integration:** Create a `@CheckPolicy(action, resource)` guard that delegates to the PDP. Never use `@Roles()` decorators — they cement the wrong abstraction.

**Warning signs:**
- Any `if (user.role === ...)` check outside the authorization service
- More than 10 role definitions in the first year
- Requests from stakeholders that start with "Can we make it so users at Site X can only see..."
- Authorization logic duplicated between backend guards and frontend UI visibility

**Phase mapping:** Phase 1 (auth). Must be designed correctly from the start. The policy engine pattern is not significantly more complex to implement than role checks — it is just a different shape. Retrofitting is 10x harder.

**Confidence:** HIGH — RBAC-to-ABAC migration pain is extensively documented in enterprise IAM literature.

---

### Pitfall 3: Audit Log That Is Not Actually Immutable or Complete

**What goes wrong:** The audit log is implemented as a regular database table with INSERT/UPDATE/DELETE permissions. It captures some events but misses others. Timestamps come from application code (spoofable). Log entries can be modified or deleted by anyone with database access. When compliance auditors review the system, the audit trail fails integrity checks because there is no proof that logs have not been tampered with.

**Why it happens:**
- "Immutable" is treated as an application-level concern (no DELETE endpoint) rather than a storage-level guarantee (database user literally cannot delete rows)
- Developers log "what happened" but not "what the state was before and after"
- Audit events are written asynchronously and silently fail — no one notices until audit time
- The audit schema is designed for the happy path and does not capture failed attempts, permission denials, or system events
- Timestamps use `new Date()` in application code instead of database-generated `now()` or cryptographic sequencing

**Consequences:**
- NIST 800-53 AU (Audit and Accountability) family controls fail: AU-3 (content), AU-9 (protection), AU-10 (non-repudiation), AU-11 (retention)
- DOE compliance audit fails — cannot prove chain of custody for security events
- Legal discovery requests cannot be satisfied because logs are incomplete or untrustworthy
- If a security incident occurs, there is no reliable forensic record

**Prevention:**
1. **Database-level immutability.** The application database user must have only INSERT permission on audit tables — no UPDATE, no DELETE. Use a separate PostgreSQL role for audit writes. Create a trigger that prevents any UPDATE or DELETE even by the table owner: `CREATE RULE audit_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING;` and `CREATE RULE audit_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;`.
2. **Database-generated timestamps.** Use `DEFAULT now()` on the timestamp column and make it non-overridable. Do not accept timestamps from application code.
3. **Cryptographic chaining (hash chain).** Each log entry includes a hash of the previous entry: `hash = SHA-256(previous_hash + event_data)`. This creates a tamper-evident chain — any modification to a historical entry breaks the chain. This satisfies NIST AU-10 (non-repudiation).
4. **Capture before/after state.** For data mutations, log both the previous value and the new value. Use PostgreSQL `hstore` or JSONB diff for structured change capture.
5. **Log failures, not just successes.** Every authentication failure, authorization denial, and validation rejection must be logged. NIST 800-53 AU-2 explicitly requires logging unsuccessful events.
6. **Synchronous writes for security events.** Authentication and authorization events must be written synchronously (in the same transaction or before returning the response). Non-security events (UI interactions, navigation) can be async.
7. **Separate audit storage.** For DOE-tier tenants, audit logs should live in a separate database or schema that the main application cannot access for writes after initial insert.

**Warning signs:**
- The audit table has UPDATE or DELETE grants for the application database user
- Log entries have timestamps that are earlier than the previous entry (clock skew or application-generated timestamps)
- Searching for "failed login" or "permission denied" returns zero results
- The audit log schema has no `previous_hash` or equivalent integrity field
- Audit writes are wrapped in try/catch blocks that swallow errors silently

**Phase mapping:** Phase 1 (audit logging). Must be designed immutable from the first schema migration. Retrofitting immutability onto a mutable audit log requires re-creating the entire table and re-hashing the chain — effectively starting over.

**Confidence:** HIGH — NIST 800-53 AU controls are prescriptive and well-documented. Hash-chain audit logs are a standard pattern in compliance-grade systems.

---

### Pitfall 4: Multi-Tenant Database Migrations That Break One Tier

**What goes wrong:** Schema migrations work for the shared-schema (logical isolation) tenants but fail for database-per-tenant tenants, or vice versa. A migration runs against the "main" database but is never applied to the 47 individual tenant databases. Or a migration assumes a shared schema and breaks when applied to an isolated database that has a different migration history.

**Why it happens:**
- The migration tool (Prisma Migrate, Drizzle Kit, TypeORM migrations) is designed for a single database. Multi-database migration requires custom orchestration.
- Developers test migrations locally against one database and assume it works for all
- Tenant databases are created at different times and have different migration histories — database #1 has all migrations, database #47 (just provisioned) needs to run all 200 migrations from scratch
- Migration scripts reference tenant-specific data (seed data, default roles) that varies between tenants
- Schema-per-tenant in PostgreSQL requires running migrations per schema, which most ORMs do not support natively

**Consequences:**
- Tenant onboarding fails because the new database cannot be bootstrapped
- One tenant's database is stuck on an old schema version, causing runtime errors
- Rollback is impossible for some tenants because they were already on the new schema
- Data corruption when a migration makes assumptions about existing data that are not true for all tenants

**Prevention:**
1. **Build a migration orchestrator from day one.** This is a service that: (a) discovers all tenant databases/schemas, (b) runs migrations in order for each, (c) tracks migration state per tenant independently, (d) handles failures by marking the tenant as "migration-failed" rather than crashing.
2. **Separate "structural" migrations from "data" migrations.** Schema changes (add column, add table) should be in one pipeline. Data changes (seed default roles, update enum values) should be in another. Data migrations are tenant-aware; structural migrations are universal.
3. **Test migrations against a "fresh" database and an "established" database.** Every migration must work both as a delta on an existing database and as part of a full bootstrap sequence.
4. **Use idempotent migrations.** `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Never assume the current state — check it.
5. **ORM consideration:** Drizzle has the lightest migration footprint (SQL files, easy to orchestrate). Prisma Migrate is opinionated and harder to use in multi-database scenarios. TypeORM migrations are more flexible but have their own issues. This is a key factor in ORM selection.

**Warning signs:**
- Migration commands are run manually (`npx prisma migrate deploy`) instead of through an orchestration service
- No test coverage for "provision new tenant database from scratch"
- The migration table has different row counts across tenant databases
- Any migration that references specific tenant data

**Phase mapping:** Phase 1 (multi-tenancy infrastructure). The migration orchestrator must exist before any feature migrations are written. It is part of the tenancy infrastructure, not an afterthought.

**Confidence:** HIGH — multi-database migration is a well-known pain point in every multi-tenant system using relational databases.

---

### Pitfall 5: NestJS Module Boundaries That Become a Dependency Spaghetti

**What goes wrong:** NestJS modules start cleanly separated but gradually import each other in circular patterns. The `AuthModule` imports `UserModule`, which imports `OrganizationModule`, which imports `AuthModule` for guards. Nx dependency graph shows a tangled mess. Build times explode. Changing one module requires rebuilding everything. Testing a single module requires mocking half the application.

**Why it happens:**
- NestJS `forwardRef()` makes circular dependencies "work" — it is a crutch that masks design problems
- Shared entities (User, Organization, Tenant) are needed by almost every module, creating a gravitational pull toward a "god module"
- Guards, interceptors, and pipes are module-scoped in NestJS, so using a guard from another module means importing that module
- In a monorepo with Nx, the NestJS module boundary and the Nx library boundary are two different things — developers get confused about which layer enforces what

**Consequences:**
- Nx `affected` commands rebuild everything because everything depends on everything
- Build times go from seconds to minutes as the monorepo grows
- Module isolation is fictional — you cannot extract a module into a separate service later
- Testing requires complex DI setup because real dependencies leak through circular imports

**Prevention:**
1. **Enforce a dependency direction rule.** Define layers: `core` (tenant, auth, audit) -> `domain` (modules) -> `presentation` (controllers, tRPC routers). Higher layers depend on lower layers, never the reverse. Auth, Tenant, and Audit are in core — they never import domain modules.
2. **Use interfaces and injection tokens at module boundaries.** The `AuthModule` should not import `UserModule`. Instead, `AuthModule` defines a `USER_REPOSITORY` injection token and an interface. `UserModule` provides the implementation. Wire them together in the root module.
3. **Nx library boundaries.** Use Nx `@nx/enforce-module-boundaries` ESLint rule with tags. Tag libraries as `scope:core`, `scope:domain`, `type:feature`, `type:data-access`, `type:util`. Enforce that `scope:core` cannot depend on `scope:domain`.
4. **Never use `forwardRef()`.** Treat any use of `forwardRef()` as a code smell that must be resolved by restructuring, not worked around.
5. **Global modules sparingly.** Only truly cross-cutting concerns (TenantContext, AuditLogger, ConfigService) should be `@Global()`. Everything else should be explicitly imported.

**Warning signs:**
- Any use of `forwardRef()` in the codebase
- Nx dependency graph has cycles
- `nx affected --target=build` rebuilds most or all projects for a small change
- A NestJS module has more than 5-6 imports in its decorator
- Test files require more than 3-4 mock modules in `Test.createTestingModule()`

**Phase mapping:** Phase 1 (scaffolding and infrastructure). Dependency direction rules and Nx boundary enforcement must be configured in the first commit. Retrofitting boundaries onto tangled modules is extremely painful.

**Confidence:** HIGH — NestJS circular dependency issues are the most common complaint in the NestJS community for applications beyond trivial size.

---

### Pitfall 6: tRPC + NestJS Integration Friction

**What goes wrong:** tRPC and NestJS have fundamentally different paradigms. NestJS uses decorators, dependency injection, and a module system. tRPC uses functional composition with context and middleware. Developers try to use both at full power simultaneously and end up with a hybrid that gets the worst of both: NestJS guards that do not work on tRPC routes, tRPC middleware that cannot access NestJS DI, and two parallel middleware stacks that must be kept in sync.

**Why it happens:**
- tRPC was designed for Next.js and lightweight Express/Fastify servers, not for NestJS
- NestJS has its own request lifecycle (guards, interceptors, pipes, exception filters) that operates at a different layer than tRPC middleware
- Developers expect `@UseGuards(AuthGuard)` to protect tRPC procedures — it does not, because tRPC procedures are not NestJS route handlers
- The NestJS DI container is not natively accessible from tRPC context creation

**Consequences:**
- Security gaps: auth guards applied to REST endpoints but missing from tRPC procedures
- Duplicated middleware logic: validation, auth, tenant context, audit logging implemented twice
- The "type safety" benefit of tRPC is undermined by the complexity of the integration layer
- Debugging is painful because errors can originate in either middleware stack

**Prevention:**
1. **Choose one paradigm for request handling.** Use tRPC for all client-facing API endpoints. Use NestJS for internal structure (DI, modules, services). Do not use NestJS controllers alongside tRPC routers for the same consumers.
2. **Bridge NestJS DI into tRPC context.** Create the tRPC context factory with access to the NestJS application instance: `const appContext = app.get(SomeService)`. Pass NestJS services into tRPC context during context creation, not during procedure execution.
3. **Implement all cross-cutting concerns as tRPC middleware, not NestJS guards.** Auth, tenant resolution, audit logging, and rate limiting should be tRPC middleware that calls NestJS services. This gives one middleware stack, not two.
4. **Use `nestjs-trpc` adapter if it meets your needs.** There is a community adapter (@anatine/trpc-nestjs or similar) that bridges the two. Evaluate whether it is maintained and compatible with your NestJS and tRPC versions before committing. If not adequate, build a thin adapter yourself.
5. **Type-safe contract first.** Define tRPC routers with Zod schemas. Let the tRPC router be the API surface. NestJS services are the implementation behind the router — they do not know about tRPC.

**Warning signs:**
- Both `@Controller()` and tRPC router handling requests from the same frontend
- Auth checks in NestJS guards that are not replicated in tRPC middleware
- `any` types appearing at the tRPC-NestJS boundary because DI services are not properly typed
- The tRPC context creation function grows beyond 50 lines because it's reimplementing NestJS lifecycle hooks

**Phase mapping:** Phase 1 (API infrastructure). The tRPC-NestJS integration pattern must be established before any feature routers are written. Getting this wrong early means every feature route inherits the problem.

**Confidence:** MEDIUM — tRPC + NestJS is a less common combination than tRPC + Next.js. Community patterns are less established. Verified through training data but unable to check latest adapter status.

---

### Pitfall 7: Premature Optimization of Tenant Isolation Tiers

**What goes wrong:** The developer builds both DB-per-tenant and logical-isolation modes simultaneously in Phase 1, doubling the surface area for every feature. Every query, every migration, every test must work in both modes. Development velocity collapses because the simplest feature requires testing two code paths.

**Why it happens:**
- The architecture calls for tiered tenancy, so the developer assumes both tiers must be built in parallel
- Fear of "painting yourself into a corner" leads to over-engineering the abstraction layer
- The project description says "config-driven switching" which implies both modes must exist from day one

**Consequences:**
- Development takes 3-4x longer because every feature is effectively built twice
- Bugs hide in the less-tested tier
- The abstraction layer between tiers becomes the most complex and fragile part of the codebase
- Solo developer burns out trying to maintain two parallel data access patterns

**Prevention:**
1. **Build one tier first, abstract second.** Start with logical isolation (shared schema with RLS). This is the harder security model to get right and the one most commercial tenants will use. Get it rock-solid.
2. **Design the abstraction interface but implement only one side.** Define a `TenantDataSource` interface that could route to different databases. Implement only the shared-schema version. The DB-per-tenant implementation comes in Phase 2 or when a DOE tenant is actually onboarded.
3. **Use the Repository pattern as the abstraction boundary.** Repositories take a tenant context and return tenant-scoped data. Whether that scoping happens via RLS, schema switching, or database routing is an implementation detail hidden behind the repository.
4. **Test the abstraction contract, not the implementation.** Write integration tests against the repository interface. When the second tier is implemented, the same tests verify it.

**Warning signs:**
- Feature PRs that touch both tier implementations
- More time spent on the "multi-tenant switching logic" than on actual features
- The tenant abstraction layer has more code than the features it supports
- Decision paralysis about whether a new feature should be "tier-aware"

**Phase mapping:** Phase 1 should implement logical isolation only. Phase 2 or a dedicated later phase adds DB-per-tenant. The interface should be designed in Phase 1 to make Phase 2 straightforward, but only one implementation should be built.

**Confidence:** HIGH — "build the abstraction, implement one side" is a universal engineering principle that is especially critical for solo developers.

---

## Moderate Pitfalls

Mistakes that cause significant rework, performance issues, or missed requirements but are recoverable without full rewrites.

---

### Pitfall 8: Audit Log Performance Becomes a Bottleneck

**What goes wrong:** Every API request writes one or more audit log entries synchronously. As the system grows, the audit table becomes the hottest table in the database. Queries slow down because the audit table has billions of rows with no partitioning. The application's response time degrades because every operation waits for the audit write.

**Prevention:**
1. **Partition the audit table by time (monthly or weekly).** PostgreSQL native partitioning with `PARTITION BY RANGE (created_at)`. Old partitions can be moved to cold storage.
2. **Use a separate audit database connection pool.** Audit writes should not compete with feature queries for connections.
3. **For non-security events, use async writes via a write-ahead buffer.** Batch audit events and write them in bulk. Security events (auth, authz) remain synchronous.
4. **Index strategically.** Audit tables need indexes on `tenant_id`, `created_at`, `actor_id`, and `resource_type`. Do not index `event_data` (JSONB) — use GIN index only if you need to query inside the JSON.
5. **Plan retention policy from day one.** NIST 800-53 AU-11 requires defined retention periods. Build the archival/purge mechanism alongside the logging mechanism.

**Warning signs:**
- Audit table grows past 10 million rows with no partitioning strategy
- Query plan for "get recent audit events for tenant X" shows sequential scan
- Application response times increase linearly with audit table size
- No retention or archival policy defined

**Phase mapping:** Phase 1 design (table partitioning and separate connection pool). Retention/archival can be Phase 2.

**Confidence:** HIGH — audit log scaling is a textbook database performance problem.

---

### Pitfall 9: Nx Monorepo Configuration Entropy

**What goes wrong:** The Nx workspace configuration drifts as new libraries and applications are added. Build caching stops working correctly. The `nx.json` and individual `project.json` files have inconsistent configurations. Generators are not used — libraries are created manually with slight variations. Build tags are not enforced. Within weeks, `nx graph` shows a mess.

**Prevention:**
1. **Create custom Nx generators for new libraries and modules.** A generator ensures every new library has consistent `project.json`, `tsconfig.json`, tags, and directory structure. Never create a library manually.
2. **Configure `@nx/enforce-module-boundaries` in the first commit.** Define tag constraints before any code exists.
3. **Use `namedInputs` in `nx.json` to define what invalidates cache for each target.** Default is overly broad — fine-tune to avoid unnecessary rebuilds.
4. **Pin Nx version and update deliberately.** Nx major versions sometimes change configuration format. Update Nx as a dedicated task, not as a side effect of adding a feature.
5. **Verify cache hits regularly.** Run `nx build api --verbose` and check that cache is used when nothing changed. If cache misses on no-change builds, fix the configuration immediately.

**Warning signs:**
- `nx affected --target=build` builds everything for a small change
- Different libraries have different `tsconfig.json` `compilerOptions` (inconsistent strictness, paths)
- No tags on any library
- Libraries created by copying another library's directory and modifying files

**Phase mapping:** Phase 1 (scaffolding). Nx configuration and generators must be established before the first library is created.

**Confidence:** HIGH — Nx configuration entropy is the most common complaint from Nx users at enterprise scale.

---

### Pitfall 10: RBAC+ABAC Policy Explosion Without Hierarchy

**What goes wrong:** The authorization system supports fine-grained policies but has no concept of policy inheritance or hierarchy. Every site, every role, every resource type gets its own flat set of policies. An organization with 50 sites and 10 roles has 500 policy sets to manage. Adding a new permission requires updating it in potentially hundreds of places.

**Prevention:**
1. **Model policy inheritance along the organizational hierarchy.** Company-level policies are inherited by all regions. Region-level policies are inherited by all sites. Site-level policies can override or extend.
2. **Use role templates.** A "Security Officer" role template defines default permissions. Each site can customize, but the template provides the baseline.
3. **Implement permission resolution as a merge-with-override algorithm.** Start from the broadest scope (company), overlay narrower scopes (region, site), and apply explicit overrides last. `deny` always wins over `allow` at the same scope level.
4. **Provide a "effective permissions" API.** Given a user and a resource, return the resolved set of permissions. This is essential for debugging and for the admin UI.

**Warning signs:**
- Admin UI requires selecting a specific site before configuring any permissions
- Identical permission sets copied across multiple sites
- No way to answer "what can user X do at site Y?" without reading code
- Permission changes require a deployment

**Phase mapping:** Phase 1 (auth design). The hierarchy resolution algorithm must be designed with the policy engine. Implementation of the admin UI for managing hierarchical policies can be Phase 2.

**Confidence:** MEDIUM — policy hierarchy design varies significantly by domain. The pattern is well-established in enterprise IAM but implementation details depend on the specific organizational model.

---

### Pitfall 11: Shared Database Package Becomes an Unmanageable God Package

**What goes wrong:** The `packages/db` library starts as a clean database abstraction layer. Over time, it accumulates every entity, every repository, every migration, every query builder, and every database utility. It becomes the largest package in the monorepo, imported by every other package, and impossible to change without risking breakage everywhere.

**Prevention:**
1. **Split `packages/db` by domain early.** Instead of one `packages/db`, use `packages/db-core` (connection management, tenant routing, base entity), `packages/db-auth` (user, role, permission entities), `packages/db-audit` (audit log entities and writer). Domain modules get their own DB packages later.
2. **Each package owns its entities and migrations.** The auth package owns User, Role, Permission tables. The audit package owns AuditLog tables. This maps cleanly to NestJS module boundaries.
3. **Use Nx library boundaries to enforce the split.** Tag DB packages with `scope:core` or `scope:domain` and enforce that domain DB packages do not depend on each other.
4. **Base entity and connection management are shared utilities.** Keep `packages/db-core` small: base entity class, connection factory, migration runner, and nothing else.

**Warning signs:**
- `packages/db` has more than 20 entity files
- Every feature PR modifies `packages/db`
- Circular imports within `packages/db` between entity files
- Import path like `@sentinel/db` used everywhere with no sub-path exports

**Phase mapping:** Phase 1 (scaffolding). Define the DB package split in the initial monorepo setup. Starting monolithic and splitting later is possible but painful.

**Confidence:** HIGH — monorepo "god package" is the most common structural problem in Nx workspaces.

---

### Pitfall 12: Compliance Requirements Treated as Documentation, Not Code

**What goes wrong:** NIST 800-53 controls are captured in a spreadsheet or document but not encoded as automated tests, configuration checks, or infrastructure-as-code. When the system changes, the documentation says one thing but the system does another. Compliance is verified manually, which means it is verified rarely and incompletely.

**Prevention:**
1. **Encode compliance requirements as integration tests.** For AU-9 (audit protection): test that the application DB user cannot UPDATE or DELETE audit rows. For AC-3 (access enforcement): test that unauthenticated requests are rejected. For IA-2 (identification and authentication): test that MFA is required for privileged actions.
2. **Use a compliance-as-code mapping.** Maintain a file (`compliance-map.yaml` or similar) that maps NIST control IDs to test file paths. When a control is implemented, the mapping points to the test that proves it.
3. **Automate compliance checks in CI.** Run compliance-specific test suite on every PR. Failures block merge.
4. **Version the compliance mapping alongside the code.** When a feature changes, the compliance tests must be updated in the same PR.

**Warning signs:**
- Compliance documentation lives in a separate system (Confluence, SharePoint) with no link to code
- No one can answer "which test proves we meet AU-9?" without research
- Compliance review happens quarterly instead of per-commit
- Security controls were "verified" by looking at the code, not by automated tests

**Phase mapping:** Phase 1 (test infrastructure). The compliance test suite skeleton should be created alongside the audit and auth features. Individual control tests are added as features are built.

**Confidence:** HIGH — compliance-as-code is a well-established DevSecOps practice with extensive documentation from NIST, CISA, and cloud providers.

---

### Pitfall 13: AsyncLocalStorage / CLS Context Loss in NestJS

**What goes wrong:** Tenant context and user context are stored in `AsyncLocalStorage` (or the `cls-hooked`/`@nestjs/cls` library) to avoid passing them through every function parameter. This works for simple request-response flows but breaks in specific scenarios: `setTimeout` callbacks, `Promise.all` with concurrent operations, event emitters, and some database driver callbacks. The context is silently `undefined`, leading to queries without tenant scoping or audit entries without actor information.

**Prevention:**
1. **Use `@nestjs/cls` (ClsModule) which integrates properly with NestJS lifecycle.** It handles the common cases (guards, interceptors, pipes) correctly.
2. **Test context propagation explicitly.** Write tests for: nested async/await, Promise.all, setTimeout, event emitter callbacks, database transaction callbacks, and Bull/BullMQ job handlers.
3. **Always validate context at the boundary.** The repository layer should throw an error if tenant context is undefined, not silently proceed without scoping. Fail loudly.
4. **For background jobs (worker app), set context explicitly in the job handler preamble.** Do not rely on CLS for cross-process context. Pass `tenantId` and `actorId` as job payload fields and set them in CLS at the start of the handler.

**Warning signs:**
- Intermittent "tenant_id is null" errors in production logs
- Audit entries missing actor_id for some operations
- CLS context works in controllers but not in event handlers or scheduled tasks
- Tests pass individually but fail when run in parallel

**Phase mapping:** Phase 1 (infrastructure). CLS setup and validation must be in place before any feature code uses it. Add explicit tests for context propagation in all async patterns used by the application.

**Confidence:** MEDIUM — `AsyncLocalStorage` behavior is well-documented in Node.js docs, but edge cases with specific NestJS/database driver combinations require empirical testing.

---

## Minor Pitfalls

Mistakes that cause delays or technical debt but are individually survivable.

---

### Pitfall 14: Over-Engineering the Organizational Hierarchy

**What goes wrong:** The requirement says "Company > Region > Site > configurable sub-levels." The developer builds a fully recursive tree structure with unlimited nesting, adjacency list or nested set model, and recursive CTEs for every query. This adds enormous complexity for a v0.1 where 2-3 levels of hierarchy are sufficient.

**Prevention:**
1. **Start with a fixed hierarchy (Company > Region > Site > Zone) using a flat table with parent references.** Four levels cover 95% of use cases.
2. **Design the schema so it could become recursive later** (self-referencing foreign key, `parent_id`), but implement queries assuming fixed depth.
3. **Do not use nested sets or materialized path for v0.1.** Adjacency list with parent_id is simple and sufficient. Optimize to materialized path or closure table only if query performance requires it at scale.

**Warning signs:**
- Recursive CTEs in queries that could be simple JOINs with known depth
- More time spent on "how deep can the hierarchy go?" than on actual features
- Hierarchy management UI in v0.1 scope

**Phase mapping:** Phase 1 (data model). Use simple adjacency list. Revisit if performance requires it in later phases.

**Confidence:** HIGH — premature abstraction of hierarchical data is a well-known trap.

---

### Pitfall 15: Solo Developer + AI Tools Amplification Effects

**What goes wrong:** AI coding assistants generate plausible-looking code quickly, which creates several unique failure modes for a solo developer with no code review:

1. **Inconsistent patterns across the codebase.** Each AI-assisted session generates code in a slightly different style. Over weeks, the codebase has three different error handling patterns, two different ways of doing tenant scoping, and no consistent naming convention.
2. **"Works in isolation" code.** AI generates code that works for the specific feature but does not integrate with existing patterns. The auth guard from Session 1 and the auth middleware from Session 5 do the same thing differently.
3. **Uncaught security assumptions.** AI-generated code may use `any` types at boundaries, skip input validation, or implement auth checks that look correct but have subtle bypasses. Without a second pair of human eyes, these ship.
4. **Dependency sprawl.** AI suggests different libraries for similar problems across sessions. The project ends up with both `date-fns` and `dayjs`, both `lodash` and `ramda`, etc.
5. **Missing integration tests.** AI excels at generating unit tests for individual functions but rarely generates the integration tests that catch cross-module issues, tenant leakage, or auth bypasses.

**Prevention:**
1. **Establish and document architecture decision records (ADRs) and coding conventions BEFORE writing feature code.** Reference these in every AI session context. "We use X pattern for Y" prevents the AI from inventing alternatives.
2. **Use lint rules as the automated reviewer.** ESLint rules for: no `any` types, mandatory error handling, required Zod validation on all tRPC inputs, banned imports (no lodash if using native methods).
3. **Write an integration test checklist.** For every feature: (a) does it work for Tenant A? (b) does Tenant B NOT see Tenant A's data? (c) does an unauthorized user get rejected? (d) is an audit entry created? Run this checklist as a test suite, not a manual check.
4. **Maintain a CONVENTIONS.md in the repo.** Document: error handling pattern, auth pattern, tenant scoping pattern, naming conventions, approved libraries. Give this to AI assistants as context.
5. **Lock dependencies.** Maintain an approved-libraries list. Configure ESLint `no-restricted-imports` for known duplicates.
6. **Conduct periodic self-reviews.** Every 2 weeks, review the last 2 weeks of code as if reviewing someone else's PR. Look for inconsistencies, not just bugs.

**Warning signs:**
- Two or more ways of doing the same thing in the codebase
- `package.json` has libraries with overlapping functionality
- Integration tests cover less than 30% of cross-module interactions
- No `CONVENTIONS.md` or equivalent in the repo
- `any` type count increasing over time

**Phase mapping:** Phase 0 (before any code). Conventions, lint rules, and the integration test framework must be established before any feature development begins. This is the single highest-ROI investment for a solo developer using AI tools.

**Confidence:** HIGH — AI-assisted development amplification effects are well-documented in the developer community and are especially critical for solo developers.

---

### Pitfall 16: Connection Pool Exhaustion in Multi-Tenant PostgreSQL

**What goes wrong:** Each tenant (in DB-per-tenant mode) or each schema switch (in schema-per-tenant mode) requires database connections. With a naive implementation, the connection pool grows linearly with tenants. PostgreSQL has a hard limit on connections (`max_connections`, typically 100-200). At 50 tenants with a pool of 5 connections each, you are at 250 connections and PostgreSQL crashes or refuses new connections.

**Prevention:**
1. **Use PgBouncer (or PgCat) as a connection pooler between the application and PostgreSQL.** PgBouncer in transaction mode allows thousands of logical connections with only a few real connections to PostgreSQL.
2. **For logical isolation (shared schema with RLS), use a single connection pool.** Tenant context is set via session variables, not separate connections. This is the most connection-efficient model.
3. **For DB-per-tenant, use PgBouncer with database-level pooling.** Each tenant database gets a virtual pool in PgBouncer, but the total real connections are bounded.
4. **Monitor connection usage from day one.** Add a health check endpoint that reports: connections in use, connections idle, connections waiting, per tenant.
5. **Set pool size limits in application config.** Do not use unlimited pools. Start with 5-10 connections per pool and increase only based on monitoring data.

**Warning signs:**
- "too many connections" errors in PostgreSQL logs
- Requests timing out waiting for a connection from the pool
- Connection count grows with each new tenant
- No PgBouncer or equivalent in the infrastructure

**Phase mapping:** Phase 1 (infrastructure). PgBouncer setup is part of the database infrastructure, not an optimization for later. For v0.1 with few tenants it may not be immediately necessary, but the architecture should assume it will be needed.

**Confidence:** HIGH — connection pool exhaustion is the #1 operational issue in multi-tenant PostgreSQL deployments.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation | Pitfall Ref |
|-------------|---------------|------------|-------------|
| Monorepo scaffolding | Nx boundaries not configured; god packages emerge | Set up `enforce-module-boundaries`, custom generators, DB package split in first commit | #5, #9, #11 |
| Auth system | Role-based guards hardcoded; no policy engine | Build PDP pattern with CASL from day one; `@CheckPolicy()` not `@Roles()` | #2, #10 |
| Tenant isolation | RLS not used; tenant scoping relies on app code discipline | PostgreSQL RLS policies as the enforcement layer; `AsyncLocalStorage` with validation | #1, #13 |
| tRPC integration | Two middleware stacks (NestJS + tRPC) doing the same thing | tRPC middleware calls NestJS services; NestJS guards not used for tRPC routes | #6 |
| Audit logging | Mutable audit table; missing failure events; no hash chain | DB-level immutability rules; synchronous security events; hash chain from first entry | #3, #8 |
| Multi-tenant migrations | Single-DB migration tool used for multi-DB system | Build migration orchestrator before first feature migration | #4 |
| Compliance | Controls documented in docs, not tested in CI | Compliance-as-code mapping; automated control verification tests | #12 |
| AI-assisted development | Inconsistent patterns; missing integration tests | Conventions doc, strict lint rules, integration test checklist per feature | #15 |
| Org hierarchy | Recursive tree over-engineering | Fixed-depth adjacency list for v0.1; design for extension | #14 |
| DB-per-tenant mode | Connection pool exhaustion | Defer to Phase 2; design interface now, implement one tier | #7, #16 |

---

## Solo Developer Amplification Matrix

These pitfalls are especially dangerous for a solo developer because there is no code review safety net.

| Pitfall | Normal Team Risk | Solo + AI Risk | Why Amplified |
|---------|-----------------|----------------|---------------|
| #1 Tenant Leakage | Medium | **Critical** | No reviewer catches missing WHERE clauses; AI may generate un-scoped queries |
| #2 Role-Based Thinking | Medium | **High** | AI defaults to `@Roles()` pattern in NestJS examples; solo dev has no security reviewer |
| #3 Mutable Audit | Medium | **High** | "It works" looks the same as "it's compliant" — only an auditor catches the difference |
| #5 Module Spaghetti | Low | **High** | AI generates code that "works" without respecting boundaries; no reviewer enforces architecture |
| #6 tRPC+NestJS Friction | Medium | **High** | Few reference implementations exist; AI training data has conflicting patterns |
| #15 Pattern Inconsistency | Low (team norms) | **Critical** | No team norms; each AI session is stateless; drift accumulates invisibly |

---

## Key Takeaway

The single most important meta-pitfall for this project: **treating infrastructure as something that can be "gotten right later."** For Sentinel Suite, the infrastructure IS the product in v0.1. Tenant isolation, authorization policies, audit immutability, and module boundaries are not features that can be bolted on — they are the foundation that every future module trusts. Getting any one of these wrong means either living with the flaw forever or rewriting the foundation while 17 modules depend on it.

The second meta-pitfall: **a solo developer using AI tools has amplified risk for inconsistency and subtle security flaws.** The mitigation is not "use less AI" — it is "invest heavily in conventions, lint rules, and automated tests that catch what a human reviewer would catch."

---

## Sources

- PostgreSQL Row-Level Security: PostgreSQL official documentation (HIGH confidence)
- NIST 800-53 Rev 5 AU family controls: NIST official publication (HIGH confidence)
- NestJS module system and dependency injection: NestJS official documentation (HIGH confidence)
- Nx module boundaries and workspace configuration: Nx official documentation (HIGH confidence)
- tRPC + NestJS integration patterns: Community patterns, training data (MEDIUM confidence — unable to verify current adapter ecosystem)
- CASL authorization library: Training data (MEDIUM confidence — unable to verify current version/NestJS compatibility)
- `@nestjs/cls` library: Training data (MEDIUM confidence — unable to verify current API)
- Multi-tenant PostgreSQL patterns: Training data from multiple established sources (HIGH confidence — patterns are well-established)
- PgBouncer connection pooling: Training data (HIGH confidence — mature, stable technology)
- Solo developer + AI amplification effects: Training data and observed patterns (MEDIUM confidence — emerging field)
