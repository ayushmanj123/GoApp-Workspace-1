# GOAPPS PLATFORM – MASTER PROJECT MEMORY v1.0

## Project Overview

GoApps is a cloud-native low-code application platform inspired by Microsoft Power Apps Canvas Apps.

The goal is to provide:

- Visual application designer
- Drag-and-drop UI builder
- Formula-based behavior engine
- Multi-tenant SaaS architecture
- Runtime application execution engine
- Enterprise-grade security
- Extensible connector ecosystem
- ALM and deployment pipeline
- Open architecture with lower operating cost than Microsoft Power Platform

The platform must support thousands of tenants and millions of runtime sessions.

---

# Core Product Vision

Users should be able to:

1. Create applications visually.
2. Design screens.
3. Add controls.
4. Configure properties.
5. Define events.
6. Create formulas.
7. Connect to data sources.
8. Publish applications.
9. Execute applications through runtime.
10. Collaborate in real time.

Target users:

- Citizen Developers
- Business Users
- Consultants
- Enterprise Customers
- ISVs

---

# Technology Stack

## Backend

Language:

- Golang

Framework:

- Fiber

Authentication:

- Keycloak

Authorization:

- RBAC

API:

- REST

Future:

- gRPC

---

## Database

Primary Database:

- PostgreSQL

Requirements:

- Multi-Tenant
- Row-Level Security
- JSONB Support
- Auditability

---

## Cache Layer

Technology:

- Redis

Usage:

- Cache
- Sessions
- Pub/Sub
- Collaboration Engine

---

## Object Storage

Technology:

- MinIO

Usage:

- Files
- Templates
- Packages
- App Exports
- Media Assets

---

## Frontend

Language:

- TypeScript

Framework:

- React

Runtime:

- Vite

Canvas Engine:

- KonvaJS

State:

- Zustand

Data Fetching:

- TanStack Query

---

## Deployment

Platform:

- Kubernetes

CI/CD:

- GitHub Actions

Observability:

- Prometheus
- Loki
- Jaeger

---

# Multi-Tenant Architecture

Everything is tenant scoped.

Every tenant-owned table MUST contain:

- tenant_id

Every repository query MUST be tenant aware.

Every API request MUST contain tenant context.

Tenant isolation is mandatory.

Never bypass tenant filtering.

---

# Security Principles

Authentication:

- Keycloak JWT

Authorization:

- RBAC

Requirements:

- JWT validation
- Refresh tokens
- Permission-based access
- Audit logging
- RLS enforcement

Never trust client-side permissions.

---

# Core Services

## Metadata Service

Purpose:

Stores application definitions.

Owns:

- Applications
- Screens
- Controls
- Properties
- Events
- Formulas
- Connectors

Database:

- PostgreSQL

---

## Runtime Service

Purpose:

Loads application metadata and builds runtime package.

Responsibilities:

- Screen loading
- Control tree generation
- Property resolution
- Formula execution
- State management

---

## Auth Service

Purpose:

Authentication and authorization.

Responsibilities:

- User management
- Roles
- Permissions
- Tokens

---

# Metadata Model

Hierarchy:

Tenant
└─ Application
└─ Screen
└─ Control
├─ Properties
├─ Events
└─ Formulas

This hierarchy is immutable.

---

# Runtime Architecture

Application
↓
Screens
↓
Control Tree
↓
Properties
↓
Formula Engine
↓
React Renderer

Runtime must never directly access design metadata.

Runtime consumes runtime packages only.

---

# Component Registry

All controls must be registry driven.

Never use:

switch(controlType)

Never use:

if(controlType == "Button")

Always use:

Registry
↓
Component Definition
↓
Renderer

Supported Controls V1:

- Container
- Label
- Button
- Text Input
- Dropdown

Future:

- Gallery
- Form
- Data Table
- Date Picker
- Rich Text

---

# Formula Engine

Architecture:

Lexer
↓
Parser
↓
AST
↓
Evaluator

Future Goal:

Power Fx Compatibility

V1:

- Variables
- Functions
- Expressions

---

# Connector Framework

Architecture:

Connector Definition
↓
Connector Action
↓
Execution Layer

Connector Types:

- REST
- SQL
- Storage

Future:

- Salesforce
- SAP
- Dynamics
- SharePoint
- ServiceNow

---

# Studio Architecture

Canvas Studio

Responsibilities:

- Drag and Drop
- Property Editing
- Screen Management
- Formula Authoring

Must be separate from Runtime.

Never mix design-time and runtime logic.

---

# Publishing Architecture

