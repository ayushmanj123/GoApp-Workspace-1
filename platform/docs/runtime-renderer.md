# Runtime Renderer

The runtime renderer produces metadata-driven screen JSON by evaluating every control property through the Property Engine and Formula Runtime. Controls are not hardcoded; all visible values come from cached metadata plus live runtime context.

## Pipeline

```
Metadata
   ↓
Property Engine
   ↓
Formula Runtime
   ↓
Resolved property values
   ↓
Renderer JSON
```

Each control in the response includes `id`, `type`, and a `properties` bag (`Text`, `Visible`, `DisplayMode`, `Items`, layout fields, and so on).

## Supported property categories

| Category | Examples |
|----------|----------|
| Value / Text | `Text`, `Default` |
| Boolean | `Visible` |
| Color | `Color`, `Fill` |
| Number | `Width`, `Height`, `X`, `Y` |
| Object | record defaults |
| Array | `Items` |
| Enum | `DisplayMode` (`Edit`, `View`, `Disabled`) |

Formula examples:

- `Text = Gallery1.Selected.Name`
- `Visible = CountRows(colOrders) > 0`
- `DisplayMode = If(Form1.Valid, Edit, Disabled)`
- `Default = User().FullName`
- `Items = Customers`

## HTTP API

### Full screen render

```
GET /api/runtime/session/{sessionId}/render/{screenId}
```

Response:

```json
{
  "screen": "Home",
  "controls": [
    {
      "id": "Label1",
      "type": "Label",
      "properties": {
        "Text": "John",
        "Visible": true,
        "X": 10,
        "Y": 20
      }
    }
  ]
}
```

### Incremental render

After reactive refresh, re-render only affected controls:

```
GET /api/runtime/session/{sessionId}/render/{screenId}?controls=Label1,lblStatus
```

The renderer re-evaluates only the listed controls. Unaffected controls stay in the renderer cache.

## Caching

Two cache layers cooperate:

1. **Property cache** (Property Engine) — per-control property values; invalidated by reactive events and refresh instructions.
2. **Renderer cache** — assembled control JSON per screen; invalidated when any dependent property changes.

Full-screen render requests reuse cached controls and only evaluate controls whose cache entries were invalidated.

## Dependency graph

Property formulas are analyzed at session start. Dependencies are registered with the Reactive Engine for:

- Variables (`Set`, bare identifiers)
- Collections (`CountRows`, `Collect`)
- Gallery selection (`Gallery.Selected`)
- Form state (`Form.Item`, `Form.Valid`, `Form.Mode`)
- Datasources (bare collection/datasource names)
- Context variables (`UpdateContext` keys)

When an event fires, only controls whose dependency graph matches the event payload are invalidated in both caches.

## Runtime services reused

No new runtime microservices are introduced. The renderer composes:

- `RuntimeKernel` (session + metadata)
- `PropertyEngine`
- `FormulaRuntime`
- `ReactiveEngine`
- `StateManager`
- `GalleryReader`
- `FormReader`
- `DataSourceRegistry`

## Constraints

- No frontend, connector, or UI work in this slice.
- No duplicate formula evaluators — all expressions go through the existing formula runtime.
- Renderer is read-only; imperative actions remain in kernel event handlers and formula actions.
