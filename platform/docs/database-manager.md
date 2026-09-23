# Database Manager

Studio’s Database Manager (`/studio/database`) is the Power Apps–style data platform for GoApps custom tables. Storage is **entity metadata** in the metadata service plus **JSONB `entity_records`** in shared Postgres (not per-table DDL). External Postgres databases remain under **Connectors**.

## Capabilities (Dataverse 1A parity)

| Area | Behavior |
|------|----------|
| Tables | Tenant-wide list, create (with primary `Name` column), edit properties (display/plural/description/primary), soft-delete with lookup-dependent warnings |
| Columns | Types below; required/unique; delete (blocked for primary column) |
| Lookups | Many-to-one via `field_type=lookup` + `related_entity_id`; optional `delete_behavior` (`restrict` / `clear` / `cascade`) |
| Choices | `choice` / `choices` with local options; multi-choice editor in records grid |
| Keys | Alternate keys (`entity_keys`) enforced on record write; conflicts surface field-level details |
| N:N | `entity_relationships` + `entity_record_links`; associate/disassociate from records view and diagram |
| Records | Editable grid; lookup picker by label; CSV/Excel import with dry-run gate |
| Diagram | `/studio/database/diagram` ER canvas; positions persist in `localStorage`; Connect creates **lookup** or **N:N** |

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

## Studio harden behaviors

- **Lookup picker:** related records loaded via `list`; cells show primary/`Name` labels, not raw UUIDs.
- **Validation details:** runtime `error.details` highlight conflicting unique/key fields in the records editor.
- **Import:** successful dry-run (0 failed rows) required before Import; full scrollable error list; `.xlsx` parsed client-side (`xlsx`) then sent as CSV.
- **Delete table:** shared confirm loads `listDependents` (property view, diagram, list overflow).
- **Diagram:** node positions under `goapps:diagram-layout`; Connect prompts for lookup vs N:N.

## Migrations

`000025_database_manager_parity` adds entity properties, rich types, `entity_keys`, `entity_relationships`, and `entity_record_links`.

## Out of scope

Model-driven Forms/Views/Charts, business rules, calculated/rollup columns, row/column security, Copilot, and merging SQL Connectors into this manager.
