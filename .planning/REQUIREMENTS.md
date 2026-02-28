# Requirements: Sentinel Suite v0.1 -- Platform Core

**Defined:** 2026-02-28
**Core Value:** A reliable, secure foundation that enforces tiered multi-tenant isolation and hybrid RBAC+ABAC authorization -- so every module built on top inherits DOE-grade access control and audit compliance from day one.

## v1 Requirements

Requirements for v0.1 release. Each maps to roadmap phases.

### Infrastructure

- [x] **INFR-01**: Nx monorepo scaffolded with pnpm (apps/api, apps/web, apps/admin, apps/worker, apps/docs)
- [x] **INFR-02**: Shared packages created (api-client, config, db, shared, ui, validators, auth)
- [x] **INFR-03**: Environment configuration with Zod schema validation
- [x] **INFR-04**: Docker Compose for local development (PostgreSQL, Redis)
- [ ] **INFR-05**: Structured logging with Pino (JSON, request context, correlation IDs)
- [ ] **INFR-06**: Vitest testing framework configured across all packages
- [x] **INFR-07**: Biome linting and formatting configured across monorepo
- [ ] **INFR-08**: Custom Nx generators for consistent library and module creation
- [ ] **INFR-09**: Compliance-as-code test framework skeleton (NIST 800-53 control mapping)
- [ ] **INFR-10**: Nx module boundary enforcement configured with tags

### Multi-Tenancy

- [ ] **TNCY-01**: Tenant provisioning (create, configure, activate/deactivate tenants)
- [ ] **TNCY-02**: Logical tenant isolation via PostgreSQL Row-Level Security
- [ ] **TNCY-03**: Tenant context resolved per request via nestjs-cls (AsyncLocalStorage)
- [ ] **TNCY-04**: Organizational hierarchy (Company > Region > Site > configurable sub-levels)
- [ ] **TNCY-05**: Database-per-tenant isolation tier for DOE/secure tenants
- [ ] **TNCY-06**: Config-driven tier switching (tenant config determines isolation level)
- [ ] **TNCY-07**: PgBouncer connection pooling for multi-database routing
- [ ] **TNCY-08**: Control database for tenant registry and system catalog
- [ ] **TNCY-09**: Migration orchestrator for multi-database tenant management

### Authentication

- [ ] **AUTH-01**: User can log in with username/password (bcrypt hashed)
- [ ] **AUTH-02**: JWT access tokens (short-lived, 15min) with refresh token rotation
- [ ] **AUTH-03**: Redis-backed server-side sessions for web UI with instant revocation
- [ ] **AUTH-04**: User can list and revoke active sessions
- [ ] **AUTH-05**: MFA via TOTP (enrollment, verification, recovery codes)
- [ ] **AUTH-06**: Rate limiting on auth endpoints (brute force protection)
- [ ] **AUTH-07**: Refresh token family revocation on reuse detection

### Authorization

- [ ] **RBAC-01**: Role management CRUD (create, assign, customize per organization)
- [ ] **RBAC-02**: Permission management (resource:action matrix)
- [ ] **RBAC-03**: RBAC guard enforcing role-based access on all protected endpoints
- [ ] **ABAC-01**: ABAC policy engine with JSONB-stored attribute conditions
- [ ] **ABAC-02**: Location-scoped permissions (user has different roles at different sites)
- [ ] **ABAC-03**: Two-phase authorization flow (RBAC coarse gate, ABAC fine-grained)
- [ ] **ABAC-04**: Effective permissions API ("what can user X do at site Y?")
- [ ] **ABAC-05**: CASL-Drizzle custom adapter for translating abilities to DB queries

### Audit Logging

- [ ] **AUDT-01**: Append-only audit table with DB-level INSERT-only permissions
- [ ] **AUDT-02**: Who/what/when/where captured for every mutation
- [ ] **AUDT-03**: Failed attempt logging (auth failures, authorization denials)
- [ ] **AUDT-04**: Cryptographic hash chaining for tamper evidence
- [ ] **AUDT-05**: Monthly table partitioning for retention management
- [ ] **AUDT-06**: Chain verification API for compliance audits
- [ ] **AUDT-07**: NestJS interceptor for automatic audit capture on decorated endpoints

### API Layer

- [ ] **API-01**: tRPC adapter integrated with NestJS for internal type-safe API
- [ ] **API-02**: REST controllers for external third-party consumers
- [ ] **API-03**: Dual API pattern: tRPC for own apps (web, admin, mobile), REST for external
- [ ] **API-04**: Zod schema validation on all tRPC inputs (shared via packages/validators)
- [ ] **API-05**: Correlation ID propagation across all requests
- [ ] **API-06**: Health check and readiness endpoints for Docker/monitoring
- [ ] **API-07**: Global API rate limiting

