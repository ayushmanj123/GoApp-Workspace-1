# Local Development Guide

## Prerequisites

- Go 1.22+
- Node.js 20+
- pnpm 9+
- Docker and Docker Compose

## 1. Clone and configure

```bash
cd platform
cp .env.example .env
```

Edit `.env` with your local values. Default placeholders work with Docker Compose.

## 2. Start infrastructure

```bash
cd infrastructure/docker
docker compose up -d
```

Or from the repo root:

```bash
bash infrastructure/scripts/dev-up.sh
```

Wait for all containers to become healthy:

```bash
docker compose -f infrastructure/docker/docker-compose.yml ps
```

### Service endpoints

| Service | URL |
|---------|-----|
| PostgreSQL | `postgres://goapps:changeme@localhost:5432/goapps` |
| Redis | `redis://localhost:6379` |
| MinIO API | `http://localhost:9000` |
| MinIO Console | `http://localhost:9001` |
| Keycloak | `http://localhost:8080` |

Keycloak admin: `admin` / `changeme` (from `.env`).

## 3. Run backend services

Each service reads configuration from environment variables:

```bash
cd services/auth
cp .env.example .env
go run ./cmd/server
```

Verify health:

```bash
curl http://localhost:8081/health
curl http://localhost:8081/ready
```

Expected response:

```json
{
  "success": true,
  "data": { "status": "ok", "service": "auth-service" },
  "meta": { "requestId": "...", "timestamp": "..." }
}
```

Repeat for other services on ports 8082–8088.

## 4. Run frontend apps

```bash
pnpm install
pnpm dev:studio    # http://localhost:5173
pnpm dev:runtime   # http://localhost:5174
```

## 5. Run tests

```bash
# Go
go work sync
cd packages/shared/go && go test ./...

# TypeScript
pnpm typecheck
pnpm build
```

## 6. Stop infrastructure

```bash
bash infrastructure/scripts/dev-down.sh
```

## Building service Docker images

From the monorepo root:

```bash
docker build -f infrastructure/docker/services/auth/Dockerfile -t goapps/auth-service .
```

## Troubleshooting

- **Keycloak slow start**: Keycloak may take 60+ seconds on first boot while importing the realm.
- **Port conflicts**: Adjust ports in `.env` and `docker-compose.override.yml`.
- **PostgreSQL init**: The init script runs only on first volume creation. Reset with `docker compose down -v`.
