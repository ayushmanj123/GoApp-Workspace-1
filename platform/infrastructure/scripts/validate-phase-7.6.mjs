/**
 * Phase 7.6 acceptance — SQL connectors (Postgres table binding).
 * Create SQL connector with connection_string → GET must not contain DSN plaintext
 * → secret_id + table present. Runs Go identifier/Query unit tests.
 * Run: node infrastructure/scripts/validate-phase-7.6.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.6");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const METADATA_API = "http://localhost:8082/api/v1";
const TENANT = "00000000-0000-4000-8000-000000000001";
const USER = "00000000-0000-4000-8000-000000000002";
const DSN_PLAINTEXT = `postgres://phase76:secret-${Date.now()}@localhost:5432/demo?sslmode=disable`;

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
  const metadata = spawnSync(
    "go",
    ["test", "./internal/services/", "-run", "ValidateSQL"],
    { cwd: path.join(ROOT, "services/metadata"), encoding: "utf8" },
  );
  record(
    "Test 5 — metadata SQL identifier validation",
    metadata.status === 0,
    metadata.status === 0 ? "ok" : metadata.stdout + metadata.stderr,
  );

  const runtime = spawnSync(
    "go",
    ["test", "./internal/databinding/...", "-run", "QuoteSQLTable|SqlDataSource"],
    { cwd: path.join(ROOT, "services/runtime"), encoding: "utf8" },
  );
  record(
    "Test 6 — runtime SqlDataSource / identifier tests",
    runtime.status === 0,
    runtime.status === 0 ? "ok" : runtime.stdout + runtime.stderr,
  );
}

async function runApiTests() {
  try {
    const { res, body } = await metadataFetch("/applications", {
      method: "POST",
      body: JSON.stringify({
        name: `SQL Conn App ${Date.now()}`,
        description: "Phase 7.6 SQL connector validation",
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
          name: `OrdersDb${Date.now().toString(36)}`,
          connector_type: "sql",
          authentication_type: "connection_string",
          auth_config: {
            type: "connection_string",
            connection_string: DSN_PLAINTEXT,
            table: "public.orders",
            primary_key: "id",
          },
        }),
      },
    );
    connectorId = body.data?.id;
    const auth = body.data?.auth_config ?? {};
    const raw = JSON.stringify(body);
    const noPlaintext = !raw.includes(DSN_PLAINTEXT) && auth.connection_string == null;
    const hasSecretId = typeof auth.secret_id === "string" && auth.secret_id.length > 0;
    const hasTable = auth.table === "public.orders";
    record(
      "Test 2 — Create SQL connector stores secret_id (no DSN plaintext)",
      res.ok && !!connectorId && noPlaintext && hasSecretId && hasTable && body.data?.has_secret === true,
      JSON.stringify({
        id: connectorId,
        secret_id: auth.secret_id,
        table: auth.table,
        has_secret: body.data?.has_secret,
        status: res.status,
        error: body.error,
      }),
    );
    if (!connectorId) return;
  } catch (err) {
    record("Test 2 — Create SQL connector stores secret_id (no DSN plaintext)", false, err.message);
    return;
  }

  try {
    const { res, body } = await metadataFetch(`/connectors/${connectorId}`);
    const raw = JSON.stringify(body);
    const auth = body.data?.auth_config ?? {};
    record(
      "Test 3 — GET SQL connector redacts connection string",
      res.ok &&
        !raw.includes(DSN_PLAINTEXT) &&
        auth.connection_string == null &&
        typeof auth.secret_id === "string" &&
        body.data?.has_secret === true,
      JSON.stringify({
        has_secret: body.data?.has_secret,
        secret_id: auth.secret_id,
        table: auth.table,
        error: body.error,
      }),
    );
  } catch (err) {
    record("Test 3 — GET SQL connector redacts connection string", false, err.message);
  }

  try {
    const { res, body } = await metadataFetch(`/connectors/${connectorId}`, {
      method: "PUT",
      body: JSON.stringify({
        auth_config: {
          type: "connection_string",
          table: "public.orders",
          primary_key: "id",
          connection_string: `${DSN_PLAINTEXT}&rotated=1`,
        },
      }),
    });
    const raw = JSON.stringify(body);
    const auth = body.data?.auth_config ?? {};
    record(
      "Test 4 — Rotate connection string (still redacted)",
      res.ok &&
        body.data?.has_secret === true &&
        typeof auth.secret_id === "string" &&
        !raw.includes(DSN_PLAINTEXT),
      JSON.stringify({
        secret_id: auth.secret_id,
        has_secret: body.data?.has_secret,
        error: body.error,
      }),
    );
  } catch (err) {
    record("Test 4 — Rotate connection string (still redacted)", false, err.message);
  }
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("Phase 7.6 validation starting");

  try {
    await waitForService("http://localhost:8082/health", "metadata");
  } catch (err) {
    record("Prerequisite — metadata service", false, err.message);
    printSummary(1);
    process.exit(1);
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
