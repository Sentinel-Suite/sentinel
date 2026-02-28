# Sentinel Suite

## What This Is

Sentinel Suite (sentinel-suite.app) is a unified platform for security, safety, emergency management, and risk management operations — developed by Tracksoft Solutions. It serves both contract security companies managing multiple client sites and in-house security departments across facility types ranging from commercial office buildings to DOE GOCO-operated National Laboratories. v0.1 focuses on proving the Platform Core foundation: authentication, multi-tenancy, API infrastructure, and audit logging.

## Core Value

A reliable, secure foundation that enforces tiered multi-tenant isolation and hybrid RBAC+ABAC authorization — so every module built on top inherits DOE-grade access control and audit compliance from day one.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Hybrid RBAC+ABAC authentication and authorization with location-scoped permissions
- [ ] tRPC-based API layer with type-safe frontend-backend communication
- [ ] Tiered multi-tenancy: database-per-tenant (DOE/secure) and logical isolation (commercial), config-driven
- [ ] Immutable audit logging with full who-did-what-when-where tracking
- [ ] Flexible organizational hierarchy (Company > Region > Site > configurable sub-levels)
- [ ] User and session management (login, session persistence, logout)
- [ ] Role and permission management with customizable roles per organization
- [ ] NestJS + Nx monorepo scaffolding with pnpm (apps, packages, modules)

### Out of Scope

- Offline sync — deferred to v0.2 (complex, not needed for auth proof)
- GIS/mapping — deferred to v0.2 (not needed for foundation)
- Event bus — deferred to v0.2 (module-to-module communication comes after modules exist)
- Command bus / unified command system — deferred to v0.2
- Notifications — deferred to v0.2
- Settings/preferences UI — deferred to v0.2 (admin config via API/seed is sufficient for v0.1)
- Master Records (person, vehicle, location entities) — deferred to v0.3+
- Security Operations (Module 1) and all other domain modules — future milestones
- Mobile and desktop apps — future (web-first)
- External integrations framework — future
- SSO/SAML, CAC/PIV, AD/LDAP auth methods — v0.1 uses username/password with MFA; federated auth in later milestone
- FedRAMP certification — future
- White-labeling — future

## Context

- Greenfield project, no existing codebase
- Solo developer with AI-assisted development, no hard deadlines
- Self-funded, phased rollout module by module
- v0.1 is infrastructure proof — only the developer is testing, no real end users yet
- The platform will eventually span 17 modules (see .docs/pdd.md for full module list)
- DOE compliance (FISMA/NIST 800-53) must be baked into architecture from day one, not bolted on
- Deployment model: SaaS primary, Docker self-hosted for DOE/secure facilities

### Milestone Roadmap (high-level)

- **v0.1** — Platform Core foundation: auth, API, multi-tenancy, audit logging
- **v0.2** — Remaining Platform Core: notifications, GIS, event bus, command bus, offline sync, settings
- **v0.3+** — Master Records (Module 0.5): person, vehicle, location entities
- **v0.4+** — Security Operations (Module 1) and beyond

## Constraints

- **Tech stack**: NestJS backend, Next.js frontend, pnpm monorepo with Nx, PostgreSQL, tRPC internal API
- **ORM**: TBD — research will inform (Prisma, Drizzle, or TypeORM under consideration)
- **Module organization**: TBD — top-level `modules/` vs `apps/api/src/modules/` to be researched
- **Compliance**: DOE Orders (470 series), FISMA/NIST 800-53, Section 508/WCAG 2.1 from day one
- **Deployment**: Docker containerized, must support both SaaS and self-hosted
- **Accessibility**: Section 508 / WCAG 2.1 compliance from day one
- **Multi-tenancy**: Tiered data isolation — full DB isolation for DOE/secure, logical isolation for commercial

### Monorepo Structure

```
sentinel-suite/
├── apps/
│   ├── api/          # NestJS backend
│   ├── web/          # Next.js main app
│   ├── admin/        # Admin interface
│   ├── worker/       # Background jobs
│   └── docs/         # Documentation site
├── packages/
│   ├── api-client/   # Typed API client
│   ├── config/       # Shared configuration
│   ├── db/           # Database layer / ORM
│   ├── shared/       # Shared utilities / types
│   ├── ui/           # Component library
│   ├── validators/   # Shared validation schemas
│   └── auth/         # Auth logic
└── modules/          # Domain modules (TBD: top-level vs inside api)
```

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| NestJS for backend | Modular architecture aligns with multi-module platform; strong TypeScript support; enterprise patterns (DI, decorators, guards) | — Pending |
| Nx monorepo with pnpm | Manages build/test/lint across apps and packages; pnpm for fast, disk-efficient installs | — Pending |
| tRPC for internal API | Type-safe end-to-end; eliminates API contract drift between frontend and backend | — Pending |
| PostgreSQL | Strong multi-tenant support, JSONB for flexible schemas, mature ecosystem, DOE-compatible | — Pending |
| Tiered multi-tenancy from v0.1 | Proving the harder model early de-risks DOE deployment; config-driven switching | — Pending |
| Hybrid RBAC+ABAC | Location-scoped permissions required for DOE; pure RBAC insufficient for multi-site, multi-role scenarios | — Pending |
| ORM selection | TBD — research will compare Prisma, Drizzle, TypeORM for this use case | — Pending |
| Module location in monorepo | TBD — research will compare top-level modules/ vs apps/api/src/modules/ | — Pending |

---
*Last updated: 2026-02-28 after initialization*
