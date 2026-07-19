# SQL Connectors (Phases 7.6 + 7.9 + 7.16)

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
7. For Form / Patch writes (7.16): set **table** and **primary_key** (UUID column). Named-query-only connectors stay read-only.
8. Publish and Open Runtime.

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

`table` may be omitted when a named `list` action supplies the SELECT (list-only).
Writes require both `table` and `primary_key`.

**Named list action** (`connector_actions`):

| Field | Value |
|-------|--------|
| `action_name` | `list` |
| `http_method` | `GET` (required by schema; ignored at exec) |
| `endpoint` | `SELECT id, name FROM public.orders WHERE active = true` |

Runtime wraps the SELECT as `SELECT * FROM (<query>) AS goapps_named_q LIMIT $1 OFFSET $2`.

## Writes (Phase 7.16)

Table-bound connectors support Create / Update / Delete via:

- Form `SubmitForm` when the form datasource resolves to a SQL connector
- `Patch(OrdersDb, { recordId: "…", name: "…" })` (version optional; ignored for SQL)
- Datasource `Create` / `Update` / `Delete` APIs

Rules:

- Primary key values are UUIDs (matches runtime `DataSource` APIs).
- Column names must be safe SQL identifiers; values are bound as `$n` parameters.
- If Create omits the primary key column, runtime generates a UUID.
- Named-query-only connectors (no `table`) refuse writes with a clear error.

## Filters (Phase 7.18 / 7.19)

Table-bound list queries honor gallery / LookUp / Filter predicates (equals, comparisons, And/Or of leaves):

```sql
SELECT * FROM "public"."orders" WHERE "Status" = $1 AND "Region" = $2 LIMIT $3 OFFSET $4
SELECT * FROM "public"."orders" WHERE "Amount" > $1 OR "Status" = $2 LIMIT $3 OFFSET $4
```

Named-query (`list` SELECT) connectors ignore filter pushdown (query text is used as-is with paging wrap only).

## Safety

- Table names must be `identifier` or `schema.identifier` when set.
- Named queries must be a single `SELECT` / `WITH … SELECT` (no `;`, no writes).
- Write SQL never concatenates user values into the statement text.

## Validation

```bash
node infrastructure/scripts/validate-phase-7.6.mjs
node infrastructure/scripts/validate-phase-7.9.mjs
node infrastructure/scripts/validate-phase-7.16.mjs
node infrastructure/scripts/validate-phase-7.18.mjs
node infrastructure/scripts/validate-phase-7.19.mjs
node infrastructure/scripts/validate-phase-7.20.mjs
```

## Out of scope

- MySQL / other dialects
- Parameterized named filters (`$name`)
- Non-UUID primary keys
- Optimistic concurrency / version columns on SQL tables
- Writing through free-form named SQL text
- Filter pushdown into named-query SELECT text
