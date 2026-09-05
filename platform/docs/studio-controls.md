# Studio Controls (Phases 7.27 / 7.30 / 7.31)

Phase 7.27 expanded the Studio toolbox with interactive HTML controls and Konva decorative shape primitives. Phase 7.30 polished canvas UX: single-line toolbox, Shapes flyout, designer chrome CSS, and Power Apps–like container nesting. Phase 7.31 adds a Konva-style context menu, Shift-only snap guides, and simpler nest actions.

Run validation:

```bash
node infrastructure/scripts/validate-phase-7.27.mjs
node infrastructure/scripts/validate-phase-7.30.mjs
node infrastructure/scripts/validate-phase-7.31.mjs
```

## Toolbox (7.30)

- One centered tools row with `flex-wrap: nowrap` and horizontal scroll when needed (`ToolsFooter`).
- Decorative shapes live under a single **Shapes** button → flyout (Rectangle, Ellipse, Line, Arrow, Shape Image, Star). The menu is **portaled to `document.body`** with `position: fixed` so it is not clipped by the canvas/`overflow` ancestors. Drag payload remains `application/goapps-control`.
- Footer height: `--tools-footer-height` (~52px).

## Canvas editor chrome (7.31)

- Right-click context menu: Lock, Duplicate, Remove, Layering (To Front / Forward / Backward / To back).
- Container: Insert into Container… · Non-container: Nest into Container…
- Drag: free move by default; hold **Shift** for snap + alignment guides.
- Property panel / formula bar typing is not stolen by canvas hotkeys.

## Interactive HTML controls

| Control | Toolbox type | Runtime | Designer | Property highlights |
|---------|--------------|---------|----------|---------------------|
| Dropdown | `dropdown` | `<select>` with Items/Default/OnChange | HTML preview | `items`, `default`, `value`, `onChange` |
| Container | `container` | nested child layout | bordered box + children | `direction` |
| Checkbox | `checkbox` | checkbox + label | HTML preview | `text`, `checked`, `default`, `onChange` |
| Toggle | `toggle` | switch + label | HTML preview | `text`, `checked`, `default`, `onChange` |
| Image | `image` | `<img src>` | HTML preview | `src`, `alt` |
| Icon | `icon` | emoji / named glyph | HTML preview | `icon`, `color` |
| DatePicker | `datepicker` | `<input type="date">` | HTML preview | `value`, `default`, `onChange` |
| DataTable | `datatable` | table + paging | sample/live preview rows | `items`, `pageSize`, `offset`, `columns`, `showRefresh` (Studio Refresh data button) |

### Designer chrome

Host CSS (`StudioControlRenderer.module.css`) stretches only fill controls (button, text/date inputs, `.fillControl`). Toggle track/thumb and Checkbox inputs keep intrinsic size so they look like a switch / checkbox. Empty Form shows “Drop fields or Generate fields”.

### Data binding

- **Dropdown** — `Items` formula resolves to option rows; `Default` binds to parent item fields (same pattern as TextInput); `OnChange` runs action formulas via the runtime kernel when a session is active.
- **Checkbox / Toggle / DatePicker** — support static values plus optional `Default` parent-item binding and `OnChange` actions.

### Container nesting (drop + insert-into-selection)

`container` (also Form / Gallery / component instances) is a layout parent:

1. **Drop** — drop any toolbox control (HTML or shape) onto a container on the canvas to nest (`parent_control_id` + local x/y).
2. **Insert-into-selection** — with a container selected (or while in container-edit mode, or with a nested child selected), clicking a toolbox tool / shape nests the new control inside that container with a small offset.

Children use **absolute** coordinates inside the parent. Nested shapes position via designer `absoluteBounds` so they track the container. Double-click a container to edit nested children; banner: “Editing Container — Drop or insert tools here · Esc to exit”.

DataTable can be a **child of** a Container; it is not itself a nest target for cell children.

### Canvas context menu (7.31)

Right-click a control for **Lock**, **Duplicate**, **Remove**, and **Layering** (To Front / Forward / Backward / To back). Containers also get **Insert into Container…**; other controls get **Nest into Container…** (pick a target). Delete/Backspace removes the selection when focus is not in an input.

### Drag snap / alignment guides (7.31)

Controls move freely by default. Hold **Shift** while dragging to enable 8px grid + edge snap and show alignment guide lines.

### Studio typing (7.31)

Property Panel and Formula Bar accept typing while focused. Canvas designer control previews stay non-interactive (use Runtime Preview to type into live inputs).

#### Nesting model (current vs next)

| Behavior | Status |
|----------|--------|
| Drop any control/shape onto Container / Form / Gallery | Done (`hitTestContainerAtPoint` → `parent_control_id`) |
| Click toolbox while Container selected → nest inside | Done (`resolveInsertParentId`) |
| Container-edit mode (double-click / Esc) | Done |
| Nested shapes follow parent via `absoluteBounds` | Done |
| Visual drop highlight while dragging over a container | Done (`dropTargetControlId` + outline) |
| Reparent via drag existing control into/out of container | Done (pointer drag → `updateControl` parent + local x/y) |
| Context Insert / Nest into Container | Done (right-click menu) |
| Explorer tree nest/un-nest / Indent commands | **Next** |
| Auto-layout packing (`direction` horizontal/vertical) | Done (flex pack by `z_index`; Runtime Preview + designer) |

