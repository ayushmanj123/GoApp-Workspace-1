# Database Manager

Studio’s Database Manager (`/studio/database`) is the Power Apps–style data platform for GoApps custom tables. Storage is **entity metadata** in the metadata service plus **JSONB `entity_records`** in shared Postgres (not per-table DDL). External Postgres databases remain under **Connectors**.

## Capabilities (Dataverse 1A parity)

| Area | Behavior |
|------|----------|
| Tables | Tenant-wide list, create (with primary `Name` column), edit properties (display/plural/description/primary), soft-delete |
| Columns | Types below; required/unique; delete (blocked for primary column) |
| Lookups | Many-to-one via `field_type=lookup` + `related_entity_id`; optional `delete_behavior` (`restrict` / `clear` / `cascade`) |
| Choices | `choice` / `choices` with local options |
| Keys | Alternate keys (`entity_keys`) enforced on record write |
| N:N | `entity_relationships` + `entity_record_links`; associate/disassociate APIs |
| Records | Editable grid in manager; create/update/delete; CSV import |
| Diagram | `/studio/database/diagram` ER canvas; Ctrl+click two tables → create lookup |

## Field types

`text`, `multiline`, `email`, `phone`, `url`, `number`, `integer`, `decimal`, `currency`, `boolean`, `date`, `datetime`, `choice`, `choices`, `lookup`

## Metadata API (gateway → metadata)

- `POST/GET /api/v1/applications/:appId/entities`
- `PUT/DELETE /api/v1/entities/:id`
- `GET /api/v1/entities/:entityId/dependents`
- `POST/GET /api/v1/entities/:entityId/fields`
- `PUT/DELETE /api/v1/entity-fields/:id`
- `POST/GET /api/v1/entities/:entityId/keys`
- `DELETE /api/v1/entity-keys/:id`
- `POST /api/v1/entity-relationships`
- `GET /api/v1/entities/:entityId/relationships`
- `DELETE /api/v1/entity-relationships/:id`

## Runtime record API

See [entity-record-api.md](./entity-record-api.md). Additional endpoints:

- `POST /api/entities/:entityId/records/import` (multipart `file`, `mapping` JSON, `dryRun`)
- `POST /api/relationships/:relationshipId/associate`
- `POST /api/relationships/:relationshipId/disassociate`
- `GET /api/relationships/:relationshipId/related/:recordId?side=left|right`

## Migrations

`000025_database_manager_parity` adds entity properties, rich types, `entity_keys`, `entity_relationships`, and `entity_record_links`.

## Out of scope

Model-driven Forms/Views/Charts, business rules, calculated/rollup columns, row/column security, Copilot, and merging SQL Connectors into this manager.
