# SQL Connectors (Phases 7.6 + 7.9)

Postgres table/view connectors and optional named SELECT queries. Gallery Items
bind by connector name. Execution lives in the runtime `SqlDataSource`.
Connection strings use Phase 7.5 encrypted secrets.

## Studio

1. Open **Connectors** → **+ New Connector**.
2. Choose type **SQL (Postgres)**.
3. Enter name, connection string, optional table (`public.orders` or `orders`), optional primary key.
4. Save — Studio never shows the connection string again (write-only).
5. **Named query (7.9):** open the connector → **+ Add Query** → action `list` with a SELECT statement.
   When a `list` action exists, runtime uses it instead of `SELECT * FROM table`.
6. Bind a Gallery **Items** datasource to the connector name.
7. Publish and Open Runtime.

To rotate the DSN: open the connector, type a new connection string, Save (leave empty to keep existing).

## Auth config shape

**Request (create/update):**

```json
{
  "name": "OrdersDb",
  "connector_type": "sql",
  "authentication_type": "connection_string",
  "auth_config": {
    "type": "connection_string",
    "connection_string": "postgres://user:pass@host:5432/db?sslmode=disable",
    "table": "public.orders",
    "primary_key": "id"
  }
}
```

`table` may be omitted when a named `list` action supplies the SELECT.

**Named list action** (`connector_actions`):

| Field | Value |
|-------|--------|
| `action_name` | `list` |
| `http_method` | `GET` (required by schema; ignored at exec) |
| `endpoint` | `SELECT id, name FROM public.orders WHERE active = true` |

Runtime wraps the SELECT as `SELECT * FROM (<query>) AS goapps_named_q LIMIT $1 OFFSET $2`.

## Safety

- Table names must be `identifier` or `schema.identifier` when set.
- Named queries must be a single `SELECT` / `WITH … SELECT` (no `;`, no writes).
- Create / Update / Delete against external tables are not supported yet.

## Validation

```bash
node infrastructure/scripts/validate-phase-7.6.mjs
node infrastructure/scripts/validate-phase-7.9.mjs
```

## Out of scope

- MySQL / other dialects
- Parameterized named filters (`$name`)
- Write CRUD to external tables
- Environment-scoped connection overrides
