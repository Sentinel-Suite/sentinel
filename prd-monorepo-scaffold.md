<rpg-method>
# PRD: Sentinel Suite — Monorepo Scaffold

<overview>
## Problem Statement
The Sentinel Suite requires a strictly defined, deterministic monorepo scaffold to serve as the foundation for web, API, and mobile applications. Without robust dependency management, module boundaries, and caching, the monorepo risks degrading into a tangled monolith, increasing build times and developer friction.

## Target Users
Developers working on Sentinel Suite (Web, API, Mobile engineers, DevOps).

## Success Metrics
- 100% deterministic cold-checkout build success (`docker compose build` succeeds).
- Zero cyclic dependencies due to strict module boundaries.
- Pre-commit hooks complete in < 5 seconds for single-file changes.
- Safe local execution (NX Cloud disabled per FISMA/CVE constraints).
</overview>

<functional-decomposition>
## Capability Tree

### Capability: Monorepo Foundation
Establishes the core workspace structure, task running, and package management.
#### Feature: Package Management & Linking
- **Description**: Monorepo dependency management via pnpm 10.
- **Inputs**: `pnpm-workspace.yaml`, `.npmrc`, single-version catalogs.
- **Outputs**: Hoisted node_modules for Metro compatibility, reliable lockfiles.
- **Behavior**: Links `apps/*` and `libs/*` securely (hoisted node-linker) without relying on `shamefully-hoist`.

#### Feature: Task Orchestration & Caching
- **Description**: Configures NX 22 for fast, deterministic task execution.
- **Inputs**: `nx.json` (NX Cloud disabled), `targetDefaults`.
- **Outputs**: Local task cache, affected graph execution.
- **Behavior**: Evaluates `nx affected` and runs pipelines with local caching.

### Capability: Code Structure & Quality Boundaries
Maintains architectural integrity across TypeScript projects.
#### Feature: TypeScript Project References
- **Description**: Fast compilation across isolated packages.
- **Inputs**: `tsconfig.base.json`, per-app tsconfigs.
- **Outputs**: Generated `.d.ts` declarations, `out-tsc` directories.
- **Behavior**: Synthesizes type safety using `nx sync`.

#### Feature: Module Boundary Enforcement
- **Description**: ESLint rules enforcing strict dependency chains.
- **Inputs**: Tag constraints (`platform:*`, `type:*`), ESLint config.
- **Outputs**: Immediate lint errors on violation.
- **Behavior**: Prevents unauthorized imports (e.g., UI components importing data-access layers improperly).

### Capability: DX Tooling
Improves the local developer loop.
#### Feature: Formatting & Linting Pipeline
- **Description**: Universal format and lint rules.
- **Inputs**: `.prettierrc`, `eslint.config.js`.
- **Outputs**: Formatted code, lint validation.
- **Behavior**: Analyzes TS/JS files, ensures consistency.

#### Feature: Git Hooks Verification
- **Description**: Husky + lint-staged committing safeguards.
- **Inputs**: Staged changes, Commit messages.
- **Outputs**: Accepted or blocked commits.
- **Behavior**: Rapidly lints affected files and validates commitmsg via commitlint (Conventional Commits).

### Capability: Local Infrastructure
Brings up required local services.
#### Feature: Database Local Service
- **Description**: Docker Compose Postgres 17 instance.
- **Inputs**: `docker-compose.yml`, seed SQL files, `.env.example`.
- **Outputs**: Running, healthy Postgres container.
- **Behavior**: Probes `pg_isready` healthcheck before dependent services start.

#### Feature: Application Build Environments
- **Description**: Optimized multi-stage Dockerfiles.
- **Inputs**: Source code, Node version.
- **Outputs**: Minimal runtime container images.
- **Behavior**: Uses BuildKit mount cache for pnpm store to speed up container builds.

### Capability: Application Shells
Empty, buildable apps mapped to boundaries.
#### Feature: Web Application Shell
- **Description**: Bootstrapped Next.js 15/16 App Router application.
- **Inputs**: `@nx/next` generator.
- **Outputs**: `apps/web/` directory.
- **Behavior**: Non-functional shell with build/serve/test/lint targets.

#### Feature: API Server Shell
- **Description**: Bootstrapped NestJS 11 backend.
- **Inputs**: `@nx/nest` generator.
- **Outputs**: `apps/api/` directory.
- **Behavior**: Non-functional shell with SWC compiler.