Studio
↓
Publish Service (:8085)
↓
Metadata Service (snapshot assembly)
↓
Version Snapshot (`application_snapshots.snapshot_json`)
↓
Runtime Package
↓
Runtime App

Rules:

- Draft metadata tables remain editable after publish
- Published runtime loads frozen snapshots via `applications.current_version_id`
- Studio preview uses `?channel=draft` on runtime APIs
- `packages` / MinIO artifact storage deferred to a later phase

Published versions must be immutable.

---

# Versioning Rules

Applications support:

- Draft
- Published
- Archived

Published applications are immutable.

Changes require new version creation.

---

# Audit Requirements

Audit everything:

- Application changes
- Screen changes
- Control changes
- Formula changes
- Permission changes

Audit logs must be append-only.

No hard deletes.

---

# Performance Requirements

Target:

Application Load:
< 500ms

Screen Load:
< 200ms

API Response:
< 100ms

Support:

- 10,000+ applications
- 100,000+ users
- 1,000+ tenants

---

# Development Rules

Always:

- Follow Clean Architecture
- Use Dependency Injection
- Use Repository Pattern
- Use DTOs
- Use Service Layer

Never:

- Put business logic in handlers
- Access DB from handlers
- Hardcode tenant IDs
- Hardcode control types

---

# Current Build Order

Macro phases (product roadmap):

| Phase | Name | Status |
|-------|------|--------|
| 1 | Infrastructure | COMPLETE |
| 2 | Metadata Service | COMPLETE (CRUD + runtime assembly; JWT deferred) |
| 3 | Runtime Engine | COMPLETE (client `apps/runtime` + Go kernel/sessions/records) |
| 4 | Canvas Studio | COMPLETE (Konva, Monaco, explorer, layers) |
| 5 | Formula Engine | COMPLETE (literal + remote Power Fx, actions, forms) |
| 6.0 | Entity Foundation | COMPLETE |
| 6.1 | Publishing Pipeline | COMPLETE |
| 6.9 | Runtime Hardening | COMPLETE |
| 7.0 | Core Loop Polish | COMPLETE (Open Runtime, seed screen, E2E validator) |
| 7.1 | REST Connector Framework | COMPLETE (metadata CRUD + RestDataSource) |
| 7.2 | Keycloak Production Auth | COMPLETE (JWKS validator + Studio/Runtime session login) |
| 7.3 | Studio Connector Designer | COMPLETE (manager UI, Data panel, Items picker) |
| 7.4 | Auth Trust Boundary Hardening | COMPLETE (gateway proxies, service auth, Keycloak realm) |
| 7.5 | Connector Secrets | COMPLETE (encrypted secrets table, write-only Studio UX, runtime resolve) |
| 7.6 | SQL Connector | COMPLETE (Postgres table binding, connection_string secrets, SqlDataSource) |
| 7.7 | Runtime Productization | COMPLETE (runtime login + env-aware Open Runtime) |
| 7.8 | ALM Studio Polish | COMPLETE (Versions modal: rollback / deprecate) |
| 7.9 | Named SQL Queries | COMPLETE (list action SELECT override for SqlDataSource) |
| 7.10 | REST OAuth | COMPLETE (oauth_client_credentials + Bearer token cache) |
| 7.11 | Storage Connector | COMPLETE (S3/MinIO StorageDataSource list/get) |
| 7.12 | Env-scoped connector secrets | COMPLETE (environment_secret_overrides + Studio Secrets + runtime resolve) |
| 7.13 | Freeze connectors into publish snapshots | COMPLETE (RuntimeConnector in snapshot + snapshot-aware runtime connector repos) |
| 7.14 | Entity relationships UI | COMPLETE (lookup field type + related entity picker, Studio Relationships panel) |
| 7.15 | Navigate + Filter usable Power Fx slice | COMPLETE (kernel session `Navigate()` verified real; gallery/connector list `filter` property wired into `QueryOverrides.Filter`) |
| 7.16 | SQL write CRUD | COMPLETE (SqlDataSource Create/Update/Delete + Form submit for table-bound connectors; Patch uses registry) |
| 7.17 | Storage upload/delete | COMPLETE (StorageDataSource PutObject/RemoveObject + Form ModeNew + Remove formula) |
| 7.18 | Richer Filter / LookUp | COMPLETE (And equals filters, SQL WHERE pushdown, LookUp formula; gateway X-Request-ID stamp) |
| 7.19 | Deeper Filter / Or / comparisons | COMPLETE (`Filter()` formula, Or + comparison predicates, collection gallery filter, SQL WHERE for Or/ops) |
| 7.20 | Entity DB WHERE pushdown | COMPLETE (`FilterExpr` → Postgres JSONB WHERE on entity list Count/Find; correct filtered paging beyond in-memory window) |
| 7.21 | REST OAuth authorization-code | COMPLETE (app-level Connect + PKCE + encrypted refresh + runtime refresh_token grant) |
| 7.22 | Per-user connector OAuth | COMPLETE (connection_scope app\|user, connector_user_connections, runtime Connect banner) |
| 7.23 | Workflow MVP | COMPLETE (manual trigger + connector_action steps + Studio Workflow Manager + run history) |
| 7.24 | Workflow triggers v2 | COMPLETE (schedule poller + HTTP webhook + Studio trigger editor) |
| 7.25 | Action parity + delete + binding props | COMPLETE (Studio actions/; , Remove entity/SQL/REST, gallery filter/sort/limit, Timer kernel) |
| 7.26 | Form designer completeness | COMPLETE (nest-into Form/Gallery drop, Generate fields, REST SubmitForm, client New mode) |
| 7.27 | control palette + Konva shapes | COMPLETE (HTML controls + Konva decorative shape primitives) |
| 7.28 | search + lookup picker + typed Generate Fields | COMPLETE (Contains/StartsWith filters, lookup Dropdown Items, checkbox/datepicker Generate fields) |
| 7.29 | DataTable + gallery paging | COMPLETE (DataTable control, pageSize/offset + Load more, QueryOverrides.Offset) |
| 7.30 | Studio canvas UX polish | COMPLETE (single-line toolbox + Shapes flyout, designer chrome CSS, nest-any / insert-into-selection) |
| 7.31 | Studio canvas editor UX | COMPLETE (context menu Lock/Duplicate/Remove/Layering, nest menu, Shift-snap, typing guards) |
| 8.0 | Enterprise ALM | COMPLETE (unpublish/rollback/deprecate, environments + promote, audit events) |
| 8.1 | MinIO publish artifacts | COMPLETE (snapshot blob uploaded to MinIO on publish; `packages.package_url`/`package_hash`; runtime prefers the artifact, falls back to `snapshot_json`) |
| 8.2 | MinIO artifact GC | COMPLETE (ref-safe GC on Deprecate when unreferenced by app + envs; Unpublish stays pointer-only; `snapshot_json` retained) |

