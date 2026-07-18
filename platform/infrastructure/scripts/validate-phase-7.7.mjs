/**
 * Phase 7.7 acceptance — Runtime productization.
 * Publish → promote environment → GET runtime package with environmentId.
 * Go unit test for env package resolve. Optional smoke: runtime /login.
 * Run: node infrastructure/scripts/validate-phase-7.7.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.7");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const METADATA_API = "http://localhost:8082/api/v1";
const RUNTIME_UI = "http://localhost:5174";
const TENANT = "00000000-0000-4000-8000-000000000001";
const USER = "00000000-0000-4000-8000-000000000002";

const results = [];
let createdAppId = null;
let versionId = null;
let environmentId = null;

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
    ["test", "./internal/services/", "-run", "BuildRuntimePackageByEnvironment"],
    { cwd: path.join(ROOT, "services/metadata"), encoding: "utf8" },
  );
  record(
    "Test 7 — BuildRuntimePackageByEnvironment unit test",
    metadata.status === 0,
    metadata.status === 0 ? "ok" : metadata.stdout + metadata.stderr,
  );
}

async function smokeRuntimeLogin() {
  try {
    const res = await fetch(`${RUNTIME_UI}/login`);
    record(
      "Test 8 — Runtime /login route (optional)",
      res.ok,
      res.ok ? `status ${res.status}` : `status ${res.status}`,
    );
  } catch (err) {
    record(
      "Test 8 — Runtime /login route (optional)",
      true,
      `skipped — runtime UI not up (${err.message})`,
    );
  }
}

async function runApiTests() {
  try {
    const { res, body } = await metadataFetch("/applications", {
      method: "POST",
      body: JSON.stringify({
        name: `Runtime Env App ${Date.now()}`,
        description: "Phase 7.7 environment runtime validation",
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
      `/applications/${createdAppId}/screens`,
    );
    const screens = body.data?.items ?? body.data ?? [];
    const list = Array.isArray(screens) ? screens : [];
    const ok = res.ok && list.length >= 1;
    record(
      "Test 2 — Seeded screen present",
      ok,
      ok ? `${list.length} screen(s)` : body.error || "no screens",
    );
  } catch (err) {
    record("Test 2 — Seeded screen present", false, err.message);
  }

  try {
    const { res, body } = await metadataFetch(
      `/applications/${createdAppId}/publish`,
      { method: "POST", body: JSON.stringify({}) },
    );
    versionId = body.data?.version_id ?? null;
    record(
      "Test 3 — Publish application",
      res.ok && !!versionId,
      versionId || body.error || res.status,
    );
    if (!versionId) return;
  } catch (err) {
    record("Test 3 — Publish application", false, err.message);
    return;
  }

  try {
    const { res, body } = await metadataFetch(
      `/applications/${createdAppId}/environments`,
      {
        method: "POST",
        body: JSON.stringify({
          name: `Staging ${Date.now()}`,
          environment_type: "test",
        }),
      },
    );
    environmentId = body.data?.id ?? null;
    record(
      "Test 4 — Create environment",
      res.ok && !!environmentId,
      environmentId || body.error || res.status,
    );
    if (!environmentId) return;
  } catch (err) {
    record("Test 4 — Create environment", false, err.message);
    return;
  }

  try {
    const { res, body } = await metadataFetch(
      `/applications/${createdAppId}/environments/${environmentId}/promote`,
      {
        method: "POST",
        body: JSON.stringify({ version_id: versionId }),
      },
    );
    const current = body.data?.current_version_id ?? null;
    record(
      "Test 5 — Promote version to environment",
      res.ok && current === versionId,
      current || body.error || res.status,
    );
  } catch (err) {
    record("Test 5 — Promote version to environment", false, err.message);
    return;
  }

  try {
    const published = await metadataFetch(
      `/runtime/applications/${createdAppId}?channel=published`,
    );
    const byEnv = await metadataFetch(
      `/runtime/applications/${createdAppId}?environmentId=${environmentId}`,
    );
    const pubScreens = published.body.data?.screens ?? [];
    const envScreens = byEnv.body.data?.screens ?? [];
    const ok =
      byEnv.res.ok &&
      byEnv.body.success &&
      envScreens.length >= 1 &&
      envScreens.length === pubScreens.length &&
      byEnv.body.data?.id === createdAppId;
    record(
      "Test 6 — Runtime package by environmentId",
      ok,
      ok
        ? `screens=${envScreens.length} (matches published channel)`
        : byEnv.body.error || `status ${byEnv.res.status}`,
    );
  } catch (err) {
    record("Test 6 — Runtime package by environmentId", false, err.message);
  }

  try {
    const empty = await metadataFetch(
      `/applications/${createdAppId}/environments`,
      {
        method: "POST",
        body: JSON.stringify({
          name: `Empty ${Date.now()}`,
          environment_type: "development",
        }),
      },
    );
    const emptyId = empty.body.data?.id;
    if (!emptyId) {
      record(
        "Test 6b — Unpromoted environment returns 404",
        false,
        "could not create empty env",
      );
      return;
    }
    const { res, body } = await metadataFetch(
      `/runtime/applications/${createdAppId}?environmentId=${emptyId}`,
    );
    record(
      "Test 6b — Unpromoted environment returns 404",
      res.status === 404,
      body.error || `status ${res.status}`,
    );
  } catch (err) {
    record("Test 6b — Unpromoted environment returns 404", false, err.message);
  }
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("Phase 7.7 validation starting");

  try {
    await waitForService("http://localhost:8082/health", "metadata");
  } catch (err) {
    record("Prerequisite — metadata service", false, err.message);
    printSummary(1);
    process.exit(1);
  }

  await runApiTests();
  runGoTests();
  await smokeRuntimeLogin();
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
