/**
 * Phase 7.18 — Richer Filter / LookUp (And parse, SQL WHERE, LookUp formula).
 * Run: node infrastructure/scripts/validate-phase-7.18.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.18");
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
  log("Phase 7.18 validation starting");

  const runtime = path.join(ROOT, "services/runtime");
  runGo(
    runtime,
    [
      "test",
      "./internal/databinding/",
      "-run",
      "ParseEqualsFilter|SqlDataSourceQuery",
      "-count=1",
    ],
    "Test 1 — Filter parse + SQL Query (incl. WHERE pushdown)",
  );
  runGo(
    runtime,
    ["test", "./internal/formula/", "-run", "LookUpReturnsFirstMatch|PatchAndDefaults", "-count=1"],
    "Test 2 — LookUp formula",
  );

  const middleware = readFileSync(
    path.join(ROOT, "packages/shared/go/middleware/middleware.go"),
    "utf8",
  );
  record(
    "Test 3 — RequestID stamps inbound header",
    middleware.includes(`c.Request().Header.Set(requestIDHeader, requestID)`),
    "middleware RequestID inbound stamp",
  );

  const sqlSrc = readFileSync(
    path.join(ROOT, "services/runtime/internal/databinding/sql_datasource.go"),
    "utf8",
  );
  record(
    "Test 4 — SQL WHERE pushdown present",
    sqlSrc.includes("resolveListQueryArgs") && sqlSrc.includes("WHERE %s"),
    "sql_datasource.go WHERE clause builder",
  );

  const instructions = readFileSync(path.join(ROOT, "instructions.md"), "utf8");
  record(
    "Test 5 — instructions.md marks 7.18 COMPLETE",
    /7\.18.*COMPLETE/i.test(instructions),
    "7.18 COMPLETE row",
  );

  const galleryDocs = readFileSync(path.join(ROOT, "docs/gallery-runtime.md"), "utf8");
  const sqlDocs = readFileSync(path.join(ROOT, "docs/sql-connectors.md"), "utf8");
  record(
    "Test 6 — docs describe Filter/LookUp",
    galleryDocs.includes("LookUp (Phase 7.18)") && sqlDocs.includes("Filters (Phase 7.18)"),
    "gallery-runtime.md + sql-connectors.md",
  );

  const failed = results.filter((r) => !r.passed);
  log(`Done: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main();
