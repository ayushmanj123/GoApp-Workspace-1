/**

 * Phase 7.27 — Control palette expansion (HTML controls + Konva decorative shapes).

 * Run: node infrastructure/scripts/validate-phase-7.27.mjs

 */

import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";

import path from "node:path";

import { fileURLToPath } from "node:url";



const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.resolve(__dirname, "../..");

const OUT_DIR = path.resolve(ROOT, ".validation-7.27");

const LOG_FILE = path.join(OUT_DIR, "validation.log");



const results = [];



function log(line) {

  const msg = `[${new Date().toISOString()}] ${line}`;

  console.log(msg);

  appendFileSync(LOG_FILE, `${msg}\n`);

}



function record(test, passed, detail) {

  results.push({ test, passed, detail });

  log(`${passed ? "PASS" : "FAIL"} — ${test}: ${detail}`);

}



function main() {

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  writeFileSync(LOG_FILE, "");

  log("Phase 7.27 validation starting");



  const defaults = readFileSync(

    path.join(ROOT, "apps/studio/src/control-defaults.ts"),

    "utf8",

  );

  record(

    "Test 1 — control-defaults HTML + shape types",

    defaults.includes('control_type: "dropdown"') &&

      defaults.includes('control_type: "container"') &&

      defaults.includes('control_type: "checkbox"') &&

      defaults.includes('control_type: "toggle"') &&

      defaults.includes('control_type: "image"') &&

      defaults.includes('control_type: "icon"') &&

      defaults.includes('control_type: "datepicker"') &&

      defaults.includes('control_type: "shape_rectangle"') &&

      defaults.includes('control_type: "shape_star"'),

    "control-defaults.ts",

  );



  const footer = readFileSync(

    path.join(ROOT, "apps/studio/src/components/layout/ToolsFooter.tsx"),

    "utf8",

  );

  record(

    "Test 2 — ToolsFooter palette entries",

    footer.includes('type: "dropdown"') &&

      footer.includes('type: "container"') &&

      footer.includes('type: "checkbox"') &&

      footer.includes('type: "toggle"') &&

      footer.includes('type: "shape_rectangle"') &&

      footer.includes('type: "shape_ellipse"') &&

      footer.includes("SHAPE_TOOL_ITEMS"),

    "ToolsFooter.tsx",

  );



  const propertyMeta = readFileSync(

    path.join(ROOT, "apps/studio/src/property-metadata/registry.ts"),

    "utf8",

  );

  record(

    "Test 3 — property metadata bindings + shape fill/stroke",

    propertyMeta.includes('name: "items"') &&

      propertyMeta.includes('name: "onChange"') &&

      propertyMeta.includes("dropdown: DROPDOWN_PROPERTIES") &&

      propertyMeta.includes('name: "fill"') &&

      propertyMeta.includes('name: "stroke"') &&

      propertyMeta.includes("shaperectangle:"),

    "property-metadata/registry.ts",

  );



  const canvas = readFileSync(

    path.join(ROOT, "apps/studio/src/canvas/CanvasSurface.tsx"),

    "utf8",

  );

  const shapeLayer = readFileSync(

    path.join(ROOT, "apps/studio/src/canvas/designer/DesignerShapeLayer.tsx"),

    "utf8",

  );

  record(

    "Test 4 — Konva DesignerShapeLayer behind HTML overlay",

    canvas.includes("DesignerShapeLayer") &&

      canvas.includes("isShapeControlType") &&

      shapeLayer.includes("react-konva") &&

      shapeLayer.includes("Rect") &&

      shapeLayer.includes("Star"),

    "CanvasSurface + DesignerShapeLayer",

  );



  const dropdown = readFileSync(

    path.join(ROOT, "apps/runtime/src/components/dropdown.tsx"),

    "utf8",

  );

  record(

    "Test 5 — dropdown Items/Default/OnChange runtime",

    dropdown.includes("useResolvedGalleryRecords") &&

      dropdown.includes("defaultProperty") &&

      dropdown.includes("useRuntimeActionHandler") &&

      dropdown.includes("OnChange"),

    "dropdown.tsx",

  );



  const bridge = readFileSync(

    path.join(ROOT, "apps/runtime/src/registry-bridge.tsx"),

    "utf8",

  );

  const shapes = readFileSync(

    path.join(ROOT, "apps/runtime/src/components/shape-primitives.tsx"),

    "utf8",

  );

  record(

    "Test 6 — runtime registry + SVG shapes (no konva)",

    bridge.includes('"Checkbox"') &&

      bridge.includes('"ShapeRectangle"') &&

      bridge.includes('"DatePicker"') &&

      shapes.includes("ShapeSvgFrame") &&

      !shapes.includes("konva") &&

      !readFileSync(path.join(ROOT, "apps/runtime/package.json"), "utf8").includes('"konva"'),

    "registry-bridge + shape-primitives",

  );



  const designer = readFileSync(

    path.join(ROOT, "apps/studio/src/canvas/designer/register-designer-renderers.tsx"),

    "utf8",

  );

  record(

    "Test 7 — designer renderers for new HTML controls",

    designer.includes('"Dropdown"') &&

      designer.includes('"Container"') &&

      designer.includes("DesignerCheckbox") &&

      designer.includes("ShapeRectangle"),

    "register-designer-renderers.tsx",

  );



  const docs = readFileSync(path.join(ROOT, "docs/studio-controls.md"), "utf8");

  const instructions = readFileSync(path.join(ROOT, "instructions.md"), "utf8");

  record(

    "Test 8 — docs + instructions 7.27 COMPLETE + next 7.28",

    docs.includes("Konva decorative primitives") &&

      docs.includes("shape_rectangle") &&

      instructions.includes("| 7.27 |") &&

      instructions.includes("control palette") &&

      instructions.includes("COMPLETE") &&

      instructions.includes("7.28") &&

      instructions.includes("validate-phase-7.27.mjs"),

    "docs/studio-controls.md + instructions.md",

  );



  const failed = results.filter((r) => !r.passed).length;

  log("---");

  log(`Results: ${results.length - failed} passed, ${failed} failed`);

  for (const r of results) {

    log(`  ${r.passed ? "✓" : "✗"} ${r.test}`);

  }

  process.exit(failed > 0 ? 1 : 0);

}



main();

