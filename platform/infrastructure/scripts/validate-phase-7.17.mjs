/**
 * Phase 7.17 — Storage upload/delete (Create/Delete + Form ModeNew + Remove formula).
 * Run: node infrastructure/scripts/validate-phase-7.17.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.17");
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
  log("Phase 7.17 validation starting");

  const runtime = path.join(ROOT, "services/runtime");
  runGo(
    runtime,
    [
      "test",
      "./internal/databinding/",
      "-run",
      "StorageDataSourceCreateUpdateDelete|StorageDataSourceCreateBase64|StorageDataSourceCreateRequires",
      "-count=1",
    ],
    "Test 1 — StorageDataSource write unit tests",
  );
  runGo(
    runtime,
    [
      "test",
      "./internal/form/",
      "-run",
      "SubmitStorageUsesDataSource|SubmitSQLUsesDataSource",
      "-count=1",
    ],
    "Test 2 — Form storage submit + SQL regression",
  );
  runGo(
    runtime,
    ["test", "./internal/formula/", "-run", "RemoveStorageObject|PatchAndDefaults", "-count=1"],
    "Test 3 — Remove + Patch formulas",
  );

  const storageSrc = readFileSync(
    path.join(ROOT, "services/runtime/internal/databinding/storage_datasource.go"),
    "utf8",
  );
  record(
    "Test 4 — Create/Delete no longer stubbed",
    !storageSrc.includes("storage create is not supported") &&
      !storageSrc.includes("storage delete is not supported") &&
      storageSrc.includes("PutObject") &&
      storageSrc.includes("DeleteByObjectKey"),
    "storage_datasource.go write implementations present",
  );

  const instructions = readFileSync(path.join(ROOT, "instructions.md"), "utf8");
  record(
    "Test 5 — instructions.md marks 7.17 COMPLETE",
    /7\.17.*COMPLETE/i.test(instructions),
    "7.17 COMPLETE row",
  );

  const docs = readFileSync(path.join(ROOT, "docs/storage-connectors.md"), "utf8");
  record(
    "Test 6 — docs describe writes",
    docs.includes("Writes (Phase 7.17)") && !docs.includes("- Upload / delete from gallery"),
    "storage-connectors.md write section",
  );

  const failed = results.filter((r) => !r.passed);
  log(`Done: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main();
