<rpg-method>
# PRD: Sentinel Suite — Monorepo Scaffold

<overview>
## Problem Statement
The Sentinel Suite requires a strictly defined, deterministic monorepo scaffold to serve as the foundation for web, API, and mobile applications. The primary goal is to produce **Immutable Docker Images** ("Golden Images") for delivery to high-security (DOE/GOCO) environments. This requires robust dependency management, module boundaries, and a verification pipeline that balances developer velocity with rigorous auditability.

## Target Users
Developers working on Sentinel Suite (Web, API, Mobile engineers, DevOps) and Security Auditors (DOE/GOCO).

## Success Metrics
- 100% deterministic cold-checkout build success (`docker compose build` succeeds).
- Zero cyclic dependencies due to strict module boundaries.
- **SAT-lite PR Validation**: Pre-commit hooks and incremental CI (mocks/logic only) complete in < 5 minutes (NFR36).
- **SAT-full Verification**: Full workspace verification (lint, test with Testcontainers, build, typecheck) completes in < 20 minutes.
- **Artifact-Based Deployment**: 100% build success for SaaS, Self-hosted, and Air-gapped (Docker Image Load) deployment modes (NFR35).
- **Strict Sovereignty**: Zero external data telemetry (NX Cloud disabled; local-only persistent caching for CI).
</overview>

<functional-decomposition>
## Capability Tree

### Capability: Monorepo Foundation
Establishes the core workspace structure, task running, and package management.
#### Feature: Package Management & Linking
- **Description**: Monorepo dependency management via pnpm 10.
- **Inputs**: `pnpm-workspace.yaml`, `.npmrc`, single-version catalogs.
- **Outputs**: Isolated node_modules for auditability and precise SBOM.
- **Behavior**: Enforces a **Single Version Policy** via pnpm 10 Catalogs. Links `apps/*` and `libs/*` using default isolated layout. Rejects `shamefully-hoist` and `node-linker=hoisted`.

#### Feature: Task Orchestration & Caching
- **Description**: Configures NX 22 for fast, deterministic task execution.
- **Inputs**: `nx.json` (NX Cloud disabled), `targetDefaults`.
- **Outputs**: Local task cache, affected graph execution.
- **Behavior**: Evaluates `nx affected` and runs pipelines with **Local Persistent Caching** on self-hosted CI runners to meet DOE/GOCO security requirements.

### Capability: Code Structure & Quality Boundaries
Maintains architectural integrity across TypeScript projects.
#### Feature: TypeScript Project References
- **Description**: Fast compilation across isolated packages.
- **Inputs**: `tsconfig.base.json`, per-app tsconfigs.
- **Outputs**: Generated `.d.ts` declarations, `out-tsc` directories.
- **Behavior**: Synthesizes type safety using `nx sync`.

#### Feature: Module Boundary Enforcement
- **Description**: ESLint rules enforcing strict dependency chains and architecture layers.
- **Inputs**: Tag constraints (`scope:*`, `type:*`, `platform:*`), ESLint config.
- **Outputs**: Immediate lint errors on violation.
- **Behavior**: Prevents unauthorized imports. Mandates that every package explicitly declare its dependencies in its local `package.json` to ensure SBOM accuracy. Cross-module communication must be via events/shared layers.

### Capability: Workspace Tooling
Establishes local automation for architecture compliance.
#### Feature: Custom Workspace Generators
- **Description**: NX generators for standardized component scaffolding.
- **Inputs**: Generator schema (name, tier, type).
- **Outputs**: Scaffolding code in `apps/`, `libs/`, or `modules/`.
- **Behavior**: 
    - `module`: Scaffolds a **Nested Domain Module** with three concerns: `api/` (Backend), `ui/` (Frontend), and `shared/` (DTOs).
    - `lib`: Scaffolds a shared library with correct `@sentinel/` alias and tags (`type:*`, `scope:libs`).
    - `app`: Scaffolds a deployable shell with Docker/CI boilerplate.
#### Feature: Formatting & Linting Pipeline
- **Description**: Universal format and lint rules, including strict naming conventions (AR34).
- **Inputs**: `.prettierrc`, `eslint.config.js`, shared config packages.
- **Outputs**: Formatted code, lint validation.
- **Behavior**: Analyzes TS/JS files, ensures consistency. Enforces `kebab-case` for files/folders, `camelCase` for variables/functions, and `PascalCase` for types/classes.

