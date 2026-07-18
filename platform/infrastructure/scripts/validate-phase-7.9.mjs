/**
 * Phase 7.9 — Named SQL list action.
 * Create SQL connector + list action with SELECT; assert action stored.
 * Run Go ValidateNamedSQL / named list unit tests.
 * Run: node infrastructure/scripts/validate-phase-7.9.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.9");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const METADATA_API = "http://localhost:8082/api/v1";
const TENANT = "00000000-0000-4000-8000-000000000001";
const USER = "00000000-0000-4000-8000-000000000002";
const DSN = `postgres://phase79:secret-${Date.now()}@localhost:5432/demo?sslmode=disable`;

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
    ["test", "./internal/databinding/", "-run", "NamedListAction|ValidateNamedSQL"],
    { cwd: path.join(ROOT, "services/runtime"), encoding: "utf8" },
  );
  record(
    "Test 4 — Named SQL unit tests",
    runtime.status === 0,
    runtime.status === 0 ? "ok" : runtime.stdout + runtime.stderr,
  );
}

async function runApiTests() {
  try {
    const { res, body } = await metadataFetch("/applications", {
      method: "POST",
      body: JSON.stringify({
        name: `Named SQL App ${Date.now()}`,
        description: "Phase 7.9 named SQL validation",
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
          name: `NamedDb${Date.now().toString(36)}`,
          connector_type: "sql",
          authentication_type: "connection_string",
          auth_config: {
            type: "connection_string",
            connection_string: DSN,
            table: "public.orders",
            primary_key: "id",
          },
        }),
      },
    );
    connectorId = body.data?.id;
    record("Test 2 — Create SQL connector", res.ok && !!connectorId, connectorId || body.error);
    if (!connectorId) return;
  } catch (err) {
    record("Test 2 — Create SQL connector", false, err.message);
    return;
  }

  try {
    const sql = "SELECT id, name FROM public.orders WHERE active = true";
    const { res, body } = await metadataFetch(`/connectors/${connectorId}/actions`, {
      method: "POST",
      body: JSON.stringify({
        action_name: "list",
        http_method: "GET",
        endpoint: sql,
      }),
    });
    const ok = res.ok && body.data?.endpoint === sql && body.data?.action_name === "list";
    record("Test 3 — Create named list action", ok, ok ? body.data.id : body.error || res.status);
  } catch (err) {
    record("Test 3 — Create named list action", false, err.message);
  }
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("Phase 7.9 validation starting");

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
