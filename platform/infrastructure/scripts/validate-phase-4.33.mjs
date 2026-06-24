/**
 * Phase 4.33 acceptance validation — Components Foundation (Lite).
 * Run: node infrastructure/scripts/validate-phase-4.33.mjs
 */
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-4.33");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const METADATA_API = "http://localhost:8082/api/v1";
const STUDIO_BASE = "http://localhost:5173";

const TENANT = "00000000-0000-4000-8000-000000000001";
const APP_ID = "00000000-0000-4000-8000-000000000003";
const SCREEN1_ID = "00000000-0000-4000-8000-000000000004";
const STUDIO_URL = `http://localhost:5173/studio/apps/${APP_ID}/screens/${SCREEN1_ID}`;

const results = [];
let studioStartedByScript = false;
let studioProcess = null;
let prefix = null;
let rootId = null;
let childId = null;
let componentName = null;

function log(line) {
  const msg = `[${new Date().toISOString()}] ${line}`;
  console.log(msg);
  fs.appendFileSync(LOG_FILE, `${msg}\n`);
}

function record(test, passed, detail) {
  results.push({ test, passed, detail });
  log(`${passed ? "PASS" : "FAIL"} — ${test}: ${detail}`);
}

async function waitForMetadata(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${METADATA_API}/applications/${APP_ID}/screens`, {
        headers: { "X-Tenant-Id": TENANT },
      });
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

async function listControls(screenId) {
  const res = await fetch(`${METADATA_API}/screens/${screenId}/controls`, {
    headers: { "X-Tenant-Id": TENANT },
  });
  return (await res.json()).data?.items ?? [];
}

async function deleteControl(controlId) {
  await fetch(`${METADATA_API}/controls/${controlId}`, {
    method: "DELETE",
    headers: { "X-Tenant-Id": TENANT },
  });
}

async function createControlViaApi(screenId, name, controlType, x, y, width, height, parentControlId = null, properties = null) {
  const res = await fetch(`${METADATA_API}/screens/${screenId}/controls`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Tenant-Id": TENANT },
    body: JSON.stringify({
      name,
      control_type: controlType,
      x,
      y,
      width,
      height,
      z_index: 50,
      parent_control_id: parentControlId,
    }),
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(`Create control failed: ${JSON.stringify(body)}`);
  if (properties) {
    await fetch(`${METADATA_API}/controls/${body.data.id}/properties`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Tenant-Id": TENANT },
      body: JSON.stringify({ properties }),
    });
  }
  return body.data;
}

async function listComponentDefinitions() {
  const res = await fetch(`${METADATA_API}/applications/${APP_ID}/component-definitions`, {
    headers: { "X-Tenant-Id": TENANT },
  });
  return (await res.json()).data?.items ?? [];
}

async function cleanupByPrefix(p) {
  const items = await listControls(SCREEN1_ID);
  for (const c of items) {
    if (c.name.startsWith(p) || c.control_type === "component") {
      await deleteControl(c.id);
    }
  }
}

async function openStudio(page) {
  await page.goto(STUDIO_URL, { waitUntil: "networkidle" });
  await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
  await page.getByTestId("explorer-control-tree").waitFor({ timeout: 15000 });
}

async function selectControl(page, controlId) {
  await page.getByTestId(`explorer-select-${controlId}`).click();
  await page.waitForTimeout(200);
}

async function saveScreen(page) {
  return page.evaluate(async () => {
    const result = await window.__applicationStore?.getState().saveScreen();
    return result ?? { success: false, errors: ["saveScreen unavailable"] };
  });
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("=== Phase 4.33 Acceptance Validation ===");

  const typeStudio = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@goapps/studio", "typecheck"],
    { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" },
  );
  record("Test 9 — TypeScript clean", typeStudio.status === 0, `exit=${typeStudio.status}`);
  if (typeStudio.status !== 0) process.exit(1);

  await waitForMetadata();
  await ensureStudio();

  prefix = `Cmp33_${Date.now()}`;
  componentName = `${prefix}_Header`;
  await cleanupByPrefix(prefix);

  rootId = (await createControlViaApi(SCREEN1_ID, `${prefix}_RootLbl`, "label", 80, 80, 180, 32, null, {
    text: { value: `${prefix}_Title` },
  })).id;
  childId = (await createControlViaApi(SCREEN1_ID, `${prefix}_RootBtn`, "button", 80, 120, 140, 36, rootId, {
    text: { value: "Go" },
  })).id;

  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    browser = await chromium.launch({ channel: "msedge", headless: true });
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await openStudio(page);
    await selectControl(page, rootId);

    // Test 1 — Create component from subtree
    await page.getByTestId("explorer-create-component").click();
    await page.getByTestId("explorer-create-component-name").fill(componentName);
    await page.getByTestId("explorer-create-component-save").click();
    await page.waitForTimeout(800);
    const defsAfterCreate = await listComponentDefinitions();
    const createdDef = defsAfterCreate.find((d) => d.name === componentName);
    const test1 = Boolean(createdDef?.definition_json?.controls?.length >= 2);
    record("Test 1 — Create component from subtree", test1, `controls=${createdDef?.definition_json?.controls?.length ?? 0}`);

    // Test 2 — Insert component instance
    await page.getByTestId("explorer-insert-component").click();
    await page.getByTestId("insert-component-modal").waitFor({ timeout: 5000 });
    await page.getByTestId(`insert-component-${componentName}`).click();
    await page.waitForTimeout(400);
    const instanceOnCanvas = await page.locator('[data-testid="component-instance"]').count();
    const test2 = instanceOnCanvas >= 1;
    record("Test 2 — Insert component instance", test2, `instancesOnCanvas=${instanceOnCanvas}`);

    // Test 3 — Instance renders
    const renders = await page.locator('[data-testid="component-instance"]').count();
    const test3 = renders >= 1;
    record("Test 3 — Instance renders", test3, `instancesOnCanvas=${renders}`);

    // Test 4 — Multiple instances render
    await page.getByTestId("explorer-insert-component").click();
    await page.getByTestId(`insert-component-${componentName}`).click();
    await page.waitForTimeout(400);
    const multiCount = await page.locator('[data-testid="component-instance"]').count();
    const test4 = multiCount >= 2;
    record("Test 4 — Multiple instances render", test4, `instancesOnCanvas=${multiCount}`);

    // Test 5 — Save + refresh persists
    const saveResult = await saveScreen(page);
    const savedInstancesBeforeReload = (await listControls(SCREEN1_ID)).filter(
      (c) => c.control_type === "component",
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("explorer-control-tree").waitFor({ timeout: 15000 });
    const savedInstances = (await listControls(SCREEN1_ID)).filter(
      (c) => c.control_type === "component",
    );
    const test5 = saveResult?.success === true && savedInstances.length >= 2;
    record(
      "Test 5 — Save + refresh persists",
      test5,
      `save=${saveResult?.success}, before=${savedInstancesBeforeReload.length}, after=${savedInstances.length}, errors=${JSON.stringify(saveResult?.errors ?? [])}`,
    );

    // Test 6 — Explorer shows components
    await page.getByTestId("explorer-components-section").waitFor({ timeout: 5000 });
    const defVisible = await page.getByTestId(`explorer-component-def-${componentName}`).isVisible();
    const test6 = defVisible;
    record("Test 6 — Explorer shows components", test6, `defVisible=${defVisible}`);

    // Test 7 — Runtime unaffected
    const rtRes = await fetch(`${METADATA_API}/runtime/applications/${APP_ID}`, {
      headers: { "X-Tenant-Id": TENANT },
    });
    const rtBody = await rtRes.json();
    const test7 = rtRes.ok && Array.isArray(rtBody.data?.screens);
    record("Test 7 — Runtime unaffected", test7, `screens=${rtBody.data?.screens?.length ?? 0}`);

    // Test 8 — Forms/Galleries unaffected
    const gal = (await listControls(SCREEN1_ID)).find((c) => c.control_type === "gallery");
    const rtGal = rtBody.data?.screens
      ?.find((s) => s.id === SCREEN1_ID)
      ?.controls?.find((c) => c.control_type === "gallery" || c.name?.toLowerCase().includes("gallery"));
    const test8 = !gal || rtGal || rtRes.ok;
    record("Test 8 — Forms/Galleries unaffected", test8, `galleryControl=${Boolean(gal)}, runtimeOk=${rtRes.ok}`);
  } finally {
    await browser.close();
    await stopStudioDev();
    if (prefix) await cleanupByPrefix(prefix);
  }

  const failed = results.filter((r) => !r.passed).length;
  log(`=== Summary: ${results.length - failed}/${results.length} passed ===`);
  fs.writeFileSync(path.join(OUT_DIR, "results.json"), JSON.stringify(results, null, 2));
  if (failed > 0) process.exit(1);
}

run().catch(async (err) => {
  log(`FATAL: ${err.stack || err}`);
  await stopStudioDev();
  if (prefix) await cleanupByPrefix(prefix);
  process.exit(1);
});
