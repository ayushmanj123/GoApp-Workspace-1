/**
 * Phase 7.22 — Per-user connector OAuth (connection_scope + runtime consent).
 * Run: node infrastructure/scripts/validate-phase-7.22.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.22");
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
  log("Phase 7.22 validation starting");

  const metadata = path.join(ROOT, "services/metadata");
  runGo(
    metadata,
    ["test", "./internal/services/", "-run", "OAuth|Pkce|Redirect|ConnectionScope", "-count=1"],
    "Test 1 — metadata OAuth unit tests",
  );

  const runtime = path.join(ROOT, "services/runtime");
  runGo(
    runtime,
    [
      "test",
      "./internal/databinding/",
      "-run",
      "RestDataSourceOAuthAuthorizationCode|UserOAuth|ResolveAuthSecret",
      "-count=1",
    ],
    "Test 2 — runtime auth-code + user oauth unit tests",
  );

  const migration = path.join(
    ROOT,
    "services/metadata/internal/database/migrations/000019_connector_user_connections.up.sql",
  );
  record(
    "Test 3 — migration connector_user_connections",
    existsSync(migration) &&
      readFileSync(migration, "utf8").includes("connector_user_connections"),
    "000019_connector_user_connections.up.sql",
  );

  const secretsSrc = readFileSync(
    path.join(ROOT, "services/metadata/internal/services/connector_secrets.go"),
    "utf8",
  );
  record(
    "Test 4 — connection_scope in persistAuthConfig",
    secretsSrc.includes("ConnectionScope") &&
      secretsSrc.includes("normalizeConnectionScope"),
    "connector_secrets.go",
  );

  const oauthSrc = readFileSync(
    path.join(ROOT, "services/metadata/internal/services/connector_oauth.go"),
    "utf8",
  );
  record(
    "Test 5 — user connection upsert + runtime return URL",
    oauthSrc.includes("upsertUserRefreshConnection") &&
      oauthSrc.includes("GetOAuthConnectionStatus") &&
      oauthSrc.includes("OAUTH_CONNECTOR_RUNTIME_RETURN_URL") &&
      oauthSrc.includes("ReturnTo") &&
      oauthSrc.includes("normalizeOAuthReturnTo"),
    "connector_oauth.go",
  );

  const routesSrc = readFileSync(
    path.join(ROOT, "services/metadata/internal/api/routes.go"),
    "utf8",
  );
  record(
    "Test 6 — oauth connection routes",
    routesSrc.includes("/connectors/:id/oauth/connection") &&
      routesSrc.includes("GetOAuthConnection") &&
      routesSrc.includes("DeleteOAuthConnection"),
    "routes.go",
  );

  const restSrc = readFileSync(
    path.join(ROOT, "services/runtime/internal/databinding/rest_datasource.go"),
    "utf8",
  );
  const repoSrc = readFileSync(
    path.join(ROOT, "services/runtime/internal/databinding/rest_repository.go"),
    "utf8",
  );
  record(
    "Test 7 — runtime ErrConnectorUserOAuthRequired + user cache key",
    repoSrc.includes("ErrConnectorUserOAuthRequired") &&
      repoSrc.includes("connector_user_oauth_required") &&
      repoSrc.includes("connector_user_connections") &&
      restSrc.includes("ConnectionScope") &&
      restSrc.includes("ErrConnectorUserOAuthRequired"),
    "rest_datasource.go / rest_repository.go",
  );

  const bannerSrc = readFileSync(
    path.join(ROOT, "apps/runtime/src/components/connector-oauth-banner.tsx"),
    "utf8",
  );
  record(
    "Test 8 — runtime Connect banner",
    bannerSrc.includes("connectorsOAuthApi") &&
      bannerSrc.includes('"runtime"') &&
      bannerSrc.includes('params.get("oauth")') &&
      bannerSrc.includes('"connected"'),
    "connector-oauth-banner.tsx",
  );

  const apiSrc = readFileSync(
    path.join(ROOT, "apps/studio/src/api/connectors-api.ts"),
    "utf8",
  );
  const detailSrc = readFileSync(
    path.join(
      ROOT,
      "apps/studio/src/components/manager/connectors/ConnectorDetailView.tsx",
    ),
    "utf8",
  );
  record(
    "Test 9 — Studio connection_scope UX",
    apiSrc.includes("connection_scope") &&
      apiSrc.includes("getOAuthConnection") &&
      detailSrc.includes("connectionScope") &&
      detailSrc.includes("Connect as me"),
    "Studio connectors",
  );

  const docs = readFileSync(path.join(ROOT, "docs/rest-connectors.md"), "utf8");
  record(
    "Test 10 — docs dual mode + connector_user_connections",
    docs.includes("connection_scope") &&
      docs.includes("connector_user_connections") &&
      docs.includes("connector_user_oauth_required") &&
      docs.includes("OAUTH_CONNECTOR_RUNTIME_RETURN_URL") &&
      !docs.includes("- Per-user / runtime consent token maps"),
    "docs/rest-connectors.md",
  );

  const instructions = readFileSync(path.join(ROOT, "instructions.md"), "utf8");
  record(
    "Test 11 — instructions 7.22 COMPLETE + Workflow next",
    instructions.includes("| 7.22 |") &&
      instructions.includes("Per-user connector OAuth") &&
      instructions.includes("COMPLETE") &&
      instructions.includes("Workflow") &&
      !instructions.includes("Per-user connector OAuth (runtime consent)."),
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
