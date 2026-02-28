# Architecture Patterns

**Domain:** Multi-tenant enterprise security platform core (NestJS + Nx + PostgreSQL)
**Researched:** 2026-02-28
**Overall confidence:** MEDIUM (training data only -- web verification tools unavailable; all patterns are well-established in training data but version-specific details should be validated)

---

## Recommended Architecture

### High-Level System Topology

```
                                  +------------------+
                                  |   Load Balancer   |
                                  +--------+---------+
                                           |
                        +------------------+------------------+
                        |                                     |
                +-------v-------+                   +---------v---------+
                |   apps/web    |                   |   apps/admin      |
                |   (Next.js)   |                   |   (Next.js)       |
                +-------+-------+                   +---------+---------+
                        |                                     |
                        +------------------+------------------+
                                           | tRPC (type-safe)
                                           |
                                  +--------v---------+
                                  |    apps/api       |
                                  |    (NestJS)       |
                                  |                   |
                                  | +---------------+ |
                                  | | TenantContext  | |     +----------------+
                                  | | (per-request)  | |     |  apps/worker   |
                                  | +---------------+ |     |  (Bull/BullMQ)  |
                                  +---------+---------+     +-------+--------+
                                            |                       |
                        +-------------------+---+-------------------+
                        |                   |                       |
               +--------v------+   +--------v--------+   +---------v--------+
               | Control DB    |   | Tenant DB (DOE)  |   | Shared DB        |
               | (system-wide) |   | (per-tenant)     |   | (commercial)     |
               +---------------+   +-----------------+   +------------------+
```

### Architecture Style: Modular Monolith

Use a modular monolith (not microservices) for v0.1. This is the correct choice because:

1. **Solo developer** -- microservices add operational overhead (service mesh, distributed tracing, deployment coordination) that a solo developer cannot sustain
2. **Module boundaries are still uncertain** -- a monolith lets you refactor boundaries cheaply; microservices make wrong boundaries expensive
3. **NestJS modules map naturally** -- NestJS's DI system, module imports/exports, and guards already enforce boundaries within a single process
4. **Extract later** -- well-bounded NestJS modules can be extracted to standalone services when traffic or team size demands it

**Confidence:** HIGH -- this is the standard recommendation in the NestJS ecosystem for greenfield projects. The Nx monorepo structure further supports this by letting you define library boundaries that can later become independent deployables.

---

## Component Boundaries

### Core Components (v0.1 Scope)

| Component | Responsibility | Communicates With | Build Phase |
|-----------|---------------|-------------------|-------------|
| **TenancyModule** | Tenant resolution, DB connection routing, tenant context propagation | Every module (upstream of all) | Phase 1 |
| **DatabaseModule** | Connection pool management, migrations, ORM config | TenancyModule, all data-access layers | Phase 1 |
| **AuthModule** | Authentication (login, sessions, MFA), token issuance | TenancyModule, UserModule, RBAC | Phase 2 |
| **UserModule** | User CRUD, profile management, user-tenant associations | AuthModule, RBAC, TenancyModule | Phase 2 |
| **RBACModule** | Role/permission definitions, role assignments | AuthModule, ABACModule | Phase 3 |
| **ABACModule** | Attribute-based policy evaluation, location-scoped access | RBACModule, TenancyModule | Phase 3 |
| **AuditModule** | Immutable event logging, tamper detection, query interface | Every module (downstream of all) | Phase 2 |
| **tRPCModule** | Router registration, procedure definitions, middleware chain | AuthModule, all domain modules | Phase 1 |
| **OrgHierarchyModule** | Company > Region > Site > sub-level management | TenancyModule, RBAC, ABAC | Phase 3 |

### Shared Packages (Nx libraries)

| Package | Purpose | Consumed By |
|---------|---------|-------------|
| `packages/db` | Database schemas, migrations, repository base classes, connection factory | apps/api, apps/worker |
| `packages/shared` | TypeScript types, enums, constants, utility functions | All apps and packages |
| `packages/config` | Environment config schemas, validation, typed config access | All apps |
| `packages/validators` | Zod schemas for all domain objects (shared between tRPC and frontend) | apps/api, apps/web, apps/admin |
| `packages/auth` | Auth-related types, token interfaces, permission constants | apps/api, apps/web, apps/admin |
| `packages/api-client` | Generated/typed tRPC client, React Query hooks | apps/web, apps/admin |
| `packages/ui` | Shared React component library | apps/web, apps/admin |

---

## Question 1: Tiered Multi-Tenancy Architecture

### Recommendation: Three-Database Topology with Config-Driven Switching

**Confidence:** MEDIUM -- this pattern is well-documented in multi-tenant literature. The NestJS-specific implementation uses dynamic modules and request-scoped providers, which are established patterns.

#### Database Topology

```
+-------------------+     +------------------------+     +--------------------+
| Control Database  |     | Tenant Database (N)    |     | Shared Database    |
| (system catalog)  |     | (DOE/high-security)    |     | (commercial pool)  |
+-------------------+     +------------------------+     +--------------------+
| - tenant_registry |     | - users                |     | - users            |
| - tenant_config   |     | - roles                |     | - roles            |
| - subscription    |     | - permissions          |     | - permissions      |
| - feature_flags   |     | - audit_logs           |     | - audit_logs       |
| - global_settings |     | - org_hierarchy        |     | - org_hierarchy    |
| - db_connections  |     | - [all domain tables]  |     | - [all domain]     |
+-------------------+     +------------------------+     +--------------------+
                                                          (with tenant_id FK
                                                           + RLS policies)
```

**Three databases, not two:**

