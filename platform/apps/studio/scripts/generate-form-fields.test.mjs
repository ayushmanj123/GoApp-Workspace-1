/**
 * Runtime tests for generate-form-fields helpers via Vite SSR.
 * Run: node apps/studio/scripts/generate-form-fields.test.mjs
 */
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const server = await createServer({
  root,
  configFile: path.join(root, "vite.config.ts"),
  logLevel: "error",
});
await server.pluginContainer.buildStart({});

const mod = await server.ssrLoadModule("/src/utils/generate-form-fields.ts");
const {
  buildFormFieldControls,
  computeCardLayout,
  computeRequiredFormHeight,
  resolveFormLayout,
} = mod;

const now = "2026-01-01T00:00:00.000Z";
const form = {
  id: "form-1",
  tenant_id: "tenant-1",
  screen_id: "screen-1",
  parent_control_id: null,
  control_type: "form",
  name: "Form1",
  x: 0,
  y: 0,
  width: 320,
  height: 200,
  z_index: 1,
  properties: {
    layout: { value: "Vertical" },
    columns: { value: 2 },
  },
  deleted_at: null,
  CreatedOn: now,
  ModifiedOn: now,
};

const fields = [
  {
    id: "f1",
    tenant_id: "tenant-1",
    entity_id: "e1",
    name: "Name",
    display_name: "Name",
    field_type: "text",
    is_required: true,
  },
  {
    id: "f2",
    tenant_id: "tenant-1",
    entity_id: "e1",
    name: "Amount",
    display_name: "Amount",
    field_type: "currency",
    is_required: false,
  },
];

const generated = buildFormFieldControls({
  form,
  fields,
  entities: [],
  existingNames: ["Form1"],
  nextZIndex: 2,
  now,
});

const datacards = generated.controls.filter((c) => c.control_type === "datacard");
assert.equal(datacards.length, 2, "expected one DataCard per field");

for (const card of datacards) {
  assert.equal(card.parent_control_id, form.id, "DataCard parent must be Form");
  const children = generated.controls.filter((c) => c.parent_control_id === card.id);
  assert.equal(children.length, 2, "each DataCard should have label + input");
  assert.ok(
    children.some((c) => c.control_type === "label" && c.x === 0 && c.y === 0),
    "label should be positioned at card origin",
  );
  const input = children.find((c) => c.control_type !== "label");
  assert.ok(input, "input child expected");
  assert.equal(input.parent_control_id, card.id);
  assert.equal(input.properties?.default?.formula, `ThisItem.${card.properties.dataField.value}`);
  assert.equal(card.properties.default.formula, `ThisItem.${card.properties.dataField.value}`);
}

const nameCard = datacards.find((c) => c.properties.dataField.value === "Name");
assert.equal(nameCard.properties.required.value, true);
assert.equal(nameCard.properties.displayMode.value, "Edit");
assert.equal(nameCard.properties.visible.value, true);

const columnsLayout = computeCardLayout({
  form,
  index: 1,
  fieldCount: 4,
  layout: "Columns",
  columns: 2,
});
assert.ok(columnsLayout.x > 12, "second column card should shift horizontally");

const horizontalHeight = computeRequiredFormHeight({
  form,
  fieldCount: 3,
  layout: "Horizontal",
  columns: 2,
});
assert.ok(horizontalHeight < 200, "horizontal layout should not stack rows");

assert.deepEqual(resolveFormLayout(form), { layout: "Vertical", columns: 2 });

await server.close();
console.log("generate-form-fields.test: PASS");
