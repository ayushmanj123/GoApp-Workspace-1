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

### Reload gallery / DataTable

```http
POST /api/runtime/session/{sessionId}/gallery/{controlId}/reload

{
  "appId": "…"
}
```

Forces `gallery.Service.Load` for that control and returns the same `GalleryResponse` shape as GET. Used by formula `Refresh(DataSource)` (via `ReloadForSource`) and client gallery reloads.

### Select gallery row

```http
POST /api/runtime/session/{sessionId}/gallery/{controlId}/select

{
  "appId": "…",
  "index": 0
}
```

Response includes targeted `refresh[]` instructions for controls that depend on `{Gallery}.Selected`.

## Filter property (Phase 7.15 / 7.18 / 7.19)

Gallery controls may set a `filter` formula/property. Runtime parses predicates into `QueryOverrides.Filter`:

| Expression | Meaning |
|------------|---------|
| `Status='Active'` | Single equals |
| `Amount>10` | Comparison (`<>`, `>`, `<`, `>=`, `<=`; quoted string or number) |
| `Status='Active' And Region='West'` | AND of leaves |
| `And(Status='Active', Region='West')` | Same, function form |
| `Status='A' Or Status='B'` | OR of leaves |
| `Or(Status='A', Status='B')` | Same, function form |
| `Contains(Name,'acme')` | Case-insensitive substring match (Phase 7.28) |
| `StartsWith(Name,'A')` | Case-insensitive prefix match (Phase 7.28) |
| `EndsWith(Name,'Inc')` | Case-insensitive suffix match (Wave 3) |

Collection galleries apply the same predicate in-memory (Phase 7.19). Entity datasources push `FilterExpr` into Postgres JSONB `WHERE` (Phase 7.20) so filtered paging and totals stay correct for large lists. REST forwards equals-`And` as query params; richer predicates filter in-memory after fetch. Table-bound SQL connectors push And/Or + comparisons into `WHERE` (7.18/7.19). Named SQL `list` queries do not rewrite free-form SELECT text. Mixed infix `And`/`Or` in one expression is rejected (use `And()` / `Or()` of leaves only).

## Paging (Phase 7.29)

Gallery and DataTable controls support optional `pageSize` and `offset` properties. Runtime passes them through as `QueryOverrides.Limit` and `QueryOverrides.Offset` on entity/REST/SQL queries. The client shows a **Load more** button when cached rows exceed `pageSize`, revealing additional rows without reloading the screen.

## DataTable client binding

DataTable (and Gallery) read rows from `GET …/gallery/:controlId` when a runtime session is active (`useSessionGalleryItems`). Offline / no-session falls back to formula evaluation and the hydrated collection store (entities **and** connector names).

Columns are resolved in order:

1. Optional `columns` text property (comma-separated field names) — Studio Data tab offers a checkbox/reorder picker that writes this string
2. Designer `columnHints` when present (Sheets)
3. Inferred keys from loaded records (excluding `recordId` / `entityId` / `version` noise)

DataTable Data property `showRefresh` (boolean, default `true`) controls the Studio property-pane **Refresh data** button (designer preview). It does **not** render a button inside the published runtime app. To refresh live data at runtime, use Power Fx `Refresh(DataSource)` on a Button (or other) `OnSelect`.

## Refresh(DataSource)

```text
Refresh(Customers)
```

Calls `ReloadForSource` for galleries/DataTables bound to that datasource and publishes `DatasourceChanged` refresh instructions so the React client re-fetches session gallery state.

## LookUp (Phase 7.18)

```text
LookUp(Customers, Status='Active')
LookUp(OrdersDb, And(Status='Open', Region='West'))
LookUp(OrdersDb, Status='Open' Or Status='Pending')
```

Returns the first matching record, or blank when none match. Uses the same predicate parser as gallery filters.

## Filter formula (Phase 7.19)

```text
Filter(Customers, Status='Active')
Filter(OrdersDb, Amount>10 Or Status='Open')
```

Returns all matching records as a table (empty table when none match). Same predicate parser as LookUp / gallery `filter`.

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