1. **Control Database** -- system-level catalog. Stores tenant registry, connection strings, subscription tiers, feature flags. Never contains tenant data. Single instance.
2. **Tenant Databases (N)** -- one per DOE/high-security tenant. Complete isolation. Each has its own users, audit logs, domain tables. Connection string stored encrypted in Control DB.
3. **Shared Database** -- pool for commercial tenants. All commercial tenants share one database with `tenant_id` column on every table + PostgreSQL Row-Level Security (RLS) policies enforcing isolation.

#### Config-Driven Switching

The `tenant_config` table in the Control DB determines isolation strategy:

```typescript
// packages/db/src/schemas/tenant-config.ts
interface TenantConfig {
  tenantId: string;
  isolationLevel: 'database' | 'shared';  // config-driven
  databaseUrl?: string;                     // encrypted, only for 'database' level
  encryptionKeyId: string;                  // per-tenant encryption key reference
  complianceProfile: 'doe' | 'fisma' | 'commercial';
  features: Record<string, boolean>;
}
```

#### Request-Scoped Tenant Context (NestJS Implementation)

```typescript
// apps/api/src/tenancy/tenant-context.service.ts
@Injectable({ scope: Scope.REQUEST })
export class TenantContext {
  private tenantId: string;
  private dataSource: DataSource;  // resolved per-request

  // Set by TenantMiddleware early in request pipeline
  setTenant(tenantId: string, dataSource: DataSource) {
    this.tenantId = tenantId;
    this.dataSource = dataSource;
  }

  getTenantId(): string { return this.tenantId; }
  getDataSource(): DataSource { return this.dataSource; }
}
```

```typescript
// apps/api/src/tenancy/tenant.middleware.ts
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private controlDb: ControlDatabaseService,
    private connectionPool: TenantConnectionPool,
    private tenantContext: TenantContext,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // 1. Extract tenant identifier from subdomain, header, or JWT
    const tenantId = this.extractTenantId(req);

    // 2. Look up tenant config in control DB
    const config = await this.controlDb.getTenantConfig(tenantId);

    // 3. Get or create connection for this tenant
    const dataSource = config.isolationLevel === 'database'
      ? await this.connectionPool.getDedicatedConnection(config.databaseUrl)
      : await this.connectionPool.getSharedConnection();

    // 4. Set tenant context for this request
    this.tenantContext.setTenant(tenantId, dataSource);

    // 5. If shared DB, set RLS session variable
    if (config.isolationLevel === 'shared') {
      await dataSource.query(`SET app.current_tenant = '${tenantId}'`);
    }

    next();
  }
}
```

#### Connection Pool Management

```typescript
// apps/api/src/tenancy/tenant-connection-pool.service.ts
@Injectable()
export class TenantConnectionPool {
  private pools: Map<string, DataSource> = new Map();

  async getDedicatedConnection(encryptedUrl: string): Promise<DataSource> {
    const url = await this.decrypt(encryptedUrl);
    const key = hashConnectionString(url);

    if (!this.pools.has(key)) {
      const ds = new DataSource({ type: 'postgres', url, /* ... */ });
      await ds.initialize();
      this.pools.set(key, ds);
    }
    return this.pools.get(key);
  }

  async getSharedConnection(): Promise<DataSource> {
    return this.pools.get('shared'); // initialized at startup
  }
}
```

#### PostgreSQL RLS for Shared Database

```sql
-- Applied to every tenant-scoped table in the shared database
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON users
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- Force RLS even for table owners (critical for security)
ALTER TABLE users FORCE ROW LEVEL SECURITY;
```

**Critical detail:** RLS must be `FORCE`d even for the table owner role, otherwise the application's DB user bypasses policies entirely. This is a common and dangerous misconfiguration.

#### Tenant Resolution Strategy

Resolve tenant from (in priority order):
1. **JWT claim** (`tenant_id` in access token) -- primary for authenticated requests
2. **Subdomain** (`acme.sentinel-suite.app`) -- for login page tenant resolution
3. **X-Tenant-ID header** -- for API-to-API calls and testing
4. **Query parameter** (`?tenant=acme`) -- fallback for development only

---

## Question 2: Nx Monorepo Module Organization

### Recommendation: Hybrid -- `packages/` for Shared Libraries, Domain Modules Inside `apps/api/src/modules/`

**Confidence:** MEDIUM -- Nx documentation recommends libraries in `packages/` (or `libs/`). NestJS domain modules being inside the API app is standard NestJS practice. The hybrid approach is the pragmatic choice for a modular monolith.

#### Why NOT Top-Level `modules/`

A top-level `modules/` directory is awkward because:

1. **NestJS modules are backend-specific** -- they use NestJS decorators (`@Module`, `@Injectable`, `@Controller`), which only make sense inside a NestJS app. Putting them at the repo root implies they are framework-agnostic, which they are not.
2. **Nx library boundaries are for shared code** -- `packages/` (Nx libraries) should contain code consumed by multiple apps. NestJS modules are consumed by exactly one app (`apps/api`).
3. **Import paths become confusing** -- a top-level `modules/auth` would need Nx path aliases, but it only has one consumer. Overhead without benefit.

#### Recommended Structure

