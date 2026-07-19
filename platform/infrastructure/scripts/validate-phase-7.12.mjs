/**
 * Phase 7.12 — Environment-scoped connector secrets.
 * Create app + connector + environment → upsert override → list shows has_override.
 * Run: node infrastructure/scripts/validate-phase-7.12.mjs
 */
import { existsSync, mkdirSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.12");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const METADATA_API = "http://localhost:8082/api/v1";
const TENANT = "00000000-0000-4000-8000-000000000001";
const USER = "00000000-0000-4000-8000-000000000002";
const BASE_SECRET = `phase712-base-${Date.now()}`;
const ENV_SECRET = `phase712-env-${Date.now()}`;

const results = [];
let createdAppId = null;
let connectorId = null;
let envId = null;

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
  const runtime = spawnSync(
    "go",
    ["test", "./internal/databinding/", "-run", "DecryptSecret|EnvironmentID", "-count=1"],
    { cwd: path.join(ROOT, "services/runtime"), encoding: "utf8" },
  );
  record(
    "Test 5 — Runtime secret resolve unit tests",
    runtime.status === 0,
    runtime.status === 0 ? "ok" : runtime.stdout + runtime.stderr,
  );
  const meta = spawnSync(
    "go",
    ["test", "./internal/services/", "-run", "EnvironmentSecret", "-count=1"],
    { cwd: path.join(ROOT, "services/metadata"), encoding: "utf8" },
  );
  record(
    "Test 6 — Metadata environment secret package compiles",
    meta.status === 0 || String(meta.stdout + meta.stderr).includes("no tests to run"),
    meta.status === 0 || String(meta.stdout + meta.stderr).includes("no tests to run")
      ? "ok"
      : meta.stdout + meta.stderr,
  );
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("Phase 7.12 validation starting");

  await waitForService(`${METADATA_API.replace("/api/v1", "")}/health`, "metadata");

  // Create app
  {
    const { res, body } = await metadataFetch("/applications", {
      method: "POST",
      body: JSON.stringify({ name: `Phase712-${Date.now()}`, description: "env secrets" }),
    });
    createdAppId = body?.data?.id;
    record("Test 1 — Create application", res.ok && !!createdAppId, createdAppId || body.error);
  }

  // Create connector with secret
  if (createdAppId) {
    const { res, body } = await metadataFetch(`/applications/${createdAppId}/connectors`, {
      method: "POST",
      body: JSON.stringify({
        name: "EnvSecretAPI",
        connector_type: "rest",
        authentication_type: "header",
        base_url: "https://httpbin.org",
        auth_config: { type: "header", header_name: "X-Api-Key", header_value: BASE_SECRET },
      }),
    });
    connectorId = body?.data?.id;
    const auth = body?.data?.auth_config ?? {};
    const ok =
      res.ok &&
      !!connectorId &&
      typeof auth.secret_id === "string" &&
      !JSON.stringify(body).includes(BASE_SECRET);
    record("Test 2 — Create connector with secret_id", ok, ok ? auth.secret_id : body.error);
  }

  // Create environment
  if (createdAppId) {
    const { res, body } = await metadataFetch(`/applications/${createdAppId}/environments`, {
      method: "POST",
      body: JSON.stringify({ name: "test", environment_type: "test" }),
    });
    envId = body?.data?.id;
    record("Test 3 — Create test environment", res.ok && !!envId, envId || body.error);
  }

  // Upsert override
  if (createdAppId && envId && connectorId) {
    const { res, body } = await metadataFetch(
      `/applications/${createdAppId}/environments/${envId}/secret-overrides`,
      {
        method: "PUT",
        body: JSON.stringify({ connector_id: connectorId, value: ENV_SECRET }),
      },
    );
    const ok = res.ok && body?.data?.has_override === true && !JSON.stringify(body).includes(ENV_SECRET);
    record("Test 4 — Upsert env secret override (write-only)", ok, ok ? body.data.base_secret_id : body.error);
  }

  // List overrides
  if (createdAppId && envId) {
    const { res, body } = await metadataFetch(
      `/applications/${createdAppId}/environments/${envId}/secret-overrides`,
    );
    const items = body?.data?.items ?? [];
    const match = items.find((i) => i.connector_id === connectorId);
    const ok = res.ok && match?.has_override === true;
    record("Test 5b — List shows has_override", ok, JSON.stringify(match ?? items));
  }

  // Delete override
  if (createdAppId && envId && connectorId) {
    const { res } = await metadataFetch(
      `/applications/${createdAppId}/environments/${envId}/secret-overrides/${connectorId}`,
      { method: "DELETE" },
    );
    const list = await metadataFetch(
      `/applications/${createdAppId}/environments/${envId}/secret-overrides`,
    );
    const items = list.body?.data?.items ?? [];
    const match = items.find((i) => i.connector_id === connectorId);
    const ok = res.ok && (match == null || match.has_override === false);
    record("Test 5c — Delete override restores app-default", ok, JSON.stringify(match ?? {}));
  }

  runGoTests();

  // Cleanup
  if (createdAppId) {
    await metadataFetch(`/applications/${createdAppId}`, { method: "DELETE" }).catch(() => {});
  }

  const failed = results.filter((r) => !r.passed);
  log(`Done: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
