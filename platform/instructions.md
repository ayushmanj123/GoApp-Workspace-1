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
Metadata
↓
Publish
↓
Version Snapshot
↓
Runtime Package
↓
Runtime

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

Phase 1:
Infrastructure

Status:
COMPLETE

---

Phase 2:
Metadata Service

Status:
IN PROGRESS

---

Phase 3:
Runtime Engine

Status:
IN PROGRESS

---

Phase 4:
Canvas Studio

Status:
NOT STARTED

---

Phase 5:
Formula Engine

Status:
NOT STARTED

---

Phase 6:
Publishing Pipeline

Status:
NOT STARTED

---

Phase 7:
Connector Framework

Status:
NOT STARTED

---

Phase 8:
Enterprise Features

Status:
NOT STARTED

---

# Current MVP Goal

User can:

1. Create Application
2. Create Screen
3. Create Controls
4. Save Metadata
5. Publish
6. Open Runtime
7. Interact with App

No Power Fx yet.

No AI features yet.

No Marketplace yet.

Focus entirely on:

Metadata → Runtime → Studio

before building advanced capabilities.

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