```
sentinel-suite/
├── apps/
│   ├── api/                          # NestJS backend application
│   │   ├── src/
│   │   │   ├── app.module.ts         # Root module, imports all domain modules
│   │   │   ├── main.ts               # Bootstrap
│   │   │   ├── core/                 # Framework-level (non-domain) services
│   │   │   │   ├── tenancy/          # TenantMiddleware, TenantContext, ConnectionPool
│   │   │   │   ├── trpc/             # tRPC adapter, router registry
│   │   │   │   ├── config/           # NestJS ConfigModule setup
│   │   │   │   └── health/           # Health checks
│   │   │   └── modules/              # Domain modules
│   │   │       ├── auth/
│   │   │       │   ├── auth.module.ts
│   │   │       │   ├── auth.service.ts
│   │   │       │   ├── auth.guard.ts
│   │   │       │   ├── strategies/   # Passport strategies
│   │   │       │   ├── dto/
│   │   │       │   └── __tests__/
│   │   │       ├── user/
│   │   │       │   ├── user.module.ts
│   │   │       │   ├── user.service.ts
│   │   │       │   ├── user.repository.ts
│   │   │       │   └── ...
│   │   │       ├── rbac/
│   │   │       │   ├── rbac.module.ts
│   │   │       │   ├── rbac.guard.ts
│   │   │       │   ├── rbac.service.ts
│   │   │       │   ├── decorators/   # @Roles(), @Permissions()
│   │   │       │   └── ...
│   │   │       ├── abac/
│   │   │       │   ├── abac.module.ts
│   │   │       │   ├── policy-engine.service.ts
│   │   │       │   ├── policies/     # Policy definitions
│   │   │       │   └── ...
│   │   │       ├── audit/
│   │   │       │   ├── audit.module.ts
│   │   │       │   ├── audit.service.ts
│   │   │       │   ├── audit.interceptor.ts
│   │   │       │   └── ...
│   │   │       └── org-hierarchy/
│   │   │           ├── org-hierarchy.module.ts
│   │   │           └── ...
│   │   └── test/                     # E2E tests
│   ├── web/                          # Next.js frontend
│   ├── admin/                        # Admin panel
│   ├── worker/                       # Background job processor
│   └── docs/                         # Documentation site
├── packages/                         # Shared Nx libraries
│   ├── db/                           # Database schemas, migrations, base repos
│   │   ├── src/
│   │   │   ├── schemas/              # ORM schema definitions
│   │   │   ├── migrations/           # Database migrations
│   │   │   ├── seeds/                # Seed data
│   │   │   └── repositories/         # Base repository classes
│   │   └── project.json
│   ├── shared/                       # Cross-app types and utilities
│   │   ├── src/
│   │   │   ├── types/                # TypeScript interfaces/types
│   │   │   ├── constants/            # Shared constants, enums
│   │   │   └── utils/                # Pure utility functions
│   │   └── project.json
│   ├── validators/                   # Zod schemas (shared validation)
│   │   ├── src/
│   │   │   ├── auth.schema.ts
│   │   │   ├── user.schema.ts
│   │   │   └── ...
│   │   └── project.json
│   ├── config/                       # Environment config
│   ├── auth/                         # Auth types, token interfaces, permission constants
│   ├── api-client/                   # tRPC client + React Query wrappers
│   └── ui/                           # React component library
├── tools/                            # Nx generators, scripts
├── nx.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

#### Nx Module Boundary Enforcement

Use Nx tags to enforce import rules:

```json
// nx.json (or .eslintrc.json with @nx/enforce-module-boundaries)
{
  "depConstraints": [
    { "sourceTag": "scope:api", "onlyDependOnLibsWithTags": ["scope:shared", "scope:db", "scope:validators", "scope:config", "scope:auth-types"] },
    { "sourceTag": "scope:web", "onlyDependOnLibsWithTags": ["scope:shared", "scope:validators", "scope:api-client", "scope:ui", "scope:config", "scope:auth-types"] },
    { "sourceTag": "scope:shared", "onlyDependOnLibsWithTags": ["scope:shared"] },
    { "sourceTag": "scope:db", "onlyDependOnLibsWithTags": ["scope:shared", "scope:config"] }
  ]
}
```

Tag each project in its `project.json`:

```json
// apps/api/project.json
{ "tags": ["scope:api", "type:app"] }

// packages/shared/project.json
{ "tags": ["scope:shared", "type:lib"] }
```

---

## Question 3: NestJS Module Boundaries (Auth, Tenancy, Logging)

### Recommendation: Layered Guard Chain with Clear Import Direction

**Confidence:** HIGH -- this is standard NestJS architecture using guards, interceptors, and middleware.

#### Request Pipeline (Order Matters)

```
Incoming Request
  |
  v
[1] TenantMiddleware          (middleware -- resolves tenant, sets DB connection)
  |
  v
[2] AuthGuard                 (guard -- validates JWT/session, sets req.user)
  |
  v
[3] RBACGuard                 (guard -- checks role-based permissions)
  |
  v
[4] ABACGuard                 (guard -- evaluates attribute-based policies)
  |
  v
[5] ValidationPipe            (pipe -- validates request body via Zod schemas)
  |
  v
[6] Controller / tRPC Router  (handler -- executes business logic)
  |
  v
[7] AuditInterceptor          (interceptor -- logs action result to audit trail)
  |
  v
Response
```

#### Module Import Direction (Dependency Graph)

```
TenancyModule (no domain imports -- standalone)
     |
     v
AuthModule (imports TenancyModule for tenant-scoped user lookups)
     |
     v
RBACModule (imports AuthModule for user context)
     |
     v
ABACModule (imports RBACModule, TenancyModule for location-scoped policies)
     |
     v
AuditModule (imports TenancyModule -- standalone otherwise, used via interceptor)
     |
     v
