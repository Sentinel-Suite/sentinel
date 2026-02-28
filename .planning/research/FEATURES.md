# Feature Landscape

**Domain:** Enterprise multi-tenant security/compliance platform core (v0.1 infrastructure)
**Researched:** 2026-02-28
**Confidence:** MEDIUM (based on training data for enterprise platform patterns, NIST 800-53, and multi-tenant architecture; web verification unavailable this session)

---

## Table Stakes

Features the platform core MUST have. Without these, the foundation is incomplete and no module built on top can be trusted.

### Authentication & Session Management

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Username/password authentication with bcrypt/argon2 hashing | Bare minimum auth; every platform needs it | Low | Use Argon2id (winner of Password Hashing Competition); bcrypt acceptable fallback. NIST 800-63B compliant password rules (no arbitrary complexity, min 8 chars, check against breach lists) |
| TOTP-based MFA (authenticator app) | DOE/NIST 800-53 IA-2 requires MFA for privileged access; table stakes for any security platform | Medium | Store encrypted TOTP secrets, provide QR code enrollment flow. Support recovery codes (single-use, hashed). v0.1 scope: TOTP only; SMS/WebAuthn deferred |
| JWT access tokens + refresh token rotation | Standard stateless auth for API access; refresh rotation prevents token theft | Medium | Short-lived access tokens (15 min), longer refresh tokens (7 days) with rotation. Store refresh token family to detect reuse (token replay detection). Sign with RS256 for future multi-service verification |
| Session management (list active sessions, revoke) | Users and admins must be able to see and kill sessions; NIST 800-53 AC-12 session termination | Medium | Track device/IP/user-agent per session. Support admin-initiated session kill for any user in their org. Session timeout enforcement (configurable per tenant) |
| Password reset flow (email-based) | Every auth system needs account recovery | Low | Time-limited tokens (1 hour), single-use, invalidate on use. Rate-limit reset requests. Do NOT reveal whether email exists (prevents enumeration) |
| Account lockout after failed attempts | NIST 800-53 AC-7 unsuccessful login attempts; prevents brute force | Low | Configurable threshold (default: 5 attempts), configurable lockout duration (default: 30 min), exponential backoff. Lockout must be per-account, NOT per-IP (prevents distributed bypass) |
| Secure password storage | Non-negotiable for any auth system | Low | Argon2id with memory/time/parallelism params. Never store plaintext or reversible encryption. Salt is built into Argon2 |

### Authorization (Hybrid RBAC+ABAC)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Role definitions with permission sets | Core RBAC: roles bundle permissions, users get roles | Medium | Roles are per-organization (tenant-scoped), not global. System provides default role templates (Super Admin, Org Admin, Site Manager, Officer, Read-Only) that tenants can clone and customize |
| Permission model (resource:action format) | Granular permissions beyond roles; needed for fine-grained access | Medium | Use `resource:action` convention (e.g., `audit-log:read`, `user:create`, `role:assign`). Permissions are additive (no explicit deny in v0.1 -- simplifies reasoning). Enumerate all permissions in code, not freeform strings |
| Attribute-based policy evaluation | Location/time/classification scoping that pure RBAC cannot express | High | The "ABAC" in hybrid RBAC+ABAC. Policies like "User X has role Officer, but only at Site Y during shift hours." Attributes: user attributes, resource attributes, environment attributes (time, IP). Use a policy engine pattern, not scattered if-statements |
| Location-scoped permissions | DOE requirement: access varies by physical site/facility | High | A user may be Officer at Site A but have no access to Site B. Permissions resolve as intersection of role permissions AND location scope. Organizational hierarchy (Company > Region > Site > sub-levels) determines inheritance |
| Permission checking middleware/guards | Every API endpoint must enforce authorization | Medium | NestJS guards that resolve permissions from the request context (user, target resource, attributes). Must be declarative (decorators) and composable. Fail-closed: if no permission check is declared, deny by default |
| Role assignment with scope | Assigning roles at specific organizational levels | Medium | "User X has role Y at scope Z" where Z can be company-wide, regional, site-specific, or sub-level. Hierarchical inheritance: company-level role grants access to all sites unless overridden |

