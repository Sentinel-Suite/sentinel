# Module: Platform Core (Module 0)

**Status:** draft
**Parent:** [PDD](pdd.md)
**Created:** 2026-02-22
**Last Updated:** 2026-02-22

## Purpose

Foundation services shared by all modules. Platform Core provides authentication, authorization, data synchronization, communication infrastructure, mapping, API layer, and the unified command system that ties the entire platform together.

## Responsibilities

- User authentication across multiple methods and identity providers
- Fine-grained, location-scoped authorization with customizable roles
- Immutable, comprehensive audit logging with SIEM export
- Offline data sync for field officers with conflict resolution
- Multi-channel notifications with priority tiers
- Indoor/outdoor GIS and mapping with data overlays
- API-first architecture (tRPC internal, REST external)
- Event bus for async module-to-module communication and real-time updates
- Unified command bus enabling CLI, command palette, hotkeys, buttons, and menus to execute the same operations
- System settings (admin/org-level) and user preferences
- Future integration framework (plugin architecture → webhooks → connectors → marketplace)

## Sub-Modules

### Auth

**Authentication:**

- Username/password with MFA
- SSO/SAML federation (enterprise IdP)
- CAC/PIV certificate-based (preferred for DOE)
- AD/LDAP
- Social auth (commercial clients)
- Configurable per organization

**Authorization:**

- Hybrid RBAC + ABAC model
- Predefined roles as starting point with fine-grained overrides
- Full resource/action permission matrix
- Location-scoped permissions (user may have different access at different sites)
- Roles customizable per organization

### Logging

- **User actions / audit trail** — who did what, when, where
- **System events** — errors, performance, health monitoring
- **Security events** — login attempts, permission changes, data access
- **Data change history** — full record versioning
- **Immutable** — write-once, tamper-evident, cryptographic integrity
- **SIEM-exportable** — standard formats for external security tooling

### Offline Sync

- **Scope:** Field officers only (role-based data subset)
- **Capabilities:** Read synced data, create new records, edit existing records
- **Data subset:** Determined by role — only data relevant to officer's assignments
- **Conflict resolution:** Last-write-wins as default, manual merge queued for genuine conflicts
- **Security:** Limited data subset reduces exposure if device is lost/compromised

### Notifications

- **Channels:** In-app (web + mobile), push notifications, email, SMS, mass notification system integration (future)
- **Priority tiers:** Critical (overrides DND), High, Normal, Low
- **User-configurable** preferences for channels and quiet hours per notification type

### GIS / Mapping

- **Outdoor maps:** Campus, perimeter, surrounding area
- **Indoor floor plans:** Building interiors, floors, zones
- **Data layers:** Officer locations (GPS), incident locations, patrol routes/checkpoints, facility boundaries/zones, points of interest (cameras, AEDs, fire extinguishers, exits, rally points)
- **No offline map requirement**

### API

- **Internal:** tRPC for type-safe frontend-backend communication
- **External:** REST for third-party integrations and external consumers
- **API-first design:** Every platform feature accessible via API
- **Enables:** White-label frontends, third-party integrations, future mobile clients

### Event Bus

- **Module-to-module communication** (incident created → notification → dashboard update)
- **Audit trail generation** (events → immutable log)
- **Real-time client updates** (live dashboards, dispatch boards)
- **Workflow triggers** (severity escalation → auto-notify chain of command)
- **Integration hooks** (future: external systems subscribe to events)
- **Delivery:** At-least-once for critical events, best-effort for non-critical

### Command Bus

- **CQRS** — separates write operations from read queries
- **Action dispatching** — structured command execution across the platform
- **Workflow orchestration** — multi-step operations with rollback capability
- **Permission checks and input validation** enforced at the command level

**Unified Command System:**

Every action in the platform is a command, invocable from any surface:

- UI buttons and menus
- Keyboard shortcuts / hotkeys
- Command palette (searchable, VS Code-style)
- CLI-style command input with positional and named arguments

