# Publish Service

Public entry point for app publishing and version history. Proxies to the metadata service, which owns snapshot persistence.

## Run locally

```bash
cp .env.example .env
go run ./cmd/server
```

Default port: **8085**

Requires metadata service on **8082** (`METADATA_SERVICE_URL`).

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/applications/:id/publish` | Create released version + immutable snapshot |
| GET | `/api/v1/applications/:id/versions` | List version history |
| GET | `/api/v1/applications/:id/versions/:versionId` | Get version metadata |