#### Feature: Git Hooks Verification
- **Description**: Husky + lint-staged committing safeguards.
- **Inputs**: Staged changes, Commit messages.
- **Outputs**: Accepted or blocked commits.
- **Behavior**: Rapidly lints affected files and validates commitmsg via commitlint (Conventional Commits).

### Capability: Local Infrastructure
Brings up required local services and provides containerization baseline.
#### Feature: Database & Cache Local Services
- **Description**: Docker Compose Postgres 17 and Redis 7 instances.
- **Inputs**: `docker-compose.yml`, seed SQL files, `.env.example`.
- **Outputs**: Running, healthy Postgres and Redis containers.
- **Behavior**: Probes `pg_isready` (Postgres) and `redis-cli ping` (Redis) healthchecks before dependent services start.

#### Feature: Application Build Environments
- **Description**: Optimized multi-stage Dockerfiles for Golden Image creation.
- **Inputs**: Source code, Node v22-alpine.
- **Outputs**: Minimal, secure runtime container images.
- **Behavior**: Uses 4-stage build (base, deps, builder, runner) with non-root user security and layer caching optimization. Supports build-time ARGs for NFR35 deployment modes. **Primary delivery for air-gapped environments is via "Fat" Docker Image Tarballs (docker save) containing all dependencies and compiled code.**

### Capability: Application Shells
Empty, buildable apps mapped to boundaries.
#### Feature: Web Application Shell
- **Description**: Bootstrapped Next.js 15/16 App Router application (React 19).
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
- **Behavior**: Non-functional shell with New Architecture enabled. **Note**: Uses custom `metro.config.js` to resolve pnpm symlinks in isolated layout.

### Capability: CI Pipeline
Remote verification processes.
#### Feature: Automated PR Checks (SAT-lite)
- **Description**: Incremental GitHub Actions validating pull requests in <5 minutes (NFR36).
- **Inputs**: Clean checkout, PR commits.
- **Outputs**: CI status points, audited dependencies, test coverage.
- **Behavior**: Validates `nx affected` for `lint`, `test`, `build`, and `typecheck`. **Tests use mocks/in-memory databases for speed**. Executes `pnpm audit --audit-level=high`.

#### Feature: Full Workspace Verification (SAT-full)
- **Description**: Comprehensive validation of all targets in <20 minutes.
- **Inputs**: Main/Release branch commits.
- **Outputs**: Full test suite report, coverage summary.
- **Behavior**: Runs `nx run-many` for all targets across all projects. **Tests use Testcontainers (Postgres/Redis) for real-world verification**.

#### Feature: Deployment Mode Verification
- **Description**: Verifies build parity across deployment constraints (NFR35).
- **Inputs**: DEPLOY_MODE environment variable (saas, self-hosted, air-gapped).
- **Outputs**: Successful builds for all three target modes.
- **Behavior**: Executes build matrix loop for all deployment configurations. Air-gapped builds result in exported image artifacts.

#### Feature: CI Performance Guardrails
- **Description**: Automated monitoring of CI duration against SAT targets.
- **Inputs**: Job start/end timestamps, SAT thresholds (5m/20m).
- **Outputs**: GitHub Step Summary with performance status; CI warning or failure on threshold breach.
- **Behavior**: Executes `tools/ci/performance-guardrail.sh` to validate efficiency (NFR36).

#### Feature: Affected Surface Summary
- **Description**: Visibility into PR scope and complexity growth.
- **Inputs**: `nx show projects --affected`.
- **Outputs**: PR summary list of all projects and types impacted by the change.
- **Behavior**: Automates the "Affected" report to track monorepo sprawl.

### Capability: Security & Compliance
Automated safeguards for codebase integrity.
#### Feature: Dependency Vulnerability Scanning
- **Description**: Automated auditing of third-party dependencies.
- **Inputs**: `pnpm-lock.yaml`.
- **Outputs**: Audit report, failed CI on high/critical vulnerabilities.
- **Behavior**: Runs `pnpm audit --audit-level=high` in every CI run.

#### Feature: Secret Leak Prevention
- **Description**: Detects accidentally committed secrets, keys, and tokens.
- **Inputs**: Git commit history.
- **Outputs**: Failed CI if secrets are detected.
- **Behavior**: Executes `gitleaks` scan with project-specific `.gitleaks.toml` rules.

#### Feature: Secure Coding Rules
- **Description**: Linting rules to prevent common security anti-patterns.
- **Inputs**: Source code.
- **Outputs**: Inline IDE warnings and CI failures.
- **Behavior**: Enforces `eslint-plugin-security` across all workspace projects.

