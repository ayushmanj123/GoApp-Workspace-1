# Runtime Formula Integration

The runtime formula package executes action-style formulas against real backend services: session state, datasource registry, and record service (via `Patch`). It mirrors the TypeScript action parsers used in the browser runtime without modifying the Power Fx expression parser.

## RuntimeFormulaContext

Every formula executes through a single `RuntimeFormulaContext`:

| Field | Purpose |
|-------|---------|
| `State` | `FormulaStateManager` — variables, collections, screen context |
| `DataSources` | `DataSourceRegistry` — entity (and future connector) data access |
| `Resolver` | Resolves datasource names to entity bindings |
| `Navigation` | `NavigationService` interface — real screen navigation on the kernel session path (Phase 7.15), see [Navigation](#navigation) |
| `User` | `TenantID`, `UserID`, `Email` from auth |
| `App` | Running `AppID` |
| `Session` | `SessionID` and active `Screen` name |

Formula execution must use this context only — no direct database or repository access from handlers.

## Execution flow

```text
POST /api/runtime/formula/evaluate
        ↓
    Evaluator
        ↓
    Dispatcher (action routing)
        ↓
RuntimeFormulaContext
        ↓
StateManager / DataSourceRegistry / NavigationService
        ↓
    JSON result
```

## Evaluate API

```http
POST /api/runtime/formula/evaluate
Authorization: Bearer dev:<tenant>:<user>

{
  "appId": "00000000-0000-4000-8000-000000000003",
  "sessionId": "…",
  "screen": "Home",
  "formula": "Set(x,123)"
}
```

Success response:

```json
{
  "success": true,
  "data": {
    "result": 123
  }
}
```

Error response (structured):

```json
{
  "success": false,
  "error": {
    "code": "DATASOURCE_NOT_FOUND",
    "message": "datasource not found"
  },
  "data": {
    "code": "DATASOURCE_NOT_FOUND",
    "message": "datasource not found"
  }
}
```

Create a session first via `POST /api/runtime/state/sessions`.

## Supported functions

### State

| Function | Example | Backend |
|----------|---------|---------|
| `Set` | `Set(varTitle, "Hello")` | `StateManager.SetVariable` |
| `UpdateContext` | `UpdateContext({ mode: "edit" })` | `StateManager.UpdateContext` for active screen |

### Collections

| Function | Example | Backend |
|----------|---------|---------|
| `Collect` | `Collect(Customers, { Name: "Alice" })` | `StateManager.Collect` |
| `ClearCollect` | `ClearCollect(Customers, { Name: "Bob" })` | `StateManager.ClearCollect` |
| `Clear` | `Clear(Customers)` | `StateManager.Clear` |
| `First` | `First(Customers)` | `StateManager.First` |
| `Last` | `Last(Customers)` | `StateManager.Last` |
| `CountRows` | `CountRows(Customers)` | `StateManager.CountRows` |

### Data

| Function | Example | Backend |
|----------|---------|---------|
| `Defaults` | `Defaults(Customers)` | Resolver + empty record template |
| `Patch` | `Patch(Customers, { Name: "Alice" })` | `DataSource.Create` |
| `Patch` (update) | `Patch(Customers, { recordId: "…", version: 1, Name: "Updated" })` | `DataSource.Update` via record service |

`Patch` resolves the datasource name, selects the entity `DataSource`, and calls create/update on the record service. No SQL or repository access from the formula package.

### Navigation

| Function | Status |
|----------|--------|
| `Navigate(ScreenName)` | Implemented on session-scoped endpoints (Phase 7.15) |

`Navigate()` behavior depends on which endpoint evaluated the formula:

- **Session endpoints** — `POST /api/runtime/session/:sessionId/evaluate`, `POST /api/runtime/session/:sessionId/event` (control events), and session `StartSession` (`App.OnStart`/`Screen.OnVisible`). These go through `kernel.RuntimeKernel`, which wires `sessionNavigation` (`services/runtime/internal/kernel/kernel.go`): it records `varPreviousScreen`, updates `RuntimeSession.CurrentScreen`, reloads the target screen's galleries and forms, and publishes a `NavigationRequested` reactive event. The HTTP response's `currentScreen` field reflects the new screen. This is the path used by the deployed app runtime (control click handlers, `Back()`, etc.) and is fully functional — Navigate no longer stubs out here.
- **Standalone endpoint** — `POST /api/runtime/formula/evaluate`. This endpoint has no session/screen model of its own (`state.MemoryStore` only tracks variables/context/collections, not a current screen). When a reactive engine is configured (the default in `server.go`), `Navigate()` publishes a `NavigationRequested` event via `reactive.NavigationService` and does not error, but no screen state is persisted and the response's `currentScreen` stays empty. Callers that need real navigation semantics should use the session-scoped endpoints above. If no reactive engine or navigation implementation is injected at all (only possible in custom/test wiring), `Navigate()` falls back to `NoopNavigationService` and returns `NAVIGATION_NOT_IMPLEMENTED`.

## Value expressions

`Set()` value expressions support literals (`123`, `"text"`, `true`/`false`), global variables, screen context variables, and nested `First`/`Last`/`CountRows`/`Defaults` calls. Full Power Fx evaluation remains in the .NET formula host for browser expressions; backend actions use the same parsing rules as the TypeScript runtime action handlers.

## Extension points

| Interface | Future use |
|-----------|------------|
| `FormulaStateManager` | Formula engine calls `SetVariable`, `Collect`, `UpdateContext` |
| `DataSourceRegistry` | REST/SQL/SharePoint datasources for `Patch`/`Defaults` |
| `NavigationService` | Screen navigation from `Navigate()` — session-aware implementation in `kernel.sessionNavigation`, event-only implementation in `reactive.NavigationService` |
| `BindingResolver` | Datasource metadata resolution |

## Related docs

- [Runtime State Engine](./runtime-state-engine.md)
- [Runtime Data Binding](./runtime-data-binding.md)
- [Entity Record API](./entity-record-api.md)
