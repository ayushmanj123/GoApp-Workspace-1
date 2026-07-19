/**
 * Phase 7.16 — SQL write CRUD (Create/Update/Delete + Form submit path).
 * Run: node infrastructure/scripts/validate-phase-7.16.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.16");
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
  log("Phase 7.16 validation starting");

  const runtime = path.join(ROOT, "services/runtime");
  runGo(
    runtime,
    [
      "test",
      "./internal/databinding/",
      "-run",
      "SqlDataSourceCreateUpdateDelete|SqlDataSourceWritesRequire|SqlDataSourceQuery|SqlDataSourceNamed",
      "-count=1",
    ],
    "Test 1 — SqlDataSource write unit tests",
  );
  runGo(
    runtime,
    [
      "test",
      "./internal/form/",
      "-run",
      "SubmitSQLUsesDataSource|SubmitNewCreatesRecord|SubmitExisting",
      "-count=1",
    ],
    "Test 2 — Form SQL submit + entity submit regression",
  );
  runGo(
    runtime,
    ["test", "./internal/formula/", "-run", "PatchAndDefaults", "-count=1"],
    "Test 3 — Patch formula still works",
  );

  const sqlSrc = readFileSync(
    path.join(ROOT, "services/runtime/internal/databinding/sql_datasource.go"),
    "utf8",
  );
  record(
    "Test 4 — Create/Update/Delete no longer stubbed as phase 7.6",
    !sqlSrc.includes("not supported in phase 7.6") &&
      sqlSrc.includes("INSERT INTO") &&
      sqlSrc.includes("RETURNING *"),
    "sql_datasource.go write implementations present",
  );

  const instructions = readFileSync(path.join(ROOT, "instructions.md"), "utf8");
  record(
    "Test 5 — instructions.md marks 7.16 COMPLETE",
    /7\.16.*COMPLETE/i.test(instructions),
    "7.16 COMPLETE row",
  );

  const docs = readFileSync(path.join(ROOT, "docs/sql-connectors.md"), "utf8");
  record(
    "Test 6 — docs describe writes",
    docs.includes("Writes (Phase 7.16)") && !docs.includes("- Write CRUD to external tables"),
    "sql-connectors.md write section",
  );

  const failed = results.filter((r) => !r.passed);
  log(`Done: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main();
