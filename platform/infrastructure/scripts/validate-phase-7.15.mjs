/**
 * Phase 7.15 — Navigate + Filter usable Power Fx slice.
 *
 * Unlike most phase validators this one does not depend on live HTTP
 * services: the work in this phase is internal Go-host wiring (kernel
 * session navigation, gallery/connector filter passthrough), so the
 * validation is compile checks + targeted Go unit tests for the affected
 * packages (formula, gallery, kernel).
 *
 * Run: node infrastructure/scripts/validate-phase-7.15.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.15");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const RUNTIME_DIR = path.join(ROOT, "services/runtime");

const results = [];

function log(line) {
  const msg = `[${new Date().toISOString()}] ${line}`;
  console.log(msg);
  fs.appendFileSync(LOG_FILE, `${msg}\n`);
}

function record(test, passed, detail) {
  results.push({ test, passed, detail });
  log(`${passed ? "PASS" : "FAIL"} — ${test}: ${detail}`);
}

function run(cmd, args, cwd) {
  return spawnSync(cmd, args, { cwd, encoding: "utf8" });
}

function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("Phase 7.15 validation starting");

  // Test 1 — runtime service compiles.
  {
    const res = run("go", ["build", "./..."], RUNTIME_DIR);
    record(
      "Test 1 — runtime-service compiles",
      res.status === 0,
      res.status === 0 ? "ok" : res.stdout + res.stderr,
    );
  }

  // Test 2 — runtime service vets clean.
  {
    const res = run("go", ["vet", "./..."], RUNTIME_DIR);
    record(
      "Test 2 — runtime-service go vet",
      res.status === 0,
      res.status === 0 ? "ok" : res.stdout + res.stderr,
    );
  }

  // Test 3 — formula package tests, including Navigate stub/reactive-wiring coverage.
  {
    const res = run("go", ["test", "./internal/formula/...", "-run", "Navigate", "-v", "-count=1"], RUNTIME_DIR);
    const ok =
      res.status === 0 &&
      res.stdout.includes("TestNavigateWithoutNavigationServiceIsNotImplemented") &&
      res.stdout.includes("TestNavigateWithReactiveNavigationServiceSucceeds");
    record(
      "Test 3 — formula Navigate stub + reactive-wiring tests",
      ok,
      ok ? "ok" : res.stdout + res.stderr,
    );
  }

  // Test 4 — kernel session-path Navigate updates CurrentScreen (no NAVIGATION_NOT_IMPLEMENTED).
  {
    const res = run(
      "go",
      ["test", "./internal/kernel/...", "-run", "TestEvaluateExpressionNavigateUpdatesCurrentScreen", "-v", "-count=1"],
      RUNTIME_DIR,
    );
    const ok = res.status === 0 && res.stdout.includes("PASS");
    record(
      "Test 4 — kernel session Navigate() updates CurrentScreen",
      ok,
      ok ? "ok" : res.stdout + res.stderr,
    );
  }

  // Test 5 — gallery Load/ReloadForSource pass the control filter property into QueryOverrides.Filter.
  {
    const res = run(
      "go",
      ["test", "./internal/gallery/...", "-run", "Filter", "-v", "-count=1"],
      RUNTIME_DIR,
    );
    const ok =
      res.status === 0 &&
      res.stdout.includes("TestLoadPassesFilterPropertyToQueryOverrides") &&
      res.stdout.includes("TestLoadWithoutFilterPropertyLeavesOverrideEmpty") &&
      res.stdout.includes("TestReloadForSourcePassesFilterPropertyToQueryOverrides");
    record(
      "Test 5 — gallery filter passthrough tests",
      ok,
      ok ? "ok" : res.stdout + res.stderr,
    );
  }

  // Test 6 — full package suites still pass (no regressions).
  {
    const res = run(
      "go",
      ["test", "./internal/formula/...", "./internal/gallery/...", "./internal/kernel/...", "-count=1"],
      RUNTIME_DIR,
    );
    record(
      "Test 6 — formula/gallery/kernel full suites pass",
      res.status === 0,
      res.status === 0 ? "ok" : res.stdout + res.stderr,
    );
  }

  // Test 7 — instructions.md marks 7.15 COMPLETE.
  {
    const instructions = fs.readFileSync(path.join(ROOT, "instructions.md"), "utf8");
    const ok = /\|\s*7\.15\s*\|[^\n]*COMPLETE/.test(instructions);
    record("Test 7 — instructions.md marks 7.15 COMPLETE", ok, ok ? "ok" : "no 7.15 COMPLETE row found");
  }

  // Test 8 — docs mention the Navigate session-path behavior and gallery filter wiring.
  {
    const formulaDocs = fs.readFileSync(path.join(ROOT, "docs/runtime-formula-integration.md"), "utf8");
    const bindingDocs = fs.readFileSync(path.join(ROOT, "docs/runtime-data-binding.md"), "utf8");
    const navDocumented = formulaDocs.includes("sessionNavigation") && formulaDocs.includes("Session endpoints");
    const filterDocumented = bindingDocs.includes("ReadFilterFormula") && bindingDocs.includes("QueryOverrides.Filter");
    const ok = navDocumented && filterDocumented;
    record(
      "Test 8 — docs updated for Navigate session-path + gallery filter",
      ok,
      ok ? "ok" : `navDocumented=${navDocumented} filterDocumented=${filterDocumented}`,
    );
  }

  const failed = results.filter((r) => !r.passed).length;
  printSummary(failed);
  process.exit(failed > 0 ? 1 : 0);
}

function printSummary(failed) {
  log("---");
  log(`Results: ${results.length - failed} passed, ${failed} failed`);
  for (const r of results) {
    log(`  ${r.passed ? "✓" : "✗"} ${r.test}`);
  }
}

main();
