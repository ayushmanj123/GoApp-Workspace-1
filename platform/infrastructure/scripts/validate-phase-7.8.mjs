/**
 * Phase 7.8 acceptance — ALM Studio polish (rollback / deprecate).
 * Publish twice → rollback to v1 → deprecate v2 → assert statuses.
 * Run: node infrastructure/scripts/validate-phase-7.8.mjs
 */
import { existsSync, mkdirSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.8");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const METADATA_API = "http://localhost:8082/api/v1";
const TENANT = "00000000-0000-4000-8000-000000000001";
const USER = "00000000-0000-4000-8000-000000000002";

const results = [];
let createdAppId = null;
let version1 = null;
let version2 = null;

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
        name: `ALM UI App ${Date.now()}`,
        description: "Phase 7.8 rollback/deprecate validation",
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
    const p1 = await metadataFetch(`/applications/${createdAppId}/publish`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    version1 = p1.body.data?.version_id ?? null;
    // Small change so second publish creates a new version
    await metadataFetch(`/applications/${createdAppId}`, {
      method: "PUT",
      body: JSON.stringify({ description: `Updated ${Date.now()}` }),
    });
    const p2 = await metadataFetch(`/applications/${createdAppId}/publish`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    version2 = p2.body.data?.version_id ?? null;
    record(
      "Test 2 — Publish two versions",
      p1.res.ok && p2.res.ok && !!version1 && !!version2 && version1 !== version2,
      `v1=${version1} v2=${version2}`,
    );
    if (!version1 || !version2) return;
  } catch (err) {
    record("Test 2 — Publish two versions", false, err.message);
    return;
  }

  try {
    const { res, body } = await metadataFetch(
      `/applications/${createdAppId}/versions/${version1}/rollback`,
      { method: "POST" },
    );
    const app = await metadataFetch(`/applications/${createdAppId}`);
    const ok =
      res.ok &&
      body.data?.version_id === version1 &&
      app.body.data?.current_version_id === version1 &&
      app.body.data?.status === "published";
    record(
      "Test 3 — Rollback to first version",
      ok,
      ok ? `current=${version1}` : body.error || res.status,
    );
  } catch (err) {
    record("Test 3 — Rollback to first version", false, err.message);
  }

  try {
    const { res, body } = await metadataFetch(
      `/applications/${createdAppId}/versions/${version2}/deprecate`,
      { method: "POST" },
    );
    const versions = await metadataFetch(
      `/applications/${createdAppId}/versions`,
    );
    const items = versions.body.data?.items ?? [];
    const v2 = items.find((v) => v.id === version2);
    const ok = res.ok && v2?.status === "deprecated";
    record(
      "Test 4 — Deprecate second version",
      ok,
      ok ? `status=${v2.status}` : body.error || JSON.stringify(v2),
    );
  } catch (err) {
    record("Test 4 — Deprecate second version", false, err.message);
  }

  try {
    const studio = await fetch("http://localhost:5173/");
    record(
      "Test 5 — Studio UI reachable (optional)",
      studio.ok,
      studio.ok ? `status ${studio.status}` : `status ${studio.status}`,
    );
  } catch (err) {
    record(
      "Test 5 — Studio UI reachable (optional)",
      true,
      `skipped — studio not up (${err.message})`,
    );
  }
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("Phase 7.8 validation starting");

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
