# Phase 8.0 — Enterprise ALM

Application lifecycle management on top of the Phase 6.1 publishing pipeline:
unpublish, rollback, deprecate, per-application environments with version
promotion, and an append-only audit trail.

## Publish ALM operations

Metadata service (`services/metadata`, domain logic + persistence, `:8082`)
and Publish service (`services/publish`, public proxy, `:8085`) both expose:

| Method | Path | Effect |
|--------|------|--------|
| `POST` | `/api/v1/applications/:id/publish` | Create a new immutable version + snapshot; app becomes `published` |
| `POST` | `/api/v1/applications/:id/unpublish` | Clear `applications.current_version_id`; app becomes `draft`. Versions, snapshots, and MinIO publish artifacts are kept (pointer-only; never GC). |
| `GET`  | `/api/v1/applications/:id/versions` | List versions |
| `GET`  | `/api/v1/applications/:id/versions/:versionId` | Get one version + manifest |
| `POST` | `/api/v1/applications/:id/versions/:versionId/rollback` | Point `current_version_id` at a previously `released` version; app becomes `published` again |
| `POST` | `/api/v1/applications/:id/versions/:versionId/deprecate` | Set `application_versions.status = deprecated`. If it was the current version, the application's pointer is cleared and it reverts to `draft`. When the version is unreferenced by the app and every environment, best-effort MinIO GC may delete that version's publish artifact and `packages` row (`snapshot_json` is kept). |

Rules enforced by `PublishService` (`internal/services/publish_service.go`):

- `rollback` requires the target version to belong to the application, have
  `status = released`, and have an existing immutable snapshot — the same
  guarantee the `published` runtime channel relies on.
- `deprecate` never deletes a version row; it only flips its status and, if
  necessary, detaches the application's current pointer so runtime traffic
  stops resolving to it. Separately, Phase 8.2 may best-effort delete the
  MinIO publish blob (and `packages` metadata) when the version is no longer
  referenced by `applications.current_version_id` or any
  `environments.current_version_id`. `application_snapshots.snapshot_json` is
  never deleted.
- `unpublish` is non-destructive: it only touches the application row and
  never garbage-collects MinIO artifacts (envs may still point at versions).

## Publish artifacts (Phases 8.1 / 8.2)

On publish, the metadata service uploads the snapshot JSON to MinIO and records
`packages.package_url` / `packages.package_hash` (Phase 8.1). Runtime prefers
the artifact and falls back to `snapshot_json`.

Artifact lifecycle (Phase 8.2):

| Operation | Blob GC? |
|-----------|----------|
| Unpublish | No — pointer-only |
| Deprecate (version still referenced by app or any environment) | No |
| Deprecate (unreferenced) | Yes — best-effort `RemoveObject` + delete `packages` row; keep `snapshot_json` |

GC failures are logged and never fail Deprecate (same soft-fail policy as
upload on publish).

The Publish service (`services/publish`) is a thin HTTP proxy — it forwards
these calls to the metadata service with the tenant/request headers intact
(see `internal/client/metadata_client.go`, `internal/handlers/publish_handler.go`).

Studio wires all six operations through `apps/studio/src/api/publish-api.ts`
(`publish`, `unpublish`, `rollback`, `deprecate`, `listVersions`).

### Studio Versions UI (Phase 7.8)

Apps dashboard `AppCard` exposes a **Versions** button that opens
`VersionsModal`:

- Lists all versions with status badges (`current` / `released` / `deprecated`)
- **Rollback** on a non-current `released` version
- **Deprecate** on any non-deprecated version (current → app reverts to draft)
- **Unpublish** remains on the card footer

## Environments

Environments are per-application deployment targets (`development`, `test`,
`production`) that track their own promoted version, independent of the
application's global `current_version_id`. This lets a team stage a release
in `test` before promoting the same version to `production`.

Metadata service routes (`internal/api/handlers/environment_handler.go`):

