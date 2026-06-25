# Services Reference

## Backend Services

All services expose standard health endpoints and use the shared API response envelope.

| Service | Module | Default Port | Health |
|---------|--------|-------------|--------|
| auth | `services/auth` | 8081 | `GET /health`, `GET /ready` |
| metadata | `services/metadata` | 8082 | `GET /health`, `GET /ready` |
| runtime | `services/runtime` | 8083 | `GET /health`, `GET /ready`, `GET /readiness`, `GET /live`, `GET /metrics`, records, kernel session, renderer |
| connector | `services/connector` | 8084 | `GET /health`, `GET /ready` |
| publish | `services/publish` | 8085 | `GET /health`, `GET /ready` |
| environment | `services/environment` | 8086 | `GET /health`, `GET /ready` |
| audit | `services/audit` | 8087 | `GET /health`, `GET /ready` |
| search | `services/search` | 8088 | `GET /health`, `GET /ready` |
| gateway | `services/gateway` | 8090 | `GET /health`, `GET /ready`, `GET /live` |

## Environment Variables

All services share these base variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SERVICE_NAME` | Yes | — | Service identifier for logs and health |
| `PORT` | No | `8080` | HTTP listen port |
| `APP_ENV` | No | `development` | Environment name |
| `LOG_LEVEL` | No | `info` | Log verbosity |
| `DATABASE_URL` | No | — | PostgreSQL connection (future) |
| `REDIS_URL` | No | — | Redis connection (future) |

## Frontend Apps

| App | Package | Dev Port | Description |
|-----|---------|----------|-------------|
| Studio | `@goapps/studio` | 5173 | Low-code app builder |
| Runtime | `@goapps/runtime` | 5174 | Published app shell |

## Shared Packages

| Package | Language | Description |
|---------|----------|-------------|
| `@goapps/shared` | TypeScript | API types, tenant context |
| `@goapps/sdk` | TypeScript | HTTP client skeleton |
| `@goapps/ui` | TypeScript | UI component library (scaffold) |
| `@goapps/config` | TypeScript | Shared TS/ESLint/Prettier config |
| `github.com/goapps-platform/shared` | Go | Logging, errors, response, tenant, middleware |

## Quick health check (all services)

```bash
for port in 8081 8082 8083 8084 8085 8086 8087 8088; do
  echo "Port $port:"
  curl -s "http://localhost:$port/health" | head -c 200
  echo
done
```
