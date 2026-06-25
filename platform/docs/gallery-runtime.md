# Gallery Runtime Binding

The gallery runtime package (`services/runtime/internal/gallery`) connects Gallery controls to entity datasources and in-memory collections through the existing Runtime Kernel, Data Binding engine, Record API, and Reactive Engine.

No new backend services or metadata schema changes are required.

## Architecture

```text
Gallery metadata (items formula)
        ↓
Runtime Kernel session
        ↓
Gallery Service
        ↓
BindingResolver + DataSourceRegistry + RecordService
        ↓
Cached gallery rows (AllItems) + Selected
        ↓
Formula runtime + Reactive refresh
```

## Items resolution

Gallery controls declare an `items` formula in metadata (for example `Customers` or `Orders`).

Resolution rules:

| Items expression | Source | Loader |
|------------------|--------|--------|
| Entity name on the application | Entity datasource | `DataSourceRegistry` → Record API |
| Collection name in session state | In-memory collection | `FormulaStateManager` |

Loaded rows are cached per session in `SessionStore`, preserving query order. Empty datasources return `items: []`.

## Gallery state

Each gallery control exposes:

| Symbol | Description |
|--------|-------------|
| `{Gallery}.AllItems` | Cached row array for the control |
| `{Gallery}.Selected` | Currently selected row object |

Selection is stored separately from global variables and screen context.

## HTTP APIs

### Load gallery

```http
GET /api/runtime/session/{sessionId}/gallery/{controlId}
Authorization: Bearer dev:<tenant>:<user>
```

Response:

```json
{
  "success": true,
  "data": {
    "controlId": "galleryCustomers",
    "source": "Customers",
    "items": [
      { "recordId": "…", "Name": "Alice" }
    ],
    "selected": null,
    "count": 1
  }
}
```

The kernel preloads galleries for the active screen during session start and `OnVisible`.

### Select gallery row

```http
POST /api/runtime/session/{sessionId}/gallery/{controlId}/select

{
  "appId": "…",
  "index": 0
}
```

Response includes targeted `refresh[]` instructions for controls that depend on `{Gallery}.Selected`.

## Formula support

The formula runtime resolves gallery references through `GalleryReader`:

| Expression | Result |
|------------|--------|
| `galleryOrders.Selected` | Selected row object |
| `First(galleryOrders.AllItems)` | First cached row |
| `Last(galleryOrders.AllItems)` | Last cached row |
| `CountRows(galleryOrders.AllItems)` | Number of cached rows |

Bare collection functions still work for in-memory collections:

```text
CountRows(Orders)
```

## Reactive refresh

Gallery controls register dependencies from their `items` formula:

- `DatasourceChanged` refreshes galleries bound to entity datasources (for example after `Patch`)
- `CollectionChanged` refreshes galleries bound to collections (after `Collect` / `ClearCollect`)
- `GallerySelectionChanged` refreshes controls that reference `{Gallery}.Selected`

Unrelated controls are not refreshed.

Example dependency registration:

```json
{
  "controlId": "galleryOrders",
  "dataSources": ["Orders"]
}
```

```json
{
  "controlId": "lblSelected",
  "galleries": ["galleryOrders"]
}
```

## Kernel integration

`RuntimeKernel` orchestrates gallery behavior:

1. Session start / `OnVisible` → `loadScreenGalleries`
2. Formula execution → `syncGalleriesAfterRefresh` reloads affected galleries
3. Formula context → `Gallery.Reader(sessionId)` for `Selected` / `AllItems`
4. Session expiration → gallery cache cleared with state and reactive subscriptions

## Related docs

- [Runtime Kernel](./runtime-kernel.md)
- [Runtime Data Binding](./runtime-data-binding.md)
- [Reactive Runtime](./reactive-runtime.md)