Domain Modules (import Auth, RBAC, ABAC, Audit as needed)
```

#### Module Boundary Rules

| Module | Exports (Public API) | Never Imports |
|--------|---------------------|---------------|
| **TenancyModule** | `TenantContext`, `TenantGuard` | Any domain module |
| **AuthModule** | `AuthGuard`, `AuthService`, `CurrentUser` decorator | RBAC, ABAC, domain modules |
| **RBACModule** | `RBACGuard`, `@Roles()` decorator, `RBACService` | ABAC, domain modules |
| **ABACModule** | `ABACGuard`, `@Policy()` decorator, `PolicyEngine` | Domain modules |
| **AuditModule** | `AuditInterceptor`, `AuditService`, `@Audited()` decorator | Auth, RBAC, ABAC |
| **UserModule** | `UserService` | RBAC (consumed by RBAC, not the reverse) |

#### Guard Composition Example

```typescript
// Using decorators to compose the full auth chain on a route
@Controller('sites')
export class SiteController {
  @Get(':siteId/reports')
  @UseGuards(AuthGuard, RBACGuard, ABACGuard)  // Order enforced
  @Roles('security_manager', 'site_admin')       // RBAC requirement
  @Policy('site:read', { locationScoped: true })  // ABAC: must have access to THIS site
  @Audited('site.reports.viewed')                 // Audit trail
  async getSiteReports(
    @CurrentUser() user: AuthenticatedUser,
    @Param('siteId') siteId: string,
  ) {
    // Guards already verified:
    // 1. User is authenticated (AuthGuard)
    // 2. User has security_manager or site_admin role (RBACGuard)
    // 3. User has site:read permission for THIS specific site (ABACGuard)
    // AuditInterceptor will log the result after handler returns
  }
}
```

---

## Question 4: tRPC Integration with NestJS

### Recommendation: Nest-tRPC Adapter with Express Middleware Mount

**Confidence:** MEDIUM -- tRPC has an Express adapter (stable). NestJS runs on Express (or Fastify) underneath. The integration pattern is to mount tRPC as Express middleware within NestJS, not to replace NestJS controllers. There is a community library `nestjs-trpc` but its maturity should be validated before adoption.

#### Integration Architecture

```
NestJS App (Express underneath)
├── /api/trpc/*          <-- tRPC router (mounted as Express middleware)
│   ├── auth.*           <-- tRPC procedures for auth
│   ├── user.*           <-- tRPC procedures for user management
│   ├── audit.*          <-- tRPC procedures for audit queries
│   └── ...
├── /api/v1/*            <-- REST controllers (future external API)
└── /health              <-- NestJS health check controller
```

#### Implementation Pattern

```typescript
// apps/api/src/core/trpc/trpc.module.ts
@Module({
  providers: [TrpcService, TrpcRouter],
  exports: [TrpcService],
})
export class TrpcModule implements NestModule {
  constructor(private trpcRouter: TrpcRouter) {}

  configure(consumer: MiddlewareConsumer) {
    // Mount tRPC as Express middleware on /api/trpc
    consumer
      .apply(
        createExpressMiddleware({
          router: this.trpcRouter.appRouter,
          createContext: this.trpcRouter.createContext,
        }),
      )
      .forRoutes('/api/trpc');
  }
}
```

```typescript
// apps/api/src/core/trpc/trpc.service.ts
import { initTRPC, TRPCError } from '@trpc/server';
import { injectable } from '@nestjs/common';
import type { TenantContext } from '../tenancy/tenant-context.service';

export interface TrpcContext {
  tenantContext: TenantContext;
  user: AuthenticatedUser | null;
  req: Request;
  res: Response;
}

@Injectable()
export class TrpcService {
  private t = initTRPC.context<TrpcContext>().create();

  get router() { return this.t.router; }
  get procedure() { return this.t.procedure; }
  get middleware() { return this.t.middleware; }

  // Reusable middleware that mirrors the NestJS guard chain
  isAuthenticated = this.t.middleware(({ ctx, next }) => {
    if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
    return next({ ctx: { ...ctx, user: ctx.user } });
  });

  // Protected procedure = authenticated + tenant-scoped
  protectedProcedure = this.t.procedure.use(this.isAuthenticated);
}
```

```typescript
// apps/api/src/core/trpc/trpc.router.ts
@Injectable()
export class TrpcRouter {
  constructor(
    private trpc: TrpcService,
    private authRouter: AuthTrpcRouter,
    private userRouter: UserTrpcRouter,
    private auditRouter: AuditTrpcRouter,
  ) {}

  appRouter = this.trpc.router({
    auth: this.authRouter.router,
    user: this.userRouter.router,
    audit: this.auditRouter.router,
  });

  createContext = async ({ req, res }): Promise<TrpcContext> => {
    // Extract tenant context and user from NestJS request
    // (TenantMiddleware already ran before tRPC middleware)
    return {
      tenantContext: req['tenantContext'],
      user: req['user'] || null,
      req,
      res,
    };
  };
}

export type AppRouter = TrpcRouter['appRouter'];
```

#### Per-Module tRPC Routers

Each domain module defines its own tRPC router:

```typescript
// apps/api/src/modules/auth/auth.trpc-router.ts
@Injectable()
export class AuthTrpcRouter {
  constructor(
    private trpc: TrpcService,
    private authService: AuthService,
  ) {}

  router = this.trpc.router({
    login: this.trpc.procedure
      .input(loginSchema)        // Zod schema from packages/validators
      .mutation(({ input }) => this.authService.login(input)),

    me: this.trpc.protectedProcedure
      .query(({ ctx }) => this.authService.getProfile(ctx.user.id)),

    logout: this.trpc.protectedProcedure
      .mutation(({ ctx }) => this.authService.logout(ctx.user.sessionId)),
  });
}
```

#### Client-Side Type Safety

```typescript
// packages/api-client/src/index.ts
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@sentinel-suite/api/trpc'; // Nx path alias

export const trpc = createTRPCReact<AppRouter>();

// Usage in apps/web:
// const { data: user } = trpc.auth.me.useQuery();
```

**Key architectural decision:** tRPC handles internal (frontend-to-backend) communication. REST controllers (standard NestJS `@Controller`) handle external API consumers. This dual-API pattern gives type safety internally while providing a documented REST API externally.

---

## Question 5: Hybrid RBAC+ABAC Authorization Architecture

### Recommendation: RBAC as Coarse Gate, ABAC as Fine-Grained Policy Engine

**Confidence:** MEDIUM -- this is a well-established pattern in enterprise authorization (NIST 800-162 describes ABAC; NIST 800-53 AC controls reference both). The NestJS-specific implementation is standard guard/decorator composition.

#### Authorization Data Model

```
+------------------+     +-------------------+     +--------------------+
| Role             |     | Permission        |     | Policy             |
+------------------+     +-------------------+     +--------------------+
| id               |     | id                |     | id                 |
| tenant_id        |     | resource          |     | name               |
| name             |     | action            |     | description        |
| description      |     | description       |     | effect (allow/deny)|
| is_system        |     +-------------------+     | conditions (JSONB) |
| created_at       |           |                   | priority           |
+------------------+     +-----v-------------+     +--------------------+
       |                 | RolePermission     |            |
  +----v-----------+     +-------------------+     +-------v-----------+
  | UserRole       |     | role_id           |     | PolicyBinding      |
  +----------------+     | permission_id     |     +-------------------+
  | user_id        |     +-------------------+     | policy_id          |
  | role_id        |                               | role_id (optional) |
  | tenant_id      |                               | resource_type      |
  | scope_type     |     (enum: 'global' |         | scope_type         |
  | scope_id       |      'region' | 'site' |      | scope_id           |
  +----------------+      'zone')                  +-------------------+
         |
         | scope determines WHERE this role applies
         | (global = everywhere, site = specific site only)
```

#### Two-Phase Authorization Flow

```
Request arrives with user context
  |
  v
Phase 1: RBAC (Coarse-grained, fast)
  - Does user have ANY role granting this permission?
  - Check: user.roles -> role.permissions -> includes(resource:action)?
  - Result: DENY (fast reject) or CONTINUE
  |
  v
Phase 2: ABAC (Fine-grained, contextual)
  - Evaluate attribute-based policies for this specific context
  - Subject attributes: user.department, user.clearance_level, user.certifications
  - Resource attributes: resource.classification, resource.site_id
  - Environment attributes: time_of_day, ip_address, is_on_site
  - Context: does user's role scope include THIS resource's location?
  - Result: ALLOW or DENY
```

#### Location-Scoped Permissions (Key Differentiator)

This is the critical DOE requirement: a user might be `Security Manager` at Site A but only `Security Officer` at Site B.

```typescript
// Example: User has different roles at different locations
const userRoles = [
  { role: 'security_manager', scopeType: 'site', scopeId: 'site-doe-lab-a' },
  { role: 'security_officer', scopeType: 'site', scopeId: 'site-commercial-b' },
  { role: 'viewer', scopeType: 'global', scopeId: null },
];

// When accessing Site A reports: security_manager permissions apply
// When accessing Site B reports: security_officer permissions apply
// When accessing cross-site dashboard: viewer permissions apply
```

#### ABAC Policy Engine

```typescript
// apps/api/src/modules/abac/policy-engine.service.ts
@Injectable()
export class PolicyEngine {
  async evaluate(context: PolicyContext): Promise<PolicyDecision> {
    const { subject, resource, action, environment } = context;

    // 1. Gather applicable policies
    const policies = await this.getPolicies(resource.type, action);

    // 2. Evaluate each policy's conditions against context
    const results = policies.map(policy => ({
      policy,
      matches: this.evaluateConditions(policy.conditions, {
        subject,
        resource,
        environment,
      }),
    }));

    // 3. Apply combining algorithm (deny-overrides)
    // Any explicit DENY wins over ALLOWs
    if (results.some(r => r.matches && r.policy.effect === 'deny')) {
      return { allowed: false, reason: 'Explicit deny policy matched' };
    }
    if (results.some(r => r.matches && r.policy.effect === 'allow')) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'No matching allow policy' };
  }

  private evaluateConditions(
    conditions: PolicyCondition[],
    context: EvaluationContext,
  ): boolean {
    // Conditions stored as JSONB, evaluated at runtime
    // Example condition:
    // { "subject.clearance_level": { "$gte": "resource.required_clearance" } }
    // { "environment.time": { "$between": ["06:00", "18:00"] } }
    // { "subject.site_assignments": { "$contains": "resource.site_id" } }
    return conditions.every(cond => this.evaluateCondition(cond, context));
  }
}
```

#### Policy Storage (JSONB Conditions)

```sql
-- Example policies
INSERT INTO policies (name, effect, conditions, priority) VALUES
  ('require-clearance-for-classified',
   'deny',
   '[{"subject.clearance_level": {"$lt": "resource.required_clearance"}}]',
   100),

  ('business-hours-only-for-remote',
   'deny',
   '[{"environment.is_remote": {"$eq": true}}, {"environment.time": {"$notBetween": ["06:00", "22:00"]}}]',
   90),

  ('site-assignment-required',
   'deny',
   '[{"subject.assigned_sites": {"$notContains": "resource.site_id"}}]',
   100);
```

---

## Question 6: Audit Logging Architecture

### Recommendation: Append-Only Table with Cryptographic Chaining (Not Full Event Sourcing)

**Confidence:** MEDIUM -- append-only audit tables are the standard approach for compliance-grade logging. Full event sourcing is overkill for audit trails and adds significant complexity. The cryptographic chaining pattern is used in DOE/FISMA environments for tamper evidence.

#### Why NOT Full Event Sourcing

| Factor | Event Sourcing | Append-Only Table |
|--------|---------------|-------------------|
| Complexity | HIGH -- requires event store, projections, snapshots, eventual consistency | LOW -- standard INSERT + query |
| Replay capability | Yes -- rebuild state from events | No -- audit is record of events, not source of truth |
| Query flexibility | Complex -- requires read models | Simple -- standard SQL queries |
| Storage | Grows indefinitely, requires snapshots | Grows linearly, standard retention policies |
| Value for THIS project | Overkill -- we need immutable records, not state reconstruction | Perfect fit -- who-did-what-when-where |

Event sourcing is a state management pattern. Audit logging is a compliance pattern. They solve different problems. Use append-only tables with cryptographic integrity for audit; consider event sourcing later for the Event Bus (v0.2) if command replay is needed.

#### Audit Log Schema

```sql
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,

  -- WHO
  actor_id        UUID NOT NULL,                 -- user who performed the action
  actor_type      VARCHAR(50) NOT NULL,          -- 'user', 'system', 'api_key'
  actor_ip        INET,
  actor_user_agent TEXT,

  -- WHAT
  action          VARCHAR(100) NOT NULL,         -- 'user.created', 'role.assigned', 'report.viewed'
  resource_type   VARCHAR(100) NOT NULL,         -- 'user', 'role', 'incident_report'
  resource_id     UUID,
  changes         JSONB,                         -- { before: {...}, after: {...} } for mutations

  -- WHEN
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- WHERE
  site_id         UUID,                          -- location context
  module          VARCHAR(50),                   -- 'auth', 'rbac', 'user'

  -- INTEGRITY
  previous_hash   VARCHAR(64),                   -- SHA-256 of previous log entry (chaining)
  entry_hash      VARCHAR(64) NOT NULL,          -- SHA-256 of this entry's content
  sequence_num    BIGINT NOT NULL,               -- monotonic sequence per tenant

  -- METADATA
  session_id      UUID,
  correlation_id  UUID,                          -- trace across related actions
  metadata        JSONB                          -- additional context
);

-- Immutability enforcement
REVOKE UPDATE, DELETE ON audit_logs FROM app_user;
-- Only INSERT and SELECT allowed

-- Indexes for common query patterns
CREATE INDEX idx_audit_tenant_time ON audit_logs (tenant_id, occurred_at DESC);
CREATE INDEX idx_audit_actor ON audit_logs (tenant_id, actor_id, occurred_at DESC);
CREATE INDEX idx_audit_resource ON audit_logs (tenant_id, resource_type, resource_id);
CREATE INDEX idx_audit_action ON audit_logs (tenant_id, action, occurred_at DESC);

-- Partition by month for retention management
CREATE TABLE audit_logs_2026_01 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

#### Cryptographic Chain for Tamper Evidence

```typescript
// apps/api/src/modules/audit/audit.service.ts
@Injectable()
export class AuditService {
  constructor(
    private tenantContext: TenantContext,
  ) {}

  async log(entry: AuditEntry): Promise<void> {
    const ds = this.tenantContext.getDataSource();
    const tenantId = this.tenantContext.getTenantId();

    // 1. Get previous entry's hash for chaining
    const previous = await ds.query(
      `SELECT entry_hash, sequence_num FROM audit_logs
       WHERE tenant_id = $1 ORDER BY sequence_num DESC LIMIT 1`,
      [tenantId],
    );

    const previousHash = previous[0]?.entry_hash || '0'.repeat(64);
    const sequenceNum = (previous[0]?.sequence_num || 0) + 1;

    // 2. Compute this entry's hash (includes previous hash for chaining)
    const entryHash = this.computeHash({
      ...entry,
      tenantId,
      previousHash,
      sequenceNum,
    });

    // 3. INSERT (never UPDATE)
    await ds.query(
      `INSERT INTO audit_logs (
        tenant_id, actor_id, actor_type, actor_ip, actor_user_agent,
        action, resource_type, resource_id, changes,
        site_id, module, previous_hash, entry_hash, sequence_num,
        session_id, correlation_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [tenantId, entry.actorId, entry.actorType, entry.actorIp, entry.actorUserAgent,
       entry.action, entry.resourceType, entry.resourceId, entry.changes,
       entry.siteId, entry.module, previousHash, entryHash, sequenceNum,
       entry.sessionId, entry.correlationId, entry.metadata],
    );
  }

  private computeHash(data: object): string {
    return createHash('sha256')
      .update(JSON.stringify(data, Object.keys(data).sort()))
      .digest('hex');
  }

  // Verify chain integrity (for compliance audits)
  async verifyChain(tenantId: string, from: Date, to: Date): Promise<ChainVerification> {
    const entries = await this.getEntries(tenantId, from, to);
    const breaks: ChainBreak[] = [];

    for (let i = 1; i < entries.length; i++) {
      if (entries[i].previous_hash !== entries[i - 1].entry_hash) {
        breaks.push({
          at: entries[i].sequence_num,
          expected: entries[i - 1].entry_hash,
          found: entries[i].previous_hash,
        });
      }
    }

    return { valid: breaks.length === 0, breaks, entriesChecked: entries.length };
  }
}
```

#### NestJS Interceptor for Automatic Auditing

```typescript
// apps/api/src/modules/audit/audit.interceptor.ts
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditAction = this.reflector.get<string>('audit:action', context.getHandler());
    if (!auditAction) return next.handle(); // Skip if not @Audited

    const req = context.switchToHttp().getRequest();
    const startTime = Date.now();

    return next.handle().pipe(
      tap(async (response) => {
        await this.auditService.log({
          actorId: req.user?.id,
          actorType: 'user',
          actorIp: req.ip,
          actorUserAgent: req.headers['user-agent'],
          action: auditAction,
          resourceType: this.extractResourceType(context),
          resourceId: this.extractResourceId(req),
          changes: this.extractChanges(req, response),
          siteId: req.params?.siteId,
          module: this.extractModule(context),
          sessionId: req.user?.sessionId,
          correlationId: req.headers['x-correlation-id'],
          metadata: { duration: Date.now() - startTime },
        });
      }),
      catchError(async (error) => {
        // Log failed attempts too (critical for security auditing)
        await this.auditService.log({
          actorId: req.user?.id,
          actorType: req.user ? 'user' : 'anonymous',
          action: `${auditAction}.failed`,
          // ... error details
          metadata: { error: error.message, statusCode: error.status },
        });
        throw error;
      }),
    );
  }
}

// Decorator
export const Audited = (action: string) => SetMetadata('audit:action', action);
```

#### Table Partitioning for Retention

```sql
-- Partition audit_logs by month for efficient retention management
-- Drop old partitions instead of DELETE (instant, no vacuum needed)
-- DOE tenants: 7-year retention
-- Commercial tenants: 1-year retention (configurable)

-- Automated partition creation (run monthly via apps/worker cron job)
CREATE TABLE audit_logs_2026_03 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
```

---

## Data Flow

### Authentication Flow

```
Client                  apps/api                    Database
  |                        |                           |
  |-- POST /api/trpc/auth.login ---------------------->|
  |                        |                           |
  |                  TenantMiddleware                   |
  |                  (resolve tenant,                   |
  |                   get DB connection)                |
  |                        |                           |
  |                  AuthService.login()                |
  |                  (validate credentials) ----------->| (query users table)
  |                        |<--------------------------|
  |                  (generate JWT with                 |
  |                   tenantId, userId, roles)          |
  |                        |                           |
  |                  AuditService.log()                 |
  |                  ('auth.login.success') ----------->| (INSERT audit_logs)
  |                        |                           |
  |<-- { accessToken, refreshToken } ------------------|
```

### Authorized Request Flow

```
Client                  apps/api                    Database
  |                        |                           |
  |-- GET /api/trpc/user.list (Bearer token) --------->|
  |                        |                           |
  |                  [1] TenantMiddleware               |
  |                  - extract tenantId from JWT        |
  |                  - lookup tenant config ----------->| (control DB)
  |                  - get/create DB connection         |
  |                  - set RLS if shared DB             |
  |                        |                           |
  |                  [2] tRPC Context Creation          |
  |                  - attach tenantContext, user       |
  |                        |                           |
  |                  [3] tRPC Middleware (isAuth)        |
  |                  - verify JWT signature             |
  |                  - check token not revoked -------->| (session check)
  |                        |                           |
  |                  [4] RBAC Check                     |
  |                  - user has 'user:list' perm? ----->| (role_permissions)
  |                        |                           |
  |                  [5] ABAC Check                     |
  |                  - policy conditions met? --------->| (policies)
  |                        |                           |
  |                  [6] Handler Execution              |
  |                  - UserService.list() ------------->| (tenant-scoped query)
  |                        |<--------------------------|
  |                        |                           |
  |                  [7] Audit Interceptor              |
  |                  - log 'user.list.viewed' --------->| (INSERT audit_logs)
  |                        |                           |
  |<-- { users: [...] } --------------------------------|
```

---

## Patterns to Follow

### Pattern 1: Repository Pattern with Tenant Scoping

**What:** All data access goes through repository classes that automatically scope queries to the current tenant.
**When:** Every database query in the application.

```typescript
// packages/db/src/repositories/base.repository.ts
export abstract class TenantScopedRepository<T> {
  constructor(protected tenantContext: TenantContext) {}

  protected getRepo(): Repository<T> {
    return this.tenantContext.getDataSource().getRepository(this.entity);
  }

  // All queries automatically include tenant_id
  protected baseQuery(): SelectQueryBuilder<T> {
    const qb = this.getRepo().createQueryBuilder('entity');
    // For shared DB: RLS handles this, but belt-and-suspenders
    // For dedicated DB: this is a no-op (all data belongs to one tenant)
    if (this.tenantContext.getIsolationLevel() === 'shared') {
      qb.where('entity.tenant_id = :tenantId', {
        tenantId: this.tenantContext.getTenantId(),
      });
    }
    return qb;
  }
}
```

### Pattern 2: Decorator-Driven Authorization

**What:** Use custom decorators to declare authorization requirements declaratively, keeping controllers clean.
**When:** Every protected endpoint.

```typescript
// Compose multiple auth requirements in a single decorator
export function Authorized(
  roles: string[],
  policy?: string,
  options?: { locationScoped?: boolean },
) {
  return applyDecorators(
    UseGuards(AuthGuard, RBACGuard, ABACGuard),
    Roles(...roles),
    policy ? Policy(policy, options) : () => {},
    Audited(`${policy || 'unknown'}.accessed`),
  );
}

// Usage:
@Authorized(['security_manager'], 'report:read', { locationScoped: true })
async getReport() { /* ... */ }
```

### Pattern 3: Zod Schemas as Single Source of Truth for Validation

**What:** Define Zod schemas in `packages/validators`, use them in tRPC input validation, form validation, and type generation.
**When:** Every data structure that crosses a boundary (API, form, database).

```typescript
// packages/validators/src/user.schema.ts
import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  roleIds: z.array(z.string().uuid()).min(1),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

