# Control capability matrix

Living inventory. After shipping a gap, move it into **Already in GoApps** and set a new **Next additive gap**. Primary files are relative to `platform/`.

Status key: **Done** = usable in Studio + Runtime for the listed slice. **Partial** = works with known limits. **Gap** = next additive target.

## Interactive HTML

| Type | Power Apps–inspired target | Already in GoApps | Next additive gap | Primary files |
|------|----------------------------|-------------------|-------------------|---------------|
| `button` | Text, Disabled, OnSelect, Visible, Tooltip | Text, Disabled, Visible, DisplayMode, Tooltip, OnSelect (Navigate/Set/Collect/SubmitForm/Patch/Refresh/…) | — | `apps/studio/.../registry.ts`, `apps/runtime/src/components/button.tsx` |
| `label` | Text, Color, Font, Size, Align, Visible | Text, Color (formula-capable), Size, Weight, Align, Visible | — | `label.tsx`, registry `LABEL_PROPERTIES` |
| `textinput` | Default, Value, Placeholder, DisplayMode, Required, OnChange | Default (ThisItem), Value, Placeholder, inputMode, Disabled, Visible, DisplayMode, Required, Tooltip, OnChange | — | `text-input.tsx`, Form dirty flush |
| `dropdown` | Items, Default, Value, DisplayMode, OnChange, DisplayFields | Items, Default, Value, DisplayField, ValueField, Disabled, Visible, DisplayMode, Required, Tooltip, OnChange | — | `dropdown.tsx`; see `docs/studio-controls.md` |
| `checkbox` | Text, Default, Checked, DisplayMode, OnChange | Text, Checked, Default, Disabled, Visible, DisplayMode, Required, Tooltip, OnChange | — | `checkbox.tsx` |
| `toggle` | Text, Default, Checked, DisplayMode, OnChange | Same pattern as Checkbox + Tooltip | Design-system polish only if requested | `toggle.tsx` |
| `datepicker` | Default, Value, DisplayMode, OnChange | Value, Default, Disabled, Visible, DisplayMode, Required, Tooltip, OnChange | Locale/format options | `datepicker.tsx` |
| `image` | Image, Alt, OnSelect, Visible | Src, Alt, Visible, OnSelect | — | `image.tsx` |
| `icon` | Icon, Color, OnSelect | Icon glyph map, Color, Visible, OnSelect | Richer icon packs (deferred in docs) | `icon.tsx` |
| `timer` | Duration, OnTimerEnd, Start/Stop, AutoStart, Repeat | Duration, OnTimerEnd, AutoStart, Start, Repeat, Visible, DisplayMode | — | `timer.tsx`, registry `TIMER_PROPERTIES` |
| `container` | Layout direction, nested children, auto-layout | Nesting (drop/reparent/edit mode); `direction` + Visible; flex packing by `z_index` | — | `container.tsx`, canvas nest helpers; `docs/studio-controls.md` |

## Data controls

| Type | Power Apps–inspired target | Already in GoApps | Next additive gap | Primary files |
|------|----------------------------|-------------------|-------------------|---------------|
| `gallery` | Items, Selected, Filter/Sort, templates, Refresh | Items (entity/collection/connector), Selected/AllItems, filter/sort/limit/pageSize/offset (Contains/StartsWith/**EndsWith**), Load more, Refresh(DS), selection → Form sync, Visible | Richer nested Filter; template chrome | `gallery.tsx`, `services/runtime/internal/gallery/`, `docs/gallery-runtime.md` |
| `datatable` | Items, columns, selection, paging, Refresh | Same gallery binding path; columns/columnHints; Studio column picker; row select; Studio `showRefresh`; Visible | Infer polish only | `datatable.tsx`, gallery session, PropertyPanel |
| `form` | Item, DataSource, Mode New/Edit/View, Submit/Reset, Valid/Unsaved | Modes + NewForm/EditForm/ViewForm; SubmitForm/ResetForm; OnSuccess/OnFailure; DataCards; Layout/Columns (+ container query responsive); LastSubmit/Updates/Error; connector + entity submit; Visible; Item ← Gallery/DataTable `.Selected`; **focus-safe typing** (no Update autofocus); offline/session hint | Typed field types still N/A later (attachments/people); card-level Update formula | `form.tsx`, `services/runtime/internal/form/`, `docs/form-runtime.md` |
| `datacard` | DataField, Default, Update, Required, DisplayMode | Generated under Form; Default/Update/Required/Visible/DisplayMode; consistent card chrome | Stay generated; extend with Form Generate typed fields | `datacard.tsx`, `generate-form-fields.ts` |

## Shapes (decorative)

| Type | Power Apps–inspired target | Already in GoApps | Next additive gap | Primary files |
|------|----------------------------|-------------------|-------------------|---------------|
| `shape_rectangle` | Fill, Stroke, Opacity | Fill, Stroke, StrokeWidth, Opacity | OnSelect only if product asks | designer Konva + runtime SVG |
| `shape_ellipse` | same | same | same | same |
| `shape_line` | Stroke, Opacity | Stroke, StrokeWidth, Opacity | same | same |
| `shape_arrow` | Stroke, Opacity | Fill/Stroke family as registered | same | same |
| `shape_image` | Image fill | Shape image props as registered | same | same |
| `shape_star` | Fill, Stroke, Points | Fill/Stroke + points | same | same |

## Library / generated (not toolbox)

| Type | Notes | Next additive gap |
|------|--------|-------------------|
| `component` | Expands definition into nested controls | Marketplace catalog is placeholder — do not treat as shipped controls |
| `datacard` | See Form row above | — |

## Wave alignment (roadmap)

1. **Wave 1 — Common chrome:** Visible / DisplayMode / Disabled consistency — **Done** (Studio registry + defaults; Runtime `readVisible` unwraps `{ value }`; ControlRenderer gates).
2. **Wave 2 — Input parity:** TextInput OnChange; Dropdown DisplayField/ValueField; Tooltip — **Done**.
3. **Wave 3 — Data controls:** Form Item ← DataTable.Selected; EndsWith filter; DataTable column picker — **Done**.
4. **Wave 4 — Layout & media:** Container packing from `direction`; Image/Icon OnSelect; Timer AutoStart/Start/Repeat — **Done**.
5. **Wave 5 — Formula surface (narrow):** three-arg `Patch(DS, Selected\|Form.Item, {fields})` + base resolution — **Done** (no full evaluator rewrite).

## Doc anchors

- Toolbox & nesting: `docs/studio-controls.md`
- Form: `docs/form-runtime.md`
- Gallery/DataTable: `docs/gallery-runtime.md`
- Property evaluation: `docs/property-engine.md`
