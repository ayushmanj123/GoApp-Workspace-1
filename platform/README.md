# GoApps Platform

Cloud-native low-code platform monorepo for building, publishing, and running management applications visually.

## Current status

Phases **1–6.1**, runtime hardening **6.9**, core-loop polish **7.0**, REST connectors **7.1**, Keycloak auth **7.2**, Studio connector designer **7.3**, auth trust-boundary hardening **7.4**, and enterprise ALM **8.0** are complete. Builders can create apps in Studio (via the gateway), configure REST connectors visually, bind galleries/forms to entities or connectors, publish/unpublish/rollback, promote environment versions, and run apps with development or Keycloak identity.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, TypeScript, Vite |
| Canvas | KonvaJS (Studio) |
| Editor | Monaco (formula editor) |
| Backend | Go, Fiber |
| Database | PostgreSQL |
| Cache / Event Bus | Redis |
| Object Storage | MinIO |
| Auth | Keycloak (dev mode uses `X-Tenant-Id` / `dev:` tokens) |
| Deployment | Docker, Kubernetes |
| CI/CD | GitHub Actions |

## Repository Structure

```
platform/
├── apps/           # Frontend applications (studio, runtime)
├── services/       # Go microservices
├── packages/       # Shared TypeScript and Go libraries
├── infrastructure/ # Docker, Kubernetes, scripts
├── docs/           # Architecture and development guides
└── .github/        # CI/CD workflows
```

## Quick Start

### Prerequisites

- Go 1.22+
- Node.js 20+
- pnpm 9+
- Docker and Docker Compose

### 1. Start infrastructure

```bash
cd infrastructure/docker
docker compose up -d
```

Or use the helper script:

```bash
./infrastructure/scripts/dev-up.sh
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your local values
```

### 3. Run a backend service

```bash
cd services/metadata
cp .env.example .env
go run ./cmd/server
curl http://localhost:8082/health
```

### 4. Run frontend apps

```bash
pnpm install
pnpm dev:studio   # Studio app on http://localhost:5173
pnpm dev:runtime  # Runtime app on http://localhost:5174
```

## Documentation

- [Architecture](docs/architecture.md)
- [Platform Hardening (Phase 6.9)](docs/platform-hardening.md)
- [Local Development](docs/local-development.md)
- [Services](docs/services.md)
- [Authentication](docs/authentication.md)
- [Sample Customer App](docs/sample-customer-app.md)

## Platform validation

```bash
node infrastructure/scripts/validate-platform.mjs
node infrastructure/scripts/validate-phase-7.0.mjs
```

## Service Ports

| Service | Port |
|---------|------|
| auth | 8081 |
| metadata | 8082 |
| runtime | 8083 |
| connector | 8084 |
| publish | 8085 |
| environment | 8086 |
| audit | 8087 |
| search | 8088 |
| gateway | 8090 |

## License

Proprietary — GoApps Platform