// Used in tRPC:     .input(createUserSchema)
// Used in frontend: useForm<CreateUserInput>() with zodResolver
// Used in tests:    createUserSchema.parse(testData)
```

### Pattern 4: Correlation ID Propagation

**What:** Generate a correlation ID at request entry, propagate through all operations for traceability.
**When:** Every request.

```typescript
// Middleware generates/extracts correlation ID
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = req.headers['x-correlation-id'] || randomUUID();
    req['correlationId'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    // Also set in AsyncLocalStorage for access without passing through every function
    next();
  }
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Bypassing Tenant Context

**What:** Directly accessing the database without going through TenantContext/Repository layer.
**Why bad:** Data leaks between tenants. One wrong raw query without `tenant_id` filter exposes all commercial tenants' data.
**Instead:** All queries go through TenantScopedRepository. Raw queries require explicit `TenantContext.getDataSource()` which already has RLS set.

### Anti-Pattern 2: Authorization Logic in Services

**What:** Putting permission checks inside service methods instead of guards/decorators.
**Why bad:** Authorization becomes scattered, inconsistent, easy to forget. One missing check = security vulnerability.
**Instead:** Guards handle all authorization. Services assume the caller is authorized. If a service needs conditional logic based on permissions, inject `PolicyEngine` and evaluate explicitly.

