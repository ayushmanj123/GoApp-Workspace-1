# Workflows (Phase 7.23 / 7.24)

App-scoped linear automations hosted in the metadata service. Supports
**manual**, **schedule**, and **webhook** triggers with ordered
**connector_action** steps that call existing REST connector actions.

## Studio

1. Open **Workflow Manager** in the manager sidebar.
2. Select an application and click **+ New Workflow**.
3. Pick a REST connector + action (defaults to `list` when present).
4. On the detail page, choose a **Trigger** (Manual / Schedule / Webhook),
   add/reorder steps, **Save**, then **Test run**.
5. Inspect **Run history** for status, trigger source, and errors.

### Schedule

- 5-field cron (`minute hour dom month dow`) plus IANA timezone (default `UTC`).
- An in-process poller (every ~30s) claims due rows with
  `FOR UPDATE SKIP LOCKED` and runs them synchronously.
- Disable via the Enabled select (clears upcoming runs).

### Webhook

1. Set trigger to **Webhook**, save, then **Generate secret**.
2. Copy the plaintext secret once (it is not shown again).
3. `POST` the hook URL with `Authorization: Bearer <secret>`.

Example (via gateway, no Keycloak):

```bash
curl -X POST "http://localhost:8090/api/v1/public/workflows/<workflow-id>/hook" \
  -H "Authorization: Bearer <secret>" \
  -H "Content-Type: application/json" \
  -d '{"event":"example"}'
```

Direct metadata URL: `http://localhost:8082/api/v1/public/workflows/<id>/hook`.

Body size is capped at 64KB. A truncated payload is stored on the run for history.

## Definition

```json
{
  "trigger": { "type": "manual" },
  "steps": [
    {
      "id": "step-1",
      "type": "connector_action",
      "connector_id": "<uuid>",
      "action_name": "list",
      "body": { "optional": "json for POST/PUT/PATCH" }
    }
  ]
}
```

Schedule:

```json
{
  "trigger": {
    "type": "schedule",
    "cron": "0 */15 * * *",
    "timezone": "UTC",
    "enabled": true
  },
  "steps": [ ... ]
}
```

Webhook:

```json
{
  "trigger": { "type": "webhook", "enabled": true },
  "steps": [ ... ]
}
```

Constraints:

- Trigger type must be `manual`, `schedule`, or `webhook`.
- Step type must be `connector_action`.
- Connector must be `rest` and belong to the same application.
- Action must exist on that connector.
- Per-user OAuth connectors use the calling user’s connection; schedule and
  webhook runs have no user and fail with `connector_user_oauth_required`
  unless the connector uses app-scoped OAuth or header auth.
- Studio **Test run** (`POST /workflows/:id/run`) always works for any trigger type.

## Metadata APIs

Base: `http://localhost:8082/api/v1` (or via gateway `:8090`).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/applications/:appId/workflows` | JWT | Create |
| `GET` | `/applications/:appId/workflows` | JWT | List |
| `GET/PUT/DELETE` | `/workflows/:id` | JWT | Get / update / soft-delete |
| `POST` | `/workflows/:id/run` | JWT | Sync Test run (`trigger_source=manual`) |
| `GET` | `/workflows/:id/runs` | JWT | Run history |
| `POST` | `/workflows/:id/webhook-secret` | JWT | Generate/rotate webhook secret (plaintext once) |
| `POST` | `/public/workflows/:id/hook` | Bearer secret | Public webhook invoke |

Runs are synchronous: the HTTP request (or poller tick) waits until all steps
finish. Status is `succeeded` or `failed`. Result JSON includes per-step outcomes.
`trigger_source` is `manual`, `schedule`, or `webhook`.

## Tables

- `workflows` — definition jsonb plus denormalized schedule/webhook columns
- `workflow_runs` — status, trigger_source, trigger_payload, triggered_by, result

## Config

- `WORKFLOW_SCHEDULER_ENABLED` (default `true`) — start the in-process schedule poller.

## Validation

```bash
node infrastructure/scripts/validate-phase-7.24.mjs
```

## Out of scope

- Entity-change / record triggers
- Branching, loops, parallel steps
- Visual graph designer
- Redis job queue / separate `services/workflow`
- Mapping webhook JSON into step bodies
- Marketplace packaging of flows
- AI steps

See also: [REST connectors](./rest-connectors.md).