| Method | Path | Effect |
|--------|------|--------|
| `GET`  | `/api/v1/applications/:appId/environments` | List environments for an application |
| `POST` | `/api/v1/applications/:appId/environments` | Create an environment (`name`, `environment_type`) |
| `GET`  | `/api/v1/applications/:appId/environments/:envId` | Get one environment |
| `PUT`  | `/api/v1/applications/:appId/environments/:envId` | Update name / type |
| `DELETE` | `/api/v1/applications/:appId/environments/:envId` | Delete an environment |
| `POST` | `/api/v1/applications/:appId/environments/:envId/promote` | Body `{ "version_id": "..." }` — point the environment's `current_version_id` at a `released` version |

Data model: `environments.current_version_id` (nullable UUID FK, composite
`(tenant_id, current_version_id) → application_versions(tenant_id, id)`,
`ON DELETE SET NULL`) — see migration
`services/metadata/internal/database/migrations/000015_environment_current_version.up.sql`.

Following the same pattern as solution packages, there is no separate
`services/environment` proxy — Studio talks to the metadata service directly
via `apps/studio/src/api/environments-api.ts`. The `services/environment`
module remains a thin scaffold for future use (secrets, per-env config).

Studio UI: `/studio/environments` renders `EnvironmentsManagerPage`
(`apps/studio/src/components/manager/environments/`), replacing the old
stub page. It lists environments per application with create, delete,
"Promote", and **Open** (runtime with that environment's promoted snapshot).

### Runtime package by environment

`GET /api/v1/runtime/applications/:id?environmentId=<uuid>` resolves the
package from the environment's `current_version_id` (same snapshot assembly as
the published channel). When `environmentId` is absent, existing
`channel=draft|published` behavior is unchanged.

Studio entry points:

- App card **Open Runtime** menu: Published (`/apps/:id`) or an environment
  (`/apps/:id?environmentId=…`) on the runtime origin (`:5174`)
- Environments page **Open** button per row (disabled until promoted)

## Audit trail

`AuditService` (`internal/services/audit_service.go`) appends rows to the
existing `audit_logs` table via the tenant-scoped store, so the append-only
trigger and row-level security policies from migration `000002_enable_rls`
apply exactly as they do for every other metadata table.

| Method | Path | Effect |
|--------|------|--------|
| `POST` | `/api/v1/audit-events` | Append one event (`action`, `resource_type`, `resource_id`, optional `user_id`) |
| `GET`  | `/api/v1/audit-events` | List events for the tenant, most recent first |

`audit_logs` has no update/delete endpoint by design — the table is
append-only at the database level.

## Environment-scoped connector secrets (Phase 7.12)

Connectors still store one app-level `secret_id` in `auth_config`. Per-environment
overrides live in `environment_secret_overrides` (AES-GCM, same master key).

| Method | Path | Effect |
|--------|------|--------|
| `GET` | `/api/v1/applications/:appId/environments/:envId/secret-overrides` | List connectors that have a base secret; `has_override` when set |
| `PUT` | `/api/v1/applications/:appId/environments/:envId/secret-overrides` | Upsert override `{ connector_id, value }` (write-only) |
| `DELETE` | `/api/v1/applications/:appId/environments/:envId/secret-overrides/:connectorId` | Remove override (falls back to app-default) |

Studio: Environments → **Secrets** on an environment row.

Runtime: pass `?environmentId=` when opening the app (and on session start).
Connector queries decrypt the env override when present, otherwise the base secret.

Audit writes are hooked directly into the ALM handlers (same Go process, same
tenant context — no HTTP round-trip):

- `publish_handler.go` records `publish`, `unpublish`, `rollback`, `deprecate`
- `environment_handler.go` records `promote`

A best-effort acting-user id is read from `X-User-Id` / `Locals("user_id")`
(`internal/api/tenant.GetUserID`) and is `nil` until JWT auth (Phase 7.2)
populates it — audit writes never fail the underlying ALM operation.

`services/audit` remains a thin scaffold, matching `services/environment`;
writes go straight through the metadata store so RLS/tenant isolation apply.

## Testing

Go unit tests cover the new service methods against the in-memory fake store:

- `services/metadata/internal/services/publish_service_test.go` — unpublish,
  rollback (including cross-application rejection), deprecate
- `services/metadata/internal/services/environment_service_test.go` — create/
  list/get, promote (rejects non-released versions), tenant/application scoping
- `services/metadata/internal/services/audit_service_test.go` — record + list

Run: `go test ./internal/services/...` from `services/metadata`.
