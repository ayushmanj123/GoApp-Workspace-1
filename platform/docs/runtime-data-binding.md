# Runtime Data Binding

The runtime data binding engine connects controls (Gallery, Form, DataTable, and future Patch/Submit/Lookup flows) to backend data through a generic `DataSource` abstraction. Controls declare datasource metadata; the runtime resolves that metadata into queries and returns JSON rows controls can bind directly.

## Architecture

```text
Control metadata
      ↓
Binding Resolver
      ↓
DataSource (Entity today; REST/SQL/SharePoint later)
      ↓
Record Service (entity only)
      ↓
JSON rows
```

Runtime code never branches on provider type beyond the `DataSource` registry. Entity records are the first implementation; future connectors implement the same interface.

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
| `rest` | External REST APIs | Future |
| `sql` | SQL connectors | Future |
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
2. `filter` supports a single equals expression: `Field='Value'` (v1 only).
3. `sort` maps to record list `orderBy` (entity field name or `created_on`).
4. `limit` defaults to `50`, capped at `200`.

API query parameters override metadata defaults:

| Parameter | Description |
|-----------|-------------|
| `limit` | Page size |
| `offset` | Page offset |
| `filter` | Equals filter expression |
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

Entity queries call `RecordService.List`, then apply equals filters in memory (v1 constraint while Power Fx and SQL-side filtering are deferred). Paging is applied after filtering.

## Per-request cache

Each HTTP request gets an in-memory cache (`RequestCacheMiddleware`). Repeated datasource queries with identical tenant, app, datasource, and normalized query input reuse the first result. This avoids duplicate database reads when multiple controls on the same screen request the same datasource during one render pass.

No Redis or cross-request cache is used.

## Gateway routing

The gateway proxies `/api/runtime/*` and `/api/entities/*/records*` to the runtime service (`RUNTIME_SERVICE_URL`, default `http://localhost:8083`).

## Future connector integration

To add a connector-backed datasource later:

1. Implement `DataSource` for the connector type.
2. Register it in `DataSourceRegistry`.
3. Extend metadata resolution to map datasource names to connector configuration.
4. Keep handlers and controls unchanged — they continue to call `/api/runtime/apps/{appId}/datasources/{name}`.

## Related docs

- [Entity Record API](./entity-record-api.md)
- [Authentication](./authentication.md)
