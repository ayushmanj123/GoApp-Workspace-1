# GoApps Platform

Cloud-native low-code platform monorepo. This repository contains the foundation scaffold for building, deploying, and running GoApps applications.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, TypeScript, Vite |
| Canvas | KonvaJS (declared, not yet implemented) |
| Editor | Monaco (declared, not yet implemented) |
| Backend | Go, Fiber |
| Database | PostgreSQL |
| Cache / Event Bus | Redis |
| Object Storage | MinIO |
| Auth | Keycloak |
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
cd services/auth
cp .env.example .env
go run ./cmd/server
curl http://localhost:8081/health
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

## Platform validation

```bash
node infrastructure/scripts/validate-platform.mjs
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

## License

Proprietary — GoApps Platform
