---
name: canvas-component-capabilities
description: >-
  Extends GoApps canvas controls toward Power Apps–like capabilities by adding
  properties, events, and runtime behavior on top of existing Studio metadata,
  Runtime renderers, and Go session services—without refactoring. Use when
  working on Form, Gallery, DataTable, Button, TextInput, Dropdown, Checkbox,
  Toggle, DatePicker, Container, Image, Icon, Timer, Label, shapes, DataCard,
  DisplayMode, OnSelect, OnChange, Items, Default, Selected, control parity,
  or additive component features.
---

# Canvas component capabilities

Build **on top of** existing GoApps controls. Prefer new properties, handlers, and kernel paths. Do **not** rename `control_type`, replace Form/Gallery session APIs, invent a second property system, or do cleanup refactors unrelated to the capability.

## When to use

- User asks for Power Apps canvas–like behavior on a control
- Adding Visible / DisplayMode / Disabled / Tooltip / OnChange / OnSelect / Items / Default
- Deepening Form, Gallery, DataTable, or input controls
- Filling a gap listed in the control matrix

## Hard rules

1. **Build on top** — extend existing files; do not rewrite architecture.
2. **One capability family per change** — e.g. DisplayMode on inputs, not “entire Dropdown rewrite.”
3. **Follow the additive stack** — see [references/extension-patterns.md](references/extension-patterns.md).
4. **Update the matrix** after shipping — [references/control-matrix.md](references/control-matrix.md).
5. **Full Power Fx stays deferred** — target control surface only; see [references/power-apps-surface.md](references/power-apps-surface.md).

## Workflow

Copy and track:

```
Capability Progress:
- [ ] 1. Read control-matrix.md for this control_type
- [ ] 2. Read power-apps-surface.md for the target property/event
- [ ] 3. Read extension-patterns.md (layer order)
- [ ] 4. Implement additive changes only
- [ ] 5. Verify (unit-check / Go tests / manual Runtime)
- [ ] 6. Append matrix + docs (do not rewrite history)
```

### Step 1 — Inventory

Open [references/control-matrix.md](references/control-matrix.md). Note **Already in GoApps** and **Next additive gap**. Do not invent gaps already marked Done.

### Step 2 — Scope one gap

Pick a single gap (or a shared chrome property across sibling controls). Align with later waves when possible:

| Wave | Focus |
|------|--------|
| 1 | Visible / DisplayMode / Disabled consistency |
| 2 | TextInput OnChange; Dropdown DisplayField/ValueField; Tooltip |
| 3 | Form / Gallery / DataTable selection & filter/column UX |
| 4 | Container layout from `direction`; Image OnSelect; Timer Start/Stop |
| 5 | Narrow formula/events needed by those controls only |

### Step 3 — Extend layers (order)

1. `apps/studio/src/control-defaults.ts`
2. `apps/studio/src/property-metadata/registry.ts`
3. Designer preview only if visual change needed
4. `apps/runtime/src/components/<control>.tsx` (+ `registry-bridge.tsx` only if registering something new)
5. Action/data formula hooks / Go dispatcher only if a new event/formula is required
6. Go session packages (`form`, `gallery`, `properties`) for data controls — extend, don’t replace
7. Append notes in `docs/studio-controls.md` / `docs/*-runtime.md`

Details: [references/extension-patterns.md](references/extension-patterns.md).

### Step 4 — Verify

- Studio: `node apps/studio/scripts/unit-check.mjs` when property metadata/defaults change
- Runtime: `node apps/runtime/scripts/unit-check.mjs` when Form/Gallery/actions change
- Go: `go test ./internal/<pkg>/...` under `services/runtime` for session changes
- Manual: Studio property pane shows the field; Runtime Preview exercises the behavior

### Step 5 — Record

Update the **Next additive gap** / **Already** columns in the matrix. Append a short bullet to the relevant doc. Do not rewrite completed phase narratives in `instructions.md`.

## Anti-patterns

- Renaming toolbox `control_type` values
- Replacing Form/Gallery session stores or APIs
- Parallel property bags outside `control_properties` + Studio registry
- “While I’m here” refactors
- Claiming full Power Fx parity

## References

- [control-matrix.md](references/control-matrix.md) — per-control status and next gap
- [extension-patterns.md](references/extension-patterns.md) — additive stack and file map
- [power-apps-surface.md](references/power-apps-surface.md) — target control surface
- Product docs: `docs/studio-controls.md`, `docs/form-runtime.md`, `docs/gallery-runtime.md`, `docs/property-engine.md`
