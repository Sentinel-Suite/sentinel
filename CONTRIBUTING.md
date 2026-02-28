# Contributing to Sentinel Suite

## Prerequisites

- **Node.js** 22 LTS or later
- **pnpm** 9.x (`corepack enable && corepack prepare pnpm@latest --activate`)
- **Docker** and **Docker Compose** v2

## Setup

```bash
# Clone the repository
git clone <repo-url>
cd sentinel-suite

# Install dependencies
pnpm install

# Start infrastructure (Postgres + Redis)
make up

# Start all apps in dev mode
pnpm dev
```

## Branch Naming

- `feat/<description>` -- New features
- `fix/<description>` -- Bug fixes
- `chore/<description>` -- Maintenance, tooling, dependencies
- `docs/<description>` -- Documentation changes
- `refactor/<description>` -- Code refactoring

## Commit Conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Commit messages are enforced via commitlint.

```
feat(scope): add user authentication
fix(api): handle null tenant context
chore(deps): update NestJS to 11.1
```

Common types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `perf`.

## Pull Request Checklist

- [ ] Branch follows naming convention
- [ ] Commits follow Conventional Commits
- [ ] `pnpm lint` passes
- [ ] `pnpm type-check` passes
- [ ] `pnpm test` passes
- [ ] Documentation updated if applicable

## Creating New Packages

Always use Nx generators to create new packages and apps:

```bash
# New library package
npx nx g @nx/js:lib packages/<name> --name=@sentinel/<name>

# New NestJS app
npx nx g @nx/nest:app apps/<name>

# New Next.js app
npx nx g @nx/next:app apps/<name>
```

This ensures proper configuration of project.json, tsconfig, and workspace references.

## Project Structure

```
sentinel-suite/
  apps/         # Deployable applications
    api/        # NestJS backend
    web/        # Next.js public web app
    admin/      # Next.js admin app
    worker/     # BullMQ background worker
    docs/       # Nextra documentation site
  packages/     # Shared libraries
    config/     # Environment configuration
    db/         # Database client and schema
    shared/     # Common types and utilities
    api-client/ # API client (tRPC + REST)
    ui/         # React component library
    validators/ # Shared Zod schemas
    auth/       # Authentication utilities
```
