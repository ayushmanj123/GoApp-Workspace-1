/**
 * Phase 7.5 acceptance — Connector secrets.
 * Create connector with header secret → GET must not contain plaintext → secret_id present.
 * Also runs shared crypto + runtime resolve unit tests.
 * Run: node infrastructure/scripts/validate-phase-7.5.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.5");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const METADATA_API = "http://localhost:8082/api/v1";
const TENANT = "00000000-0000-4000-8000-000000000001";
const USER = "00000000-0000-4000-8000-000000000002";
const SECRET_PLAINTEXT = `phase75-secret-${Date.now()}`;

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

function runGoTests() {
  const shared = spawnSync("go", ["test", "./secrets/..."], {
    cwd: path.join(ROOT, "packages/shared/go"),
    encoding: "utf8",
  });
  record(
    "Test 5 — shared secrets Encrypt/Decrypt",
    shared.status === 0,
    shared.status === 0 ? "ok" : shared.stdout + shared.stderr,
  );

  const runtime = spawnSync(
    "go",
    ["test", "./internal/databinding/...", "-run", "RestDataSourceAppliesStaticHeaderAuth|ResolveAuthSecret"],
    {
      cwd: path.join(ROOT, "services/runtime"),
      encoding: "utf8",
    },
  );
  record(
    "Test 6 — runtime header auth + secret resolve tests",
    runtime.status === 0,
    runtime.status === 0 ? "ok" : runtime.stdout + runtime.stderr,
  );
}

async function runApiTests() {
  try {
    const { res, body } = await metadataFetch("/applications", {
      method: "POST",
      body: JSON.stringify({
        name: `Secrets App ${Date.now()}`,
        description: "Phase 7.5 connector secrets validation",
      }),
    });
    createdAppId = body.data?.id;
    record(
      "Test 1 — Create application",
      res.ok && !!createdAppId,
      createdAppId || body.error || res.status,
    );
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
          name: `SecuredAPI${Date.now().toString(36)}`,
          connector_type: "rest",
          authentication_type: "header",
          base_url: "https://api.example.com",
          auth_config: {
            type: "header",
            header_name: "X-Api-Key",
            header_value: SECRET_PLAINTEXT,
          },
        }),
      },
    );
    connectorId = body.data?.id;
    const auth = body.data?.auth_config ?? {};
    const authStr = JSON.stringify(auth);
    const noPlaintext =
      !authStr.includes(SECRET_PLAINTEXT) &&
      auth.header_value == null &&
      auth.header_value !== SECRET_PLAINTEXT;
    const hasSecretId = typeof auth.secret_id === "string" && auth.secret_id.length > 0;
    const hasSecretFlag = body.data?.has_secret === true;
    record(
      "Test 2 — Create connector stores secret_id (no plaintext)",
      res.ok && !!connectorId && noPlaintext && hasSecretId && hasSecretFlag,
      JSON.stringify({
        id: connectorId,
        secret_id: auth.secret_id,
        has_secret: body.data?.has_secret,
        auth_config: auth,
        status: res.status,
        error: body.error,
      }),
    );
    if (!connectorId) return;
  } catch (err) {
    record("Test 2 — Create connector stores secret_id (no plaintext)", false, err.message);
    return;
  }

  try {
    const { res, body } = await metadataFetch(`/connectors/${connectorId}`);
    const raw = JSON.stringify(body);
    const auth = body.data?.auth_config ?? {};
    const noPlaintext = !raw.includes(SECRET_PLAINTEXT);
    const hasSecretId = typeof auth.secret_id === "string" && auth.secret_id.length > 0;
    record(
      "Test 3 — GET connector redacts secret plaintext",
      res.ok && noPlaintext && hasSecretId && body.data?.has_secret === true,
      JSON.stringify({
        has_secret: body.data?.has_secret,
        secret_id: auth.secret_id,
        leaked: !noPlaintext,
        error: body.error,
      }),
    );
  } catch (err) {
    record("Test 3 — GET connector redacts secret plaintext", false, err.message);
  }

  try {
    const { res, body } = await metadataFetch(`/connectors/${connectorId}`, {
      method: "PUT",
      body: JSON.stringify({
        name: `SecuredAPIRotated${Date.now().toString(36)}`,
        auth_config: {
          type: "header",
          header_name: "X-Api-Key",
          header_value: `${SECRET_PLAINTEXT}-rotated`,
        },
      }),
    });
    const auth = body.data?.auth_config ?? {};
    const raw = JSON.stringify(body);
    record(
      "Test 4 — Rotate secret via update (still redacted)",
      res.ok &&
        body.data?.has_secret === true &&
        typeof auth.secret_id === "string" &&
        !raw.includes(SECRET_PLAINTEXT) &&
        !raw.includes(`${SECRET_PLAINTEXT}-rotated`),
      JSON.stringify({
        secret_id: auth.secret_id,
        has_secret: body.data?.has_secret,
        error: body.error,
      }),
    );
  } catch (err) {
    record("Test 4 — Rotate secret via update (still redacted)", false, err.message);
  }
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("Phase 7.5 validation starting");

  try {
    await waitForService(`${METADATA_API.replace("/api/v1", "")}/health`, "metadata");
  } catch (err) {
    try {
      await waitForService("http://localhost:8082/healthz", "metadata");
    } catch {
      record("Prerequisite — metadata service", false, err.message);
      printSummary(1);
      return;
    }
  }

  await runApiTests();
  runGoTests();
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
