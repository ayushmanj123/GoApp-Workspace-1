/**
 * Phase 7.20 — Entity DB WHERE pushdown (FilterExpr → Postgres JSONB).
 * Run: node infrastructure/scripts/validate-phase-7.20.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.20");
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
  log("Phase 7.20 validation starting");

  const runtime = path.join(ROOT, "services/runtime");
  runGo(
    runtime,
    [
      "test",
      "./internal/records/",
      "-run",
      "BuildJSONBFilterClause|MatchFilterExpr|ServiceListFilterPaging",
      "-count=1",
    ],
    "Test 1 — JSONB WHERE builder + service filtered List",
  );
  runGo(
    runtime,
    [
      "test",
      "./internal/databinding/",
      "-run",
      "EntityDataSourceFilterSortPaging|EntityDataSourceSparseFilterPaging|EntityDataSourceOr",
      "-count=1",
    ],
    "Test 2 — EntityDataSource pushdown + sparse paging",
  );

  const filterSrc = readFileSync(
    path.join(ROOT, "services/runtime/internal/records/filter.go"),
    "utf8",
  );
  record(
    "Test 3 — records FilterExpr + buildJSONBFilterClause",
    filterSrc.includes("type FilterExpr struct") && filterSrc.includes("buildJSONBFilterClause"),
    "records/filter.go",
  );

  const dsSrc = readFileSync(
    path.join(ROOT, "services/runtime/internal/databinding/datasource.go"),
    "utf8",
  );
  record(
    "Test 4 — EntityDataSource passes FilterExpr (no 1000 prefetch)",
    dsSrc.includes("toRecordsFilterExpr") &&
      dsSrc.includes("FilterExpr:     toRecordsFilterExpr") &&
      !dsSrc.includes("fetchLimit = 1000"),
    "datasource.go pushdown",
  );

  const instructions = readFileSync(path.join(ROOT, "instructions.md"), "utf8");
  record(
    "Test 5 — instructions.md marks 7.20 COMPLETE",
    /7\.20.*COMPLETE/i.test(instructions),
    "7.20 COMPLETE row",
  );

  const bindingDocs = readFileSync(path.join(ROOT, "docs/runtime-data-binding.md"), "utf8");
  const galleryDocs = readFileSync(path.join(ROOT, "docs/gallery-runtime.md"), "utf8");
  record(
    "Test 6 — docs describe entity JSONB WHERE pushdown",
    bindingDocs.includes("Phase 7.20") &&
      galleryDocs.includes("Phase 7.20") &&
      bindingDocs.includes("JSONB"),
    "runtime-data-binding.md + gallery-runtime.md",
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