### Capability: Configuration & Secrets Management
Standardized environment and secret lifecycle.
#### Feature: Type-safe Configuration
- **Description**: Runtime validation of environment variables.
- **Inputs**: `process.env`.
- **Outputs**: Validated config object, immediate process exit on failure.
- **Behavior**: Uses Zod to enforce required variables and data types.

#### Feature: Secrets Management Platform
- **Description**: Centralized secrets management via platform (Infisical/Doppler/Vault).
- **Inputs**: Platform API/CLI.
- **Outputs**: Environment-specific secrets injected into process.
- **Behavior**: Synchronizes local development and CI/CD environments with zero `.env` sprawl.

#### Feature: Feature Flagging
- **Description**: Runtime feature toggling via Flagsmith.
- **Inputs**: Flagsmith SDK.
- **Outputs**: Active/inactive feature states.
- **Behavior**: Enables progressive rollouts and environment-specific toggles.

### Capability: Observability & Monitoring
Unified telemetry and error tracking.
#### Feature: Distributed Tracing & Metrics
- **Description**: Performance and health monitoring via OpenTelemetry.
- **Inputs**: OTel SDK/Exporter.
- **Outputs**: Distributed traces and custom metrics.
- **Behavior**: Collects data across frontend and backend boundaries.

#### Feature: Error Tracking
- **Description**: Centralized crash reporting and error analysis via Sentry.
- **Inputs**: Sentry SDK.
- **Outputs**: Detailed error reports and stack traces.
- **Behavior**: Integrates with build pipelines for source map support.

### Capability: Knowledge Management
Preservation of architectural rationale and system design.
#### Feature: Architectural Decision Records (ADR)
- **Description**: Formal tracking of significant design decisions.
- **Inputs**: `docs/adr/ADR_TEMPLATE.md`.
- **Outputs**: Searchable timeline of decisions in `docs/adr/index.md`.
- **Behavior**: Mandates Context, Decision, and Consequences sections for every architectural change.
</functional-decomposition>

<structural-decomposition>
## Repository Structure

```
sentinel/
├── apps/                     # Deployable targets; Imports from modules/ + libs/
│   ├── api/                  # Maps to: API Server Shell
│   ├── mobile/               # Maps to: Mobile App Shell
│   └── web/                  # Maps to: Web Application Shell
├── modules/                  # Domain modules (vertical slices); Imports from libs/
│   └── <domain>/             # Nested Domain Module (e.g., dispatch)
│       ├── api/              # Backend sub-package (@sentinel/<domain>/api)
│       ├── ui/               # Frontend sub-package (@sentinel/<domain>/ui)
│       ├── shared/           # Types/DTOs sub-package (@sentinel/<domain>/shared)
│       └── tests/            # Domain-specific integration tests
├── libs/                     # Shared infrastructure/primitives; Imports from packages/
│   ├── api/
│   ├── mobile/
│   │   └── data-access-api/  # Maps to: Sync Boundary Placeholder
│   ├── shared/
│   │   ├── config/           # Maps to: Configuration & Secrets Management
│   │   ├── types/            # Maps to: Code Structure (DTOs/Interfaces)
│   │   └── utils/            # Maps to: Code Structure (Utility functions)
│   ├── sync-protocol/        # Maps to: Sync Interface Contracts
│   ├── testing/              # Maps to: Testing Framework Infrastructure
│   └── web/
├── packages/                 # Publishable utilities/configs; Standalone
│   ├── eslint-config/        # Maps to: Formatting & Linting
│   ├── tsconfig/             # Maps to: TypeScript Project References
│   └── workspace-smoke/      # Maps to: Boundary & Config Verification
├── tools/                    # Local workspace tools & generators
│   ├── ci/                   # Maps to: Performance Guardrails (CI Scripts)
│   └── generators/           # NX Custom Generators
│       ├── lib/              # Maps to: Workspace Tooling (Shared Libraries)
│       └── module/           # Maps to: Module Boundaries & Scaffolding Tooling
├── docs/                     # Project documentation
│   ├── adr/                  # Maps to: Architectural Decision Records
│   └── operations/           # Maps to: Secrets Management Policy
├── .github/
│   └── workflows/
│       └── ci.yml            # Maps to: CI Pipeline
├── infra/
│   ├── postgres-init/        # Maps to: Database Local Service (Seed SQL)
│   ├── otel-config/          # Maps to: Observability (OpenTelemetry)
│   └── sentry/               # Maps to: Error Tracking
├── docker-compose.yml        # Maps to: Database Local Service
├── .npmrc                    # Maps to: Package Linking (Isolated Layout)
├── pnpm-workspace.yaml       # Maps to: Package Management (Catalogs)
├── nx.json                   # Maps to: Task Orchestration (Task caching)
├── eslint.config.js          # Maps to: DX Tooling (Linting + Boundaries)
├── vitest.workspace.ts       # Maps to: DX Tooling (Testing)
├── .lintstagedrc             # Maps to: DX Tooling (Pre-commit formatting/linting)
├── .commitlintrc.yaml        # Maps to: DX Tooling (Commit message validation)
├── package.json
├── .gitignore                # Maps to: DX Tooling (Monorepo optimized)
└── tsconfig.base.json        # Maps to: Code Structure
```

