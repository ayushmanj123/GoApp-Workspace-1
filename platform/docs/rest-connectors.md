# REST Connectors (Phases 7.1 + 7.3 + 7.5 + 7.10 + 7.13 + 7.21)

Minimal connector framework: REST datasources resolve through the same runtime `DataSource` registry as entities. Execution lives in the runtime service (not `services/connector`).

## Studio (Phase 7.3 + 7.5 + 7.10 + 7.21)

1. Open **Connectors** in the manager sidebar (after Database Manager).
2. Select an application and click **+ New Connector**.
3. Enter a name (e.g. `Weather`), base URL, and auth (`none`, static header, **OAuth client credentials**, or **OAuth authorization code**).
4. For header / OAuth secrets, enter the secret once — Studio never shows it again (write-only password field).
5. For authorization-code connectors: after create, open the connector and click **Connect** (or **Reconnect**) to authorize an **app-level** account once. All runtime users share that connection.
6. On the connector detail page, add a **`list`** action (`GET` + endpoint such as `/items`).
7. In Studio canvas, select a Gallery → **Data** tab → **Items datasource** picker → choose the connector name (or an entity).
8. Publish and **Open Runtime** — the gallery loads rows from the REST `list` action.

To rotate a key: open the connector, type a new value in the API key field, and Save. Leave the field empty to keep the existing secret.

The Data panel also lists connector names (click to copy). Advanced formulas remain available via **Edit formula**.

## Secrets (Phase 7.5 + 7.12)

Header API keys are stored in the metadata Postgres `secrets` table (AES-GCM), not in `connectors.auth_config`.

Environment-scoped overrides (Phase 7.12) store a separate ciphertext per
`(environment_id, base_secret_id)` in `environment_secret_overrides`. Runtime
decrypts the override when the session/query carries `environmentId`; otherwise
the app-default secret is used. See [enterprise-alm.md](./enterprise-alm.md).

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
| `POST` | `/connectors/:id/oauth/start` | Start OAuth authorization-code (PKCE); returns `authorize_url` |
| `GET` | `/connectors/oauth/callback` | IdP callback; exchanges code, stores refresh, redirects to Studio |

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

### OAuth authorization code (Phase 7.21 + 7.22)

**Dual ownership** via `auth_config.connection_scope`:

| Scope | Who Connects | Where refresh lives |
|-------|--------------|---------------------|
| `app` (default) | Designer once in Studio | Connector `refresh_secret_id` (shared) |
| `user` | Each runtime end user | `connector_user_connections` row per `(connector, user)` |

```json
{
  "name": "Graph",
  "connector_type": "rest",
  "authentication_type": "oauth_authorization_code",
  "base_url": "https://graph.microsoft.com/v1.0",
  "auth_config": {
    "type": "oauth_authorization_code",
    "connection_scope": "user",
    "authorization_url": "https://login.microsoftonline.com/.../oauth2/v2.0/authorize",
    "token_url": "https://login.microsoftonline.com/.../oauth2/v2.0/token",
    "client_id": "my-client",
    "client_secret": "secret",
    "scope": "offline_access User.Read"
  }
}
```

Flow:

1. `POST /connectors/:id/oauth/start` with `{ "return_to": "studio"|"runtime" }` → `{ authorize_url, state }` (PKCE `code_verifier` stored server-side; requires authenticated user).
2. Browser opens the IdP authorize URL (`response_type=code`, `code_challenge`, `state`).
3. IdP redirects to the platform callback with `code` + `state`.
4. Metadata exchanges the code (+ verifier) at `token_url`, encrypts the **refresh_token**:
   - `connection_scope=app` → connector `refresh_secret_id`
   - `connection_scope=user` → `connector_user_connections.refresh_secret_id` for that user
5. Redirects to Studio or Runtime with `?oauth=connected`.
6. Runtime uses `grant_type=refresh_token` → `Authorization: Bearer …`. For per-user connectors, missing consent returns stable error `connector_user_oauth_required`; the Runtime app shows a Connect banner.

Status / disconnect:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/connectors/:id/oauth/connection` | `{ connected, connection_scope }` for current user |
| `DELETE` | `/connectors/:id/oauth/connection` | Disconnect current user (or clear app refresh) |

Redirect URI (register this with the IdP):

```bash
OAUTH_CONNECTOR_REDIRECT_URI=http://localhost:8082/api/v1/connectors/oauth/callback
```

Optional return URLs after callback:

```bash
OAUTH_CONNECTOR_STUDIO_RETURN_URL=http://localhost:5173/studio/connectors
OAUTH_CONNECTOR_RUNTIME_RETURN_URL=http://localhost:5174/?oauth=connected
```

Env overrides (7.12) may still apply to `client_secret`; refresh tokens stay
app-default / user-default (no env-scoped refresh yet). Publish snapshots freeze
`connection_scope` + IdP config and may keep `refresh_secret_id` for app scope;
per-user rows are **never** frozen — runtime resolves them live by user id.

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

## Freezing connectors into publish snapshots (Phase 7.13)

Publishing an application now freezes its connectors + actions into
`application_snapshots.snapshot_json` alongside screens and entities.
`RuntimeApplication.connectors` (mirrored in `apps/runtime`'s
`runtime-types.ts` as `RuntimeConnector`) carries a **sanitized**
`auth_config`: `secret_id`, `refresh_secret_id`, `type`, `header_name`,
`token_url`, `authorization_url`, `client_id`, `scope`, `connection_scope`,
`table`, `primary_key`, `endpoint`, `bucket`, `access_key_id`, `use_ssl`, and
`prefix` are kept; `header_value`, `client_secret`, `connection_string`, and
`secret_access_key` are always stripped before the snapshot is written (the same
allowlist `redactAuthConfig` already used for API responses).

Runtime channel behavior:

- **Draft channel** (`?channel=draft`, or Studio's live preview) always
  resolves connector config from the live `connectors` / `connector_actions`
  tables, exactly as before.
- **Published channel** (default, or any `environmentId` session) resolves
  connector base URL, auth config, and actions from the frozen snapshot for
  the app's current version (or the environment's promoted version). Only
  the referenced secrets (`secret_id`, `refresh_secret_id`) are decrypted live —
  the frozen snapshot never contains plaintext secrets.

Editing a connector in Studio after publish only affects the draft channel
and the next publish; the already-published Open Runtime keeps using the
frozen config until the app is republished. If a connector is renamed or
removed after publish, name-based datasource resolution (`ResolveEntity`)
also falls back to the frozen snapshot so published sessions keep working.

## Validation

```bash
node infrastructure/scripts/validate-phase-7.5.mjs
node infrastructure/scripts/validate-phase-7.10.mjs
node infrastructure/scripts/validate-phase-7.12.mjs
node infrastructure/scripts/validate-phase-7.13.mjs
node infrastructure/scripts/validate-phase-7.21.mjs
node infrastructure/scripts/validate-phase-7.22.mjs
```

## Out of scope

- Multi-account picker / device flow / IdP discovery
- Env-scoped refresh tokens
- Vault / KMS rotation UI
- SharePoint / Salesforce connectors
- Execution via `services/connector` scaffold

See also: [SQL connectors](./sql-connectors.md), [Storage connectors](./storage-connectors.md).
