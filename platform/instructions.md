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
| 3 | Runtime Engine | COMPLETE (client-side `apps/runtime`; Go service health-only) |
| 4 | Canvas Studio | COMPLETE (Konva, Monaco, explorer, layers) |
| 5 | Formula Engine | COMPLETE (literal + remote Power Fx, actions, forms) |
| 6.0 | Entity Foundation | COMPLETE |
| 6.1 | Publishing Pipeline | COMPLETE |
| 7 | Connector Framework | NOT STARTED |
| 8 | Enterprise Features | NOT STARTED |

---

# Granular Validation Milestones

Acceptance scripts live in `infrastructure/scripts/validate-phase-*.mjs`.

Granular sub-phases use different numbering than macro phases:

- **4.3.8 → 4.33** — Studio chrome, canvas, formulas, actions, gallery, forms, timer, components
- **5.0 → 5.2** — Explorer tree, layers UX, Monaco formula editor
- **6.0** — Entity foundation (schema + Studio + runtime package)
- **6.1** — Publishing pipeline (immutable snapshots + publish service)

Run: `node infrastructure/scripts/validate-phase-6.1.mjs`

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

Connectors → Enterprise features

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
