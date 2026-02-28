---
phase: 01-monorepo-foundation
plan: 01
subsystem: infra
tags: [nx, pnpm, monorepo, biome, typescript, nestjs, nextjs, husky, github-actions]

# Dependency graph
requires: []
provides:
  - Nx monorepo workspace with 5 apps and 7 shared packages
  - TypeScript strict configs (base, node, react) with @sentinel/* path mappings
  - Biome v2 linting and formatting across entire monorepo
  - Git hooks (Husky pre-commit + commitlint) for code quality enforcement
  - GitHub Actions CI pipeline (lint, type-check, test)
  - Repository housekeeping (README, CONTRIBUTING, SECURITY, .env.example)
affects: [01-02, 01-03, all-future-phases]

# Tech tracking
tech-stack:
  added: [nx@22, pnpm@9, typescript@5, biome@2, nestjs@11, next@15, husky@9, lint-staged@16, commitlint@20]
  patterns: [pnpm-workspaces, nx-plugin-inference, biome-v2-root-config, workspace-star-protocol]

key-files:
  created:
    - nx.json
    - pnpm-workspace.yaml
    - package.json
    - tsconfig.base.json
    - tsconfig.node.json
    - tsconfig.react.json
    - biome.json
    - apps/api/package.json
    - apps/api/src/main.ts
    - apps/api/src/app.module.ts
    - apps/web/package.json
    - apps/web/src/app/layout.tsx
    - apps/web/src/app/page.tsx
    - apps/admin/package.json
    - apps/admin/src/app/layout.tsx
    - apps/admin/src/app/page.tsx
    - apps/worker/package.json
    - apps/docs/package.json
    - packages/config/src/index.ts
    - packages/db/src/index.ts
    - packages/shared/src/index.ts
    - packages/shared/src/result.ts
    - packages/shared/src/errors.ts
    - packages/api-client/src/index.ts
    - packages/ui/src/index.ts
    - packages/validators/src/index.ts
    - packages/auth/src/index.ts
    - .github/workflows/ci.yml
    - .env.example
    - README.md
    - CONTRIBUTING.md
    - SECURITY.md
  modified: []

key-decisions:
  - "Removed @nx/nest/plugin from nx.json -- Nx 22 @nx/nest package has no plugin export; API targets defined explicitly in project.json"
  - "Removed nested biome.json files -- Biome v2 auto-discovers root config, nested extends caused conflicts"
  - "Biome files.includes scoped to apps/** and packages/** to avoid scanning .nx cache and output.json"

patterns-established:
  - "Workspace protocol: all @sentinel/* internal deps use workspace:* in package.json"
  - "TypeScript config hierarchy: tsconfig.base.json -> tsconfig.node.json (API, packages) / tsconfig.react.json (web, admin, ui)"
  - "Biome v2 root-only config: single biome.json at root covers entire monorepo, no nested configs needed"
  - "Nx plugin inference for Next.js apps; explicit targets for NestJS API"

requirements-completed: [INFR-01, INFR-02, INFR-07]

# Metrics
duration: 9min
completed: 2026-02-28
---

# Phase 1 Plan 1: Monorepo Scaffolding Summary

**Nx 22 monorepo with 5 apps (NestJS API, 2x Next.js, worker stub, docs stub), 7 shared packages (@sentinel/*), Biome v2 linting, Husky git hooks, and GitHub Actions CI pipeline**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-28T23:24:21Z
- **Completed:** 2026-02-28T23:33:34Z
- **Tasks:** 2
- **Files modified:** 74

## Accomplishments
- Complete Nx workspace with pnpm workspaces hosting 12 projects (5 apps + 7 packages)
- Nx dependency graph validates all cross-package dependencies (api->config/db/shared, web/admin->ui/api-client, db->config)
- Biome v2 linting passes across entire monorepo with `pnpm lint`
- packages/shared delivers Result<T,E> type with ok/err factories and typed error classes (AppError, NotFoundError, ValidationError, UnauthorizedError, ForbiddenError)
- Full repository housekeeping: README, CONTRIBUTING, SECURITY, .env.example with all port assignments, CI pipeline, dependabot, PR template, VSCode settings

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Nx workspace with all apps and packages** - `d7205f0` (feat)
2. **Task 2: Configure Biome linting, Git hooks, CI pipeline, and repo housekeeping** - `bf7034e` (chore)

## Files Created/Modified
- `package.json` - Root workspace with scripts (dev, build, lint, format, type-check, test) and lint-staged config
- `pnpm-workspace.yaml` - Workspace packages definition (apps/*, packages/*)
- `nx.json` - Nx workspace config with @nx/next plugin, named inputs, target defaults with caching
- `tsconfig.base.json` - Root TS config: strict, noUncheckedIndexedAccess, ES2022, @sentinel/* paths
- `tsconfig.node.json` - Node.js TS config extending base with node types
- `tsconfig.react.json` - React TS config extending base with JSX, DOM libs, bundler resolution
- `biome.json` - Biome v2 config: 2-space indent, 100 line width, recommended rules, organize imports
- `apps/api/` - NestJS API with package.json, project.json, tsconfig, nest-cli.json, main.ts, app.module.ts
- `apps/web/` - Next.js web with package.json, project.json, tsconfig, next.config.ts, postcss, layout, page, globals.css
- `apps/admin/` - Next.js admin (same structure as web, port 3502)
- `apps/worker/` - BullMQ stub with package.json and placeholder entry point
- `apps/docs/` - Nextra stub with package.json, layout, page
- `packages/config/` - @sentinel/config barrel export stub
- `packages/db/` - @sentinel/db barrel export stub (depends on @sentinel/config)
- `packages/shared/` - @sentinel/shared with Result type, error classes, barrel export
- `packages/api-client/` - @sentinel/api-client barrel export stub
- `packages/ui/` - @sentinel/ui barrel export stub (React tsconfig)
- `packages/validators/` - @sentinel/validators barrel export stub
- `packages/auth/` - @sentinel/auth barrel export stub
- `.github/workflows/ci.yml` - CI pipeline: checkout, pnpm, node 22, install, lint, type-check, test
- `.github/dependabot.yml` - Weekly npm dependency updates
- `.github/PULL_REQUEST_TEMPLATE.md` - PR template with type checkboxes and checklist
- `.husky/pre-commit` - Runs lint-staged
- `.husky/commit-msg` - Runs commitlint
- `commitlint.config.cjs` - Conventional Commits config
- `.gitignore` - Node, Next.js, Nx, Docker, IDE, env, OS, coverage exclusions
- `.npmrc` - strict-peer-dependencies, audit, save-exact
- `.nvmrc` - Node 22
- `.editorconfig` - UTF-8, LF, 2-space indent, trim trailing whitespace
- `.env.example` - All environment variables with defaults and comments (ports 3500-3580)
- `.vscode/settings.json` - Biome as default formatter, format on save
- `.vscode/extensions.json` - Recommended: Biome, Tailwind CSS, Nx Console
- `README.md` - Project overview, quick start, architecture, packages, ports
- `CONTRIBUTING.md` - Prerequisites, setup, branch naming, commit conventions, PR checklist
- `SECURITY.md` - Vulnerability reporting process

## Decisions Made
- **Removed @nx/nest/plugin:** Nx 22's @nx/nest package does not export a plugin for task inference. API build/serve/type-check targets are defined explicitly in apps/api/project.json instead.
- **No nested biome.json files:** Biome v2 automatically discovers the root configuration. Nested biome.json with `"extends": ["//"]` caused "nested root configuration" errors. Single root biome.json is sufficient.
- **Scoped Biome includes:** Set `files.includes` to `["apps/**", "packages/**", "biome.json"]` to avoid scanning Nx cache (.nx/), output.json, and pnpm-lock.yaml.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Biome v2 configuration format**
- **Found during:** Task 2 (Biome configuration)
- **Issue:** Research referenced Biome v1 config keys (`organizeImports`, `files.ignore`) which were renamed/removed in Biome v2. Also, nested biome.json with `"extends": ["//"]` caused root config conflicts.
- **Fix:** Updated to Biome v2 schema: `assist.actions.source.organizeImports` instead of `organizeImports`, `files.includes` instead of `files.ignore`, removed all nested biome.json files.
- **Files modified:** biome.json
- **Verification:** `pnpm lint` passes on all 51 files
- **Committed in:** bf7034e (Task 2 commit)

**2. [Rule 1 - Bug] Fixed bracket notation lint warning in main.ts**
- **Found during:** Task 2 (Biome lint verification)
- **Issue:** `process.env["API_PORT"]` flagged by Biome `complexity/useLiteralKeys` rule
- **Fix:** Changed to `process.env.API_PORT`
- **Files modified:** apps/api/src/main.ts
- **Verification:** `pnpm lint` passes
- **Committed in:** bf7034e (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both auto-fixes were necessary due to Biome v2 API differences from research. No scope creep.

## Issues Encountered
- @nx/nest/plugin import path does not exist in Nx 22.4.3. The @nx/nest package provides generators but not an inferred plugin. Resolved by removing the plugin from nx.json and defining explicit targets in the API project.json.
- Biome v2 has significantly different configuration schema from v1 (which the research document referenced). All config keys were updated to match the v2 schema.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Workspace is ready for Plan 02 (environment config, Drizzle DB, Docker Compose)
- All package entry points exist for dependency wiring
- pnpm install succeeds, nx graph validates, pnpm lint passes
- TypeScript path mappings ready for @sentinel/* imports

## Self-Check: PASSED

- All 30 key files verified present
- Both task commits (d7205f0, bf7034e) verified in git log
- pnpm lint passes (51 files checked)
- nx graph shows 12 nodes with correct dependency edges

---
*Phase: 01-monorepo-foundation*
*Completed: 2026-02-28*