## v2 Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Platform Core v0.2

- **NOTF-01**: In-app notification system with priority tiers
- **NOTF-02**: Push notification support (web + mobile)
- **NOTF-03**: Email notification channel
- **NOTF-04**: User-configurable notification preferences
- **EVNT-01**: Event bus for async module-to-module communication
- **EVNT-02**: Real-time client updates (live dashboards)
- **CMND-01**: Command bus with CQRS pattern
- **CMND-02**: Unified command system (CLI, command palette, hotkeys, buttons)
- **OFFL-01**: Offline data sync for field officers
- **OFFL-02**: Conflict resolution (last-write-wins + manual merge queue)
- **GIS-01**: Indoor/outdoor GIS mapping with data overlays
- **GIS-02**: Officer location tracking (GPS)
- **SETS-01**: System settings admin UI
- **SETS-02**: User preferences UI (theme, layout, notification config)

### Master Records v0.3+

- **MREC-01**: Base person record (employees, visitors, guests)
- **MREC-02**: Vehicle records
- **MREC-03**: Location records with facility profiles

### Future Auth

- **FAUTH-01**: SSO/SAML federation (enterprise IdP)
- **FAUTH-02**: CAC/PIV certificate-based authentication (DOE)
- **FAUTH-03**: AD/LDAP integration
- **FAUTH-04**: Social auth (commercial clients)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full 911/PSAP CAD system | Not a security platform feature -- specialized domain |
| Payroll processing | Scheduling only, no payroll -- separate concern |
| Mobile app (React Native) | Web-first; mobile deferred to future milestone |
| Desktop app | Web-first; desktop deferred to future milestone |
| White-labeling | Branding customization deferred to v0.2+ |
| Integration marketplace | Future phased rollout (plugin > webhooks > connectors > marketplace) |
| FedRAMP certification | Future SaaS offering; architecture supports it but certification is separate |
| Internationalization | English first; multi-language on future roadmap |
| Domain modules (Security Ops, Dispatch, etc.) | v0.1 is infrastructure only; domain modules start v0.4+ |
| External system integrations | Access control, CCTV, alarm panels -- future integration framework |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFR-01 | Phase 1 | Complete |
| INFR-02 | Phase 1 | Complete |
| INFR-03 | Phase 1 | Complete |
| INFR-04 | Phase 1 | Complete |
| INFR-05 | Phase 1 | Pending |
| INFR-06 | Phase 8 | Pending |
| INFR-07 | Phase 1 | Complete |
| INFR-08 | Phase 8 | Pending |
| INFR-09 | Phase 8 | Pending |
| INFR-10 | Phase 5 | Pending |
| TNCY-01 | Phase 2 | Pending |
| TNCY-02 | Phase 2 | Pending |
| TNCY-03 | Phase 2 | Pending |
| TNCY-04 | Phase 5 | Pending |
| TNCY-05 | Phase 9 | Pending |
| TNCY-06 | Phase 9 | Pending |
| TNCY-07 | Phase 9 | Pending |
| TNCY-08 | Phase 2 | Pending |
| TNCY-09 | Phase 9 | Pending |
| AUTH-01 | Phase 4 | Pending |
| AUTH-02 | Phase 4 | Pending |
| AUTH-03 | Phase 4 | Pending |
| AUTH-04 | Phase 4 | Pending |
| AUTH-05 | Phase 4 | Pending |
| AUTH-06 | Phase 4 | Pending |
| AUTH-07 | Phase 4 | Pending |
| RBAC-01 | Phase 5 | Pending |
| RBAC-02 | Phase 5 | Pending |
| RBAC-03 | Phase 5 | Pending |
| ABAC-01 | Phase 6 | Pending |
| ABAC-02 | Phase 6 | Pending |
| ABAC-03 | Phase 6 | Pending |
| ABAC-04 | Phase 6 | Pending |
| ABAC-05 | Phase 6 | Pending |
| AUDT-01 | Phase 7 | Pending |
| AUDT-02 | Phase 7 | Pending |
| AUDT-03 | Phase 7 | Pending |
| AUDT-04 | Phase 7 | Pending |
| AUDT-05 | Phase 7 | Pending |
| AUDT-06 | Phase 7 | Pending |
| AUDT-07 | Phase 7 | Pending |
| API-01 | Phase 3 | Pending |
| API-02 | Phase 8 | Pending |
| API-03 | Phase 8 | Pending |
| API-04 | Phase 3 | Pending |
| API-05 | Phase 3 | Pending |
| API-06 | Phase 3 | Pending |
| API-07 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 48 total
- Mapped to phases: 48
- Unmapped: 0

---
*Requirements defined: 2026-02-28*
*Last updated: 2026-02-28 after roadmap creation*