### Anti-Pattern 3: Mutable Audit Logs

**What:** Using UPDATE or soft-delete on audit records.
**Why bad:** Destroys compliance value. FISMA/DOE auditors will reject any audit system where records can be modified.
**Instead:** REVOKE UPDATE/DELETE at the database level. Application user has INSERT + SELECT only. Corrections are new entries referencing the original.

### Anti-Pattern 4: God Module

**What:** A single "CoreModule" that exports everything.
**Why bad:** Circular dependencies, unclear boundaries, impossible to test in isolation, every change potentially affects everything.
**Instead:** Separate modules (Tenancy, Auth, RBAC, ABAC, Audit) with explicit imports/exports. Each module has a clear public API.

### Anti-Pattern 5: Shared Database Without RLS

**What:** Relying solely on application-level `WHERE tenant_id = ?` for tenant isolation.
**Why bad:** One missed WHERE clause = data breach. ORM relation loading, raw queries, third-party libraries -- any of these can bypass application filters.
**Instead:** PostgreSQL RLS as the primary isolation mechanism. Application-level filtering as defense-in-depth.

---

## Scalability Considerations

| Concern | At 10 tenants | At 100 tenants | At 1000 tenants |
|---------|--------------|----------------|-----------------|
| **DB connections** | Direct pooling fine | Connection pool per dedicated DB; PgBouncer for shared | PgBouncer required; consider tenant-group sharding |
| **Audit log volume** | Single partition fine | Monthly partitions, automated rotation | Partition + archive to cold storage, consider TimescaleDB |
| **Auth token validation** | JWT validation in-process | Same (JWT is stateless) | Same, but add Redis for revocation list |
| **Tenant resolution** | In-memory cache (control DB small) | Same with TTL refresh | Redis-backed cache, eventual consistency on config changes |
| **ABAC policy evaluation** | Evaluate per-request from DB | Cache policies per-tenant in memory | Compiled policy cache, invalidate on change |

