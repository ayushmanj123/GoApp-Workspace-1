/**
 * Phase 7.26 — Form designer completeness (nest drop, Generate fields, REST submit, New mode).
 * Run: node infrastructure/scripts/validate-phase-7.26.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.26");
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

function runGo(cwd, args, label) {
  const proc = spawnSync("go", args, { cwd, encoding: "utf8" });
  const ok = proc.status === 0;
  record(label, ok, ok ? "ok" : `${proc.stdout}\n${proc.stderr}`);
  return ok;
}

function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(LOG_FILE, "");
  log("Phase 7.26 validation starting");

  const runtime = path.join(ROOT, "services/runtime");
  runGo(
    runtime,
    ["test", "./internal/form/", "-run", "SubmitREST|SubmitSQL|SubmitStorage", "-count=1"],
    "Test 1 — form submit REST/SQL/Storage unit tests",
  );

  const formSvc = readFileSync(
    path.join(ROOT, "services/runtime/internal/form/service.go"),
    "utf8",
  );
  record(
    "Test 2 — SubmitForm REST branch",
    formSvc.includes("submitREST") &&
      formSvc.includes("DataSourceKindRest") &&
      formSvc.includes("source.Create("),
    "form/service.go",
  );

  const appStore = readFileSync(
    path.join(ROOT, "apps/studio/src/store/applicationStore.ts"),
    "utf8",
  );
  record(
    "Test 3 — createControl parent_control_id + generateFormFields",
    appStore.includes("parent_control_id?: string | null") &&
      appStore.includes("generateFormFields") &&
      appStore.includes("buildFormFieldControls"),
    "applicationStore.ts",
  );

  const canvas = readFileSync(
    path.join(ROOT, "apps/studio/src/canvas/CanvasSurface.tsx"),
    "utf8",
  );
  const hitTest = readFileSync(
    path.join(ROOT, "apps/studio/src/canvas/interaction/HitTestService.ts"),
    "utf8",
  );
  record(
    "Test 4 — nest drop into Form/Gallery",
    canvas.includes("hitTestContainerAtPoint") &&
      canvas.includes("parent_control_id: container.controlId") &&
      hitTest.includes("hitTestContainerAtPoint"),
    "CanvasSurface + HitTestService",
  );

  const generateFields = readFileSync(
    path.join(ROOT, "apps/studio/src/utils/generate-form-fields.ts"),
    "utf8",
  );
  const propertyPanel = readFileSync(
    path.join(ROOT, "apps/studio/src/components/layout/PropertyPanel.tsx"),
    "utf8",
  );
  record(
    "Test 5 — Generate fields UI + bindings",
    generateFields.includes("ThisItem.") &&
      generateFields.includes("resolveFormEntity") &&
      propertyPanel.includes("generate-form-fields-btn") &&
      propertyPanel.includes("Generate fields"),
    "generate-form-fields + PropertyPanel",
  );

  const clientForm = readFileSync(
    path.join(ROOT, "apps/runtime/src/components/form.tsx"),
    "utf8",
  );
  record(
    "Test 6 — runtime Form New mode",
    clientForm.includes('"New"') &&
      clientForm.includes('formMode === "New"') &&
      clientForm.includes("isEditLike"),
    "apps/runtime form.tsx",
  );

  const docs = readFileSync(path.join(ROOT, "docs/form-runtime.md"), "utf8");
  record(
    "Test 7 — docs/form-runtime.md Phase 7.26",
    docs.includes("Generate fields") &&
      docs.includes("Nest controls on drop") &&
      docs.includes("REST"),
    "docs/form-runtime.md",
  );

  const instructions = readFileSync(path.join(ROOT, "instructions.md"), "utf8");
  record(
    "Test 8 — instructions 7.26 COMPLETE + next 7.27",
    instructions.includes("| 7.26 |") &&
      instructions.includes("Form designer completeness") &&
      instructions.includes("COMPLETE") &&
      instructions.includes("7.27") &&
      instructions.includes("control palette") &&
      instructions.includes("validate-phase-7.26.mjs") &&
      instructions.includes("| 7.25 |") &&
      instructions.includes("7.25") &&
      instructions.includes("COMPLETE"),
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
