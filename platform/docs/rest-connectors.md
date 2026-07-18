# REST Connectors (Phases 7.1 + 7.3 + 7.5 + 7.10)

Minimal connector framework: REST datasources resolve through the same runtime `DataSource` registry as entities. Execution lives in the runtime service (not `services/connector`).

## Studio (Phase 7.3 + 7.5 + 7.10)

1. Open **Connectors** in the manager sidebar (after Database Manager).
2. Select an application and click **+ New Connector**.
3. Enter a name (e.g. `Weather`), base URL, and auth (`none`, static header, or **OAuth client credentials**).
4. For header / OAuth secrets, enter the secret once — Studio never shows it again (write-only password field).
5. On the connector detail page, add a **`list`** action (`GET` + endpoint such as `/items`).
6. In Studio canvas, select a Gallery → **Data** tab → **Items datasource** picker → choose the connector name (or an entity).
7. Publish and **Open Runtime** — the gallery loads rows from the REST `list` action.

To rotate a key: open the connector, type a new value in the API key field, and Save. Leave the field empty to keep the existing secret.

The Data panel also lists connector names (click to copy). Advanced formulas remain available via **Edit formula**.

## Secrets (Phase 7.5)

Header API keys are stored in the metadata Postgres `secrets` table (AES-GCM), not in `connectors.auth_config`.

Persisted `auth_config` shape:

```json
{
  "type": "header",
  "header_name": "X-Api-Key",
  "secret_id": "<uuid>"
}
```

- Create/Update still accept optional `header_value` in the request body; the service encrypts it and writes `secret_id`.
- GET/list responses never return plaintext. They include `has_secret: true` and may include `secret_id`.
- Runtime loads the secret by `secret_id`, decrypts with `SECRETS_MASTER_KEY`, and attaches the header.
- Legacy connectors that still have `header_value` in JSON continue to work (compat); the next Studio save migrates them into `secrets`.

Set the same key on metadata and runtime:

```bash
SECRETS_MASTER_KEY=<32-byte key as raw, base64, or hex>
```

In development, if unset, a documented default key is used (not for production).

## Metadata APIs

Base: `http://localhost:8082/api/v1` with `X-Tenant-Id` (or bearer auth via gateway).

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/applications/:appId/connectors` | Create connector |
| `GET` | `/applications/:appId/connectors` | List connectors |
| `GET` | `/connectors/:id` | Get connector |
| `PUT` | `/connectors/:id` | Update connector |
| `DELETE` | `/connectors/:id` | Soft-delete connector |
| `POST` | `/connectors/:connectorId/actions` | Create action |
| `GET` | `/connectors/:connectorId/actions` | List actions |
| `PUT` | `/connector-actions/:id` | Update action |
| `DELETE` | `/connector-actions/:id` | Soft-delete action |

### Create connector (header secret)

```json
{
  "name": "Weather",
  "connector_type": "rest",
  "authentication_type": "header",
  "base_url": "https://api.example.com",
  "auth_config": {
    "type": "header",
    "header_name": "X-Api-Key",
    "header_value": "secret"
  }
}
```

Response `auth_config` contains `secret_id` (not `header_value`) and `has_secret: true`.

### OAuth client credentials (Phase 7.10)

```json
{
  "name": "CRM",
  "connector_type": "rest",
  "authentication_type": "oauth_client_credentials",
  "base_url": "https://api.example.com",
  "auth_config": {
    "type": "oauth_client_credentials",
    "token_url": "https://idp.example.com/oauth/token",
    "client_id": "my-client",
    "client_secret": "secret",
    "scope": "read"
  }
}
```

Persisted shape stores `secret_id` instead of `client_secret`. Runtime POSTs
`grant_type=client_credentials` to `token_url`, caches the access token in-process,
and sends `Authorization: Bearer …` on connector calls.

### Create list action

```json
{
  "action_name": "list",
  "http_method": "GET",
  "endpoint": "/items"
}
```

Convention action names: `list`, `get`, `create`, `update`, `delete`. Use `{id}` or `:id` in endpoints for record-level calls.

## Runtime binding

Set a Gallery `Items` formula to the connector name (e.g. `Weather`). The resolver falls back from entities to REST connectors by name.

## Validation

```bash
node infrastructure/scripts/validate-phase-7.5.mjs
node infrastructure/scripts/validate-phase-7.10.mjs
```

## Out of scope

- OAuth authorization-code / PKCE / refresh tokens
- Vault / environment-scoped secret promotion
- SharePoint / Salesforce connectors
- Freezing connectors into publish snapshots (runtime reads live metadata DB)
- Execution via `services/connector` scaffold

See also: [SQL connectors](./sql-connectors.md), [Storage connectors](./storage-connectors.md).