---

## Suggested Build Order (Dependencies)

The build order is driven by architectural dependencies:

```
Phase 1: Foundation (no domain logic depends on these, but everything needs them)
  [1] Nx monorepo scaffolding + packages structure
  [2] packages/config (environment configuration)
  [3] packages/db (database connection, ORM setup, migration runner)
  [4] TenancyModule (tenant resolution, connection routing, RLS setup)
  [5] tRPC module (adapter setup, context creation, router registry)
      Dependencies: [1] -> [2] -> [3] -> [4] -> [5]

Phase 2: Identity + Observability (everything else depends on knowing WHO and logging WHAT)
  [6] UserModule (user entity, CRUD -- needed before Auth can authenticate)
  [7] AuthModule (JWT issuance, session management, login/logout)
  [8] AuditModule (append-only logging, interceptor, chain verification)
      Dependencies: [4] -> [6] -> [7], [4] -> [8]

Phase 3: Authorization + Hierarchy (build on identity, scope to locations)
  [9]  RBACModule (roles, permissions, role assignment, RBAC guard)
  [10] OrgHierarchyModule (Company > Region > Site > sub-level)
  [11] ABACModule (policy engine, location-scoped evaluation, ABAC guard)
       Dependencies: [7] -> [9], [4] -> [10], [9] + [10] -> [11]

Phase 4: Integration + Hardening
  [12] packages/api-client (typed tRPC client for frontends)
  [13] packages/validators (Zod schemas for all entities)
  [14] REST API layer (external API controllers)
  [15] Health checks, graceful shutdown, rate limiting
       Dependencies: [5] -> [12], all schemas -> [13]
```