### Path Aliasing
All workspace packages use `@sentinel/` scoped npm aliases targeting their respective folder name and sub-path.
- `libs/shared/utils` → `@sentinel/utils`
- `modules/dispatch/api` → `@sentinel/dispatch/api`
- `modules/dispatch/ui` → `@sentinel/dispatch/ui`
- `apps/api` → `@sentinel/api`

## Module Definitions

### Module: Workspace Tooling Root
- **Maps to capability**: Monorepo Foundation & DX Tooling
- **Responsibility**: Establishes correct pnpm layout, NX target caching, git hooks, and global standards. Includes local NX generators (`tools/generators/module`).
- **Exports**: Workspace commands (`nx run-many`, `nx g @sentinel/generators:module`, etc).

### Module: packages/* (Tier 4)
- **Maps to capability**: DX Tooling & Infrastructure
- **Responsibility**: Publishable utility configurations and shared contracts. Standalone with zero internal imports.
- **File structure**:
  ```
  packages/
  ├── eslint-config/                  # Maps to: Formatting & Linting
  │   ├── base.js
  │   ├── backend.js
  │   ├── frontend.js
  │   ├── shared.js
  │   └── module-boundaries.js
  └── tsconfig/                       # Maps to: TypeScript Project References
      ├── base.json
      ├── backend.json
      ├── frontend.json
      └── shared.json
  ```
- **Exports**: Standalone utilities, configs (`@sentinel/eslint-config`, `@sentinel/tsconfig`).

### Module: modules/* (Tier 2)
- **Maps to capability**: Feature implementation
- **Responsibility**: Domain modules serving as vertical slices (colocated sub-packages for API, UI, and Shared). Only imports from `libs/`. Cross-module communication via event bus.
- **File structure**:
  ```
  modules/<domain>/
  ├── api/         # NestJS module, services, controllers, commands, events
  ├── ui/          # Domain-specific React components, pages, hooks
  ├── shared/      # Types, DTOs, interfaces shared between UI/API
  └── tests/       # Module-specific integration tests
  ```
- Note: `api`, `ui`, and `shared` are separate workspace packages within the domain folder.
- **Exports**: Business domain slices via sub-path aliasing.

### Module: Infrastructure
- **Maps to capability**: Local Infrastructure
- **Responsibility**: Provides docker-compose Postgres instance and `Dockerfile` builder configs.

### Module: libs/shared/config
- **Maps to capability**: Configuration & Secrets Management
- **Responsibility**: Centralizes type-safe environment configuration and runtime validation.
- **File structure**: 
  ```
  libs/shared/config/
  ├── src/
  │   ├── env.schema.ts    # Zod validation schema
  │   ├── get-env.ts       # Type-safe getter with caching
  │   └── index.ts
  ```
- **Exports**: Configuration getters via barrel `index.ts`.

### Module: libs/api
- **Maps to capability**: Code Structure (Shared Backend Primitives)
- **Responsibility**: Provides shared NestJS utilities, decorators, and global filters.
- **File structure**: 
  ```
  libs/api/
  ├── src/
  │   ├── core/      # Base services/controllers
  │   ├── decorators/
  │   ├── filters/
  │   └── index.ts
  ```
- **Exports**: API utilities via barrel `index.ts`.

### Module: libs/web
- **Maps to capability**: Code Structure (Shared Frontend Primitives)
- **Responsibility**: Provides shared React hooks and basic UI primitives (non-domain specific).
- **File structure**: 
  ```
  libs/web/
  ├── src/
  │   ├── hooks/
  │   ├── ui/        # Shared primitives (Button, Input, etc.)
  │   └── index.ts
  ```
- **Exports**: Web utilities and UI primitives via barrel `index.ts`.

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

