/**
 * Phase 7.19 — Deeper Filter (Filter formula, Or/comparisons, collection filter).
 * Run: node infrastructure/scripts/validate-phase-7.19.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.19");
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
  log("Phase 7.19 validation starting");

  const runtime = path.join(ROOT, "services/runtime");
  runGo(
    runtime,
    [
      "test",
      "./internal/databinding/",
      "-run",
      "ParseFilterExpr|ParseEqualsFilter|MatchFilterExpr|EntityDataSourceOr|SqlDataSourceQueryPushes",
      "-count=1",
    ],
    "Test 1 — FilterExpr parse + entity/SQL apply",
  );
  runGo(
    runtime,
    ["test", "./internal/formula/", "-run", "FilterReturnsMatchingRows|LookUpReturnsFirstMatch", "-count=1"],
    "Test 2 — Filter() + LookUp formulas",
  );
  runGo(
    runtime,
    ["test", "./internal/gallery/", "-run", "CollectionGalleryAppliesFilter", "-count=1"],
    "Test 3 — collection gallery filter",
  );

  const filterSrc = readFileSync(
    path.join(ROOT, "services/runtime/internal/databinding/filter.go"),
    "utf8",
  );
  record(
    "Test 4 — FilterExpr + ParseFilterExpr present",
    filterSrc.includes("type FilterExpr struct") && filterSrc.includes("func ParseFilterExpr"),
    "filter.go AST + parser",
  );

  const dispatcher = readFileSync(
    path.join(ROOT, "services/runtime/internal/formula/dispatcher.go"),
    "utf8",
  );
  record(
    "Test 5 — Filter() formula dispatched",
    dispatcher.includes(`"FILTER("`) && dispatcher.includes("execFilter"),
    "dispatcher FILTER + execFilter",
  );

  const instructions = readFileSync(path.join(ROOT, "instructions.md"), "utf8");
  record(
    "Test 6 — instructions.md marks 7.19 COMPLETE",
    /7\.19.*COMPLETE/i.test(instructions),
    "7.19 COMPLETE row",
  );

  const galleryDocs = readFileSync(path.join(ROOT, "docs/gallery-runtime.md"), "utf8");
  const sqlDocs = readFileSync(path.join(ROOT, "docs/sql-connectors.md"), "utf8");
  record(
    "Test 7 — docs describe Filter / Or / comparisons",
    galleryDocs.includes("Filter formula (Phase 7.19)") &&
      galleryDocs.includes("Or(") &&
      sqlDocs.includes("7.19"),
    "gallery-runtime.md + sql-connectors.md",
  );

  const failed = results.filter((r) => !r.passed);
  log("---");
  log(`Results: ${results.length - failed.length}/${results.length} passed, ${failed.length} failed`);
  for (const r of results) {
    log(`  ${r.passed ? "✓" : "✗"} ${r.test}`);
  }
  process.exit(failed.length > 0 ? 1 : 0);
}

main();
