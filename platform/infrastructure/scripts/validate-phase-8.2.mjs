/**
 * Phase 8.2 — MinIO artifact GC (ref-safe Deprecate; Unpublish pointer-only).
 *
 * Authoritative checks are Go unit tests in
 * services/metadata/internal/services/artifact_publish_test.go:
 *   - Delete removes an uploaded blob
 *   - Deprecate with no live refs → MinIO delete + packages row cleared
 *   - Deprecate while an environment still points at the version → no delete
 *   - Unpublish never GC's blobs
 *
 * Run: node infrastructure/scripts/validate-phase-8.2.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-8.2");
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

function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(LOG_FILE, "");
  log("Phase 8.2 validation starting");

  const metadata = path.join(ROOT, "services/metadata");
  const build = spawnSync("go", ["build", "./..."], { cwd: metadata, encoding: "utf8" });
  record(
    "Test 1 — metadata-service compiles (Delete + Deprecate GC)",
    build.status === 0,
    build.status === 0 ? "ok" : `${build.stdout}\n${build.stderr}`,
  );

  const unit = spawnSync(
    "go",
    [
      "test",
      "./internal/services/...",
      "-run",
      "FakeBlobStoreDelete|DeprecateGCs|DeprecateSkipsGC|UnpublishDoesNotGC",
      "-v",
      "-count=1",
    ],
    { cwd: metadata, encoding: "utf8" },
  );
  const unitOk = unit.status === 0;
  record(
    "Test 2 — Delete removes blob (unit)",
    unitOk && unit.stdout.includes("TestFakeBlobStoreDeleteRemovesObject"),
    unitOk ? "ok" : `${unit.stdout}\n${unit.stderr}`,
  );
  record(
    "Test 3 — Deprecate GC when unreferenced (unit)",
    unitOk && unit.stdout.includes("TestDeprecateGCsUnreferencedArtifact"),
    unitOk ? "ok" : `${unit.stdout}\n${unit.stderr}`,
  );
  record(
    "Test 4 — Deprecate skips GC when env references version (unit)",
    unitOk && unit.stdout.includes("TestDeprecateSkipsGCWhenEnvironmentReferencesVersion"),
    unitOk ? "ok" : `${unit.stdout}\n${unit.stderr}`,
  );
  record(
    "Test 5 — Unpublish does not GC (unit)",
    unitOk && unit.stdout.includes("TestUnpublishDoesNotGCArtifact"),
    unitOk ? "ok" : `${unit.stdout}\n${unit.stderr}`,
  );

  const full = spawnSync("go", ["test", "./internal/services/...", "-count=1"], {
    cwd: metadata,
    encoding: "utf8",
  });
  record(
    "Test 6 — full metadata services test suite still passes",
    full.status === 0,
    full.status === 0 ? "ok" : `${full.stdout}\n${full.stderr}`,
  );

  const instructions = readFileSync(path.join(ROOT, "instructions.md"), "utf8");
  record(
    "Test 7 — instructions.md marks 8.2 COMPLETE",
    /8\.2.*COMPLETE/i.test(instructions),
    "8.2 COMPLETE row",
  );

  const almDocs = readFileSync(path.join(ROOT, "docs/enterprise-alm.md"), "utf8");
  record(
    "Test 8 — enterprise-alm.md documents Deprecate GC + Unpublish no-GC",
    almDocs.includes("Unpublish") &&
      almDocs.includes("pointer-only") &&
      almDocs.includes("best-effort") &&
      almDocs.includes("snapshot_json"),
    "docs/enterprise-alm.md artifact lifecycle",
  );

  const publishSrc = readFileSync(
    path.join(ROOT, "services/metadata/internal/services/publish_service.go"),
    "utf8",
  );
  const storeSrc = readFileSync(
    path.join(ROOT, "services/metadata/internal/services/artifact_store.go"),
    "utf8",
  );
  record(
    "Test 9 — Delete + gcUnreferencedPublishArtifact wired",
    storeSrc.includes("func (s *ArtifactStore) Delete") &&
      publishSrc.includes("gcUnreferencedPublishArtifact") &&
      publishSrc.includes("versionHasLiveReferences"),
    "artifact_store.go Delete + publish_service.go GC",
  );

  const failed = results.filter((r) => !r.passed);
  log("---");
  log(`Results: ${results.length - failed.length}/${results.length} passed, ${failed.length} failed`);
  for (const r of results) {
    log(`  ${r.passed ? "✓" : "✗"} ${r.test}`);
  }
  process.exit(failed.length > 0 ? 1 : 0);
}

main();
