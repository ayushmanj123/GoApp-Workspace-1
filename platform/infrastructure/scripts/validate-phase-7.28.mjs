/**
 * Phase 7.28 — Search filters, lookup picker, typed Generate Fields.
 * Run: node infrastructure/scripts/validate-phase-7.28.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.28");
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
  log("Phase 7.28 validation starting");

  const runtime = path.join(ROOT, "services/runtime");
  runGo(
    runtime,
    ["test", "./internal/databinding/", "-run", "Contains|StartsWith", "-count=1"],
    "Test 1 — databinding Contains/StartsWith parse + match",
  );
  runGo(
    runtime,
    ["test", "./internal/records/", "-run", "Contains|StartsWith", "-count=1"],
    "Test 2 — records Contains/StartsWith JSONB + match",
  );

  const generateFields = readFileSync(
    path.join(ROOT, "apps/studio/src/utils/generate-form-fields.ts"),
    "utf8",
  );
  record(
    "Test 3 — lookup Generate fields emits Dropdown Items formula",
    generateFields.includes('field.field_type === "lookup"') &&
      generateFields.includes('control_type: "dropdown"') &&
      generateFields.includes("writePropertyFormula(relatedEntityName"),
    "generate-form-fields.ts",
  );
  record(
    "Test 4 — typed Generate fields checkbox/datepicker",
    generateFields.includes('field.field_type === "boolean"') &&
      generateFields.includes('control_type: "checkbox"') &&
      generateFields.includes('field.field_type === "date"') &&
      generateFields.includes('control_type: "datepicker"'),
    "generate-form-fields.ts",
  );

  const galleryDocs = readFileSync(path.join(ROOT, "docs/gallery-runtime.md"), "utf8");
  const bindingDocs = readFileSync(path.join(ROOT, "docs/runtime-data-binding.md"), "utf8");
  record(
    "Test 5 — docs note Contains/StartsWith gallery filters",
    galleryDocs.includes("Contains(Name,'acme')") &&
      galleryDocs.includes("StartsWith(Name,'A')") &&
      bindingDocs.includes("Contains(Field,'text')"),
    "docs/gallery-runtime.md + runtime-data-binding.md",
  );

  const instructions = readFileSync(path.join(ROOT, "instructions.md"), "utf8");
  record(
    "Test 6 — instructions 7.28 COMPLETE + next 7.29",
    instructions.includes("| 7.28 |") &&
      instructions.includes("COMPLETE") &&
      instructions.includes("7.29") &&
      instructions.includes("validate-phase-7.28.mjs"),
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
