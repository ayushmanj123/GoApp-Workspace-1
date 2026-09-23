# Form Runtime

The form runtime package (`services/runtime/internal/form`) connects Form controls to entity and connector records through the Runtime Kernel, Formula Runtime, Reactive Engine, and Gallery runtime. **Go Form Service is the source of truth** for Mode, CurrentRecord, DirtyFields, ValidationErrors, LastSubmit, and Error. The React Form is a thin client of the session Form HTTP APIs.

## Architecture

```text
Form metadata (item, mode, dataSource, OnSuccess/OnFailure, Layout)
        ↓
Runtime Kernel session
        ↓
Form Service (single source of truth)
        ↓
Gallery.Selected | First(DS) | LookUp(DS,…) | explicit {…}
        ↓
CurrentRecord + DirtyFields + Validation + LastSubmit + Error
        ↓
RecordService / DataSourceRegistry Create|Update
        ↓
DatasourceChanged → Gallery refresh → Form GET refresh
```

Client edits call `POST …/form/{id}/update` (debounced). `SubmitForm` / mode formulas flush pending updates first, then evaluate on the session.

## Form modes

| Mode | Behavior |
|------|----------|
| `View` | Read-only; DataCards cascade to View |
| `Edit` | Editable with dirty tracking |
| `New` | Schema-shaped defaults applied; create on submit |

Formulas: `NewForm`, `EditForm`, `ViewForm`. Runtime UI prefers live session `Form.Mode` over the static package `mode` property.

## Field bindings

Generate/scaffold emit **`ThisItem.Field`**. The runtime binder accepts both `ThisItem.Field` and `Parent.Item.Field`. Flat Label+input children still work; generated forms wrap fields in **DataCard**.

## DataCard

Form → DataCard → Label + input. Card properties: `DataField`, `Default`, `Update`, `Required`, `Visible`, `DisplayMode`. Field-level errors come from `ValidationErrors` matched by `DataField`.

## Layout

Form `layout`: `Vertical` (default) | `Horizontal` | `Columns` with `columns` count. Generate/scaffold auto-arrange cards.

**Runtime nested layout:** the Form shell remains absolutely positioned on the screen artboard. Inside the Form, DataCards use a **flex column card layout** (Label → input → error) with borders/padding. Absolute `x`/`y` on nested Label/input children are designer/authoring aids; the runtime stacks them for Power Apps–like card UX.

## Interaction

- Inputs keep a local draft while focused so typing is not overwritten by formula re-eval.
- `Form.Mode = View` cascades `isReadOnly` through DataCards to inputs.
- Runtime applies `runtime-surface.module.css` on the screen artboard (borders, disabled/read-only chrome).

## Capability matrix

| Capability | Status |
|------------|--------|
| New / Edit / View + formulas | Supported |
| UI follows live mode | Supported |
| Client edits → server DirtyFields | Supported (POST update) |
| `Form.Mode` / `Valid` / `Unsaved` / `Item` | Supported |
| `Form.Updates` / `LastSubmit` / `Error` | Supported |
| `Defaults(DS)` + NewForm schema defaults | Supported |
| `Patch(DS, Form.Updates)` | Supported |
| `Patch(DS, Form.Item \| Gallery.Selected, {fields})` | Supported (Wave 5) |
| OnSuccess / OnFailure | Supported (after SubmitForm) |
| Item: Gallery.Selected / First / LookUp / `{…}` | Supported |
| DataCard + Generate/scaffold | Supported |
| Number / choice / boolean / date / lookup Generate | Supported (choice→Dropdown) |
| Layout Vertical/Horizontal/Columns + responsive | Supported |
| Attachments / People / Rich text / Image | **N/A** (later) |

## HTTP APIs

### Get form

```http
GET /api/runtime/session/{sessionId}/form/{controlId}
```

Returns mode, currentRecord, dirtyFields/updates, validationErrors, lastSubmit, error, unsaved, valid.

### Change mode / Update / Submit / Reset

```http
POST /api/runtime/session/{sessionId}/form/{controlId}/mode
POST /api/runtime/session/{sessionId}/form/{controlId}/update
POST /api/runtime/session/{sessionId}/form/{controlId}/submit
POST /api/runtime/session/{sessionId}/form/{controlId}/reset
```

