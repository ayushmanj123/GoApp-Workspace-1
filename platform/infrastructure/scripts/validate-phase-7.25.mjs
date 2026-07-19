/**
 * Phase 7.25 — Action parity + Remove entity/SQL/REST + gallery props + Timer.
 * Run: node infrastructure/scripts/validate-phase-7.25.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.25");
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
  log("Phase 7.25 validation starting");

  const runtime = path.join(ROOT, "services/runtime");
  runGo(
    runtime,
    ["test", "./internal/formula/", "./internal/gallery/", "-count=1"],
    "Test 1 — formula + gallery unit tests",
  );

  const dispatcher = readFileSync(
    path.join(ROOT, "services/runtime/internal/formula/dispatcher.go"),
    "utf8",
  );
  record(
    "Test 2 — Remove supports entity/SQL/REST Delete",
    dispatcher.includes("resolveRemoveRecordID") &&
      !dispatcher.includes("Remove() currently supports storage connectors only") &&
      dispatcher.includes("source.Delete("),
    "dispatcher.go execRemove",
  );

  const validateSrc = readFileSync(
    path.join(ROOT, "apps/studio/src/components/formula/validate-action-formula.ts"),
    "utf8",
  );
  record(
    "Test 3 — Studio action validator + semicolon",
    validateSrc.includes("splitStatements") &&
      validateSrc.includes("Patch") &&
      validateSrc.includes("Remove") &&
      validateSrc.includes("NewForm") &&
      validateSrc.includes("Back"),
    "validate-action-formula.ts",
  );

  const registry = readFileSync(
    path.join(ROOT, "apps/studio/src/property-metadata/registry.ts"),
    "utf8",
  );
  record(
    "Test 4 — gallery filter/sort/limit + form dataSource",
    registry.includes('name: "filter"') &&
      registry.includes('name: "sort"') &&
      registry.includes('name: "limit"') &&
      registry.includes('name: "dataSource"'),
    "property-metadata/registry.ts",
  );

  const galleryMeta = readFileSync(
    path.join(ROOT, "services/runtime/internal/gallery/metadata.go"),
    "utf8",
  );
  const gallerySvc = readFileSync(
    path.join(ROOT, "services/runtime/internal/gallery/service.go"),
    "utf8",
  );
  record(
    "Test 5 — gallery sort/limit wired to QueryOverrides",
    galleryMeta.includes("ReadSortFormula") &&
      galleryMeta.includes("ReadLimitProperty") &&
      gallerySvc.includes("Sort:") &&
      gallerySvc.includes("overrides.Limit"),
    "gallery metadata + service",
  );

  const timer = readFileSync(
    path.join(ROOT, "apps/runtime/src/components/timer.tsx"),
    "utf8",
  );
  const footer = readFileSync(
    path.join(ROOT, "apps/studio/src/components/layout/ToolsFooter.tsx"),
    "utf8",
  );
  record(
    "Test 6 — Timer kernel path + ToolsFooter",
    timer.includes("executeRuntimeAction") &&
      timer.includes("OnTimerEnd") &&
      footer.includes('type: "timer"'),
    "timer.tsx + ToolsFooter.tsx",
  );

  const instructions = readFileSync(path.join(ROOT, "instructions.md"), "utf8");
  record(
    "Test 7 — instructions 7.25 COMPLETE",
    instructions.includes("| 7.25 |") &&
      instructions.includes("Action parity") &&
      instructions.includes("COMPLETE") &&
      instructions.includes("validate-phase-7.25.mjs"),
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