**Why this order:**
- Tenancy MUST come first -- every other component operates within a tenant context
- Auth before RBAC because RBAC needs authenticated user identity
- Audit early (Phase 2) because DOE compliance requires logging from the start -- do not defer
- ABAC last in auth chain because it depends on RBAC (roles) + OrgHierarchy (locations)
- tRPC adapter in Phase 1 because it is the transport layer, not business logic

---

## Sources

All findings in this document are based on training data (knowledge cutoff). Web verification tools were unavailable during this research session. Confidence is MEDIUM overall.

**Patterns and recommendations are grounded in:**
- NestJS official documentation patterns (dynamic modules, guards, interceptors, middleware, DI scopes)
- Nx monorepo documentation (project boundaries, tags, enforce-module-boundaries)
- tRPC documentation (Express adapter, context creation, middleware)
- PostgreSQL documentation (Row Level Security, table partitioning)
- NIST 800-53 AC (Access Control) and AU (Audit) control families
- NIST 800-162 (Guide to Attribute Based Access Control)
- General multi-tenant SaaS architecture patterns (Microsoft Azure multi-tenancy guidance, AWS SaaS lens)

**Items that should be verified with current documentation:**
- tRPC v11+ API changes (adapter API may have changed)
- NestJS v11+ changes (if released) -- guard execution order, scope behavior
- `nestjs-trpc` community package maturity and maintenance status
- Nx v20+ module boundary enforcement syntax
- PostgreSQL 16/17 RLS performance improvements