---

# Granular Validation Milestones

Acceptance scripts live in `infrastructure/scripts/validate-phase-*.mjs`.

Granular sub-phases use different numbering than macro phases:

- **4.3.8 → 4.33** — Studio chrome, canvas, formulas, actions, gallery, forms, timer, components
- **5.0 → 5.2** — Explorer tree, layers UX, Monaco formula editor
- **6.0** — Entity foundation (schema + Studio + runtime package)
- **6.1** — Publishing pipeline (immutable snapshots + publish service)
- **7.0** — Core loop polish (seed screen, Open Runtime, create→publish→runtime)
- **7.3** — Studio connector designer (manager UI + Items datasource picker)
- **7.4** — Auth trust boundary (gateway proxies, service auth middleware, Keycloak PKCE realm)
- **7.5** — Connector secrets (encrypted `secrets` table, write-only Studio UX, runtime resolve)
- **7.6** — SQL connector (Postgres table binding, connection_string secrets, SqlDataSource)
- **7.7** — Runtime productization (Keycloak/dev login + `environmentId` Open Runtime)
- **7.8** — ALM Studio polish (Versions modal: rollback / deprecate)
- **7.9** — Named SQL queries (`list` action SELECT override)
- **7.10** — REST OAuth client credentials
- **7.11** — Storage connector (S3/MinIO)
- **7.13** — Freeze connectors into publish snapshots (`RuntimeConnector` in `application_snapshots.snapshot_json`, snapshot-aware runtime connector repos)
- **7.14** — Entity relationships UI (lookup field type + related entity picker)
- **7.15** — Navigate + Filter usable Power Fx slice (kernel session `Navigate()` real navigation confirmed; gallery/connector `filter` property passthrough into `QueryOverrides.Filter`)
- **7.16** — SQL write CRUD (`SqlDataSource` Create/Update/Delete for table-bound connectors; Form submit routes by datasource kind)
- **7.17** — Storage upload/delete (`StorageDataSource` Create/Delete, Form ModeNew submit, `Remove()` formula for string keys)
- **7.18** — Richer Filter / LookUp (`And` equals parse, SQL table-bound WHERE pushdown, `LookUp()` formula; gateway stamps generated `X-Request-ID` on inbound requests)
- **7.19** — Deeper Filter (`Filter()` formula, Or/comparisons, collection gallery filter, SQL WHERE for Or/ops)
- **7.20** — Entity DB WHERE pushdown (`ListOptions.FilterExpr` → JSONB WHERE; filtered Count + Limit/Offset)
- **7.21** — REST OAuth authorization-code (app-level Connect, PKCE callback, `refresh_secret_id`, runtime Bearer via refresh grant)
- **7.22** — Per-user connector OAuth (`connection_scope`, `connector_user_connections`, runtime Connect banner, `connector_user_oauth_required`)
- **7.23** — Workflow MVP (manual trigger, `connector_action` steps, sync runs, Studio Workflow Manager)
- **7.24** — Workflow triggers v2 (schedule poller + HTTP webhook + Studio trigger editor)
- **7.25** — Action parity + delete + binding props (Studio Patch/Remove/NewForm/; , Remove via DataSource.Delete, gallery filter/sort/limit, Timer)
- **7.26** — Form designer completeness (nest drop into Form/Gallery, schema-driven Generate fields, REST SubmitForm, runtime Form New mode)
- **7.27** — control palette expansion (dropdown/container/checkbox/toggle/image/icon/datepicker + Konva shape primitives with SVG runtime)
- **7.28** — search filters + lookup picker + typed Generate Fields (`Contains`/`StartsWith`, lookup Dropdown Items formula, checkbox/datepicker/boolean Generate fields)
- **7.29** — DataTable control + gallery/datatable paging (`pageSize`, `offset`, Load more, `QueryOverrides.Offset`)
- **7.30** — Studio canvas UX polish (single-line toolbox + Shapes flyout, designer host CSS, container nest-any + insert-into-selection)
- **7.31** — Studio canvas editor UX (context menu, nest menu, Shift-only snap guides, property typing guards)
- **8.1** — MinIO publish artifacts (upload snapshot blob to MinIO on publish, record `packages.package_url`/`package_hash`, runtime prefers the artifact with `snapshot_json` fallback)
- **8.2** — MinIO artifact GC (ref-safe deprecate GC; Unpublish never deletes blobs)

