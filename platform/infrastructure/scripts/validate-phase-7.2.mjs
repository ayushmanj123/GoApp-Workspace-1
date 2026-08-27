/**
 * Phase 7.2 acceptance — Keycloak production auth (static).
 * Confirms shared Keycloak package + Studio/Runtime keycloakConfig.
 * Run: node infrastructure/scripts/validate-phase-7.2.mjs
 */
import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.2");
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
  log("Phase 7.2 validation starting");

  const keycloakPath = path.join(ROOT, "packages/shared/go/auth/keycloak.go");
  record(
    "Test 1 — packages/shared/go/auth/keycloak.go exists",
    existsSync(keycloakPath),
    existsSync(keycloakPath) ? "keycloak.go" : "missing",
  );

  const configPath = path.join(ROOT, "packages/shared/go/auth/config.go");
  const configSrc = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
  record(
    "Test 2 — ModeKeycloak in config.go",
    existsSync(configPath) && configSrc.includes("ModeKeycloak"),
    existsSync(configPath) ? "ModeKeycloak present" : "config.go missing",
  );

  const studioSession = path.join(ROOT, "apps/studio/src/auth/session.ts");
  const studioSrc = existsSync(studioSession) ? readFileSync(studioSession, "utf8") : "";
  record(
    "Test 3 — Studio keycloakConfig",
    existsSync(studioSession) && studioSrc.includes("keycloakConfig"),
    existsSync(studioSession) ? "apps/studio/src/auth/session.ts" : "missing",
  );

  const runtimeSession = path.join(ROOT, "apps/runtime/src/auth/session.ts");
  const runtimeSrc = existsSync(runtimeSession) ? readFileSync(runtimeSession, "utf8") : "";
  record(
    "Test 4 — Runtime keycloakConfig",
    existsSync(runtimeSession) && runtimeSrc.includes("keycloakConfig"),
    existsSync(runtimeSession) ? "apps/runtime/src/auth/session.ts" : "missing",
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
