# Runtime Kernel

The runtime kernel (`services/runtime/internal/kernel`) wires the existing runtime services into one execution pipeline. All orchestration flows through `RuntimeKernel`; individual services do not call each other directly.

## Kernel responsibilities

`RuntimeKernel` owns:

| Component | Package | Role |
|-----------|---------|------|
| State manager | `state` | Per-session variables, collections, screen context |
| Formula runtime | `formula` | Action and expression evaluation |
| Data source registry | `databinding` | Entity datasource access for formulas |
| Reactive engine | `reactive` | Dependency graph and targeted refresh instructions |
| Navigation service | `reactive` | Publishes navigation events (no UI rendering) |
| Session manager | `kernel` | Active sessions, metadata cache, TTL cleanup |
| Metadata loader | `kernel` | Loads application metadata once per session |

The kernel also resolves datasource bindings through the existing `databinding.Resolver`.

## Runtime lifecycle

```text
POST /api/runtime/session
        ↓
Create state session
        ↓
Load & cache metadata (once)
        ↓
Register reactive dependencies
        ↓
Execute App.OnStart (if present)
        ↓
Execute Screen.OnVisible (when initial screen provided)
        ↓
Return sessionId + refresh[]
```

## Session lifecycle

Each session stores:

- `sessionId`, `appId`, tenant and user identity
- Cached `Package` (screens, controls, formulas, entities)
- Isolated `FormulaStateManager`
- Registered control dependencies for the reactive engine
- `lastActive` timestamp for TTL expiration

Inactive sessions expire after 30 minutes by default (`SESSION_TTL` env var, or `Registry.SessionTTL`). Optional `SESSION_MAX` caps concurrent sessions. Expiration releases:

- In-memory state (`state.MemoryStore`)
- Reactive subscriptions and dependency graph
- Cached metadata reference on the session

A background cleanup goroutine runs automatically when the runtime server starts (`RuntimeKernel.StartCleanup` in `server.New`).

Metadata is loaded once per session from a short-lived cache (`CachedMetadataLoader`) keyed by tenant, app, and channel to avoid repeated database reads.

## Screen and control lifecycle

Execution order:

```text
App.OnStart
        ↓
Screen.OnVisible
        ↓
Control events (OnSelect, OnChange, …)
        ↓
Reactive refresh resolution
```

| Event | Source | Trigger |
|-------|--------|---------|
| `OnStart` | Application metadata | Session start |
| `OnVisible` | Screen metadata | Session start (initial screen) or control event |
| `OnHidden` | Screen/control | Acknowledged; no formula required |
| `OnSelect` | Control formula (`onSelect`) | Control event API |
| `OnChange` | Control formula (`onChange`) | Control event API |

Event names map to formula property names (`OnSelect` → `onSelect`).

## Event pipeline

```text
POST /api/runtime/session/{sessionId}/event
        ↓
Lookup control/screen formula
        ↓
Build RuntimeFormulaContext
        ↓
Formula Evaluator
        ↓
State / DataSource updates
        ↓
Reactive Engine (VariableChanged, CollectionChanged, …)
        ↓
Merge refresh instructions
        ↓
JSON response { result, refresh[] }
```

### Start session

```http
POST /api/runtime/session
Authorization: Bearer dev:<tenant>:<user>

{
  "appId": "00000000-0000-4000-8000-000000000003",
  "channel": "draft",
  "screen": "Home"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "sessionId": "…",
    "appId": "…",
    "refresh": [
      { "controlId": "lblStatus", "reason": "VariableChanged" }
    ]
  }
}
```

### Control event

```http
POST /api/runtime/session/{sessionId}/event

{
  "appId": "00000000-0000-4000-8000-000000000003",
  "controlId": "btnSave",
  "event": "OnSelect",
  "screen": "Home"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "result": true,
    "refresh": [
      { "controlId": "lblStatus", "reason": "VariableChanged" }
    ]
  }
}
```

For screen visibility without a control, omit `controlId` and send `"event": "OnVisible"` with `"screen": "Home"`.

## Metadata cache

Metadata is loaded through `MetadataLoader` when a session starts. The default implementation (`PostgresMetadataLoader`) reads applications, screens, controls, formulas, properties, and entities from the shared PostgreSQL database.

The loaded `Package` is stored on the session. Subsequent events use the in-memory cache — no repeated database reads for the same session.

## Package layout

| File | Purpose |
|------|---------|
| `kernel.go` | `RuntimeKernel`, session start, event handling |
| `session.go` | Session types, `SessionManager`, TTL |
| `registry.go` | Service registry and Postgres metadata loader |
| `lifecycle.go` | Dependency extraction, screen lifecycle helpers |
| `runtime.go` | HTTP routes for session and event APIs |

## Related APIs

The kernel integrates with but does not replace the lower-level runtime APIs:

- `POST /api/runtime/state/sessions` — manual state session creation
- `POST /api/runtime/formula/evaluate` — direct formula evaluation
- `POST /api/runtime/events/*` — reactive pub/sub and polling
- `GET /api/runtime/apps/{appId}/datasources/{name}` — datasource queries

Use the kernel APIs for end-to-end application runtime orchestration.
