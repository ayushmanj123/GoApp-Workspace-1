# Studio Controls (Phases 7.27 / 7.30)

Phase 7.27 expanded the Studio toolbox with interactive HTML controls and Konva decorative shape primitives. Phase 7.30 polished canvas UX: single-line toolbox, Shapes flyout, designer chrome CSS, and Power Apps–like container nesting.

Run validation:

```bash
node infrastructure/scripts/validate-phase-7.27.mjs
node infrastructure/scripts/validate-phase-7.30.mjs
```

## Toolbox (7.30)

- One centered tools row with `flex-wrap: nowrap` and horizontal scroll when needed (`ToolsFooter`).
- Decorative shapes live under a single **Shapes** button → flyout (Rectangle, Ellipse, Line, Arrow, Shape Image, Star). The menu is **portaled to `document.body`** with `position: fixed` so it is not clipped by the canvas/`overflow` ancestors. Drag payload remains `application/goapps-control`.
- Footer height: `--tools-footer-height` (~52px).

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
| DataTable | `datatable` | table + paging | sample rows | `items`, `pageSize`, `offset` |

### Designer chrome

Host CSS (`StudioControlRenderer.module.css`) stretches only fill controls (button, text/date inputs, `.fillControl`). Toggle track/thumb and Checkbox inputs keep intrinsic size so they look like a switch / checkbox. Empty Form shows “Drop fields or Generate fields”.

### Data binding

- **Dropdown** — `Items` formula resolves to option rows; `Default` binds to parent item fields (same pattern as TextInput); `OnChange` runs action formulas via the runtime kernel when a session is active.
- **Checkbox / Toggle / DatePicker** — support static values plus optional `Default` parent-item binding and `OnChange` actions.

### Container nesting (drop + insert-into-selection)

`container` (also Form / Gallery / component instances) is a layout parent:

1. **Drop** — drop any toolbox control (HTML or shape) onto a container on the canvas to nest (`parent_control_id` + local x/y).
2. **Insert-into-selection** — with a container selected (or while in container-edit mode, or with a nested child selected), clicking a toolbox tool / shape nests the new control inside that container with a small offset.

Children use **absolute** coordinates inside the parent. Nested shapes position via designer `absoluteBounds` so they track the container. Double-click a container to edit nested children; banner: “Editing Container — Esc to exit”.

DataTable can be a **child of** a Container; it is not itself a nest target for cell children.

#### Nesting model (current vs next)

| Behavior | Status |
|----------|--------|
| Drop any control/shape onto Container / Form / Gallery | Done (`hitTestContainerAtPoint` → `parent_control_id`) |
| Click toolbox while Container selected → nest inside | Done (`resolveInsertParentId`) |
| Container-edit mode (double-click / Esc) | Done |
| Nested shapes follow parent via `absoluteBounds` | Done |
| Visual drop highlight while dragging over a container | Done (`dropTargetControlId` + outline) |
| Reparent via drag existing control into/out of container | Done (pointer drag → `updateControl` parent + local x/y) |
| Explorer tree nest/un-nest / Indent commands | **Next** |
| Auto-layout packing (`direction` horizontal/vertical) | Deferred |

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

## Out of scope

- Full Power Fx `Items` table field mapping (DisplayField / ValueField) beyond lookup Dropdown
- Horizontal/Vertical auto-layout packing inside Container (`direction` reserved)
- Animated shape transitions
- Vector icon font packs beyond named glyphs + emoji