#### Feature: Mobile App Shell
- **Description**: Bootstrapped Expo SDK 53 application.
- **Inputs**: `@nx/expo` generator.
- **Outputs**: `apps/mobile/` directory.
- **Behavior**: Non-functional shell with New Architecture enabled.

### Capability: CI Pipeline
Remote verification processes.
#### Feature: Automated PR Checks
- **Description**: GitHub Actions validating pull requests.
- **Inputs**: Clean checkout, PR commits.
- **Outputs**: CI status points, audited dependencies.
- **Behavior**: Validates `nx affected`, evaluates `NX_BASE` and `NX_HEAD`, and executes `pnpm audit --audit-level=high`.
</functional-decomposition>

<structural-decomposition>
## Repository Structure

```
sentinel/
├── apps/
│   ├── api/                  # Maps to: API Server Shell
│   ├── mobile/               # Maps to: Mobile App Shell
│   └── web/                  # Maps to: Web Application Shell
├── libs/
│   ├── api/
│   ├── mobile/
│   │   └── data-access-api/  # Maps to: Sync Boundary Placeholder
│   ├── shared/
│   │   ├── types/            # Maps to: Code Structure (DTOs/Interfaces)
│   │   └── utils/            # Maps to: Code Structure (Utility functions)
│   ├── sync-protocol/        # Maps to: Sync Interface Contracts
│   └── web/
├── .github/
│   └── workflows/
│       └── ci.yml            # Maps to: CI Pipeline
├── infra/
│   └── postgres-init/        # Maps to: Database Local Service (Seed SQL)
├── docker-compose.yml        # Maps to: Database Local Service
├── .npmrc                    # Maps to: Package Linking
├── pnpm-workspace.yaml       # Maps to: Package Management
├── nx.json                   # Maps to: Task Orchestration (Task caching)
├── eslint.config.js          # Maps to: DX Tooling (Linting + Boundaries)
├── package.json
└── tsconfig.base.json        # Maps to: Code Structure
```

## Module Definitions

### Module: Workspace Tooling Root
- **Maps to capability**: Monorepo Foundation & DX Tooling
- **Responsibility**: Establishes correct pnpm layout, NX target caching, git hooks, and global standards.
- **Exports**: Workspace commands (`nx run-many`, `pnpm install`, etc).

### Module: Infrastructure
- **Maps to capability**: Local Infrastructure
- **Responsibility**: Provides docker-compose Postgres instance and `Dockerfile` builder configs.

### Module: libs/shared/types
- **Maps to capability**: Code Structure (Dependencies)
- **Responsibility**: Centralizes cross-platform DTOs and definitions.
- **File structure**: 
  ```
  libs/shared/types/
  ├── src/
  │   └── index.ts
  ```
- **Exports**: Types/Interfaces via barrel `index.ts`.

### Module: libs/shared/utils
- **Maps to capability**: Code Structure (Dependencies)
- **Responsibility**: Pure utility functions with no framework-specific binding.
- **File structure**: 
  ```
  libs/shared/utils/
  ├── src/
  │   └── index.ts
  ```
- **Exports**: Pure JS/TS functions via barrel `index.ts`.

### Module: libs/sync-protocol
- **Maps to capability**: Offline Sync Placeholder
- **Responsibility**: Defines interface contracts for syncing (CRDT / events, deferred implementation).
- **Exports**: Sync interfaces.

### Module: apps/api
- **Maps to capability**: Application Shells
- **Responsibility**: Host NestJS endpoint.
- **Exports**: HTTP endpoints (internally managed).

### Module: apps/web
- **Maps to capability**: Application Shells
- **Responsibility**: Host Next.js interface.
- **Exports**: Configured react components & routes.

### Module: apps/mobile
- **Maps to capability**: Application Shells
- **Responsibility**: Host Expo application.
- **Exports**: React Native application registry.
</structural-decomposition>

<dependency-graph>
## Dependency Chain

### Foundation Layer (Phase 1)
No dependencies - these are built first.
- **Workspace Tooling Root**: `pnpm-workspace.yaml`, `nx.json`, DX tooling, configs, `.nvmrc`.

### Base Libraries (Phase 2 & 3)
- **libs/shared/types**: Depends on [Workspace Tooling Root]
- **libs/shared/utils**: Depends on [Workspace Tooling Root]
- **libs/sync-protocol**: Depends on [Workspace Tooling Root]

