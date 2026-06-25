# Runtime Property Evaluation Engine

The property engine evaluates control properties from cached metadata and runtime context. Controls do not evaluate their own properties; the kernel routes all property reads through `services/runtime/internal/properties`.

## Evaluation flow

1. **Session start** — The kernel loads application metadata and calls `Properties.RegisterDependencies`, which analyzes every control binding and registers reactive dependencies with the shared reactive engine.
2. **Property request** — `EvaluateControl`, `EvaluateProperty`, or `EvaluateScreen` resolves bindings via `ResolveBindings`, which merges static metadata properties, formula bindings, and layout fields (`X`, `Y`, `Width`, `Height`).
3. **Binding evaluation** — Literal, boolean, number, color, object, and array bindings return stored values. Formula bindings delegate to the existing formula runtime through `FormulaEvaluator` (no second evaluator).
4. **Cache write** — Evaluated values are stored in the per-session property cache keyed by control and property name.

```
Metadata → ResolveBindings → PropertyEvaluator → Formula Runtime
                                    ↓
                              Session Cache
```

## Runtime context

Property evaluation receives the same `RuntimeFormulaContext` built by the kernel:

- `RuntimeKernel` (session orchestration)
- Formula runtime (`FormulaEvaluator`)
- `StateManager`
- `GalleryReader`
- `FormReader`
- `DataSourceRegistry`
- Session identity (tenant, user, screen)

The property engine does not access the database directly.

## Supported properties

Initial property names:

`Text`, `Visible`, `DisplayMode`, `Default`, `Items`, `Width`, `Height`, `X`, `Y`, `Fill`, `Color`

Supported value types: literal, formula, boolean, number, color, object, array.

## Formula examples

| Property | Formula |
|----------|---------|
| Visible | `CountRows(colOrders)>0` |
| Items | `Customers` |
| Text | `Gallery1.Selected.Name` |
| Default | `Form1.Item.Name` |

## Caching

- Cache is scoped per runtime session.
- Entries are keyed by `(controlId, propertyName)`.
- On reactive events (`VariableChanged`, `CollectionChanged`, `DatasourceChanged`, `GallerySelectionChanged`, `FormChanged`), only properties whose analyzed dependencies match the event payload are invalidated.
- After formula execution, controls listed in refresh instructions also have their cached properties cleared.
- Session teardown calls `Properties.ClearSession`.

## Dependency tracking

`AnalyzeControlDependencies` inspects formula text for:

- Variables and bare collection identifiers
- `CountRows(collection)` references
- `Gallery.Selected` paths
- `Form.Item`, `Form.Mode`, `Form.Valid`, `Form.Unsaved` paths

`RegisterDependencies` stores per-property dependencies for cache invalidation and merges control-level dependencies for the reactive engine. Gallery and form static bindings from kernel metadata are merged so collection and datasource changes still refresh galleries and forms.

No manual dependency registration is required in control code.

## HTTP API

```
GET /api/runtime/session/{sessionId}/properties/{controlId}
```

Response data:

```json
{
  "controlId": "lblCustomer",
  "properties": {
    "Text": "John",
    "Visible": true,
    "DisplayMode": "Edit"
  }
}
```

## Extension model

1. Add a property name to `SupportedProperties` when the runtime should expose it.
2. Extend `bindingFromRaw` if a new metadata storage shape is introduced.
3. Extend `AnalyzeControlDependencies` extractors when new formula reference patterns need reactive invalidation.
4. Wire new layout or metadata fields in the kernel metadata loader and `ControlDefinition`.

## Constraints

- Reuses the existing formula runtime; do not add a parallel expression evaluator.
- No frontend, connector, or UI changes in this slice.
- Property evaluation is read-only; imperative behavior remains in formula actions and kernel event handlers.
