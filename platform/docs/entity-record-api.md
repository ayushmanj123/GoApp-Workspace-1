# Entity Record API

Generic CRUD API for entity records in the runtime service. All entities share a single `entity_records` table with JSONB payloads validated against metadata from `entities` and `entity_fields`.

## Base URL

- **Runtime service (direct):** `http://localhost:8083`
- **Gateway (recommended):** `http://localhost:8090`

All endpoints require authentication. `TenantID` and `UserID` are taken from `AuthContext` only (never from handler-level `X-Tenant-Id` reads).

### Development auth

Bearer dev token:

```http
Authorization: Bearer dev:<tenant_uuid>:<user_uuid>[:email]
```

Or, when `AUTH_MODE=development`, gateway/runtime auth middleware accepts `X-Tenant-Id` and optional `X-User-Id` headers and builds `AuthContext` before handlers run.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/entities/{entityId}/records` | Create a record |
| `GET` | `/api/entities/{entityId}/records` | List records |
| `GET` | `/api/entities/{entityId}/records/{recordId}` | Get one record |
| `PATCH` | `/api/entities/{entityId}/records/{recordId}` | Update a record |
| `DELETE` | `/api/entities/{entityId}/records/{recordId}` | Soft-delete a record |

## Request / response envelope

Responses use the shared platform envelope:

```json
{
  "success": true,
  "data": { },
  "meta": {
    "requestId": "…",
    "timestamp": "2026-06-25T12:00:00Z"
  }
}
```

Errors:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "name: required field missing"
  },
  "meta": { "requestId": "…", "timestamp": "…" }
}
```

## Record JSON format

### Create (`POST`)

```json
{
  "data": {
    "name": "Alice",
    "age": 30,
    "active": true
  }
}
```

### Record response

```json
{
  "recordId": "uuid",
  "entityId": "uuid",
  "tenantId": "uuid",
  "data": {
    "name": "Alice",
    "age": 30
  },
  "version": 1,
  "createdOn": "2026-06-25T12:00:00Z",
  "createdBy": "uuid",
  "modifiedOn": "2026-06-25T12:00:00Z",
  "modifiedBy": "uuid"
}
```

Field values must match entity field types:

| Field type | JSON type | Notes |
|------------|-----------|-------|
| `text` | string | |
| `number` | number | integer or float |
| `boolean` | boolean | |
| `date` | string | `YYYY-MM-DD` |
| `lookup` | string | UUID of a record in the field's `related_entity_id` entity (many-to-one relationship) |

### List (`GET`)

Query parameters:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `limit` | `50` | Max `200` |
| `offset` | `0` | Pagination offset |
| `orderBy` | `created_on` | `created_on`, `modified_on`, `version`, or a schema field name |
| `orderDirection` | `desc` | `asc` or `desc` |

Response `data`:

```json
{
  "items": [ { "recordId": "…", "data": { } } ],
  "totalCount": 42
}
```

### Update (`PATCH`)

Partial update with optimistic concurrency:

```json
{
  "version": 1,
  "data": {
    "age": 31
  }
}
```

- `version` is required and must match the current record version.
- Only fields present in `data` are updated; the merged record is re-validated (required fields, types, unknown fields).

### Delete (`DELETE`)

Returns `204 No Content`. The row is not removed; `deleted_on` and `deleted_by` are set. Deleted records are excluded from list/get.

## Validation

Before create or update, the runtime service:

1. Loads the entity and its fields for the authenticated tenant.
2. Rejects requests when the entity does not exist (`404`).
3. Rejects unknown field names (`400`).
4. Enforces `is_required` fields from `entity_fields` on create and after merge on update.
5. Validates value types against `field_type`.

## Relationships (lookup fields)

Phase 7.14 adds minimal many-to-one relationships via a `lookup` field type — no separate
graph/relationship designer. An entity field with `field_type: "lookup"` carries a
`related_entity_id` (uuid) pointing at another entity in the same tenant. Record values for a
`lookup` field are the uuid of the related entity's record (validated as a UUID string, not
resolved/joined by the runtime service).

Metadata service field CRUD (`POST /entities/:entityId/fields`, `PUT /entity-fields/:id`) accepts
an optional `related_entity_id`, required when `field_type` is `lookup` and cleared automatically
if the field type changes away from `lookup`. Studio's Database Manager surfaces these as a
"Relationships" panel on each table (list of lookup fields + related table, and a
"New relationship" action that creates a lookup field against another table).

## Storage

Single table `entity_records`:

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Record ID |
| `tenant_id` | uuid | Tenant scope |
| `entity_id` | uuid | Entity schema reference |
| `data` | jsonb | Field values |
| `version` | int | Optimistic concurrency token |
| `created_on` / `created_by` | | Audit |
| `modified_on` / `modified_by` | | Audit |
| `deleted_on` / `deleted_by` | | Soft delete |

Migrations live in the metadata service (`000010_entity_records`, `000011_entity_fields_is_required`, `000018_entity_lookup_fields`) because metadata and runtime share one PostgreSQL database.

## Optimistic concurrency

- New records start at `version: 1`.
- Each successful `PATCH` increments `version`.
- If the supplied `version` does not match the stored value, the API returns `409 Conflict` with code `VERSION_CONFLICT`.

## Tenant isolation

Every query filters by `tenant_id` from `AuthContext`. Records from other tenants are not visible and cannot be updated or deleted.

## Gateway routing

The gateway proxies `/api/entities/*/records*` to the runtime service (`RUNTIME_SERVICE_URL`, default `http://localhost:8083`). Other `/api/*` routes continue to metadata or publish.
