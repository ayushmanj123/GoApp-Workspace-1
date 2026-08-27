/**
 * Phase 7.1 acceptance — REST connectors (static).
 * Confirms RestDataSource, metadata connector routes/handler, and docs.
 * Run: node infrastructure/scripts/validate-phase-7.1.mjs
 */
import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.1");
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
  log("Phase 7.1 validation starting");

  const restDS = path.join(ROOT, "services/runtime/internal/databinding/rest_datasource.go");
  const restExists = existsSync(restDS);
  const restSrc = restExists ? readFileSync(restDS, "utf8") : "";
  record(
    "Test 1 — RestDataSource in rest_datasource.go",
    restExists && restSrc.includes("RestDataSource"),
    restExists ? "RestDataSource symbol present" : "rest_datasource.go missing",
  );

  const routesPath = path.join(ROOT, "services/metadata/internal/api/routes.go");
  const handlerCandidates = [
    path.join(ROOT, "services/metadata/internal/api/handlers/connector_handler.go"),
    path.join(ROOT, "services/metadata/internal/handlers/connector_handler.go"),
    path.join(ROOT, "services/metadata/internal/api/handlers/connector.go"),
  ];
  const routesSrc = existsSync(routesPath) ? readFileSync(routesPath, "utf8") : "";
  const handlerHit = handlerCandidates.find((p) => existsSync(p));
  const hasConnectorRoutes =
    routesSrc.includes("/connectors") ||
    routesSrc.includes("ConnectorHandler") ||
    routesSrc.includes("connectorHandler");
  record(
    "Test 2 — Metadata connector REST routes or handler",
    hasConnectorRoutes || !!handlerHit,
    hasConnectorRoutes
      ? "routes.go has connector routes/handler"
      : handlerHit
        ? path.relative(ROOT, handlerHit)
        : "no connector routes or handler found",
  );

  const docsPath = path.join(ROOT, "docs/rest-connectors.md");
  record(
    "Test 3 — docs/rest-connectors.md exists",
    existsSync(docsPath),
    existsSync(docsPath) ? "docs/rest-connectors.md" : "missing",
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
