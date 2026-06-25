# Runtime Service

Executes published GoApps at runtime.

## Run locally

```bash
cp .env.example .env
go run ./cmd/server
```

Default port: **8083**

## Health & observability

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness summary |
| `GET /live` | Process alive (used by validation scripts) |
| `GET /ready` | Readiness — pings PostgreSQL when configured |
| `GET /readiness` | Alias of `/ready` |
| `GET /metrics` | Prometheus scrape endpoint |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8083` | HTTP listen port |
| `SESSION_TTL` | `30m` | Idle session expiration |
| `SESSION_MAX` | `0` | Max concurrent sessions (`0` = unlimited) |
| `METADATA_CACHE_TTL` | `5m` | Metadata loader cache TTL |
| `METRICS_ENABLED` | `true` | Expose `/metrics` and HTTP latency histograms |
| `DATABASE_URL` | — | PostgreSQL connection (required for full runtime) |

## Validation

```bash
node infrastructure/scripts/validate-platform.mjs
```
