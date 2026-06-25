# Sample Customer Management App

Vertical Slice 5 delivers a metadata-driven Customer CRUD application that exercises every major runtime subsystem without introducing new runtime architecture. All behavior flows through existing kernel, gallery, form, property, renderer, data binding, state, and formula services.

## Purpose

The Customer Management app is a **validation harness**, not a product feature. It proves that:

- Entity records load into galleries from live datasources (no hardcoded rows).
- Gallery selection drives form `Item` binding.
- Form submit, reset, and validation integrate with the record API.
- Navigation (`Navigate`, `Back`) preserves session variables and reloads screen controls.
- The renderer returns metadata-driven control trees through the property engine.
- Reactive refresh propagates datasource and form changes without page reloads.

## Architecture

```text
Metadata seed (Customer Management app)
        ↓
Publish / draft package loader
        ↓
Runtime Kernel session
        ├── State manager (variables, context)
        ├── Gallery service → Customer entity datasource
        ├── Form service → Record API (create/update/delete)
        ├── Formula runtime (Set, Navigate, SubmitForm, …)
        ├── Property engine → control property evaluation
        ├── Renderer → screen render payloads
        └── Reactive engine → refresh instructions
```

### Application identifiers

| Resource | ID |
|----------|-----|
| Application | `00000000-0000-4000-8000-000000000010` |
| CustomerList screen | `00000000-0000-4000-8000-000000000011` |
| CustomerEdit screen | `00000000-0000-4000-8000-000000000012` |
| Customer entity | `00000000-0000-4000-8000-000000000013` |
| galleryCustomers | `00000000-0000-4000-8000-000000000015` |
| formCustomer | `00000000-0000-4000-8000-00000000001b` |

Seed source: `services/metadata/internal/seed/customer_app.go`.

## Entity

**Customer** fields:

| Field | Type | Required |
|-------|------|----------|
| Name | text | yes |
| Email | text | yes |
| Phone | text | no |
| Status | text | yes |

Records are stored through the runtime Record API (`services/runtime/internal/records`).

## Screens

### CustomerList

| Control | Role |
|---------|------|
| `txtSearch` | Search input; `onChange` sets `varSearchChanged` |
| `galleryCustomers` | Items bound to `Customer` datasource |
| `btnNew` | `NewForm(formCustomer); Navigate(CustomerEdit)` |
| `btnEdit` | `EditForm(formCustomer); Navigate(CustomerEdit)` |
| `btnRefresh` | `Navigate(CustomerList)` — reloads list screen galleries |
| `lblTitle` | Displays `varUserName` from app `OnStart` |

`galleryCustomers.Selected` is the form item source on the edit screen.

### CustomerEdit

| Control | Role |
|---------|------|
| `formCustomer` | `dataSource: Customer`, `item: galleryCustomers.Selected` |
| `btnSubmit` | `SubmitForm(formCustomer); Navigate(CustomerList)` |
| `btnReset` | `ResetForm(formCustomer)` |
| `btnCancel` | `ResetForm(formCustomer); Back()` |
| `btnBack` | `Back()` |
| `lblFormStatus` | `If(formCustomer.Valid, …)` when `formCustomer.Unsaved` |

## Data flow

### Session start

1. Kernel loads the published/draft package for the app.
2. `OnStart` runs: `Set(varUserName, User().FullName)`.
3. Galleries on the active screen load via the gallery service (`Customer` → Record API query).
4. Forms on the active screen initialize in View mode.
5. Property and renderer dependency graphs register for the session.

### Gallery → form sync

```text
POST …/gallery/galleryCustomers/select { index }
        ↓
Gallery.Select updates Selected
        ↓
Form.SyncGallerySelection copies row into formCustomer.Item
        ↓
Reactive FormChanged refresh
```

### Create / update

```text
btnNew → NewForm + Navigate(CustomerEdit)
        ↓
User edits form fields (UpdateForm)
        ↓
btnSubmit → SubmitForm → Record API create/update
        ↓
DatasourceChanged → gallery reload on CustomerList
```

### Render path

```text
GET …/render/CustomerList
        ↓
Property engine evaluates control formulas/properties
        ↓
Entity table references (e.g. Customer) resolve via datasource registry
        ↓
Renderer returns { screen, controls[] } with evaluated properties
```

## Runtime features exercised

| Feature | Where used |
|---------|------------|
| Gallery | `galleryCustomers.items = Customer` |
| Form | `formCustomer` on CustomerEdit |
| Patch | Available via formula runtime (entity updates) |
| SubmitForm / ResetForm / NewForm / EditForm / ViewForm | Button `onSelect` formulas |
| Navigate / Back | Screen transitions |
| Set / UpdateContext | App `OnStart`, search `onChange` |
| Collect / ClearCollect | Supported by formula runtime for collections |
| CountRows | `CountRows(Customer)` resolves entity tables |
| If | `lblFormStatus.text` |
| User() | App `OnStart` → `varUserName` |
| Property engine | All control property formulas |
| Renderer | `GET /runtime/session/{id}/render/{screen}` |
| Data binding | Entity datasource resolution |
| State manager | Variables, screen context, collections |
| Reactive refresh | Post-formula refresh instructions |

## Constraints

- **No new runtime architecture** — only metadata seed + integration tests.
- **No hardcoded customer rows** — gallery items always come from the Record API or test harness fake repo mirroring the same service.
- **No duplicate business logic** — CRUD flows through `form.Service.Submit` and `records.Service`.
- **No page reloads** — navigation is in-session via kernel `CurrentScreen` updates.

## Testing

### Go integration tests

`services/runtime/internal/integration/customer_app_test.go`:

| Test | Coverage |
|------|----------|
| `TestCustomerCreateUpdateDelete` | Full CRUD through kernel + form |
| `TestCustomerValidationErrors` | Required field validation |
| `TestGallerySelectionUpdatesForm` | Gallery.Selected → form item |
| `TestNavigationPreservesSessionState` | Navigate + Back, `varUserName` persists |
| `TestRendererReturnsMetadataDrivenControls` | Renderer screen payload |
| `TestGalleryRefreshAfterSubmit` | Gallery reload after create |
| `TestFormResetRestoresValues` | ResetForm behavior |
| `TestSessionRestorePreservesVariables` | Session variable survival |

Run:

```bash
cd services/runtime
go test ./internal/integration/... -v
```

### Validation script

```bash
node infrastructure/scripts/validate-sample-customer-app.mjs
```

Checks metadata seed presence, runs integration tests, and (when services are running) exercises runtime HTTP endpoints for session, gallery, form, and render.

## Related documentation

- [Runtime kernel](runtime-kernel.md)
- [Gallery runtime](gallery-runtime.md)
- [Form runtime](form-runtime.md)
- [Property engine](property-engine.md)
- [Runtime renderer](runtime-renderer.md)
- [Entity record API](entity-record-api.md)
