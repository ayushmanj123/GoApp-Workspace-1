# Metadata Service

Stores app definitions, schemas, and platform metadata.

## Run locally

```bash
cp .env.example .env
go run ./cmd/server
```

## Health endpoints

- `GET /health` — liveness probe
- `GET /ready` — readiness probe

Default port: **8082**
