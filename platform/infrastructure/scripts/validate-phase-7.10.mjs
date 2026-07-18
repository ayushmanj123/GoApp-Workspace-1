/**
 * Phase 7.10 — REST OAuth client_credentials.
 * Create OAuth REST connector; assert secret redacted; client_secret not returned.
 * Run: node infrastructure/scripts/validate-phase-7.10.mjs
 */
import { existsSync, mkdirSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.10");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const METADATA_API = "http://localhost:8082/api/v1";
const TENANT = "00000000-0000-4000-8000-000000000001";
const USER = "00000000-0000-4000-8000-000000000002";
const CLIENT_SECRET = `oauth-secret-${Date.now()}`;

const results = [];
let createdAppId = null;
let connectorId = null;

function log(line) {
  const msg = `[${new Date().toISOString()}] ${line}`;
  console.log(msg);
  fs.appendFileSync(LOG_FILE, `${msg}\n`);
}

function record(test, passed, detail) {
  results.push({ test, passed, detail });
  log(`${passed ? "PASS" : "FAIL"} — ${test}: ${detail}`);
}

async function metadataFetch(apiPath, options = {}) {
  const res = await fetch(`${METADATA_API}${apiPath}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Id": TENANT,
      "X-User-Id": USER,
      ...(options.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function waitForService(url, label, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 304) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${label} not available at ${url}`);
}

async function runApiTests() {
  try {
    const { res, body } = await metadataFetch("/applications", {
      method: "POST",
      body: JSON.stringify({
        name: `OAuth Conn App ${Date.now()}`,
        description: "Phase 7.10 OAuth validation",
      }),
    });
    createdAppId = body.data?.id;
    record("Test 1 — Create application", res.ok && !!createdAppId, createdAppId || body.error);
    if (!createdAppId) return;
  } catch (err) {
    record("Test 1 — Create application", false, err.message);
    return;
  }

  try {
    const { res, body } = await metadataFetch(
      `/applications/${createdAppId}/connectors`,
      {
        method: "POST",
        body: JSON.stringify({
          name: `OauthApi${Date.now().toString(36)}`,
          connector_type: "rest",
          authentication_type: "oauth_client_credentials",
          base_url: "https://api.example.com",
          auth_config: {
            type: "oauth_client_credentials",
            token_url: "https://idp.example.com/oauth/token",
            client_id: "demo-client",
            client_secret: CLIENT_SECRET,
            scope: "read",
          },
        }),
      },
    );
    connectorId = body.data?.id;
    const auth = body.data?.auth_config ?? {};
    const raw = JSON.stringify(body);
    const ok =
      res.ok &&
      !!connectorId &&
      body.data?.has_secret === true &&
      typeof auth.secret_id === "string" &&
      !raw.includes(CLIENT_SECRET) &&
      auth.client_secret == null;
    record(
      "Test 2 — Create OAuth connector (secret redacted)",
      ok,
      ok ? auth.secret_id : body.error || raw,
    );
  } catch (err) {
    record("Test 2 — Create OAuth connector (secret redacted)", false, err.message);
  }

  if (!connectorId) return;

  try {
    const { res, body } = await metadataFetch(`/connectors/${connectorId}`);
    const auth = body.data?.auth_config ?? {};
    const raw = JSON.stringify(body);
    record(
      "Test 3 — GET OAuth connector redacts client_secret",
      res.ok &&
        body.data?.has_secret === true &&
        typeof auth.secret_id === "string" &&
        auth.token_url &&
        auth.client_id === "demo-client" &&
        !raw.includes(CLIENT_SECRET),
      JSON.stringify({ has_secret: body.data?.has_secret, secret_id: auth.secret_id }),
    );
  } catch (err) {
    record("Test 3 — GET OAuth connector redacts client_secret", false, err.message);
  }
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("Phase 7.10 validation starting");

  try {
    await waitForService("http://localhost:8082/health", "metadata");
  } catch (err) {
    record("Prerequisite — metadata service", false, err.message);
    printSummary(1);
    process.exit(1);
  }

  await runApiTests();
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
