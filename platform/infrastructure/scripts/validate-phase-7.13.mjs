/**
 * Phase 7.13 — Freeze connectors into publish snapshots.
 * Create app + screen + connector + action → publish → mutate connector
 * base_url live → assert the published runtime package still serves the
 * frozen base_url (and sanitized auth_config) until republish, while the
 * draft channel immediately reflects the live edit.
 * Run: node infrastructure/scripts/validate-phase-7.13.mjs
 */
import { existsSync, mkdirSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.13");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const METADATA_API = "http://localhost:8082/api/v1";
const TENANT = "00000000-0000-4000-8000-000000000001";
const USER = "00000000-0000-4000-8000-000000000002";
const OLD_BASE_URL = "https://old.example.com";
const NEW_BASE_URL = "https://new.example.com";
const HEADER_SECRET = `phase713-secret-${Date.now()}`;

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
  const runtime = spawnSync(
    "go",
    ["build", "./..."],
    { cwd: path.join(ROOT, "services/runtime"), encoding: "utf8" },
  );
  record(
    "Test 8 — services/runtime builds (snapshot-aware connector repos)",
    runtime.status === 0,
    runtime.status === 0 ? "ok" : runtime.stdout + runtime.stderr,
  );
  const meta = spawnSync(
    "go",
    ["test", "./internal/services/", "-run", "BuildRuntimePackage|AssembleRuntimeApplication", "-count=1"],
    { cwd: path.join(ROOT, "services/metadata"), encoding: "utf8" },
  );
  record(
    "Test 9 — Metadata runtime package tests pass",
    meta.status === 0,
    meta.status === 0 ? "ok" : meta.stdout + meta.stderr,
  );
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("Phase 7.13 validation starting");

  await waitForService(`${METADATA_API.replace("/api/v1", "")}/health`, "metadata");

  // Create app
  {
    const { res, body } = await metadataFetch("/applications", {
      method: "POST",
      body: JSON.stringify({ name: `Phase713-${Date.now()}`, description: "freeze connectors" }),
    });
    createdAppId = body?.data?.id;
    record("Test 1 — Create application", res.ok && !!createdAppId, createdAppId || body.error);
  }

  // Create screen (publish requires at least one screen)
  if (createdAppId) {
    const { res, body } = await metadataFetch(`/applications/${createdAppId}/screens`, {
      method: "POST",
      body: JSON.stringify({ name: "Home", display_order: 1, layout_type: "grid" }),
    });
    record("Test 2 — Create screen", res.ok && !!body?.data?.id, body?.data?.id || body.error);
  }

  // Create connector with old base_url + header secret
  if (createdAppId) {
    const { res, body } = await metadataFetch(`/applications/${createdAppId}/connectors`, {
      method: "POST",
      body: JSON.stringify({
        name: "FreezeAPI",
        connector_type: "rest",
        authentication_type: "header",
        base_url: OLD_BASE_URL,
        auth_config: { type: "header", header_name: "X-Api-Key", header_value: HEADER_SECRET },
      }),
    });
    connectorId = body?.data?.id;
    record("Test 3 — Create connector with base_url", res.ok && !!connectorId, connectorId || body.error);
  }

  // Create a "list" action
  if (connectorId) {
    const { res, body } = await metadataFetch(`/connectors/${connectorId}/actions`, {
      method: "POST",
      body: JSON.stringify({ action_name: "list", http_method: "GET", endpoint: "/items" }),
    });
    record("Test 4 — Create connector action", res.ok && !!body?.data?.id, body?.data?.id || body.error);
  }

  // Publish
  if (createdAppId) {
    const { res, body } = await metadataFetch(`/applications/${createdAppId}/publish`, { method: "POST" });
    record("Test 5 — Publish application", res.ok && !!body?.data?.version_id, body?.data?.version_id || body.error);
  }

  // Fetch published runtime package right after publish: connector frozen with old base_url + sanitized auth
  let publishedConnector = null;
  if (createdAppId) {
    const { res, body } = await metadataFetch(`/runtime/applications/${createdAppId}`);
    const connectors = body?.data?.connectors ?? [];
    publishedConnector = connectors.find((c) => c.name === "FreezeAPI");
    const ok =
      res.ok &&
      !!publishedConnector &&
      publishedConnector.base_url === OLD_BASE_URL &&
      typeof publishedConnector.auth_config?.secret_id === "string" &&
      !JSON.stringify(body).includes(HEADER_SECRET);
    record(
      "Test 6 — Published snapshot includes frozen connector (secret_id only, no plaintext)",
      ok,
      ok ? JSON.stringify(publishedConnector) : JSON.stringify(body),
    );
  }

  // Mutate the connector's base_url live (simulate editing in Studio after publish)
  if (connectorId) {
    const { res, body } = await metadataFetch(`/connectors/${connectorId}`, {
      method: "PUT",
      body: JSON.stringify({ base_url: NEW_BASE_URL }),
    });
    record(
      "Test 7 — Update connector base_url live",
      res.ok && body?.data?.base_url === NEW_BASE_URL,
      body?.data?.base_url ?? body.error,
    );
  }

  // Published channel (default) must still serve the OLD (frozen) base_url
  if (createdAppId) {
    const { res, body } = await metadataFetch(`/runtime/applications/${createdAppId}`);
    const connectors = body?.data?.connectors ?? [];
    const frozen = connectors.find((c) => c.name === "FreezeAPI");
    const ok = res.ok && frozen?.base_url === OLD_BASE_URL;
    record(
      "Test 8 — Published Open Runtime still uses frozen base_url after live edit",
      ok,
      frozen ? frozen.base_url : JSON.stringify(body),
    );
  }

  // Draft channel must reflect the live edit immediately
  if (createdAppId) {
    const { res, body } = await metadataFetch(`/runtime/applications/${createdAppId}?channel=draft`);
    const connectors = body?.data?.connectors ?? [];
    const draft = connectors.find((c) => c.name === "FreezeAPI");
    const ok = res.ok && draft?.base_url === NEW_BASE_URL;
    record("Test 9 — Draft channel reflects the live connector edit", ok, draft ? draft.base_url : JSON.stringify(body));
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
