# Extension patterns (additive stack)

Use this order when adding a capability. Skip layers that are truly unchanged.

## Layer order

| # | Layer | Path | What to add |
|---|--------|------|-------------|
| 1 | Defaults | `apps/studio/src/control-defaults.ts` | Initial property bag when the control is dropped |
| 2 | Property metadata | `apps/studio/src/property-metadata/registry.ts` | Panel field: `text` / `boolean` / `number` / `color` / `formula` |
| 3 | Designer preview | `apps/studio/src/canvas/designer/` | Visual-only chrome if needed (`DesignerPrimitives.tsx`, `register-designer-renderers.tsx`) |
| 4 | Runtime component | `apps/runtime/src/components/*.tsx` | Read props; wire events; bind Default/Items |
| 5 | Registry bridge | `apps/runtime/src/registry-bridge.tsx` | Only when registering a **new** control type (rare) |
| 6 | Actions / formulas | `apps/runtime/src/hooks/use-runtime-action-handler.ts`, `apps/runtime/src/formula/`, `services/runtime/internal/formula/dispatcher.go` | New OnSelect/OnChange/behavior calls |
| 7 | Go session | `services/runtime/internal/form/`, `gallery/`, `properties/` | Data binding, selection sync, property evaluation |
| 8 | Docs | `docs/studio-controls.md`, `docs/form-runtime.md`, `docs/gallery-runtime.md`, `docs/property-engine.md` | Append capability notes |

## Property metadata conventions

- Static UI values → `type: "text" | "boolean" | "number" | "color"`.
- Always-formula (Items, Item, Default, Filter, OnSelect, OnChange) → `type: "formula"`.
- Data formulas (`items`, `item`, `default`, `filter`, `update`) vs action formulas are distinguished in `registry.ts` via `DATA_FORMULA_NAMES`.
- Studio stores many values as `{ value: ... }` or `{ formula: "..." }`. Runtime/Go readers must accept **both** plain strings and wrappers (see Form `ReadDataSource` / mode parsers).

## Runtime component patterns

- Resolve props through existing helpers (`readPropertyFormula`, session clients, `useParentItemDefault` for `ThisItem` / `Parent.Item`).
- Reuse `useRuntimeActionHandler(onSelect|onChange, ...)` for behavior formulas.
- For Gallery/DataTable selection → Form: call existing `selectGalleryItem` and bump `bumpFormRefresh` — do not invent a second selection bus.
- Support field names with spaces (`ThisItem.Column 1`) via existing `parseParentItemField` patterns.

## Go session patterns (data controls)

- **Form:** extend `services/runtime/internal/form/` (`metadata.go` readers, `service.go` modes/submit, gallery sync). Prefer new readers over new packages.
- **Gallery / DataTable:** same gallery session path (`IsItemsControl`); extend filter/sort/query overrides, not a parallel list store.
- **Properties engine:** `services/runtime/internal/properties/` — add to supported evaluation only when the kernel must resolve the property server-side; many UI props stay client-only.

## Shared / thin registry

- `packages/ui/src/registry.components-v1.ts` is a stub catalog. Prefer Studio + Runtime as source of truth for behavior. Touch the package only if catalog listing must mention a new type.

## Verification hooks

| Change area | Check |
|-------------|--------|
| Studio props/defaults | `node apps/studio/scripts/unit-check.mjs` |
| Runtime Form/actions | `node apps/runtime/scripts/unit-check.mjs` |
| Form/gallery Go | `go test ./internal/form/...` or `./internal/gallery/...` in `services/runtime` |
| Phase scripts | Existing `infrastructure/scripts/validate-phase-7.*.mjs` only if the capability intersects those phases |

## Anti-patterns

- Renaming `control_type` or PascalCase registry aliases without a dual-read shim
- Replacing Form/Gallery session stores or HTTP routes
- New parallel property systems outside `control_properties` + Studio registry
- Broad “cleanup” refactors while adding one capability
- Full Power Fx evaluator rewrites (out of scope for this skill)