### Module: libs/testing
- **Maps to capability**: Testing Framework Infrastructure
- **Responsibility**: Centralizes testing utilities, data factories, and compliance verifiers.
- **File structure**: 
  ```
  libs/testing/
  ├── src/
  │   ├── db/          # Testcontainers setup (Postgres, Redis)
  │   ├── factories/   # Standardized test data factories
  │   ├── harnesses/   # Specialized verifiers (Audit, Pipeline)
  │   └── index.ts
  ```
- **Exports**: Testing utilities and verifiers via barrel `index.ts`.

### Module: libs/mobile/data-access-api
- **Maps to capability**: Sync Boundary Placeholder
- **Responsibility**: Defines the boundary for mobile data synchronization and caching.
- **File structure**: 
  ```
  libs/mobile/data-access-api/
  ├── src/
  │   ├── sync.interface.ts
  │   └── index.ts
  ```
- **Exports**: Sync interfaces via barrel `index.ts`.

### Module: apps/api
- **Maps to capability**: Application Shells
- **Responsibility**: Host NestJS endpoint.
- **File structure**:
  ```
  apps/api/
  ├── src/
  │   ├── app/
  │   └── main.ts
  ├── project.json
  └── tsconfig.app.json
  ```
- **Exports**: HTTP endpoints (internally managed).

### Module: apps/web
- **Maps to capability**: Application Shells
- **Responsibility**: Host Next.js interface.
- **File structure**:
  ```
  apps/web/
  ├── app/             # Next.js App Router
  ├── components/      # App-level layout components
  ├── project.json
  └── tsconfig.app.json
  ```
- **Exports**: Configured react components & routes.

### Module: apps/mobile
- **Maps to capability**: Application Shells
- **Responsibility**: Host Expo application.
- **File structure**:
  ```
  apps/mobile/
  ├── src/
  ├── app.json
  ├── project.json
  └── tsconfig.app.json
  ```
- **Exports**: React Native application registry.
</structural-decomposition>

<dependency-graph>
## Dependency Chain

