/**
 * Phase 7.29 — DataTable control + gallery/datatable paging.
 * Run: node infrastructure/scripts/validate-phase-7.29.mjs
 */
import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.29");
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
  log("Phase 7.29 validation starting");

  const defaults = readFileSync(path.join(ROOT, "apps/studio/src/control-defaults.ts"), "utf8");
  record(
    "Test 1 — control-defaults datatable type",
    defaults.includes('control_type: "datatable"') && defaults.includes("pageSize"),
    "control-defaults.ts",
  );

  const footer = readFileSync(
    path.join(ROOT, "apps/studio/src/components/layout/ToolsFooter.tsx"),
    "utf8",
  );
  record(
    "Test 2 — ToolsFooter datatable entry",
    footer.includes('type: "datatable"') && footer.includes("Data Table"),
    "ToolsFooter.tsx",
  );

  const propertyMeta = readFileSync(
    path.join(ROOT, "apps/studio/src/property-metadata/registry.ts"),
    "utf8",
  );
  record(
    "Test 3 — property metadata datatable + pageSize on gallery/datatable",
    propertyMeta.includes("datatable: DATATABLE_PROPERTIES") &&
      propertyMeta.includes('name: "pageSize"') &&
      propertyMeta.includes("GALLERY_PROPERTIES"),
    "property-metadata/registry.ts",
  );

  const datatable = readFileSync(
    path.join(ROOT, "apps/runtime/src/components/datatable.tsx"),
    "utf8",
  );
  record(
    "Test 4 — runtime DataTable Items/Selected/table",
    datatable.includes("useResolvedGalleryRecords") &&
      datatable.includes("selectionStore.select") &&
      datatable.includes("<table") &&
      datatable.includes("Load more"),
    "datatable.tsx",
  );

  const bridge = readFileSync(path.join(ROOT, "apps/runtime/src/registry-bridge.tsx"), "utf8");
  const designer = readFileSync(
    path.join(ROOT, "apps/studio/src/canvas/designer/register-designer-renderers.tsx"),
    "utf8",
  );
  record(
    "Test 5 — registry + designer DataTable",
    bridge.includes('"DataTable"') && designer.includes("DesignerDataTable"),
    "registry-bridge + register-designer-renderers",
  );

  const gallery = readFileSync(path.join(ROOT, "apps/runtime/src/components/gallery.tsx"), "utf8");
  const galleryMeta = readFileSync(
    path.join(ROOT, "services/runtime/internal/gallery/metadata.go"),
    "utf8",
  );
  const gallerySvc = readFileSync(
    path.join(ROOT, "services/runtime/internal/gallery/service.go"),
    "utf8",
  );
  record(
    "Test 6 — paging pageSize/Load more + QueryOverrides.Offset",
    gallery.includes("usePagedRecords") &&
      gallery.includes("Load more") &&
      galleryMeta.includes("ReadPageSizeProperty") &&
      galleryMeta.includes("ReadOffsetProperty") &&
      galleryMeta.includes("IsDataTableControl") &&
      gallerySvc.includes("overrides.Offset"),
    "gallery runtime + gallery service",
  );

  const docs = readFileSync(path.join(ROOT, "docs/gallery-runtime.md"), "utf8");
  record(
    "Test 7 — docs paging note",
    docs.includes("pageSize") && docs.includes("Load more"),
    "docs/gallery-runtime.md",
  );

  const instructions = readFileSync(path.join(ROOT, "instructions.md"), "utf8");
  record(
    "Test 8 — instructions 7.29 COMPLETE + workflow triggers next",
    instructions.includes("| 7.29 |") &&
      instructions.includes("COMPLETE") &&
      instructions.includes("Workflow entity-change") &&
      instructions.includes("validate-phase-7.29.mjs"),
    "instructions.md",
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
