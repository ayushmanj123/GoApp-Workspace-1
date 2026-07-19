/**
 * Phase 7.14 — Entity relationships UI (minimal many-to-one lookup).
 * Create app + two entities → create a lookup field on one referencing the other →
 * assert the relationship metadata round-trips → assert lookup fields require a
 * related_entity_id → update the relationship target → list fields.
 * Run: node infrastructure/scripts/validate-phase-7.14.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.14");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const METADATA_API = "http://localhost:8082/api/v1";
const TENANT = "00000000-0000-4000-8000-000000000001";
const USER = "00000000-0000-4000-8000-000000000002";

const results = [];
let createdAppId = null;
let authorEntityId = null;
let bookEntityId = null;
let lookupFieldId = null;

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
  const meta = spawnSync("go", ["build", "./..."], {
    cwd: path.join(ROOT, "services/metadata"),
    encoding: "utf8",
  });
  record(
    "Test 7 — Metadata service compiles (EntityField lookup support)",
    meta.status === 0,
    meta.status === 0 ? "ok" : meta.stdout + meta.stderr,
  );

  const runtime = spawnSync("go", ["test", "./internal/records/", "-count=1"], {
    cwd: path.join(ROOT, "services/runtime"),
    encoding: "utf8",
  });
  record(
    "Test 8 — Runtime record validation tests (lookup field type)",
    runtime.status === 0,
    runtime.status === 0 ? "ok" : runtime.stdout + runtime.stderr,
  );
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("Phase 7.14 validation starting");

  try {
    await waitForService("http://localhost:8082/health", "metadata");
  } catch (err) {
    record("Prerequisite — metadata service", false, err.message);
    printSummary(1);
    process.exit(1);
  }

  // Create app
  {
    const { res, body } = await metadataFetch("/applications", {
      method: "POST",
      body: JSON.stringify({ name: `Phase714-${Date.now()}`, description: "entity relationships" }),
    });
    createdAppId = body?.data?.id;
    record("Test 1 — Create application", res.ok && !!createdAppId, createdAppId || body.error);
  }

  // Create two entities: Author, Book
  if (createdAppId) {
    const { res, body } = await metadataFetch(`/applications/${createdAppId}/entities`, {
      method: "POST",
      body: JSON.stringify({ name: "Author", display_name: "Author" }),
    });
    authorEntityId = body?.data?.id;
    record("Test 2 — Create Author entity", res.ok && !!authorEntityId, authorEntityId || body.error);
  }
  if (createdAppId) {
    const { res, body } = await metadataFetch(`/applications/${createdAppId}/entities`, {
      method: "POST",
      body: JSON.stringify({ name: "Book", display_name: "Book" }),
    });
    bookEntityId = body?.data?.id;
    record("Test 3 — Create Book entity", res.ok && !!bookEntityId, bookEntityId || body.error);
  }

  // Lookup field without related_entity_id must be rejected
  if (bookEntityId) {
    const { res, body } = await metadataFetch(`/entities/${bookEntityId}/fields`, {
      method: "POST",
      body: JSON.stringify({ name: "author_missing", display_name: "Author (missing)", field_type: "lookup" }),
    });
    const ok = !res.ok;
    record("Test 4 — Lookup field without related_entity_id is rejected", ok, ok ? "rejected as expected" : JSON.stringify(body));
  }

  // Create the lookup field (Book.author -> Author)
  if (bookEntityId && authorEntityId) {
    const { res, body } = await metadataFetch(`/entities/${bookEntityId}/fields`, {
      method: "POST",
      body: JSON.stringify({
        name: "author",
        display_name: "Author",
        field_type: "lookup",
        related_entity_id: authorEntityId,
      }),
    });
    lookupFieldId = body?.data?.id;
    const ok =
      res.ok &&
      !!lookupFieldId &&
      body?.data?.field_type === "lookup" &&
      body?.data?.related_entity_id === authorEntityId;
    record("Test 5 — Create lookup field referencing Author", ok, ok ? lookupFieldId : JSON.stringify(body));
  }

  // List fields shows the relationship metadata
  if (bookEntityId) {
    const { res, body } = await metadataFetch(`/entities/${bookEntityId}/fields`);
    const items = body?.data?.items ?? [];
    const match = items.find((f) => f.id === lookupFieldId);
    const ok = res.ok && match?.field_type === "lookup" && match?.related_entity_id === authorEntityId;
    record("Test 6 — List fields includes related_entity_id", ok, JSON.stringify(match ?? items));
  }

  // Changing field_type away from lookup clears the relationship
  if (lookupFieldId) {
    const { res, body } = await metadataFetch(`/entity-fields/${lookupFieldId}`, {
      method: "PUT",
      body: JSON.stringify({ field_type: "text" }),
    });
    const ok = res.ok && body?.data?.field_type === "text" && !body?.data?.related_entity_id;
    record("Test 6b — Switching field_type off lookup clears relation", ok, JSON.stringify(body?.data ?? body));
  }

  runGoTests();

  // Cleanup
  if (createdAppId) {
    await metadataFetch(`/applications/${createdAppId}`, { method: "DELETE" }).catch(() => {});
  }

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