### Foundation Layer (Phase 1)
No dependencies - these are built first.
- **Workspace Tooling Root**: `pnpm-workspace.yaml`, `nx.json`, `vitest.workspace.ts`, DX tooling, configs, `.nvmrc` or `.node-version`.
- **packages/***: Base configurations and utilities (no dependencies).

### Base Libraries (Phase 2 & 3)
- **libs/shared/types**: Depends on [packages/*]
- **libs/shared/utils**: Depends on [packages/*]
- **libs/sync-protocol**: Depends on [packages/*]

### Domain Libraries & Data (Phase 6 & 8)
- **libs/mobile/data-access-api**: Depends on [libs/sync-protocol, libs/shared/types, libs/shared/utils]
- **Infrastructure**: Depends on [Workspace Tooling Root]

### Domain Modules
- **modules/***: Depends on [libs/*]

### Applications (Phase 4)
- **apps/api**: Depends on [modules/**/api, modules/**/shared, libs/*]
- **apps/web**: Depends on [modules/**/ui, modules/**/shared, libs/*]
- **apps/mobile**: Depends on [modules/**/ui, modules/**/shared, libs/*]

### Verification & CI (Phase 7 & 9)
- **CI Pipeline**: Depends on [All Application & Foundation Modules]
</dependency-graph>

<implementation-roadmap>
## Development Phases

### Phase 1: Monorepo Foundation
**Goal**: Establish deterministic package routing & execution engine.
**Entry Criteria**: Clean initialized git repository.
**Tasks**:
- [ ] Initialize pnpm 10 workspace (`pnpm-workspace.yaml` with apps/*, modules/**/*, libs/*, packages/* globs).
- [ ] Configure **pnpm Catalogs** for single-version dependency enforcement.
- [ ] Create `.npmrc` enforcing default isolated layout (no hoisting).
- [ ] Setup NX 22 (`nx.json` with `nxCloud: false`). Document FISMA rationale (CVE-2025-36852).
- [ ] Define NX task pipelines (`targetDefaults`: build depends on ^build, test depends on ^build).
- [ ] Implement **Local Persistent Caching** on self-hosted CI runners.
- [ ] Setup affected execution (`nx affected` mapping to `defaultBase: main`).
- [ ] Configure monorepo-optimized `.gitignore` (ignoring `.nx/`, `node_modules/`, `dist/`, `coverage/`, and AI agent folders).
- [ ] Setup `vitest.workspace.ts` discovery across all projects.
- [ ] Setup `libs/testing` with `testcontainers` for PostgreSQL and Redis.
- [ ] Initialize ADR system in `docs/adr/` with template and index.
- [ ] Create `0001-use-nx-monorepo.md` documenting the monorepo decision.
**Exit Criteria**: Base tooling installed without error. `nx.json` verified. `nx build`, `nx test`, and `nx lint` commands execute cleanly. ADR structure is present.
**Delivers**: Foundation required to host shared libraries and applications.

### Phase 2: TypeScript & Project Structure
**Goal**: Core compile definitions and base library scaffolding.
**Entry Criteria**: Phase 1 complete.
**Tasks**:
- [ ] Initialize `packages/tsconfig`.
- [ ] Define `tsconfig.base.json` with `composite: true`, `declaration: true`.
- [ ] Configure `packages/tsconfig` with `base.json`, `backend.json`, `frontend.json`, `shared.json` exporting strict mode configurations.
- [ ] Configure `nx sync` for types.
- [ ] Create empty layout for the 4 tiers: `apps/`, `modules/`, `libs/`, `packages/`.
- [ ] Scaffold `libs/shared/types` with barrel `index.ts`.
- [ ] Scaffold `libs/shared/utils` with barrel `index.ts`.
- [ ] Scaffold `libs/shared/config` with Zod schema validation.
- [ ] Scaffold `libs/api` and `libs/web` as infrastructure libraries.
- [ ] Implement `libs/testing` core utilities:
    - `audit-coverage-verifier.ts` (Compliance-as-Architecture).
    - `pipeline-contract-runner.ts` (Sequence validation).
    - Entity factories (Standardized data consistency).
**Exit Criteria**: Directories exist. `tsconfig` is valid and exportable.

### Phase 3: Module Boundaries & Scaffolding Tooling
**Goal**: Lock down import constraints and establish domain module generator.
**Entry Criteria**: Phase 2 complete.
**Tasks**:
- [ ] Setup `@nx/enforce-module-boundaries` in global ESLint.
- [ ] Set tags (`scope:*`, `type:*`, `platform:*`) in `project.json` definitions.
- [ ] Implement strict `depConstraints` mapping tags:
    - `type:backend` |X| `type:frontend` (Backend cannot depend on frontend).
    - `scope:module` |X| `scope:module` (Cross-module communication must be via events/shared).
    - `type:shared` can be accessed by both `backend` and `frontend`.
- [ ] **Enforce Explicit Dependencies**: Lint rule blocking imports of packages not listed in local `package.json`.
- [ ] Document rationale that boundaries cannot be retrofitted easily.
- [ ] Scaffold `packages/workspace-smoke` with boundary smoke tests.
- [ ] Create NX local generator at `tools/generators/module/` to scaffold **Nested Domain Modules** (api, ui, shared sub-packages) dynamically.
- [ ] Create NX local generator at `tools/generators/lib/` to scaffold shared libraries (web, api, shared) with correct tags and aliases.
- [ ] Generators must utilize `@nx/devkit` to auto-update `tsconfig.base.json` subpath aliases and create precise nested `.gitkeep` setups.
**Exit Criteria**: Intentional boundary violation is correctly caught by ESLint rule. Running the generator produces lint-passing, modular targets.

### Phase 4: Application Shells
**Goal**: Deployable build-ready shells for all three client boundaries.
**Entry Criteria**: Phase 3 complete.
**Tasks**:
- [ ] Scaffold `apps/web` (Next.js 15/16 App Router).
- [ ] Scaffold `apps/api` (NestJS 11 + SWC).
- [ ] Scaffold `apps/mobile` (Expo SDK 53, New Architecture). 
- [ ] **Implement custom `metro.config.js`** to resolve pnpm symlinks in isolated layout.
- [ ] Document known friction points for Expo + pnpm + NX.
**Exit Criteria**: All shells generate and tests pass.

### Phase 5: DX Tooling
**Goal**: Formatting, linting, and committing guardrails.
**Entry Criteria**: Phase 4 complete.
**Tasks**:
- [ ] Initialize `packages/eslint-config` (ESLint v9/v10 flat config).
- [ ] Configure `packages/eslint-config` with `base.js`, `backend.js`, `frontend.js`, `shared.js`, and `module-boundaries.js`.
- [ ] Integrate `eslint-plugin-security` for common anti-pattern detection.
- [ ] Enforce AR34 naming conventions:
    - Files and Folders: `kebab-case`.
    - Variables and Functions: `camelCase`.
    - Classes, Interfaces, Enums, and Types: `PascalCase`.
- [ ] Enforce `@typescript-eslint/consistent-type-imports`.
- [ ] Establish Prettier 3 configuration.
- [ ] Setup Husky 9 (`pre-commit`, `commit-msg`).
- [ ] Add `lint-staged` 16 configuration (`.lintstagedrc`) to run `nx affected -t lint` and `prettier` on changed files.
- [ ] Configure `commitlint` 20 (`.commitlintrc.yaml` with `@commitlint/config-conventional`).
- [ ] Set `.gitattributes` (`* text=auto eol=lf`).
**Exit Criteria**: Shared rules applied across workspace. Pre-commit hook completes in <5 seconds. Invalid commits (e.g., "fixed stuff") are rejected.

### Phase 6: Infrastructure & Observability
**Goal**: Local data persistence, secrets management, and observability baseline.
**Entry Criteria**: Phase 1 complete (Parallelizable with phase 4/5).
**Tasks**:
- [ ] Setup Docker Compose file with `postgres:17-alpine`, `redis:7-alpine`, and `healthcheck` configurations.
- [ ] Setup `.env.example` documenting database, Redis, and Docker registry requirements.
- [ ] Lock Node.js version via `.nvmrc` or `.node-version` (v22 LTS) and `engines.node`.
- [ ] Create base multi-stage `Dockerfile` utilizing 4-stage build pattern (base, deps, builder, runner).
- [ ] Ensure `Dockerfile` implements non-root user security and `wget --spider` healthcheck.
- [ ] Setup monorepo-optimized `.dockerignore` blocking `.nx`, `node_modules`, and secrets.
- [ ] Setup Secrets Management Platform integration (Infisical/Doppler).
- [ ] Setup Flagsmith project for feature toggling.
- [ ] Scaffold OpenTelemetry configuration and Sentry initialization.
- [ ] Provide initial seed schema directory `/infra/postgres-init`.
- [ ] Document Secrets Management Policy in `docs/operations/secrets-management.md`.
**Exit Criteria**: Cold-checkout `docker compose build` succeeds. Observability baseline established. Documentation complete.

### Phase 7: CI Pipeline
**Goal**: Enable push-button remote verification with deployment parity.
**Entry Criteria**: All prior phases complete.
**Tasks**:
- [ ] Author `.github/workflows/ci.yml` with separate `SAT-lite` and `SAT-full` jobs.
- [ ] Implement `nx/set-shas` and `concurrency` (cancel-in-progress) strategies.
- [ ] Setup `pnpm install --frozen-lockfile` with pnpm-store caching.
- [ ] Setup PR workflows (SAT-lite) executing `nx affected --target=lint,test,build,typecheck`. **Enforce mock-only tests for lite**.
- [ ] Implement **SAT-full** executing all targets with **Testcontainers** enabled.
- [ ] Configure NX Local Persistent Caching for self-hosted runners.
- [ ] Implement deployment matrix builds (SaaS, Self-hosted, Air-gapped) for NFR35.
- [ ] Setup PR coverage reporting using `vitest-coverage-report-action`.
- [ ] Implement `pnpm audit --audit-level=high` in both SAT-lite and SAT-full.
- [ ] Integrate `gitleaks-action` secret scanning with custom `.gitleaks.toml`.
- [ ] Add `GITHUB_STEP_SUMMARY` output for audit and secret scan results.
- [ ] Implement `tools/ci/performance-guardrail.sh` to monitor SAT thresholds.
- [ ] Implement Affected Surface summary step in CI to track complexity.
- [ ] Configure Canary Docker build and push to registry on merge to `dev` branch.
- [ ] Ensure all CI jobs include a `timeout-minutes` configuration.
**Exit Criteria**: Entire CI spec successfully simulates validation logic. Full verification (SAT-full) passes in <20 minutes.

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
- [ ] Verify: Metro resolves workspace packages from clean `pnpm install` using custom config.
- [ ] Verify: `pnpm audit --audit-level=high` returns clean.
- [ ] Verify: `pnpm install --frozen-lockfile` passes in simulated CI.
**Exit Criteria**: All tests checked and passed.
</implementation-roadmap>

<test-strategy>
## Test Pyramid
- E2E: 5% (Monorepo boundary checks, shell loading)
- Integration: 15% (Testcontainers-based DB verification in SAT-full)
- Unit Tests: 80% (Fast, mocked logic tests in SAT-lite)

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
- Importing a package not declared in local `package.json` generates ESLint exception.

**Integration points**:
- Native module resolution (Metro) cleanly interprets workspace symlinks due to custom `metro.config.js`.
</test-strategy>

<architecture>
## System Components
- **Workspace Node Linker**: Default **Isolated** layout to ensure auditability and SBOM accuracy.
- **NX Runner**: Local task runner configuration with **Persistent Local Caching** on self-hosted CI runners. Cloud caching disabled to meet FISMA/DOE constraints.
- **SAT Tiers (System Acceptance Testing)**: 
    - **SAT-lite**: Incremental PR checks (Affected lint, fast test with mocks, build, typecheck) in <5 minutes.
    - **SAT-full**: Full workspace verification (All targets with Testcontainers) in <20 minutes.

## Technology Stack
- **Tools**: pnpm 10 (with Catalogs), NX 22
- **Stack**: Next.js 15/16 (React 19), NestJS 11, Expo SDK 53
- **Test**: Vitest 3, Playwright 1.50, Testcontainers
- **DB**: PostgreSQL 17
- **Secrets**: Infisical/Doppler
- **Flags**: Flagsmith
- **Obs**: OpenTelemetry, Sentry

**Decision: pnpm over yarn/npm**
- **Rationale**: Faster execution, catalogs support for exact single-version enforcement.
- **Trade-offs**: Metro integration is fragile; solved via custom `metro.config.js` to preserve isolated layout for auditability.

**Decision: NX Cloud Disabled**
- **Rationale**: Security compliance constraints (CVE-2025-36852) and DOE data sovereignty.

**Decision: NestJS for API**
- **Rationale**: Provides rigid architectural patterns (Modules, Controllers, Providers) suitable for scaling large teams in a monorepo. Native support for SWC ensures fast iteration.
- **Trade-offs**: Heavier runtime footprint compared to Fastify/Express.

**Decision: Next.js (App Router) for Web**
- **Rationale**: Industry standard for React applications with built-in SSR/Streaming capabilities and optimized bundling.
- **Trade-offs**: Opinionated routing structure can be restrictive for non-standard UI flows.

**Decision: Expo for Mobile**
- **Rationale**: Simplifies React Native development with managed native modules and unified build pipelines.
- **Trade-offs**: Workspace linking requires custom Metro configuration to resolve symlinks correctly in an isolated pnpm layout.

**Decision: Testcontainers for Integration Testing**
- **Rationale**: Provides consistent, ephemeral database (Postgres, Redis) environments for integration tests. Reserved for **SAT-full** to maintain developer velocity in PRs.
- **Trade-offs**: Requires Docker to be running; slower startup compared to mocks.

**Decision: Zod for Runtime Configuration Validation**
- **Rationale**: Ensures that environment variables are present and conform to expected types at startup. Prevents runtime errors due to misconfiguration.
- **Trade-offs**: Adds a small amount of overhead at startup.

**Decision: Multi-stage Docker Builds (Golden Images)**
- **Rationale**: Standardizes the containerization strategy with a 4-stage pattern. Primary output for restricted environments is an immutable image artifact (Docker Tarball).
- **Trade-offs**: Requires careful management of Docker layer caching to prevent slow builds.

**Decision: Secrets Management Platform (Infisical/Doppler)**
- **Rationale**: Replaces manual `.env` file management with a secure, centralized platform. Ensures secret parity across local dev, CI, and staging/prod without manual intervention.
- **Trade-offs**: Introduces a dependency on a third-party service for environment setup.

**Decision: Flagsmith for Feature Toggling**
- **Rationale**: Decouples deployment from release. Allows for runtime feature enabling/disabling and progressive rollouts.
- **Trade-offs**: Requires SDK integration and careful flag lifecycle management.

**Decision: OpenTelemetry & Sentry for Observability**
- **Rationale**: OpenTelemetry provides vendor-neutral tracing and metrics, while Sentry offers deep error analysis and crash reporting. Together they provide full-stack visibility.
- **Trade-offs**: Complexity of configuring OTel collectors and managing trace volume.
</architecture>

<risks>
## Technical Risks
**Risk**: Expo Workspace Linking breakage in isolated layout.
- **Impact**: High (Mobile development blocked).
- **Likelihood**: Medium.
- **Mitigation**: Implement and pre-validate custom `metro.config.js` for symlink resolution.

## Scope Risks
**Risk**: Lack of explicit type-safety checks inside `tsconfig`.
- **Impact**: Missed issues catching during build.
- **Mitigation**: Define strict module bounds across `libs/shared/types`.
</risks>
</rpg-method>