**CLI Syntax:**

```
/p bldg-15 -x 72 --route overnight
```

Creates a patrol assigned to officer X-72 with the overnight route at Building 15. Automatically logs to dispatch log, officer's DAR, and creates patrol record.

```
/unsecure-door secured -x 72
```

Context-aware: knows X-72 is patrolling Building 15, adds unsecured door as patrol finding, logs to dispatch and DAR.

```
/clear -x 72
```

Clears X-72 from current task, closes active records.

**Command Configuration (three tiers):**

1. Platform defaults
2. Organization overrides
3. User overrides

**Command Features:**

- Autocomplete/typeahead with syntax hints
- Help system (`/help patrol` shows usage and examples)
- Command palette with searchable list
- Undo/rollback (`/undo` reverses last command)
- Command history (per user, scrollable)
- Macro/chaining (`/assign -x 72 bldg-15 && /patrol -x 72 --route overnight`)
- Scheduled commands (execute at future time)

### Settings (Admin/Org-Level)

- Tenant configuration and deployment options
- Module enable/disable per organization
- Compliance profiles (applicable regulatory frameworks)
- Command aliases per organization
- Data retention policies
- White-label branding

### Preferences (User-Level)

- Notification preferences (channels, quiet hours)
- UI theme and layout
- Default views and dashboard arrangement
- Command aliases per user
- Keyboard shortcut customization

### Integrations (Future — Phased)

1. **Phase 1:** Plugin/adapter architecture with standardized interface
2. **Phase 2:** Webhook-based (external systems subscribe/push)
3. **Phase 3:** Pre-built connectors for common systems (Lenel, Genetec, etc.)
4. **Phase 4:** Integration marketplace for third-party connectors

## Interfaces

| Communicates With              | Direction     | Description                                          |
| ------------------------------ | ------------- | ---------------------------------------------------- |
| All modules                    | Provides      | Auth, logging, notifications, API, event/command bus |
| Module 1: Security Operations  | Provides      | Command execution, offline sync, GIS                 |
| Module 2: Dispatch / CAD       | Provides      | Command bus (CLI dispatch), real-time events, GIS    |
| Module 3: Command Center       | Provides      | Event bus (live data), GIS, dashboards               |
| Module 9: Facility & Zone Mgmt | Consumes      | Location hierarchy for permission scoping and GIS    |
| Module 8: Personnel            | Consumes      | User/role data for auth and scheduling context       |
| External IdPs                  | Bidirectional | SSO/SAML, AD/LDAP, CAC/PIV authentication            |
| External SIEM                  | Provides      | Log export                                           |

## Data Ownership

- User accounts and credentials
- Roles, permissions, and access policies
- Audit logs and system logs
- Notification records and delivery status
- Command history and macro definitions
- System settings and user preferences
- GIS layers and map configurations
- Offline sync state and conflict queue

## Dependencies

- Module 9 (Facility & Zone Management) for location hierarchy
- Module 8 (Personnel) for user/role enrichment
- External identity providers (per org configuration)

## Constraints

- DOE/FISMA compliance from day one (NIST 800-53 controls)
- Section 508 / WCAG 2.1 accessibility
- Tiered data isolation (database-per-tenant for DOE, logical for commercial)
- Must support Docker self-hosted deployment
- Offline sync must handle unreliable connectivity gracefully

## Open Questions

1. Backend framework selection (Node.js/Express, Fastify, Nest.js, etc.)
2. Database selection (PostgreSQL likely, but TBD)
3. Event bus implementation (in-process vs. message broker like Redis Streams, NATS, etc.)
4. GIS/mapping provider (Mapbox, OpenLayers, Leaflet, etc.)
5. Offline storage strategy (IndexedDB, SQLite via WASM, etc.)
6. tRPC vs. GraphQL final decision
7. CRDT library selection for offline sync conflict resolution