### Domain Libraries & Data (Phase 6 & 8)
- **libs/mobile/data-access-api**: Depends on [libs/sync-protocol, libs/shared/types, libs/shared/utils]
- **Infrastructure**: Depends on [Workspace Tooling Root]

### Applications (Phase 4)
- **apps/api**: Depends on [libs/shared/types, libs/shared/utils]
- **apps/web**: Depends on [libs/shared/types, libs/shared/utils]
- **apps/mobile**: Depends on [libs/mobile/data-access-api, libs/shared/types, libs/shared/utils]

### Verification & CI (Phase 7 & 9)
- **CI Pipeline**: Depends on [All Application & Foundation Modules]
</dependency-graph>

<implementation-roadmap>
## Development Phases

### Phase 1: Monorepo Foundation
**Goal**: Establish deterministic package routing & execution engine.
**Entry Criteria**: Clean initialized git repository.
**Tasks**:
- [ ] Initialize pnpm 10 workspace (`pnpm-workspace.yaml` with apps/libs globs, single-version catalogs).
- [ ] Create `.npmrc` enforcing `node-linker=hoisted`. Document Metro rationale.
- [ ] Setup NX 22 (`nx.json` with `nxCloud: false`). Document FISMA rationale (CVE-2025-36852).
- [ ] Define NX task pipelines (`targetDefaults`: build depends on ^build, test depends on ^build).
- [ ] Implement local task caching (`cache: true`) and define `namedInputs`.
- [ ] Setup affected execution (`nx affected` mapping to `defaultBase: main`).
**Exit Criteria**: Base tooling installed without error. `nx.json` verified.
**Delivers**: Foundation required to host shared libraries and applications.

### Phase 2: TypeScript & Project Structure
**Goal**: Core compile definitions and base library scaffolding.
**Entry Criteria**: Phase 1 complete.
**Tasks**:
- [ ] Define `tsconfig.base.json` with `composite: true`, `declaration: true`.
- [ ] Configure `nx sync` for types.
- [ ] Create empty layout: `apps/web|api|mobile`, `libs/shared|web|api|mobile`.
- [ ] Scaffold `libs/shared/types` with barrel `index.ts`.
- [ ] Scaffold `libs/shared/utils` with barrel `index.ts`.
**Exit Criteria**: Directories exist. `tsconfig` is valid.

### Phase 3: Module Boundaries
**Goal**: Lock down import constraints.
**Entry Criteria**: Phase 2 complete.
**Tasks**:
- [ ] Setup `@nx/enforce-module-boundaries` in global ESLint.
- [ ] Set tags (`platform:*`, `type:*`) in `project.json` definitions.
- [ ] Implement strict `depConstraints` mapping tags.
- [ ] Document rationale that boundaries cannot be retrofitted easily.
**Exit Criteria**: Intentional boundary violation is correctly caught by ESLint rule.

### Phase 4: Application Shells
**Goal**: Deployable build-ready shells for all three client boundaries.
**Entry Criteria**: Phase 3 complete.
**Tasks**:
- [ ] Scaffold `apps/web` (Next.js 15/16 App Router).
- [ ] Scaffold `apps/api` (NestJS 11 + SWC).
- [ ] Scaffold `apps/mobile` (Expo SDK 53, New Architecture). 
- [ ] Document known friction points for Expo + pnpm + NX.
**Exit Criteria**: All shells generate and tests pass.

### Phase 5: DX Tooling
**Goal**: Formatting, linting, and committing guardrails.
**Entry Criteria**: Phase 4 complete.
**Tasks**:
- [ ] Configure shared ESLint v9 flat config.
- [ ] Establish Prettier 3 configuration.
- [ ] Setup Husky 9 (`pre-commit`, `commit-msg`).
- [ ] Add lint-staged 16 configuration for changed TS files.
- [ ] Configure commitlint 20 (`@commitlint/config-conventional`).
- [ ] Set `.gitattributes` (`* text=auto eol=lf`).
**Exit Criteria**: Single-file-change pre-commit hook completes in <5 seconds.

### Phase 6: Infrastructure
**Goal**: Local data persistence environment.
**Entry Criteria**: Phase 1 complete (Parallelizable with phase 4/5).
**Tasks**:
- [ ] Setup Docker Compose file with `postgres:17-alpine`, `healthcheck: pg_isready`, and `depends_on`.
- [ ] Setup `.env.example` documenting requirements.
- [ ] Lock Node.js version via `.nvmrc` and `engines.node`.
- [ ] Create base multi-stage Dockerfiles utilizing BuildKit cache mounts.
- [ ] Provide initial seed schema directory `/infra/postgres-init`.
- [ ] Configure monorepo-optimized `.dockerignore` blocking `.nx`, `node_modules`.
**Exit Criteria**: Cold-checkout `docker compose build` succeeds.

