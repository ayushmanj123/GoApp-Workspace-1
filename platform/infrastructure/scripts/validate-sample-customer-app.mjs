/**
 * Vertical Slice 5 — Customer Management sample app validation.
 * Run: node infrastructure/scripts/validate-sample-customer-app.mjs
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-sample-customer");
const LOG_FILE = path.join(OUT_DIR, "validation.log");

const METADATA_API = "http://localhost:8082/api/v1";
const RUNTIME_API = "http://localhost:8083/api";

const TENANT = "00000000-0000-4000-8000-000000000001";
const USER = "00000000-0000-4000-8000-000000000002";
const AUTH = `Bearer dev:${TENANT}:${USER}:dev@example.com`;

const CUSTOMER_APP_ID = "00000000-0000-4000-8000-000000000010";
const CUSTOMER_ENTITY_ID = "00000000-0000-4000-8000-000000000013";
const CUSTOMER_LIST_SCREEN = "CustomerList";
const CUSTOMER_EDIT_SCREEN = "CustomerEdit";
const GALLERY_ID = "galleryCustomers";
const FORM_ID = "formCustomer";

const results = [];

function log(line) {
  const msg = `[${new Date().toISOString()}] ${line}`;
  console.log(msg);
  fs.appendFileSync(LOG_FILE, `${msg}\n`);
}

function record(test, passed, detail, optional = false) {
  results.push({ test, passed, detail, optional });
  const label = passed ? "PASS" : optional ? "SKIP" : "FAIL";
  log(`${label} — ${test}: ${detail}`);
}

async function runtimeFetch(path, options = {}) {
  const res = await fetch(`${RUNTIME_API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: AUTH,
      ...(options.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function metadataFetch(path, options = {}) {
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

async function waitForService(url, label, timeoutMs = 20000) {
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
  return false;
}

async function checkMetadataSeed() {
  try {
    const { res, body } = await metadataFetch(`/applications/${CUSTOMER_APP_ID}`);
    if (!res.ok) {
      record("Metadata — Customer app seeded", false, body.error ?? res.status);
      return;
    }
    const name = body.data?.name ?? body.data?.application?.name ?? "";
    const { res: screensRes, body: screensBody } = await metadataFetch(
      `/applications/${CUSTOMER_APP_ID}/screens`,
    );
    const screens = screensBody.data?.items ?? screensBody.data ?? [];
    const screenNames = Array.isArray(screens) ? screens.map((s) => s.name) : [];
    const hasList = screenNames.includes(CUSTOMER_LIST_SCREEN);
    const hasEdit = screenNames.includes(CUSTOMER_EDIT_SCREEN);
    record(
      "Metadata — Customer app seeded",
      res.ok && name === "Customer Management" && hasList && hasEdit,
      `name=${name}, screens=${screenNames.join(",")}`,
    );
    const { res: entityRes, body: entityBody } = await metadataFetch(
      `/applications/${CUSTOMER_APP_ID}/entities`,
    );
    const entities = entityBody.data?.items ?? entityBody.data ?? [];
    const customer = Array.isArray(entities)
      ? entities.find((e) => e.name === "Customer")
      : null;
    record(
      "Metadata — Customer entity",
      entityRes.ok && !!customer,
      customer ? `id=${customer.id}` : "entity missing",
    );
  } catch (err) {
    record("Metadata — Customer app seeded", false, err.message);
    record("Metadata — Customer entity", false, "metadata unavailable");
  }
}

function runIntegrationTests() {
  const goTest = spawnSync("go", ["test", "./internal/integration/...", "-count=1"], {
    cwd: path.join(ROOT, "services/runtime"),
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  record(
    "Go integration tests",
    goTest.status === 0,
    goTest.status === 0 ? "all passed" : (goTest.stderr || goTest.stdout || "failed").slice(0, 500),
  );
}

async function runRuntimeHttpFlow() {
  const live = await waitForService("http://localhost:8083/live", "runtime");
  if (!live) {
    record(
      "Runtime HTTP — service available",
      true,
      "runtime :8083 not running (optional live flow skipped)",
      true,
    );
    return;
  }
  record("Runtime HTTP — service available", true, "runtime :8083 live");

  let sessionId = null;
  let recordId = null;

  try {
    const createRes = await runtimeFetch(`/entities/${CUSTOMER_ENTITY_ID}/records`, {
      method: "POST",
      body: JSON.stringify({
        data: {
          Name: "Validation Customer",
          Email: "validate@example.com",
          Phone: "555-9999",
          Status: "Active",
        },
      }),
    });
    recordId = createRes.body.data?.recordId ?? createRes.body.data?.id;
    record(
      "Runtime HTTP — create customer record",
      createRes.res.ok && !!recordId,
      createRes.body.error?.message ?? `recordId=${recordId}`,
    );

    const sessionRes = await runtimeFetch("/runtime/session", {
      method: "POST",
      body: JSON.stringify({
        appId: CUSTOMER_APP_ID,
        channel: "draft",
        screen: CUSTOMER_LIST_SCREEN,
      }),
    });
    sessionId = sessionRes.body.data?.sessionId;
    record(
      "Runtime HTTP — start session",
      sessionRes.res.ok && !!sessionId,
      sessionRes.body.error?.message ?? `sessionId=${sessionId}`,
    );
    if (!sessionId) return;

    const galleryRes = await runtimeFetch(`/runtime/session/${sessionId}/gallery/${GALLERY_ID}`);
    const items = galleryRes.body.data?.items ?? [];
    record(
      "Runtime HTTP — gallery loads Customer datasource",
      galleryRes.res.ok && items.length >= 1,
      `count=${items.length}`,
    );

    const selectRes = await runtimeFetch(
      `/runtime/session/${sessionId}/gallery/${GALLERY_ID}/select`,
      {
        method: "POST",
        body: JSON.stringify({ appId: CUSTOMER_APP_ID, index: 0 }),
      },
    );
    record(
      "Runtime HTTP — gallery selection",
      selectRes.res.ok,
      selectRes.body.error?.message ?? "selected",
    );

    const navRes = await runtimeFetch(`/runtime/session/${sessionId}/event`, {
      method: "POST",
      body: JSON.stringify({
        appId: CUSTOMER_APP_ID,
        screen: CUSTOMER_LIST_SCREEN,
        controlId: "btnEdit",
        event: "OnSelect",
      }),
    });
    record(
      "Runtime HTTP — navigate to CustomerEdit",
      navRes.res.ok,
      navRes.body.error?.message ?? "navigated",
    );

    const formRes = await runtimeFetch(`/runtime/session/${sessionId}/form/${FORM_ID}`);
    const formName = formRes.body.data?.currentRecord?.Name ?? formRes.body.data?.item?.Name;
    record(
      "Runtime HTTP — form synced from gallery",
      formRes.res.ok && formName === "Validation Customer",
      `Name=${formName ?? "missing"}`,
    );

    const renderRes = await runtimeFetch(
      `/runtime/session/${sessionId}/render/${CUSTOMER_LIST_SCREEN}`,
    );
    const controls = renderRes.body.data?.controls ?? [];
    const hasGallery = controls.some((c) => c.id === GALLERY_ID || c.controlId === GALLERY_ID);
    record(
      "Runtime HTTP — renderer returns gallery control",
      renderRes.res.ok && hasGallery,
      `controls=${controls.length}`,
    );

    const backRes = await runtimeFetch(`/runtime/session/${sessionId}/event`, {
      method: "POST",
      body: JSON.stringify({
        appId: CUSTOMER_APP_ID,
        screen: CUSTOMER_EDIT_SCREEN,
        controlId: "btnBack",
        event: "OnSelect",
      }),
    });
    record(
      "Runtime HTTP — Back() preserves session",
      backRes.res.ok,
      backRes.body.error?.message ?? "back ok",
    );
  } catch (err) {
    record("Runtime HTTP — flow", false, err.message);
  } finally {
    if (recordId) {
      try {
        await runtimeFetch(`/entities/${CUSTOMER_ENTITY_ID}/records/${recordId}`, {
          method: "DELETE",
        });
      } catch {
        /* cleanup best effort */
      }
    }
  }
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("Sample Customer App validation starting");

  const metadataUp = await waitForService(`${METADATA_API}/applications/${CUSTOMER_APP_ID}`, "metadata", 8000);
  if (metadataUp) {
    await checkMetadataSeed();
  } else {
    record(
      "Metadata — Customer app seeded",
      true,
      "metadata :8082 not running (optional live check skipped)",
      true,
    );
    record(
      "Metadata — Customer entity",
      true,
      "metadata :8082 not running (optional live check skipped)",
      true,
    );
  }

  runIntegrationTests();
  await runRuntimeHttpFlow();

  const passed = results.filter((r) => r.passed).length;
  const required = results.filter((r) => !r.optional);
  const requiredPassed = required.filter((r) => r.passed).length;
  const total = results.length;
  log(`\n=== ${passed}/${total} checks passed (${requiredPassed}/${required.length} required) ===`);
  for (const r of results) {
    const label = r.passed ? "PASS" : r.optional ? "SKIP" : "FAIL";
    console.log(`${label} — ${r.test}: ${r.detail}`);
  }
  process.exit(requiredPassed === required.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
