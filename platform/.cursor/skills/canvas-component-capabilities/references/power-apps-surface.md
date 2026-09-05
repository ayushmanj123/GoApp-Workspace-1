# Power Apps–inspired control surface

GoApps is **Power Apps–inspired**, not a full Power Fx clone. This skill targets **control functionality** and the **already-shipped formula/action slice**. Full Power Fx language parity remains deferred (`docs/architecture.md`, `instructions.md`).

## In scope (build toward)

### Common chrome

| Property | Intent |
|----------|--------|
| Visible | Show/hide without removing from tree |
| DisplayMode | Edit / View / Disabled (Form fields already use this pattern) |
| Disabled | Block interaction |
| Tooltip | Hover hint (additive when cheap) |

### Input & actions

| Event / prop | Intent |
|--------------|--------|
| OnSelect | Button, Image, Icon, shapes (when product wants click) |
| OnChange | TextInput, Dropdown, Checkbox, Toggle, DatePicker |
| Default | Seed from `ThisItem` / `Parent.Item` / Defaults(DS) |
| Value / Checked / Text | Current control state |

### Lists & forms

| Capability | Intent |
|------------|--------|
| Items | Gallery/DataTable/Dropdown data |
| Selected / AllItems | Gallery/DataTable selection for Form.Item |
| Filter / Sort / Limit / PageSize | List query (existing gallery path) |
| Refresh(DataSource) | Reload bound lists (Studio Refresh UX for DataTable) |
| Form Mode | New / Edit / View + NewForm / EditForm / ViewForm |
| SubmitForm / ResetForm | Persist / restore |
| Form.Valid / Unsaved / Updates / LastSubmit / Error | Status surface |
| OnSuccess / OnFailure | Post-submit behavior |

### Layout & media (later waves)

| Capability | Intent |
|------------|--------|
| Container direction packing | Auto-layout from stored `direction` |
| Timer Start/Stop/AutoStart/Repeat | Beyond Duration + OnTimerEnd |
| Image/Icon OnSelect | Clickable media |

## Out of scope (do not expand this skill into)

- Full Power Fx expression language / type system parity
- Attachments / People / Rich text field types on Form (documented later N/A)
- Realtime collaboration, Marketplace, AI
- Replacing HTML/Konva chrome wholesale
- Icon font marketplace packs (explicitly deferred in `docs/studio-controls.md`)

## Shipped formula/action slice (reuse)

Prefer existing calls over inventing new ones:

`Set`, `UpdateContext`, `Navigate`, `Back`, `Collect`, `ClearCollect`, `Clear`, `Patch`, `Remove`, `Defaults`, `SubmitForm`, `ResetForm`, `NewForm`, `EditForm`, `ViewForm`, `LookUp`, `Filter`, `Refresh`, `If` (as implemented in the Go dispatcher).

Chain with `;` where the runtime already supports statements.

## Mapping tip

When a user says “like Power Apps X”:

1. Find the control row in `control-matrix.md`.
2. Map X to a row in this surface (or mark deferred).
3. Implement via `extension-patterns.md` on existing seams.
4. Do not start a new formula language or control framework.