### Phase 7: CI Pipeline
**Goal**: Enable push-button remote verification.
**Entry Criteria**: All prior phases complete.
**Tasks**:
- [ ] Author `.github/workflows/ci.yml`.
- [ ] Implement `nx/set-shas` step.
- [ ] Setup CI install step `pnpm install --frozen-lockfile`.
- [ ] Setup PR workflows executing `nx affected --target=lint,test,build`.
- [ ] Implement CI security gate `pnpm audit --audit-level=high`.
- [ ] Configure `actions/cache` for `.nx/cache` and pnpm store.
**Exit Criteria**: Entire CI spec successfully simulates validation logic.

### Phase 8: Offline Sync Placeholder
**Goal**: Define the boundaries for the sync implementation without building it.
**Entry Criteria**: Phase 2 complete.
**Tasks**:
- [ ] Scaffold `libs/sync-protocol` library with documented interface.
- [ ] Scaffold `libs/mobile/data-access-api` as the sync boundaries.
- [ ] Document the tradeoff (CRDT vs Event-Sourcing vs Queue).
**Exit Criteria**: Types and boundaries act as placeholders.

### Phase 9: Scaffold Verification
**Goal**: Execute and validate all verification criteria for passing the PRD.
**Entry Criteria**: All prior phases complete.
**Tasks**:
- [ ] Verify: cold-checkout `docker compose build` succeeds.
- [ ] Verify: `nx run-many --target=test --all` produces results.
- [ ] Verify: intentional boundary violation is caught by ESLint.
- [ ] Verify: single-file-change pre-commit hook completes in <5 seconds.
- [ ] Verify: `nx.json` contains `nxCloud: false` and no cloud token.
- [ ] Verify: Metro resolves workspace packages from clean `pnpm install`.
- [ ] Verify: `pnpm audit --audit-level=high` returns clean.
- [ ] Verify: `pnpm install --frozen-lockfile` passes in simulated CI.
**Exit Criteria**: All tests checked and passed.
</implementation-roadmap>

<test-strategy>
## Test Pyramid
- E2E: 5% (Monorepo boundary checks, shell loading)
- Integration: 15% (Local environment spins up Postgres successfully)
- Unit Tests: 80% (Tooling configuration parsing successfully)

## Coverage Requirements
N/A for the initial scaffold, as no feature code exists yet.

## Critical Test Scenarios
### Tooling & Boundary Verification
**Happy path**:
- `nx run-many --target=test --all` completes with results in valid output.
- `docker compose build` succeeds reliably.
- `pnpm audit --audit-level=high` cleanly evaluates dependencies.

**Error cases**:
- Adding an import between isolated domains generates ESLint exception.
- NX execution warns/fails if Cloud configuration is accidentally enabled.

**Integration points**:
- Native module resolution (Metro) cleanly interprets workspace symlinks due to correct `.npmrc` hoisting.
</test-strategy>

<architecture>
## System Components
- **Workspace Node Linker**: Hoisted via `.npmrc` to bypass Metro limitations with PNPM symlinks.
- **NX Runner**: Local task runner configuration. Cloud caching disabled down to meet FISMA constraints.

## Technology Stack
- **Tools**: pnpm 10, NX 22
- **Stack**: Next.js 15, NestJS 11, Expo SDK 53
- **DB**: PostgreSQL 17

**Decision: pnpm over yarn/npm**
- **Rationale**: Faster execution, catalogs support for exact single-version enforcement.
- **Trade-offs**: Metro integration is fragile; solved via `node-linker=hoisted` rather than `shamefully-hoist`.

**Decision: NX Cloud Disabled**
- **Rationale**: Security compliance constraints (CVE-2025-36852).
</architecture>

<risks>
## Technical Risks
**Risk**: Expo Workspace Linking breakage.
- **Impact**: High (Mobile development blocked).
- **Likelihood**: Medium.
- **Mitigation**: Strictly define `.npmrc` as hoisted, pre-validate via tests.

## Scope Risks
**Risk**: Lack of explicit type-safety checks inside `tsconfig`.
- **Impact**: Missed issues catching during build.
- **Mitigation**: Define strict module bounds across `libs/shared/types`.
</risks>
</rpg-method>