Run: `node infrastructure/scripts/validate-phase-7.13.mjs`
Run: `node infrastructure/scripts/validate-phase-7.14.mjs`
Run: `node infrastructure/scripts/validate-phase-7.15.mjs`
Run: `node infrastructure/scripts/validate-phase-7.16.mjs`
Run: `node infrastructure/scripts/validate-phase-7.17.mjs`
Run: `node infrastructure/scripts/validate-phase-7.18.mjs`
Run: `node infrastructure/scripts/validate-phase-7.19.mjs`
Run: `node infrastructure/scripts/validate-phase-7.20.mjs`
Run: `node infrastructure/scripts/validate-phase-7.21.mjs`
Run: `node infrastructure/scripts/validate-phase-7.22.mjs`
Run: `node infrastructure/scripts/validate-phase-7.23.mjs`
Run: `node infrastructure/scripts/validate-phase-7.24.mjs`
Run: `node infrastructure/scripts/validate-phase-7.25.mjs`
Run: `node infrastructure/scripts/validate-phase-7.26.mjs`
Run: `node infrastructure/scripts/validate-phase-7.27.mjs`
Run: `node infrastructure/scripts/validate-phase-7.28.mjs`
Run: `node infrastructure/scripts/validate-phase-7.29.mjs`
Run: `node infrastructure/scripts/validate-phase-7.30.mjs`
Run: `node infrastructure/scripts/validate-phase-7.31.mjs`
Run: `node infrastructure/scripts/validate-phase-8.1.mjs`
Run: `node infrastructure/scripts/validate-phase-8.2.mjs`

---

# Phase 6.1 — Publishing Pipeline

## APIs

Publish service (public entry, :8085):

- `POST /api/v1/applications/:id/publish`
- `GET /api/v1/applications/:id/versions`
- `GET /api/v1/applications/:id/versions/:versionId`

Metadata service (domain logic + persistence, :8082):

- Same publish/version routes (used internally by publish service)
- `GET /api/v1/runtime/applications/:id` — default `published` channel (snapshot)
- `GET /api/v1/runtime/applications/:id?channel=draft` — live draft assembly

## Data model

- `application_versions` — `status`: `draft` | `released` | `deprecated`
- `application_snapshots` — immutable `snapshot_json` (full `RuntimeApplication` DTO)
- `applications.current_version_id` — pointer to latest released version
- `applications.status` — `draft` | `published` | `archived`

## Out of scope (6.1)

- `packages` table / MinIO upload
- Environment promotion (dev → prod)
- Unpublish / rollback / deprecate
- Audit service writes
- Keycloak JWT (continue `X-Tenant-Id` header)