Gallery selection sync **does not clobber** Edit/New forms with unsaved DirtyFields.

Form **Item** may be `Gallery.Selected` or `DataTable.Selected` (any items-control name ending in `.Selected`). Studio’s Item source picker lists both Gallery and DataTable controls on the same screen. Changing the selected list row while the form is dirty keeps the in-progress record until `ResetForm` or `SubmitForm`.

## Formula support

### Actions

| Formula | Effect |
|---------|--------|
| `SubmitForm(Form1)` | Persist; then run Form OnSuccess (or OnFailure on error) |
| `ResetForm(Form1)` | Restore OriginalRecord |
| `NewForm` / `EditForm` / `ViewForm` | Mode change |
| `Defaults(DataSource)` | Schema-/sample-shaped empty record |
| `Patch(DS, Form.Updates)` | Patch using dirty field map |
| `Patch(DS, Form.Item, {…})` | Three-arg merge: identity from Item + field overrides (Wave 5) |
| `Patch(DS, Gallery.Selected, {…})` | Three-arg merge from gallery/DataTable selection (Wave 5) |

### Expressions

| Expression | Result |
|------------|--------|
| `Form1.Mode` | Mode string |
| `Form1.Valid` | Re-validates against schema on read |
| `Form1.Unsaved` | Dirty fields present |
| `Form1.Item` | Current record |
| `Form1.Updates` | DirtyFields map |
| `Form1.LastSubmit` | Last successful submit record |
| `Form1.Error` | `{ message, issues }` or blank |

## Offline path

In-memory `executeSubmitForm` runs **only** when there is no runtime session. Session apps always use Go Form Service.

The React Form shows a **status banner** when `runtimeUnavailable` or when there is no `sessionId`, so Submit cannot be mistaken for Postgres persistence.

## Focus and validation (Canvas Form foundation)

**Root cause of focus loss while typing:** the Form client autofocused the first `[aria-invalid]` control whenever `validationErrors` changed after each debounced `Update`. Go `Update` also revalidated on every keystroke flush.

**Fixes:**

- Autofocus runs only after **Submit** validation failure (`error.message` contains validation).
- Go `Update` clears `ValidationErrors` / `LastError`; schema validation runs on **Submit** (and on `Form.Valid` read via `refreshValidation`).
- `recordKey` uses platform `recordId` / `RecordId` only (not business `id`).
- Gallery/DataTable row React keys use stable `galleryRowKey(recordId)` instead of `JSON.stringify(record)`.

## Scaffold layout

`CreateCRUDApp` sizes Form height from column count (`16 + N×56 + 16`, min 360) and places action buttons below the form. DataCard / label / input IDs are **deterministic** (`uuid.NewSHA1` from parent + field) and prior form datacards are cleared on upsert so re-seed does not duplicate cards. Customer Management seed now passes `Columns: Name, Email, Phone, Status`.

## Layout / responsive

- Form interior: flex column (Vertical), wrap row (Horizontal), CSS grid + `@container` (Columns) collapsing to 1 column under 520px and 2 columns for mid widths when authored with more columns.
- DataCard: padded card chrome, consistent label/input gap, errors under the field.
- Form **shell** remains absolute on the artboard (Studio canvas model); nested cards ignore designer X/Y at runtime.

## Remaining gaps vs Power Apps Canvas Form

- Attachments / People / Rich text / Image DataCards
- First-class DataCard **Update** formula evaluation (client uses Default + `reportUpdate`)
- Full responsive canvas containers (beyond Form interior)
- Collection-native `SubmitForm` without EntityID/kind
- Deeper LookUp/Filter Item formulas

## Recommended next steps

1. Align scaffold field controls with Studio Generate typed fields (number, lookup, choice→Dropdown).
2. Optional seed sample entity rows so galleries are non-empty after seed.
3. Card-level Update property evaluation when product needs Patch-from-card parity.

- Form **DisplayMode** (Edit / View / Disabled) cascades read-only with the existing mode. **OnReset** runs after a successful `ResetForm`.

## Related docs

- [Gallery Runtime](./gallery-runtime.md)
- [Runtime Kernel](./runtime-kernel.md)
- [Entity Record API](./entity-record-api.md)
- [Google Sheets connectors](./google-sheets-connectors.md)
