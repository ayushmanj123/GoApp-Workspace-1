# Auth Service

Handles authentication and authorization integration with Keycloak for the GoApps Platform.

## Responsibilities (future)

- Token validation and user identity resolution
- OAuth2/OIDC flows for studio and runtime apps
- Role and permission enforcement

## Run locally

```bash
cp .env.example .env
go run ./cmd/server
```

## Health endpoints

- `GET /health` — liveness probe
- `GET /ready` — readiness probe

Default port: **8081**