---

# Phase 8.0 — Enterprise ALM

Full details: `docs/enterprise-alm.md`.

## APIs

Publish service + metadata service (same routes on both, publish proxies to metadata):

- `POST /api/v1/applications/:id/unpublish`
- `POST /api/v1/applications/:id/versions/:versionId/rollback`
- `POST /api/v1/applications/:id/versions/:versionId/deprecate`

Metadata service only:

- `GET/POST /api/v1/applications/:appId/environments`
- `GET/PUT/DELETE /api/v1/applications/:appId/environments/:envId`
- `POST /api/v1/applications/:appId/environments/:envId/promote`
- `POST/GET /api/v1/audit-events`

## Data model

- `environments.current_version_id` — nullable FK to `application_versions`, independent of the app's global pointer
- `audit_logs` — unchanged, append-only (migration `000002`); now written by ALM handlers via `AuditService`

## Studio

- `/studio/environments` — real `EnvironmentsManagerPage` (was a stub)
- `apps/studio/src/api/publish-api.ts` — `unpublish`, `rollback`, `deprecate`
- `apps/studio/src/api/environments-api.ts` — new
- `VersionsModal` on AppCard — list / rollback / deprecate (Phase 7.8)

## Out of scope (8.0)

- `services/environment` / `services/audit` as real proxies (kept thin, like `services/publish` was for packages) — Studio and handlers talk to metadata directly
- Richer audit payloads / search indexing across `services/audit` and `services/search`

---

# Phase 8.1 — MinIO Publish Artifacts

## What changed

- `PublishService.Publish` now uploads the same snapshot bytes it writes to `application_snapshots.snapshot_json` into MinIO, then records the resulting URL + sha256 hash on the `packages` table (`ApplicationVersionID`, `PackageURL`, `PackageHash` — previously unused columns).
- `RuntimeService.loadPublishedPackage` (used by the `published` channel and environment-scoped loads) now prefers the MinIO artifact when a `packages` row exists and downloads/verifies successfully, and transparently falls back to `application_snapshots.snapshot_json` on any miss: no row, download error, or sha256 mismatch.
- Publish never fails because of MinIO. If MinIO is unreachable/unconfigured, or the `packages` insert fails (e.g. a duplicate hash), the failure is logged and swallowed — the version still publishes successfully with the DB snapshot as its only backing store.
- `snapshot_json` remains the source of truth and is kept as the fallback for at least one release; no read path removes it.

## Config

New env var, alongside the existing MinIO vars already documented in `.env.example` (`MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_USE_SSL`):

- `MINIO_PUBLISH_BUCKET` (default `goapps-publish`) — bucket for publish artifacts; auto-created on first upload if missing.

If `MINIO_ENDPOINT` is unset, the artifact store is treated as "not configured" and publish/runtime behave exactly as before Phase 8.1 (DB-only), by design — this keeps local dev working without `docker compose up` MinIO.

## Object layout

`applications/{applicationId}/versions/{versionId}/snapshot.json`, uploaded with `Content-Type: application/json`.

## Out of scope (8.1)

- Multipart/streamed uploads for very large snapshots
- Exposing `packages` rows over the public API
- Async sweeper cron (ref-safe GC on Deprecate is Phase 8.2)

---

# Phase 8.2 — MinIO Artifact GC

## What changed

- `ArtifactStore.Delete` removes a publish artifact by URL (same URL parse path as Download).
- After a successful `Deprecate`, if the version is **not** referenced by `applications.current_version_id` and no `environments.current_version_id`, best-effort MinIO delete runs and the `packages` row is removed. `application_snapshots.snapshot_json` is kept as the runtime fallback.
- **Unpublish stays pointer-only** — never deletes MinIO blobs (environments may still reference versions).
- GC failures are logged and swallowed (same soft-fail policy as Phase 8.1 upload).

## Out of scope (8.2)

- Async sweeper cron / orphan admin API
- Multipart deletes
- Deleting `snapshot_json`
- Studio UI beyond existing Deprecate

---

# Current MVP Goal

User can:

1. Create Application — DONE
2. Create Screen — DONE
3. Create Controls — DONE
4. Save Metadata — DONE
5. Publish — DONE (Phase 6.1)
6. Open Runtime — DONE (loads published snapshot by default)
7. Interact with App — DONE

No Power Fx parity yet.

No AI features yet.

No Marketplace yet.

Next focus:

Workflow entity-change / record triggers (post 7.31).


---

# Success Definition

A user can:

Create App
↓
Create Screen
↓
Add Controls
↓
Save
↓
Publish
↓
Open Runtime
↓
Use Application

without writing code.