**Drop highlight:** while dragging from the toolbox or moving a control, the target Container/Form/Gallery shows a filled primary ring (`drop-target-outline`).

**Reparent:** drag a root control onto a container to nest it; in container-edit mode, drag a child onto the artboard (outside any container) to un-nest, or onto another container to move. Self/descendant nest targets are excluded.

## Konva decorative primitives

Shape controls render on the Konva layer **behind** the HTML control overlay in Studio (`DesignerShapeLayer` in `CanvasSurface`). At runtime they use lightweight **SVG** equivalents — Konva is not bundled into the runtime app.

| Shape | Type | Designer (Konva) | Runtime (SVG) |
|-------|------|------------------|---------------|
| Rectangle | `shape_rectangle` | `Rect` | `<rect>` |
| Ellipse | `shape_ellipse` | `Ellipse` | `<ellipse>` |
| Line | `shape_line` | `Line` | `<line>` |
| Arrow | `shape_arrow` | `Arrow` | `<line>` + marker |
| Image | `shape_image` | `Image` | `<img>` |
| Star | `shape_star` | `Star` | `<polygon>` |

Shared shape properties: `fill`, `stroke`, `strokeWidth`, `opacity`. `shape_image` also has `src`. `shape_star` adds `numPoints` and `innerRadius`.

## Studio wiring

- Toolbox: `apps/studio/src/components/layout/ToolsFooter.tsx` (single row + Shapes flyout)
- Defaults: `apps/studio/src/control-defaults.ts`
- Property panel metadata: `apps/studio/src/property-metadata/registry.ts`
- Designer HTML previews: `DesignerPrimitives.tsx`, `DesignerContainers.tsx`
- Designer Konva shapes: `apps/studio/src/canvas/designer/DesignerShapeLayer.tsx`
- Registry bridge: `apps/runtime/src/registry-bridge.tsx`

### Common chrome (Wave 1)

- **Visible** is authored in the property panel for Button, Label, Image, Icon, Timer, Gallery, DataTable, Form, Container (and the inputs that already had it). Runtime hides the control when Visible is false, including Studio `{ value: false }` wrappers (`readVisible` in `apps/runtime/src/utils/control-layout.ts`).
- **DisplayMode** (Edit / View / Disabled) is on Button and Timer (plus existing inputs/DataCard). `ControlRenderer` injects `disabled` when DisplayMode is Disabled.

### Input parity (Wave 2)

- **TextInput OnChange** runs action formulas via `useRuntimeActionHandler` (same path as Dropdown/Checkbox), after Form dirty updates.
- **Dropdown DisplayField / ValueField** map Items record fields for option label/value; falls back to `Value`/`Label` heuristics when unset.
- **Tooltip** is a text property on Button, TextInput, Dropdown, Checkbox, Toggle, and DatePicker; Runtime applies it as the native HTML `title` attribute.

### Data controls (Wave 3)

- Form **Item** source picker lists Gallery and DataTable as `Name.Selected`.
- Gallery/DataTable `filter` supports `EndsWith(Field,'…')` alongside Contains/StartsWith.
- DataTable **Columns** picker (checkboxes + reorder + CSV text) writes the existing `columns` property.

### Layout & media (Wave 4)

- **Container** packs nested children with flex from `direction` (`vertical`/`column` → column; `horizontal`/`row` → row). Child order is `z_index` ascending; authored x/y on the wire are unchanged (presentation only). Nest/drop/reparent APIs unchanged.
- **Image** and **Icon** expose **OnSelect** formulas; Runtime runs them via `useRuntimeActionHandler` on click (pointer + Enter/Space when a formula is set).
- **Timer** adds **AutoStart** (default true), **Start** (default true; set false to stop), and **Repeat** (default false) around existing Duration / OnTimerEnd.

### Formula surface (Wave 5)

- **`Patch(DS, base, {fields})`** merges identity from `gallery.Selected` / `form.Item` / `form.Updates` / a record literal with field overrides, then updates (or creates when `recordId` is absent). Two-arg `Patch` unchanged. See [runtime-formula-integration.md](./runtime-formula-integration.md).

### Form foundation (focus + scaffold)

- Form no longer autofocuses invalid fields on every Update; validation focus is Submit-only. See [form-runtime.md](./form-runtime.md).
- Scaffold sizes Form height from column count and uses deterministic DataCard IDs (re-seed safe).
- Offline / no-session Form shows a persistence warning banner.

### Label typography

- Label supports **Size** (px), **Weight** (number or normal/bold/semibold/light), and **Align** (left/center/right/justify) in the property panel; Runtime applies them as CSS `fontSize` / `fontWeight` / `textAlign`.
- Explorer control tree indents nested children by depth (`paddingLeft` scales with parent/container nesting).

## Out of scope

- Animated shape transitions
- Vector icon font packs beyond named glyphs + emoji
