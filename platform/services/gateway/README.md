# Gateway Service

API gateway with authentication middleware. Proxies authenticated requests to metadata, publish, and runtime services.

## Run locally

```bash
cp .env.example .env
go run ./cmd/server
```

Default port: **8090**

Studio and Runtime Vite proxies target this gateway in development (`AUTH_MODE` should match `VITE_AUTH_MODE`).

## Authentication

- **Development** (`AUTH_MODE=development`): accepts `X-Tenant-Id` headers or `Bearer dev:<tenant>:<user>[:email]` tokens
- **Keycloak** (`AUTH_MODE=keycloak`): validates RS256 JWTs via Keycloak JWKS (`KEYCLOAK_URL` / `KEYCLOAK_REALM` / audience)

Public routes: `/health`, `/ready`, `/live`

Authenticated identity is injected as `X-Tenant-Id` / `X-User-Id` / `X-User-Email` when proxying upstream. Upstream services also run auth middleware (defense in depth).

## Proxied routes

| Path pattern | Upstream |
|--------------|----------|
| `/api/v1/*` (default) | metadata `:8082` |
| paths containing `/publish` or `/versions` | publish `:8085` |
| `/api/runtime/*` and entity `/records` | runtime `:8083` |
