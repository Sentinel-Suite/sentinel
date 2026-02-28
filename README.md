# Sentinel Suite

Multi-tenant platform with tiered data isolation and hybrid RBAC+ABAC authorization, built for DOE-grade access control and audit compliance.

## Prerequisites

- [Node.js](https://nodejs.org/) 22 LTS
- [pnpm](https://pnpm.io/) 9.x
- [Docker](https://www.docker.com/) and Docker Compose v2

## Quick Start

```bash
# Clone and install
git clone <repo-url>
cd sentinel-suite
pnpm install

# Start infrastructure
make up          # Core: Postgres + Redis
# make up-full   # Full: + pgAdmin, Grafana, Jaeger, etc.

# Start development
pnpm dev         # Starts API, Web, and Admin apps
```

## Architecture

```
sentinel-suite/
  apps/              # Deployable applications
  packages/          # Shared libraries
  docker/            # Docker Compose infrastructure
  .planning/         # Project planning artifacts
```

### Apps

| App | Description | Port |
|-----|-------------|------|
| `apps/api` | NestJS backend API | 3500 |
| `apps/web` | Next.js public web application | 3501 |
| `apps/admin` | Next.js admin dashboard | 3502 |
| `apps/worker` | BullMQ background worker (stub) | 3503 |
| `apps/docs` | Nextra documentation site (stub) | 3504 |

### Packages

| Package | Description |
|---------|-------------|
| `@sentinel/config` | Environment configuration with Zod validation |
| `@sentinel/db` | Drizzle ORM database client and schema |
| `@sentinel/shared` | Common types, Result type, error classes |
| `@sentinel/api-client` | tRPC client and REST SDK |
| `@sentinel/ui` | Shared React component library (shadcn/ui) |
| `@sentinel/validators` | Shared Zod validation schemas |
| `@sentinel/auth` | Authentication utilities |

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start API, Web, and Admin in development mode |
| `pnpm build` | Build all apps and packages |
| `pnpm lint` | Run Biome linting across the monorepo |
| `pnpm format` | Format code with Biome |
| `pnpm type-check` | TypeScript type checking |
| `pnpm test` | Run tests across all packages |

## Infrastructure Ports

| Service | Port | Env Var |
|---------|------|---------|
| API | 3500 | `API_PORT` |
| Web | 3501 | `WEB_PORT` |
| Admin | 3502 | `ADMIN_PORT` |
| Worker | 3503 | `WORKER_PORT` |
| Docs | 3504 | `DOCS_PORT` |
| PostgreSQL | 3510 | `POSTGRES_PORT` |
| Redis | 3511 | `REDIS_PORT` |
| Mailpit SMTP | 3525 | `MAILPIT_SMTP_PORT` |
| Mailpit UI | 3526 | `MAILPIT_UI_PORT` |
| Grafana | 3530 | `GRAFANA_PORT` |
| Loki | 3531 | `LOKI_PORT` |
| Prometheus | 3532 | `PROMETHEUS_PORT` |
| Jaeger UI | 3533 | `JAEGER_UI_PORT` |
| GlitchTip | 3540 | `GLITCHTIP_PORT` |
| Flagsmith | 3541 | `FLAGSMITH_PORT` |
| pgAdmin | 3550 | `PGADMIN_PORT` |
| Traefik Dashboard | 3580 | `TRAEFIK_DASHBOARD_PORT` |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow, branch naming, and code standards.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting.