### Multi-Tenancy

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Tenant provisioning (create/configure tenant) | Must be able to create new tenants programmatically | Medium | Create tenant record, set isolation tier, provision database if DB-per-tenant, seed default roles/permissions. Idempotent and transactable |
| Tenant context resolution (from request) | Every request must be scoped to a tenant | Medium | Resolve tenant from subdomain, header, or JWT claim. Set tenant context early in request pipeline (NestJS middleware). All downstream queries automatically scoped. CRITICAL: if tenant context is missing, reject the request -- never fall through to unscoped queries |
| Database-per-tenant isolation | DOE/secure tenants require full data isolation | High | Separate PostgreSQL database (or schema) per tenant. Connection pooling strategy (pgBouncer or application-level pool-per-tenant). Migration orchestration across all tenant databases. This is the hard path -- proving it in v0.1 is the point |
| Logical (shared DB) isolation | Commercial tenants share database with row-level tenant_id scoping | Medium | Every table has `tenant_id` column. All queries filtered by tenant context. Use PostgreSQL Row-Level Security (RLS) policies as defense-in-depth (not sole mechanism -- also enforce in ORM/query layer). Prevents data leakage even if application code has bugs |
| Tenant configuration store | Each tenant needs its own settings (features, limits, branding basics) | Low | JSON/JSONB config per tenant. Feature flags, rate limits, session timeout, isolation tier, enabled modules. Read at request time, cache aggressively |
| Tier-based routing | Route tenants to correct isolation mode based on config | Medium | Middleware determines tenant's isolation tier and selects appropriate database connection. Must be transparent to business logic -- services should not know which tier they are operating in |
| Cross-tenant data prohibition | Data must never leak between tenants | High | This is not a feature, it is a constraint enforced everywhere. Defense-in-depth: application-level filtering + RLS + connection-level isolation for DB-per-tenant. Automated tests that verify cross-tenant queries return nothing. The most important correctness property of the entire system |

### Audit Logging

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Immutable append-only audit log | NIST 800-53 AU-9 (protection of audit info); DOE requires tamper-evident logs | High | Write-only table (no UPDATE/DELETE grants). Separate database connection with restricted permissions. Consider cryptographic chaining (each entry's hash includes previous entry's hash) for tamper evidence. Timestamp from server, never client |
| Who-what-when-where tracking | Every auditable action records actor, action, target, timestamp, context | Medium | Fields: `actor_id`, `actor_type` (user/system/api-key), `action` (verb), `resource_type`, `resource_id`, `changes` (before/after diff), `timestamp`, `ip_address`, `user_agent`, `tenant_id`, `session_id`, `correlation_id` |
| Structured event schema | Logs must be queryable, not just text blobs | Medium | Typed event payloads with consistent schema. Use discriminated union pattern for event types. Store in structured columns + JSONB for extensible detail. Indexing strategy for common query patterns (by user, by resource, by time range) |
| Audit log query API | Admins must be able to search/filter audit logs | Medium | Filter by: actor, action type, resource, time range, tenant. Paginated results. Sort by timestamp descending (most recent first). Read-only endpoint (no modification allowed) |
| Authentication event logging | All auth events must be logged for compliance | Low | Log: successful login, failed login, MFA challenge/success/failure, password change, session creation/termination, role change, permission change. These are non-negotiable for NIST 800-53 AU-2 |
| Correlation IDs for request tracing | Link related audit entries across a single request | Low | Generate correlation ID at request entry, propagate through all service calls, attach to all audit entries. Enables reconstructing "what happened during this request" |

### API Infrastructure (tRPC)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| tRPC router structure with NestJS integration | Type-safe API layer is a core architectural decision | Medium | Organize routers by domain (auth, users, tenants, audit, roles). Use NestJS-tRPC adapter or custom integration. Procedures: query (read), mutation (write). Input validation via Zod schemas shared between frontend and backend |
| Request validation (Zod schemas) | Every input must be validated; prevents injection and data corruption | Medium | Zod schemas for all tRPC procedure inputs. Shared between frontend (form validation) and backend (API validation). Export as `packages/validators/` for reuse. Strict: reject unknown fields |
| Error handling and error codes | Consistent error responses across all endpoints | Low | Typed error codes (not just HTTP status). Error structure: `{ code, message, details }`. Map to HTTP status codes for non-tRPC consumers. Never expose stack traces or internal details in production |
| Rate limiting | Prevent abuse; NIST 800-53 SC-5 (denial of service protection) | Medium | Per-tenant, per-user, per-endpoint rate limits. Configurable per tenant (some tenants may need higher limits). Use sliding window algorithm. Return `Retry-After` header. Store in Redis or in-memory (v0.1 can start in-memory) |
| Request context propagation | Tenant context, user context, correlation ID available to all handlers | Medium | NestJS middleware sets context early. All tRPC procedures receive enriched context. Context includes: authenticated user, tenant, permissions, correlation ID, request metadata |
| Health check endpoint | Basic operational monitoring | Low | `/health` endpoint (outside tRPC). Returns service status, database connectivity, basic metrics. Used by Docker health checks and monitoring |
| API versioning strategy | Must not break consumers when API evolves | Low | For tRPC: versioning is less critical because types enforce contracts. But: establish convention early. Recommendation: namespace routers (e.g., `v1.auth.login`), but do NOT version in v0.1 -- just establish the pattern for later |

