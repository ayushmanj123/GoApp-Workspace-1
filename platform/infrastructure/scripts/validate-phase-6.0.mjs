/**
 * Phase 6.0 acceptance validation — Entity Foundation.
 * Run: node infrastructure/scripts/validate-phase-6.0.mjs
 */
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-6.0");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const METADATA_API = "http://localhost:8082/api/v1";
const STUDIO_BASE = "http://localhost:5173";

const TENANT = "00000000-0000-4000-8000-000000000001";
const APP_ID = "00000000-0000-4000-8000-000000000003";
const SCREEN1_ID = "00000000-0000-4000-8000-000000000004";
const STUDIO_URL = `${STUDIO_BASE}/studio/apps/${APP_ID}/screens/${SCREEN1_ID}`;

const ENTITY_NAME = "Customer";
const FIELD_NAMES = {
  text: "firstName",
  number: "age",
  boolean: "isActive",
  date: "birthDate",
};

const results = [];
let studioStartedByScript = false;
let studioProcess = null;
let entityId = null;

function log(line) {
  const msg = `[${new Date().toISOString()}] ${line}`;
  console.log(msg);
  fs.appendFileSync(LOG_FILE, `${msg}\n`);
}

function record(test, passed, detail) {
  results.push({ test, passed, detail });
  log(`${passed ? "PASS" : "FAIL"} — ${test}: ${detail}`);
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${METADATA_API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Id": TENANT,
      ...(options.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function waitForMetadata(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const { res } = await apiFetch(`/applications/${APP_ID}/screens`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Metadata service not available on :8082.");
}

async function ensureStudio() {
  try {
    const res = await fetch(STUDIO_BASE);
    if (res.ok || res.status === 304) return;
  } catch {
    /* not running */
  }
  studioStartedByScript = true;
  studioProcess = spawn(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@goapps/studio", "dev"],
    { cwd: ROOT, stdio: "ignore", shell: process.platform === "win32" },
  );
  const start = Date.now();
  while (Date.now() - start < 90000) {
    try {
      const res = await fetch(STUDIO_BASE);
      if (res.ok || res.status === 304) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Studio did not start in time.");
}

async function stopStudioDev() {
  if (studioStartedByScript && studioProcess && !studioProcess.killed) {
    studioProcess.kill();
    studioProcess = null;
    studioStartedByScript = false;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function findOrCreateEntity() {
  const { res: listRes, body: listBody } = await apiFetch(`/applications/${APP_ID}/entities`);
  if (!listRes.ok) {
    throw new Error(`list entities failed: ${listBody.error ?? listRes.status}`);
  }
  const existing = (listBody.data?.items ?? []).find((e) => e.name === ENTITY_NAME);
  if (existing) {
    entityId = existing.id;
    return existing;
  }
  const { res, body } = await apiFetch(`/applications/${APP_ID}/entities`, {
    method: "POST",
    body: JSON.stringify({ name: ENTITY_NAME, display_name: ENTITY_NAME }),
  });
  if (!res.ok) {
    throw new Error(`create entity failed: ${body.error ?? res.status}`);
  }
  entityId = body.data.id;
  return body.data;
}

async function createFieldIfMissing(name, displayName, fieldType) {
  const { res: listRes, body: listBody } = await apiFetch(`/entities/${entityId}/fields`);
  if (!listRes.ok) {
    throw new Error(`list fields failed: ${listBody.error ?? listRes.status}`);
  }
  const existing = (listBody.data?.items ?? []).find((f) => f.name === name);
  if (existing) return existing;
  const { res, body } = await apiFetch(`/entities/${entityId}/fields`, {
    method: "POST",
    body: JSON.stringify({ name, display_name: displayName, field_type: fieldType }),
  });
  if (!res.ok) {
    throw new Error(`create field ${name} failed: ${body.error ?? res.status}`);
  }
  return body.data;
}

async function runApiTests() {
  try {
    const entity = await findOrCreateEntity();
    record("Test 1 — Create Customer entity", entity?.name === ENTITY_NAME, entity?.name ?? "missing");
  } catch (err) {
    record("Test 1 — Create Customer entity", false, err.message);
    return;
  }

  const fieldTests = [
    ["Test 2 — Add Text field", FIELD_NAMES.text, "First Name", "text"],
    ["Test 3 — Add Number field", FIELD_NAMES.number, "Age", "number"],
    ["Test 4 — Add Boolean field", FIELD_NAMES.boolean, "Is Active", "boolean"],
    ["Test 5 — Add Date field", FIELD_NAMES.date, "Birth Date", "date"],
  ];

  for (const [label, name, displayName, fieldType] of fieldTests) {
    try {
      const field = await createFieldIfMissing(name, displayName, fieldType);
      record(label, field?.field_type === fieldType, `${field?.name} (${field?.field_type})`);
    } catch (err) {
      record(label, false, err.message);
    }
  }
}

async function launchBrowser() {
  const launchOpts = { headless: true };
  if (process.platform === "win32") {
    try {
      return await chromium.launch({ ...launchOpts, channel: "msedge" });
    } catch {
      /* fall through */
    }
  }
  return chromium.launch(launchOpts);
}

async function runStudioTests() {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(STUDIO_URL, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector('[data-testid="explorer-entities-section"]', { timeout: 30000 });
    await page.waitForSelector(`[data-testid="explorer-entity-${ENTITY_NAME}"]`, { timeout: 30000 });

    const entityVisible = await page
      .locator(`[data-testid="explorer-entity-${ENTITY_NAME}"]`)
      .isVisible()
      .catch(() => false);
    if (!entityVisible) {
      record("Test 6 — Explorer shows entities and fields", false, "Customer entity not visible");
    } else {
      await page.locator(`[data-testid="explorer-entity-${ENTITY_NAME}"]`).click();
      const fieldChecks = await Promise.all(
        Object.values(FIELD_NAMES).map((name) =>
          page.locator(`[data-testid="explorer-entity-field-${ENTITY_NAME}-${name}"]`).isVisible(),
        ),
      );
      const allVisible = fieldChecks.every(Boolean);
      record(
        "Test 6 — Explorer shows entities and fields",
        allVisible,
        allVisible ? "entity and all fields visible" : `fields visible: ${fieldChecks.filter(Boolean).length}/4`,
      );
    }

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="explorer-entities-section"]', { timeout: 30000 });
    const persisted = await page
      .locator(`[data-testid="explorer-entity-field-${ENTITY_NAME}-${FIELD_NAMES.text}"]`)
      .isVisible()
      .catch(() => false);
    record("Test 7 — Save + refresh persists", persisted, persisted ? "fields survive refresh" : "field missing after refresh");
  } catch (err) {
    record("Test 6 — Explorer shows entities and fields", false, err.message);
    record("Test 7 — Save + refresh persists", false, err.message);
  } finally {
    await browser.close();
  }
}

async function runRuntimeTests() {
  try {
    const { res, body } = await apiFetch(`/runtime/applications/${APP_ID}`);
    if (!res.ok) {
      record("Test 8 — Runtime package contains entity metadata", false, body.error ?? res.status);
    } else {
      const entities = body.data?.entities ?? [];
      const customer = entities.find((e) => e.name === ENTITY_NAME);
      const fieldNames = (customer?.fields ?? []).map((f) => f.name);
      const hasAll =
        customer &&
        [FIELD_NAMES.text, FIELD_NAMES.number, FIELD_NAMES.boolean, FIELD_NAMES.date].every((n) =>
          fieldNames.includes(n),
        );
      record(
        "Test 8 — Runtime package contains entity metadata",
        hasAll,
        hasAll ? `Customer with ${fieldNames.length} fields` : `entities=${entities.length}, fields=${fieldNames.join(",")}`,
      );
    }
  } catch (err) {
    record("Test 8 — Runtime package contains entity metadata", false, err.message);
  }

  try {
    const { res, body } = await apiFetch(`/applications/${APP_ID}/component-definitions`);
    record("Test 9 — Components unaffected", res.ok, res.ok ? `${body.data?.items?.length ?? 0} definitions` : body.error);
  } catch (err) {
    record("Test 9 — Components unaffected", false, err.message);
  }

  try {
    const { res, body } = await apiFetch(`/runtime/screens/${SCREEN1_ID}`);
    const controls = body.data?.controls ?? [];
    record("Test 10 — Runtime unaffected", res.ok && Array.isArray(controls), res.ok ? `${controls.length} root controls` : body.error);
  } catch (err) {
    record("Test 10 — Runtime unaffected", false, err.message);
  }
}

function runTypecheck() {
  const studio = spawnSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["--filter", "@goapps/studio", "exec", "tsc", "--noEmit"], {
    cwd: ROOT,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const runtime = spawnSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["--filter", "@goapps/runtime", "exec", "tsc", "--noEmit"], {
    cwd: ROOT,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const goTest = spawnSync("go", ["test", "./..."], {
    cwd: path.join(ROOT, "services/metadata"),
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const ok = studio.status === 0 && runtime.status === 0 && goTest.status === 0;
  const detail = [
    studio.status === 0 ? "studio tsc ok" : `studio tsc fail: ${studio.stderr || studio.stdout}`,
    runtime.status === 0 ? "runtime tsc ok" : `runtime tsc fail: ${runtime.stderr || runtime.stdout}`,
    goTest.status === 0 ? "go test ok" : `go test fail: ${goTest.stderr || goTest.stdout}`,
  ].join("; ");
  record("Test 11 — TypeScript clean", ok, detail);
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("Phase 6.0 validation starting");

  await waitForMetadata();
  await runApiTests();
  await ensureStudio();
  await runStudioTests();
  await runRuntimeTests();
  runTypecheck();
  await stopStudioDev();

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  log(`\n=== ${passed}/${total} tests passed ===`);
  for (const r of results) {
    console.log(`${r.passed ? "PASS" : "FAIL"} — ${r.test}: ${r.detail}`);
  }
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
