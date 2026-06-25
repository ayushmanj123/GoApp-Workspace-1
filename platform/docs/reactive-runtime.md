# Reactive Runtime Engine

The reactive runtime engine publishes in-memory events when state, collections, datasources, or navigation change. Clients poll for events and receive targeted refresh instructions for affected controls only.

## Event flow

```text
Set() / Collect() / Patch() / UpdateContext() / Navigate()
        ↓
   Event published
        ↓
Dependency graph lookup
        ↓
Refresh instructions for affected controls only
        ↓
Client polls /api/runtime/events/poll/{sessionId}
```

## Event types

| Event | Trigger |
|-------|---------|
| `VariableChanged` | `Set()` |
| `CollectionChanged` | `Collect()`, `ClearCollect()`, `Clear()` |
| `ContextChanged` | `UpdateContext()` |
| `DatasourceChanged` | `Patch()` |
| `NavigationRequested` | `Navigate()` |
| `FormulaExecuted` | Successful formula evaluation |

## Dependency graph

Clients register control dependencies per session:

```http
POST /api/runtime/events/subscribe
{
  "appId": "…",
  "sessionId": "…",
  "controls": [
    {
      "controlId": "galleryOrders",
      "collections": ["Orders"],
      "dataSources": ["Orders"]
    },
    {
      "controlId": "lblTotal",
      "variables": ["total"]
    }
  ]
}
```

When an event fires, only controls that depend on the changed variable, collection, datasource, or context key receive refresh instructions.

## Refresh response

```json
{
  "refresh": [
    { "controlId": "galleryOrders", "reason": "CollectionChanged" },
    { "controlId": "lblTotal", "reason": "VariableChanged" }
  ]
}
```

Formula evaluation (`POST /api/runtime/formula/evaluate`) includes the same `refresh` array in its response after successful execution.

## APIs

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/runtime/events/subscribe` | Register control dependencies |
| `POST` | `/api/runtime/events/publish` | Manually publish an event |
| `GET` | `/api/runtime/events/poll/{sessionId}` | Drain pending events + refresh lists |

Polling is used in this phase. Events are queued per session and returned in sequence order.

## Formula integration

After successful execution of:

- `Set()`
- `Collect()` / `ClearCollect()`
- `Patch()`
- `UpdateContext()`
- `Navigate()` (publishes `NavigationRequested` only; no UI navigation)

…the formula engine publishes the corresponding reactive event through `RuntimeFormulaContext.Events`.

## Thread safety

The event bus uses mutex-protected session queues and monotonic event sequencing. Concurrent subscribers and publishers are supported.

## Future WebSocket support

The `EventBus` interface and `QueuedNotification` model are transport-agnostic. A future WebSocket layer can subscribe to the same bus and push notifications instead of polling, without changing dependency resolution or formula integration.

## Related docs

- [Runtime Formula Integration](./runtime-formula-integration.md)
- [Runtime State Engine](./runtime-state-engine.md)