### Infrastructure & Cross-Cutting

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Organizational hierarchy model | Company > Region > Site > configurable sub-levels; required for location-scoped permissions | Medium | Recursive/closure-table structure for arbitrary depth. Must support: DOE facilities with complex sub-structures (buildings, floors, areas, zones) and simple commercial sites (company > site). Configurable per tenant |
| User management CRUD | Create, read, update, deactivate users within a tenant | Low | Users belong to exactly one tenant. Soft-delete (deactivate, never hard delete -- audit trail must persist). Admin can manage users within their scope. Super admin can manage across scopes |
| Database migrations orchestration | Schema changes must apply across all tenant databases | High | For DB-per-tenant: migration runner iterates all tenant databases. Must handle: partial failure (some DBs migrated, others not), rollback, new tenant provisioning (apply all migrations to new DB). For logical tenants: standard single-DB migration |
| Tenant-aware connection management | Connection pooling across potentially many tenant databases | High | Pool-per-tenant or shared pool with connection switching. Connection limits, idle timeout, health checking. This is operationally complex -- start simple (pool-per-tenant with reasonable limits), optimize when needed |
| Environment-based configuration | App config from environment variables, not hardcoded | Low | Use NestJS ConfigModule. Validate all env vars at startup (fail fast). Separate configs for: database, auth (JWT secrets, token lifetimes), rate limits, feature flags. Never commit secrets to git |
| Structured logging (application logs) | Not audit logs -- operational logs for debugging and monitoring | Low | JSON-structured logs with correlation ID, tenant ID, request metadata. Log levels: error, warn, info, debug. DO NOT log sensitive data (passwords, tokens, PII). Use pino or winston |

---

## Differentiators

Features that set Sentinel Suite apart from generic multi-tenant platforms. Not strictly required for v0.1 to function, but provide competitive advantage or architectural maturity for a security/compliance platform.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Cryptographic audit log chaining | Each audit entry includes hash of previous entry, creating a tamper-evident chain (like a lightweight blockchain) | Medium | Differentiates from platforms that just use append-only tables. Allows independent verification that no entries were deleted or modified. DOE auditors will love this. Implementation: SHA-256 hash of `previous_hash + entry_data` stored with each record |
| Policy-as-code authorization engine | ABAC policies defined as structured rules (JSON/code), not scattered if-statements | High | Enables: non-developer policy authoring (future), policy versioning, policy simulation ("what would user X be able to do with this policy?"), audit trail of policy changes. Models like OPA (Open Policy Agent) or CASL for inspiration, but custom for NestJS integration |
| Tenant isolation verification tests | Automated test suite that attempts cross-tenant data access and verifies it fails | Medium | Most platforms claim isolation but never prove it. Sentinel can run these tests continuously. Include in CI/CD. Categories: query-level isolation, connection-level isolation, API-level isolation, RLS policy verification |
| Audit log export (compliance format) | Export audit logs in formats compliance officers expect (CSV, JSON, NIST-aligned event categories) | Low | DOE and FISMA audits require log exports. Pre-formatting saves compliance officer time. Map internal event types to NIST 800-53 AU-2 event categories |
| Permission simulation / "what-if" API | API endpoint: "Given user X with role Y at scope Z, what can they access?" | Medium | Invaluable for debugging access issues. Admins can pre-verify role configurations before applying them. Shows resolved permission set after RBAC+ABAC evaluation |
| Tenant provisioning automation | Self-service tenant onboarding with automated DB provisioning, migration, and seed data | Medium | Reduces operational overhead for each new customer. Full automation: create tenant record, provision DB (if isolated tier), run migrations, seed default roles/permissions/admin user. Idempotent, with rollback on failure |
| Request-scoped tenant context with AsyncLocalStorage | Implicit tenant scoping using Node.js AsyncLocalStorage instead of passing tenant through every function | Medium | Cleaner code -- services don't need explicit tenant parameter. Tenant is available via `TenantContext.current()` anywhere in the request lifecycle. Prevents accidental cross-tenant queries by making tenant context mandatory |
| Field-level audit diffs | Audit log captures before/after values for each changed field, not just "record updated" | Medium | Compliance officers can see exactly what changed. Critical for DOE where "Officer X's access level changed from L to Q" must be traceable. Implementation: deep-diff the old and new object, store structured delta |

---

## Anti-Features

