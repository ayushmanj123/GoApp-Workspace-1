# Runtime Data Binding

The runtime data binding engine connects controls (Gallery, Form, DataTable, and future Patch/Submit/Lookup flows) to backend data through a generic `DataSource` abstraction. Controls declare datasource metadata; the runtime resolves that metadata into queries and returns JSON rows controls can bind directly.

## Architecture

```text
Control metadata
      ↓
Binding Resolver
      ↓
DataSource (Entity / REST / SQL)
      ↓
Record Service (entity only) / RestDataSource / SqlDataSource
      ↓
JSON rows
```

Runtime code never branches on provider type beyond the `DataSource` registry. Entity records are the first implementation; connectors implement the same interface.

## DataSource abstraction

```go
type DataSource interface {
    Kind() DataSourceKind
    Query(ctx, input) (*QueryResult, error)
    Get(...)
    Create(...)
    Update(...)
    Delete(...)
}
```

`EntityDataSource` delegates all CRUD operations to the existing record service. No duplicate record persistence logic exists in the binding package.

Supported kinds today:

| Kind | Provider | Status |
|------|----------|--------|
| `entity` | PostgreSQL `entity_records` via record service | Implemented |
| `rest` | External REST APIs | Implemented (Phases 7.1+) |
| `sql` | External Postgres table/view connectors | Implemented (Phase 7.6) |
| `google_sheets` | Google Sheets in Google Drive | Implemented (Excel Apps) |
| `sharepoint` | SharePoint lists | Future |

## Control metadata

Controls can declare binding metadata as a single JSON property or as individual properties on `control_properties`:

```json
{
  "dataSource": "Customers",
  "filter": "Status='Active'",
  "sort": "Name",
  "limit": 100
}
```

Resolution rules:

1. `dataSource` name must match an entity `name` on the target application.
2. `filter` supports shallow And/Or of comparison leaves (`=`, `<>`, `>`, `<`, `>=`, `<=`; quoted string or number) plus `Contains(Field,'text')` and `StartsWith(Field,'text')` for gallery search (Phase 7.28) — see Phase 7.19.
3. `sort` maps to record list `orderBy` (entity field name or `created_on`).
4. `limit` defaults to `50`, capped at `200`.

API query parameters override metadata defaults:

| Parameter | Description |
|-----------|-------------|
| `limit` | Page size |
| `offset` | Page offset |
| `filter` | Filter predicate expression |
| `sort` | Order by field |
| `order` | `asc` or `desc` |

## Runtime API

```http
GET /api/runtime/apps/{appId}/datasources/{name}
Authorization: Bearer dev:<tenant>:<user>
```

Example response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "recordId": "…",
        "entityId": "…",
        "version": 1,
        "Name": "Alice",
        "Status": "Active"
      }
    ],
    "count": 123
  }
}
```

`items` merge entity field values with `recordId`, `entityId`, and `version` so Gallery/Form controls can render and later patch records.

## Query execution

1. Authenticate request and read `TenantID` / `UserID` from `AuthContext`.
2. Resolve `appId` + datasource `name` to an entity in metadata.
3. Load control binding metadata (`dataBinding` or `dataSource` properties).
4. Merge metadata with request query parameters.
5. Select the `DataSource` implementation from the registry.
6. Execute `Query` and return `{ items, count }`.

Entity queries call `RecordService.List` with `FilterExpr` pushed into Postgres JSONB `WHERE` on `entity_records.data` (Phase 7.20). Filtered `Count` and `Limit`/`Offset` are applied in the database. Collection galleries still match in-memory; REST equals-And uses query params (richer predicates in-memory after fetch).

### Gallery/connector list filtering (Phase 7.15 / 7.19 / 7.20)

`gallery.Service.Load` (and `ReloadForSource`) read the gallery control's own `filter` property — `ReadFilterFormula` checks a `filter`-named formula binding first, then `Properties["filter"]` — and pass it through as `databinding.QueryOverrides.Filter` on the entity/REST/SQL query. Collection sources apply the same `ParseFilterExpr` matcher in-memory. An empty/absent control filter leaves any metadata-driven filter from `control_properties` untouched. Supported predicates: equals, `<>`/`>`/`<`/`>=`/`<=`, And/Or of leaves (see [gallery-runtime.md](./gallery-runtime.md)).

## DataTable / Gallery session binding

With an active runtime session, DataTable and Gallery prefer `GET /api/runtime/session/{sessionId}/gallery/{controlId}` (session `AllItems` cache). The React client hydrates entity **and** connector names into the collection store as a secondary path for bare `Items` formulas. `Refresh(DataSource)` and the DataTable Refresh button call `ReloadForSource` / `POST …/gallery/:controlId/reload` respectively (see [gallery-runtime.md](./gallery-runtime.md)).

## Per-request cache

Each HTTP request gets an in-memory cache (`RequestCacheMiddleware`). Repeated datasource queries with identical tenant, app, datasource, and normalized query input reuse the first result. This avoids duplicate database reads when multiple controls on the same screen request the same datasource during one render pass.

No Redis or cross-request cache is used.

## Gateway routing

The gateway proxies `/api/runtime/*` and `/api/entities/*/records*` to the runtime service (`RUNTIME_SERVICE_URL`, default `http://localhost:8083`).

## Future connector integration

REST and SQL connectors are implemented — see [rest-connectors.md](./rest-connectors.md) and [sql-connectors.md](./sql-connectors.md).

To add another connector-backed datasource:

1. Implement `DataSource` for the connector type.
2. Register it in `DataSourceRegistry`.
3. Extend metadata resolution to map datasource names to connector configuration.
4. Keep handlers and controls unchanged — they continue to call `/api/runtime/apps/{appId}/datasources/{name}`.

## Related docs

- [Entity Record API](./entity-record-api.md)
- [Authentication](./authentication.md)
- [REST connectors](./rest-connectors.md)
- [SQL connectors](./sql-connectors.md)
