# Form Runtime

The form runtime package (`services/runtime/internal/form`) connects Form controls to entity records through the existing Runtime Kernel, Record API, Formula Runtime, Reactive Engine, and Gallery runtime.

## Architecture

```text
Form metadata (item, mode, dataSource)
        ↓
Runtime Kernel session
        ↓
Form Service
        ↓
Gallery.Selected or explicit item
        ↓
CurrentRecord + DirtyFields + Validation
        ↓
RecordService (Create / Update)
        ↓
DatasourceChanged → Gallery refresh → Form refresh
```

## Form modes

Each form maintains a per-session mode:

| Mode | Behavior |
|------|----------|
| `View` | Read-only display of the current record |
| `Edit` | Editable record with dirty tracking |
| `New` | Blank record for create on submit |

Modes are changed through the mode API or formulas (`NewForm`, `EditForm`, `ViewForm`).

## Current item

The `item` property formula resolves the bound record:

| Item expression | Source |
|-----------------|--------|
| `Gallery1.Selected` | Gallery runtime selection |
| Explicit record object | Used directly when provided |

When gallery selection changes, forms bound to `{Gallery}.Selected` are updated automatically and publish `FormChanged` refresh instructions.

## Form state

Per form control the runtime tracks:

| Field | Description |
|-------|-------------|
| `CurrentRecord` | Active record values |
| `OriginalRecord` | Snapshot used by reset |
| `DirtyFields` | Fields changed since load or reset |
| `ValidationErrors` | Structured entity validation failures |
| `Mode` | `View`, `Edit`, or `New` |
| `DataSource` | Bound entity datasource name |

## HTTP APIs

### Get form

```http
GET /api/runtime/session/{sessionId}/form/{controlId}
```

### Change mode

```http
POST /api/runtime/session/{sessionId}/form/{controlId}/mode

{ "appId": "…", "mode": "Edit" }
```

### Update fields

```http
POST /api/runtime/session/{sessionId}/form/{controlId}/update

{ "appId": "…", "fields": { "Name": "Jane" } }
```

### Submit

```http
POST /api/runtime/session/{sessionId}/form/{controlId}/submit

{ "appId": "…" }
```

- `Edit` mode → `RecordService.Update` (Patch semantics)
- `New` mode → `RecordService.Create`

Successful submit publishes `DatasourceChanged` for gallery reload and `FormChanged` for dependent controls.

### Reset

```http
POST /api/runtime/session/{sessionId}/form/{controlId}/reset

{ "appId": "…" }
```

Restores `OriginalRecord` and clears dirty state.

## Validation

Submit and update validate against entity metadata through the record service:

- Required fields
- Field data types (`text`, `number`, `boolean`, `date`)
- Unknown fields

Failures return structured `validationErrors` and `VALIDATION_FAILED`.

## Formula support

### Actions

| Formula | Effect |
|---------|--------|
| `SubmitForm(Form1)` | Persist current record |
| `ResetForm(Form1)` | Restore original values |
| `NewForm(Form1)` | Switch to `New` mode |
| `EditForm(Form1)` | Switch to `Edit` mode |
| `ViewForm(Form1)` | Switch to `View` mode |

### Expressions

| Expression | Result |
|------------|--------|
| `Form1.Mode` | Current mode string |
| `Form1.Valid` | `true` when no validation errors |
| `Form1.Unsaved` | `true` when dirty fields exist |
| `Form1.Item` | Current record object |

## Reactive refresh

Forms register dependencies for:

- `DatasourceChanged` on their entity datasource
- `FormChanged` on referenced form names
- `GallerySelectionChanged` indirectly via automatic item sync

Submit flow:

```text
SubmitForm()
        ↓
RecordService Create/Update
        ↓
DatasourceChanged
        ↓
Gallery reload
        ↓
Form refresh
```

## Related docs

- [Gallery Runtime](./gallery-runtime.md)
- [Runtime Kernel](./runtime-kernel.md)
- [Entity Record API](./entity-record-api.md)