Things to deliberately NOT build in v0.1. Each is either premature, out of scope, or actively harmful to include early.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| SSO/SAML/OIDC federation | Massive scope; requires partner integration testing; username/password+MFA is sufficient for v0.1 proof | Build auth abstraction that can accommodate federation later. Design the user model so external identity providers can be linked in v0.2+. Do not hardcode any assumption that auth is always username/password |
| CAC/PIV smartcard authentication | DOE-specific hardware auth; requires physical card reader integration, middleware, certificate chain validation | Ensure the auth pipeline has an extensibility point where CAC/PIV can plug in. User model should support `auth_method` field. Defer to DOE-specific milestone |
| Real-time event bus / pub-sub | No modules exist yet to publish or subscribe to events; building infrastructure without consumers is waste | Design audit logging so events COULD be published to a bus later (structured event payloads help). But do not implement Kafka/RabbitMQ/Redis Streams in v0.1 |
| GraphQL or REST alongside tRPC | Multiple API paradigms add complexity with no benefit when there is one frontend consumer | tRPC is the internal API. If a public API is needed later (v0.3+), add REST as a separate surface. Do not build both now |
| Admin UI for tenant management | v0.1 is developer-only; admin actions can be done via API/CLI/seed scripts | Build the API endpoints for tenant CRUD. The UI can come in v0.2. Do not build frontend pages that only one person will use |
| Notification system | No events to notify about yet; no users to notify | Design audit events with enough metadata that a notification system could consume them later. But do not build email/SMS/push infrastructure now |
| Custom branding per tenant | Visual differentiation is irrelevant when there is one developer testing | Tenant config model should have a `branding` field (JSONB) reserved for later. Do not build theme engines or logo upload flows |
| Billing/subscription management | Self-funded, no paying customers yet | Tenant model can have a `plan` field for future use. Do not integrate Stripe or build metering |
| OAuth2 authorization server | Sentinel is not an identity provider; it is a consuming application | Use JWT for internal auth. Do not build token issuance endpoints for third parties. If needed later, adopt an off-the-shelf solution (Keycloak, Auth0) rather than building one |
| Full-text search on audit logs | Premature optimization; structured queries are sufficient for v0.1 volumes | Index key columns (actor_id, resource_type, timestamp). Full-text/Elasticsearch comes when log volume demands it |
| Offline support / service workers | Complex sync conflict resolution; no mobile clients yet; v0.2 concern | Ensure API responses include enough metadata for future offline-first patterns (ETags, timestamps). But do not build IndexedDB sync, conflict resolution, or service workers |
| Settings/preferences UI | Admin config via API and seed scripts is sufficient for a single developer | Build config APIs that a settings UI can consume later. Do not build the forms/pages |
| Internationalization (i18n) | No end users yet; English-only is fine for v0.1 | Use string constants (not hardcoded inline strings) so i18n can be added by wrapping them later. Do not integrate i18next or build translation infrastructure |
| API key authentication for external consumers | No external consumers exist; internal auth via JWT is sufficient | Design the auth middleware to be extensible (support multiple auth strategies). Add API key strategy later when needed |

---

## Feature Dependencies

```
Authentication & Sessions
  --> Authorization (RBAC+ABAC)  [auth must exist before authz can evaluate]
    --> Permission checking middleware  [needs both auth + permission model]
      --> All protected API endpoints  [every endpoint needs guards]

Tenant Provisioning
  --> Tenant Context Resolution  [tenant must exist before context can resolve]
    --> Database Connection Routing  [context determines which DB to connect to]
      --> All data operations  [every query needs tenant-scoped connection]

Organizational Hierarchy
  --> Location-Scoped Permissions  [hierarchy defines the scopes]
    --> Attribute-Based Policy Evaluation  [location is a key attribute]

Structured Event Schema
  --> Audit Logging (write path)  [events must have schema before logging]
    --> Audit Log Query API (read path)  [must have data before querying]
    --> Cryptographic Chaining  [must have entries before chaining]

tRPC Router Structure
  --> Request Validation (Zod)  [routers need input schemas]
  --> Error Handling  [routers need consistent error responses]
  --> Request Context Propagation  [routers need tenant/user context]

Database Migrations Orchestration
  --> Tenant Provisioning  [new tenants need all migrations applied]
  --> DB-per-Tenant Isolation  [migrations must run across all tenant DBs]

User Management
  --> Role Assignment  [users must exist before assigning roles]
  --> Session Management  [sessions belong to users]
```

### Critical Path

The longest dependency chain that determines the minimum viable platform:

