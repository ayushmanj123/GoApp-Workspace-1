/**
 * Phase 8.1 — MinIO publish artifacts.
 *
 * Authoritative checks are the Go unit tests in
 * services/metadata/internal/services/artifact_publish_test.go, which use an
 * in-memory fake MinIO client to deterministically exercise:
 *   - publish uploads the snapshot blob and records packages.package_url/hash
 *   - runtime prefers the MinIO artifact over snapshot_json when present
 *   - publish fails when MinIO is configured and upload fails (Phase 9.1)
 *   - publish still succeeds with DB-only snapshot when MinIO is not configured
 *   - runtime falls back to snapshot_json on artifact download failure or
 *     sha256 hash mismatch
 * These pass with or without a real MinIO server, so they always run.
 *
 * If the metadata service (and, optionally, a real MinIO) are reachable,
 * this script additionally publishes a real application end-to-end and
 * confirms the runtime package is still served correctly — demonstrating
 * the graceful degrade path live, without requiring MinIO to be up.
 *
 * Run: node infrastructure/scripts/validate-phase-8.1.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-8.1");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const METADATA_API = "http://localhost:8082/api/v1";
const METADATA_HEALTH = "http://localhost:8082/health";
const MINIO_HEALTH = "http://localhost:9000/minio/health/live";
const TENANT = "00000000-0000-4000-8000-000000000001";
const USER = "00000000-0000-4000-8000-000000000002";

const results = [];
let createdAppId = null;

function log(line) {
  const msg = `[${new Date().toISOString()}] ${line}`;
  console.log(msg);
  fs.appendFileSync(LOG_FILE, `${msg}\n`);
}

function record(test, passed, detail) {
  results.push({ test, passed, detail });
  log(`${passed ? "PASS" : "FAIL"} — ${test}: ${detail}`);
}

function skip(test, detail) {
  results.push({ test, passed: true, skipped: true, detail });
  log(`SKIP — ${test}: ${detail}`);
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

async function pingOk(url, timeoutMs = 2000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok || res.status === 304;
  } catch {
    return false;
  }
}

async function waitForService(url, label, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await pingOk(url, 1000)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

/**
 * Test 1 — the deterministic, always-run proof: unit tests covering
 * upload → packages row → runtime-prefers-artifact, and every fallback path
 * (MinIO down at publish time, download failure, hash mismatch).
 */
function runGoTests() {
  const build = spawnSync("go", ["build", "./..."], {
    cwd: path.join(ROOT, "services/metadata"),
    encoding: "utf8",
  });
  record(
    "Test 1 — metadata-service compiles (minio artifact store + packages wiring)",
    build.status === 0,
    build.status === 0 ? "ok" : build.stdout + build.stderr,
  );

  const unit = spawnSync(
    "go",
    [
      "test",
      "./internal/services/...",
      "-run",
      "Publish|Runtime|ArtifactStore|ObjectURL",
      "-v",
      "-count=1",
    ],
    { cwd: path.join(ROOT, "services/metadata"), encoding: "utf8" },
  );
  record(
    "Test 2 — publish uploads artifact + packages row + runtime prefers it (unit)",
    unit.status === 0 && unit.stdout.includes("TestPublishUploadsArtifactAndRuntimePrefersIt"),
    unit.status === 0 ? "ok" : unit.stdout + unit.stderr,
  );
  record(
    "Test 3 — publish gracefully degrades when MinIO upload fails (unit)",
    unit.status === 0 && unit.stdout.includes("TestPublishFallsBackWhenMinioUploadFails"),
    unit.status === 0 ? "ok" : unit.stdout + unit.stderr,
  );
  record(
    "Test 4 — runtime falls back to snapshot_json on artifact download failure (unit)",
    unit.status === 0 && unit.stdout.includes("TestRuntimeFallsBackWhenArtifactDownloadFails"),
    unit.status === 0 ? "ok" : unit.stdout + unit.stderr,
  );
  record(
    "Test 5 — runtime falls back to snapshot_json on sha256 hash mismatch (unit)",
    unit.status === 0 && unit.stdout.includes("TestRuntimeFallsBackOnArtifactHashMismatch"),
    unit.status === 0 ? "ok" : unit.stdout + unit.stderr,
  );

  const full = spawnSync("go", ["test", "./internal/services/...", "-count=1"], {
    cwd: path.join(ROOT, "services/metadata"),
    encoding: "utf8",
  });
  record(
    "Test 6 — full metadata services test suite still passes",
    full.status === 0,
    full.status === 0 ? "ok" : full.stdout + full.stderr,
  );
}

/**
 * Test 7+ — best-effort live end-to-end: only runs if the metadata service
 * is actually reachable. MinIO availability is independently detected and
 * only changes what we assert (URL is not required to be a MinIO URL,
 * because publish must succeed identically either way).
 */
async function runLiveApiChecks() {
  const metadataUp = await waitForService(METADATA_HEALTH, "metadata");
  if (!metadataUp) {
    skip(
      "Test 7 — live publish → runtime round trip",
      `metadata service not reachable at ${METADATA_HEALTH}; unit tests above are the authoritative check for this phase`,
    );
    return;
  }

  const minioUp = await pingOk(MINIO_HEALTH, 2000);
  log(`MinIO reachable at ${MINIO_HEALTH}: ${minioUp} (informational only — publish must succeed either way)`);

  const { res: createRes, body: createBody } = await metadataFetch("/applications", {
    method: "POST",
    body: JSON.stringify({ name: `Phase81-${Date.now()}`, description: "minio publish artifacts" }),
  });
  createdAppId = createBody?.data?.id;
  record("Test 7 — create application", createRes.ok && !!createdAppId, createdAppId || createBody.error);
  if (!createdAppId) return;

  const { res: screenRes, body: screenBody } = await metadataFetch(
    `/applications/${createdAppId}/screens`,
    {
      method: "POST",
      body: JSON.stringify({ name: "Home", display_order: 1, layout_type: "grid" }),
    },
  );
  record("Test 8 — create screen", screenRes.ok && !!screenBody?.data?.id, screenBody?.data?.id || screenBody.error);

  const { res: publishRes, body: publishBody } = await metadataFetch(
    `/applications/${createdAppId}/publish`,
    { method: "POST" },
  );
  const versionId = publishBody?.data?.version_id;
  record(
    `Test 9 — publish succeeds regardless of MinIO availability (minio up: ${minioUp})`,
    publishRes.ok && !!versionId,
    versionId || publishBody.error,
  );

  const { res: runtimeRes, body: runtimeBody } = await metadataFetch(
    `/runtime/applications/${createdAppId}`,
  );
  const screens = runtimeBody?.data?.screens ?? [];
  const ok = runtimeRes.ok && screens.some((s) => s.name === "Home");
  record(
    "Test 10 — published runtime package serves correctly (artifact or snapshot_json fallback, transparently)",
    ok,
    ok ? JSON.stringify(screens.map((s) => s.name)) : JSON.stringify(runtimeBody),
  );
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("Phase 8.1 validation starting");

  runGoTests();
  await runLiveApiChecks();

  if (createdAppId) {
    await metadataFetch(`/applications/${createdAppId}`, { method: "DELETE" }).catch(() => {});
  }

  const failed = results.filter((r) => !r.passed).length;
  const skipped = results.filter((r) => r.skipped).length;
  log("---");
  log(`Results: ${results.length - failed} passed (${skipped} skipped), ${failed} failed`);
  for (const r of results) {
    log(`  ${r.passed ? (r.skipped ? "○" : "✓") : "✗"} ${r.test}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
