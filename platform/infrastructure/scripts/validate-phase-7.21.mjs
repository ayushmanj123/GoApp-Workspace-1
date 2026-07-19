/**
 * Phase 7.21 — REST OAuth authorization-code (app-level Connect + refresh grant).
 * Run: node infrastructure/scripts/validate-phase-7.21.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.21");
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
  log("Phase 7.21 validation starting");

  const metadata = path.join(ROOT, "services/metadata");
  runGo(
    metadata,
    ["test", "./internal/services/", "-run", "OAuth|PKCE|Redirect", "-count=1"],
    "Test 1 — metadata OAuth / PKCE unit tests",
  );

  const runtime = path.join(ROOT, "services/runtime");
  runGo(
    runtime,
    [
      "test",
      "./internal/databinding/",
      "-run",
      "RestDataSourceOAuthAuthorizationCode",
      "-count=1",
    ],
    "Test 2 — runtime auth-code refresh grant",
  );

  const secretsSrc = readFileSync(
    path.join(ROOT, "services/metadata/internal/services/connector_secrets.go"),
    "utf8",
  );
  record(
    "Test 3 — oauth_authorization_code + refresh_secret_id in secrets",
    secretsSrc.includes("oauth_authorization_code") &&
      secretsSrc.includes("RefreshSecretID") &&
      secretsSrc.includes("AuthorizationURL") &&
      secretsSrc.includes("HasConnection"),
    "connector_secrets.go",
  );

  const oauthSrc = readFileSync(
    path.join(ROOT, "services/metadata/internal/services/connector_oauth.go"),
    "utf8",
  );
  record(
    "Test 4 — StartOAuth + callback + PKCE",
    oauthSrc.includes("StartOAuthAuthorizationCode") &&
      oauthSrc.includes("CompleteOAuthCallback") &&
      oauthSrc.includes("code_challenge") &&
      oauthSrc.includes("OAUTH_CONNECTOR_REDIRECT_URI"),
    "connector_oauth.go",
  );

  const routesSrc = readFileSync(
    path.join(ROOT, "services/metadata/internal/api/routes.go"),
    "utf8",
  );
  record(
    "Test 5 — OAuth routes registered",
    routesSrc.includes("/connectors/oauth/callback") &&
      routesSrc.includes("/connectors/:id/oauth/start"),
    "routes.go",
  );

  const restSrc = readFileSync(
    path.join(ROOT, "services/runtime/internal/databinding/rest_datasource.go"),
    "utf8",
  );
  record(
    "Test 6 — runtime refresh_token grant branch",
    restSrc.includes("oauth_authorization_code") &&
      restSrc.includes("refresh_token") &&
      restSrc.includes("not connected"),
    "rest_datasource.go",
  );

  const repoSrc = readFileSync(
    path.join(ROOT, "services/runtime/internal/databinding/rest_repository.go"),
    "utf8",
  );
  record(
    "Test 7 — RestAuthConfig RefreshSecretID",
    repoSrc.includes("RefreshSecretID") && repoSrc.includes("oauth_authorization_code"),
    "rest_repository.go",
  );

  const apiSrc = readFileSync(
    path.join(ROOT, "apps/studio/src/api/connectors-api.ts"),
    "utf8",
  );
  record(
    "Test 8 — Studio API startOAuth + auth type",
    apiSrc.includes("oauth_authorization_code") &&
      apiSrc.includes("startOAuth") &&
      apiSrc.includes("authorization_url") &&
      apiSrc.includes("has_connection"),
    "connectors-api.ts",
  );

  const detailSrc = readFileSync(
    path.join(
      ROOT,
      "apps/studio/src/components/manager/connectors/ConnectorDetailView.tsx",
    ),
    "utf8",
  );
  record(
    "Test 9 — Studio Connect / Reconnect UX",
    detailSrc.includes("oauth_authorization_code") &&
      detailSrc.includes("handleConnectOAuth") &&
      detailSrc.includes("Reconnect") &&
      detailSrc.includes('params.get("oauth")') &&
      detailSrc.includes('"connected"'),
    "ConnectorDetailView.tsx",
  );

  const createSrc = readFileSync(
    path.join(
      ROOT,
      "apps/studio/src/components/manager/connectors/CreateConnectorModal.tsx",
    ),
    "utf8",
  );
  record(
    "Test 10 — Create modal auth-code fields",
    createSrc.includes("oauth_authorization_code") &&
      createSrc.includes("authorizationUrl") &&
      createSrc.includes("Authorization URL"),
    "CreateConnectorModal.tsx",
  );

  const docs = readFileSync(path.join(ROOT, "docs/rest-connectors.md"), "utf8");
  record(
    "Test 11 — docs cover auth-code + app-level ownership",
    docs.includes("oauth_authorization_code") &&
      docs.includes("app-level") &&
      docs.includes("OAUTH_CONNECTOR_REDIRECT_URI") &&
      docs.includes("refresh_secret_id") &&
      !docs.includes("- OAuth authorization-code / PKCE / refresh tokens"),
    "docs/rest-connectors.md",
  );

  const instructions = readFileSync(path.join(ROOT, "instructions.md"), "utf8");
  record(
    "Test 12 — instructions 7.21 COMPLETE + next focus",
    instructions.includes("7.21") &&
      instructions.includes("COMPLETE") &&
      instructions.includes("Per-user connector OAuth") &&
      !instructions.includes("OAuth authorization-code for REST connectors (interactive user auth)"),
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
