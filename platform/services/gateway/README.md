# Gateway Service

API gateway with authentication middleware. Proxies authenticated requests to metadata and publish services.

## Run locally

```bash
cp .env.example .env
go run ./cmd/server
```

Default port: **8090**

## Authentication

- Development mode (`AUTH_MODE=development`): accepts `X-Tenant-Id` headers or `Bearer dev:<tenant>:<user>` tokens
- Production mode (`AUTH_MODE=keycloak`): Keycloak JWT validation (stub — not yet implemented)

Public routes: `/health`, `/ready`, `/live`

## Proxied routes

- `/api/v1/*` → metadata service (default)
- `/api/v1/applications/*/publish` and `/versions` → publish service