```
Env Config --> DB Setup --> Tenant Provisioning --> Tenant Context Resolution
  --> Connection Routing --> Auth (password + MFA) --> JWT Issuance
  --> RBAC Permission Model --> ABAC Policy Engine --> Permission Guards
  --> tRPC Protected Endpoints --> Audit Logging --> Audit Query API
```

This chain should inform phase ordering in the roadmap.

---

## MVP Recommendation

### Must Ship (v0.1 core -- the platform is not a platform without these)

1. **Username/password auth with Argon2id + JWT access/refresh tokens** -- the most basic auth that works
2. **TOTP MFA enrollment and verification** -- DOE/NIST compliance requires it; add on day one, not later
3. **Tenant provisioning with both isolation tiers** -- proving tiered isolation is the entire point of v0.1
4. **Tenant context resolution and connection routing** -- every request must be tenant-scoped
5. **Role and permission model (RBAC core)** -- define roles, assign to users, check on endpoints
6. **Location-scoped ABAC policy evaluation** -- the hybrid part of hybrid RBAC+ABAC; without it, this is just another RBAC system
7. **Immutable audit log with who-what-when-where** -- compliance from day one, not bolted on
8. **tRPC router structure with Zod validation** -- the API backbone
9. **Organizational hierarchy (Company > Region > Site)** -- required for location-scoped permissions
10. **User management CRUD** -- create users, assign roles, deactivate
11. **Session management with revocation** -- list sessions, kill sessions, enforce timeouts
12. **Structured logging and correlation IDs** -- operational observability from the start

### Should Ship (v0.1 if time allows -- significantly strengthens the foundation)

1. **Cryptographic audit log chaining** -- differentiator; relatively low effort for high compliance value
2. **Tenant isolation verification tests** -- proves the architecture works; catches regressions
3. **Field-level audit diffs** -- compliance officers need to see what changed, not just that something changed
4. **Permission simulation API** -- invaluable for debugging during development

### Defer (v0.2+)

- **SSO/SAML/CAC/PIV** -- complex, no users yet, design the extensibility point instead
- **Event bus** -- no consumers yet
- **Admin UI** -- API-first, UI later
- **Notifications** -- nothing to notify about yet
- **Audit log export** -- useful but not blocking for a developer-only proof
- **API keys for external consumers** -- no external consumers

---

## Complexity Budget

Estimated relative complexity for v0.1 Must Ship features:

| Feature Area | Effort | Risk | Notes |
|-------------|--------|------|-------|
| Auth (password + MFA + JWT) | Medium | Low | Well-understood problem; many reference implementations |
| Tiered multi-tenancy | High | High | DB-per-tenant with connection management is the hardest part of v0.1. Most likely area for architectural mistakes. Plan for iteration |
| Hybrid RBAC+ABAC | High | Medium | RBAC is straightforward; ABAC policy engine adds significant complexity. Risk: over-engineering the policy language |
| Immutable audit logging | Medium | Low | Append-only writes are simple; the schema design and indexing strategy matter more than the write path |
| tRPC + NestJS integration | Medium | Medium | tRPC-NestJS integration is less mature than standalone tRPC. May need custom adapter work |
| Org hierarchy | Medium | Low | Closure table or materialized path; well-understood patterns |
| Migration orchestration (multi-DB) | Medium | High | Operationally complex; partial failure scenarios are tricky |

**Total v0.1 complexity: High.** This is ambitious for a solo developer, but the scope is deliberately infrastructure-only (no domain features), which keeps the feature count manageable even though individual features are complex.

---

## Sources

- NIST SP 800-53 Rev. 5 (Security and Privacy Controls) -- AC-2 through AC-12 (access control family), AU-2 through AU-12 (audit family), IA-2 through IA-8 (identification/authentication family) [HIGH confidence -- authoritative standard]
- NIST SP 800-63B (Digital Identity Guidelines: Authentication) -- password requirements, MFA guidance [HIGH confidence]
- Multi-tenant SaaS architecture patterns (Microsoft Azure, AWS Well-Architected) -- isolation models, tenant routing, connection pooling [MEDIUM confidence -- training data]
- Enterprise RBAC+ABAC hybrid patterns (NIST ABAC guide, OPA/Cedar policy models) [MEDIUM confidence -- training data]
- PostgreSQL Row-Level Security documentation [HIGH confidence -- well-documented PostgreSQL feature]
- tRPC and NestJS integration patterns [MEDIUM confidence -- training data, ecosystem relatively new]

**Note:** Web search was unavailable during this research session. Findings are based on training data knowledge of NIST standards, enterprise multi-tenant architecture patterns, and DOE compliance requirements. Recommendations for tRPC-NestJS integration maturity should be verified with current documentation during stack research.
