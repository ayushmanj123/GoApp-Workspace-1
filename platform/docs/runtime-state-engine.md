# Runtime State Engine

The runtime state engine provides in-memory session state for global variables, screen context variables, and collections. It is designed for consumption by the formula engine and runtime controls without persisting data to Redis or PostgreSQL.

## Session lifecycle

1. Runtime client calls `POST /api/runtime/state/sessions` with an `appId`.
2. The server generates a new `sessionId` and initializes empty state keyed by `(appId, sessionId)`.
3. All subsequent state operations include both identifiers so sessions remain isolated.
4. State lives only in process memory and is discarded when the runtime service restarts.

```http
POST /api/runtime/state/sessions
Authorization: Bearer dev:<tenant>:<user>

{ "appId": "00000000-0000-4000-8000-000000000003" }
```

Response:

```json
{
  "success": true,
  "data": {
    "sessionId": "…",
    "appId": "…"
  }
}
```

## Variable scopes

| Scope | Storage | Isolation |
|-------|---------|-----------|
| Global variables | `GlobalVariables` map | Shared across all screens in a session |
| Context variables | `ContextVariables[screen][name]` | Isolated per screen name |
| Collections | `Collections[name][]` | Shared across screens in a session |

### Global variables

Operations (via `StateManager` / `FormulaStateManager`):

- `SetVariable(name, value)` — create or replace
- `GetVariable(name)` — read value
- `UpdateVariable(name, value)` — update existing only
- `DeleteVariable(name)` — remove variable

HTTP:

```http
POST /api/runtime/state/{sessionId}/variables
{ "appId": "…", "name": "varTitle", "value": "Hello" }
```

## Collections

Backend collection operations mirror Power Apps semantics:

| Method | Behavior |
|--------|----------|
| `Collect(name, item)` | Append one row |
| `Clear(name)` | Remove all rows |
| `ClearCollect(name, items)` | Replace entire collection |
| `First(name)` | First row or missing |
| `Last(name)` | Last row or missing |
| `CountRows(name)` | Row count |

HTTP:

```http
POST /api/runtime/state/{sessionId}/collections
{ "appId": "…", "name": "Customers", "action": "collect", "item": { "Name": "Alice" } }
```

Supported `action` values: `collect`, `clear`, `clearCollect`, `set`.

Clear a collection:

```http
DELETE /api/runtime/state/{sessionId}/collections/{name}?appId=…
```

## Context variables

`UpdateContext(screen, values)` merges one or more variables into a screen-scoped map. `ScreenA` values never leak into `ScreenB`.

HTTP:

```http
POST /api/runtime/state/{sessionId}/context/{screen}
{ "appId": "…", "values": { "mode": "edit", "recordId": "…" } }
```

## Snapshot API

Returns the full session state for debugging and future runtime hydration:

```http
GET /api/runtime/state/{sessionId}?appId=…
```

Response `data`:

```json
{
  "appId": "…",
  "sessionId": "…",
  "globalVariables": { "varTitle": "Hello" },
  "contextVariables": {
    "Home": { "mode": "edit" }
  },
  "collections": {
    "Customers": [{ "Name": "Alice" }]
  }
}
```

## Thread safety

- `MemoryStore` protects the session index with a mutex.
- Each `sessionState` has its own read/write mutex.
- `StateManager` implementations are safe for concurrent reads and writes within a session.

## Formula engine integration (future)

The package exposes interfaces only — no Power Fx parser changes in this phase:

```go
type StateManager interface {
    GetVariable(name string) (any, bool)
    SetVariable(name string, value any)
    GetContext(screen, name string) (any, bool)
    SetContext(screen, name string, value any)
    GetCollection(name string) []any
    SetCollection(name string, items []any)
    ClearCollection(name string)
    Snapshot() RuntimeState
}

type FormulaStateManager interface {
    StateManager
    UpdateVariable(name string, value any) error
    DeleteVariable(name string) error
    Collect(collection string, item any)
    Clear(collection string)
    ClearCollect(collection string, items []any)
    First(collection string) (any, bool)
    Last(collection string) (any, bool)
    CountRows(collection string) int
    UpdateContext(screen string, values map[string]any)
}
```

The formula engine will receive a `FormulaStateManager` and call `SetVariable`, `Collect`, and `UpdateContext` when action parsing is wired to the backend runtime.

## Gateway routing

State endpoints live under `/api/runtime/state/*` and are proxied to the runtime service by the gateway.

## Related docs

- [Runtime Data Binding](./runtime-data-binding.md)
- [Authentication](./authentication.md)
