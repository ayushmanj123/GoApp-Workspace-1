/**
 * Phase 8.0 acceptance — Enterprise ALM (static).
 * Confirms unpublish/rollback/deprecate, promote route, and docs.
 * Run: node infrastructure/scripts/validate-phase-8.0.mjs
 */
import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-8.0");
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
  log("Phase 8.0 validation starting");

  const publishService = path.join(
    ROOT,
    "services/metadata/internal/services/publish_service.go",
  );
  const routesPath = path.join(ROOT, "services/metadata/internal/api/routes.go");
  const publishSrc = existsSync(publishService) ? readFileSync(publishService, "utf8") : "";
  const routesSrc = existsSync(routesPath) ? readFileSync(routesPath, "utf8") : "";
  const combined = `${publishSrc}\n${routesSrc}`;
  const hasALM =
    /unpublish/i.test(combined) &&
    /rollback/i.test(combined) &&
    /deprecate/i.test(combined);
  record(
    "Test 1 — Unpublish / rollback / deprecate in publish_service or routes",
    hasALM,
    hasALM ? "ALM verbs present" : "missing unpublish/rollback/deprecate",
  );

  const almDocs = path.join(ROOT, "docs/enterprise-alm.md");
  record(
    "Test 2 — docs/enterprise-alm.md exists",
    existsSync(almDocs),
    existsSync(almDocs) ? "docs/enterprise-alm.md" : "missing",
  );

  const hasPromote =
    existsSync(routesPath) &&
    (routesSrc.includes("/promote") || routesSrc.includes("Promote"));
  record(
    "Test 3 — Environments promote route in routes.go",
    hasPromote,
    hasPromote ? "promote route present" : "missing promote route",
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
