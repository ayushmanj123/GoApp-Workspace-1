/**
 * Phase 5.0 acceptance validation — Explorer Tree & Hierarchy Foundation.
 * Run: node infrastructure/scripts/validate-phase-5.0.mjs
 */
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-5.0");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const FORMULA_API = "http://localhost:8085";
const METADATA_API = "http://localhost:8082/api/v1";
const STUDIO_BASE = "http://localhost:5173";

const TENANT = "00000000-0000-4000-8000-000000000001";
const APP_ID = "00000000-0000-4000-8000-000000000003";
const SCREEN1_ID = "00000000-0000-4000-8000-000000000004";
const STUDIO_URL = `http://localhost:5173/studio/apps/${APP_ID}/screens/${SCREEN1_ID}`;

const results = [];
let apiProcess = null;
let studioStartedByScript = false;
let studioProcess = null;
let galleryId = null;
let formId = null;
let galLblId = null;
let galInputId = null;
let formNameId = null;
let formCityId = null;
let rootBtnId = null;

function log(line) {
  const msg = `[${new Date().toISOString()}] ${line}`;
  console.log(msg);
  fs.appendFileSync(LOG_FILE, `${msg}\n`);
}

function record(test, passed, detail) {
  results.push({ test, passed, detail });
  log(`${passed ? "PASS" : "FAIL"} — ${test}: ${detail}`);
}

function startFormulaApi() {
  const localDotnet = path.join(ROOT, ".dotnet", process.platform === "win32" ? "dotnet.exe" : "dotnet");
  const dotnet = existsSync(localDotnet) ? localDotnet : "dotnet";
  const projectDir = path.join(ROOT, "packages", "formula", "dotnet", "GoApps.PowerFx");
  apiProcess = spawn(dotnet, ["run", "--project", projectDir, "--", "--serve", "--port", "8085"], {
    cwd: projectDir,
    stdio: "ignore",
  });
}

async function stopFormulaApi() {
  if (apiProcess && !apiProcess.killed) {
    apiProcess.kill();
    apiProcess = null;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function waitForFormulaApi(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(`${FORMULA_API}/health`)).ok) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Formula API did not start.");
}

async function waitForMetadata(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${METADATA_API}/applications/${APP_ID}/screens`, {
        headers: { "X-Tenant-Id": TENANT },
      });
      if (res.ok) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Metadata service not available on :8082.");
}

async function ensureStudio() {
  try {
    const res = await fetch(STUDIO_BASE);
    if (res.ok || res.status === 304) return;
  } catch { /* not running */ }
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
    } catch { /* retry */ }
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
  const body = await res.json();
  return body.data?.items ?? [];
}

async function deleteControl(controlId) {
  await fetch(`${METADATA_API}/controls/${controlId}`, {
    method: "DELETE",
    headers: { "X-Tenant-Id": TENANT },
  });
}

async function createControlViaApi(screenId, name, controlType, x, y, width, height, properties, parentControlId = null, zIndex = 50) {
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
      z_index: zIndex,
      parent_control_id: parentControlId,
    }),
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(`Create control failed: ${JSON.stringify(body)}`);
  if (properties) {
    const propRes = await fetch(`${METADATA_API}/controls/${body.data.id}/properties`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Tenant-Id": TENANT },
      body: JSON.stringify({ properties }),
    });
    if (!propRes.ok) throw new Error(`Property update failed: ${propRes.status}`);
  }
  return body.data;
}

async function cleanupByPrefix(prefix) {
  const items = await listControls(SCREEN1_ID);
  for (const c of items) {
    if (c.name.startsWith(prefix)) {
      await deleteControl(c.id);
    }
  }
}

async function saveScreen(page) {
  await page.getByTitle("Save (Ctrl+S)").click();
  await page.waitForTimeout(1500);
}

async function getSelectedControlId(page) {
  return page.evaluate(() => window.__studioStore?.getState().selectedControlId ?? null);
}

async function explorerNodeVisible(page, controlId) {
  return page.locator(`[data-testid="explorer-control-${controlId}"]`).isVisible();
}

async function explorerNodeSelected(page, controlId) {
  return page.locator(`[data-testid="explorer-control-${controlId}"]`).getAttribute("data-selected");
}

async function clickCanvasControl(page, control) {
  const coords = await page.evaluate(({ cx, cy }) => {
    const container = document.querySelector('[data-testid="studio-canvas-stage"]');
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const ARTBOARD_W = 1366;
    const ARTBOARD_H = 768;
    const PADDING = 48;
    const stageX = Math.max((rect.width - ARTBOARD_W) / 2, PADDING);
    const stageY = Math.max((rect.height - ARTBOARD_H) / 2, PADDING);
    return { x: rect.left + stageX + cx + 12, y: rect.top + stageY + cy + 12 };
  }, { cx: control.x, cy: control.y });
  if (!coords) return false;
  await page.mouse.click(coords.x, coords.y);
  return true;
}

async function setupHierarchy(stamp) {
  const prefix = `Ex5_${stamp}`;
  await cleanupByPrefix(prefix);

  rootBtnId = (await createControlViaApi(SCREEN1_ID, `${prefix}_Btn`, "button", 80, 80, 140, 40, {
    text: { value: "RootBtn" },
  }, null, 5)).id;

  galleryId = (await createControlViaApi(SCREEN1_ID, `${prefix}_Gallery`, "gallery", 80, 140, 280, 180, {
    items: { formula: "Customers" },
  }, null, 10)).id;

  galLblId = (await createControlViaApi(SCREEN1_ID, `${prefix}_GalLbl`, "label", 8, 8, 200, 28, {
    text: { formula: "ThisItem.Name" },
  }, galleryId, 3)).id;

  galInputId = (await createControlViaApi(SCREEN1_ID, `${prefix}_GalInput`, "textinput", 8, 40, 200, 32, {
    value: { value: "" },
  }, galleryId, 4)).id;

  formId = (await createControlViaApi(SCREEN1_ID, `${prefix}_Form`, "form", 420, 140, 280, 180, {
    item: { formula: "Gallery1.Selected" },
    mode: { value: "Edit" },
  }, null, 20)).id;

  formNameId = (await createControlViaApi(SCREEN1_ID, `${prefix}_FormName`, "textinput", 8, 8, 220, 32, {
    default: { formula: "Parent.Item.Name" },
  }, formId, 6)).id;

  formCityId = (await createControlViaApi(SCREEN1_ID, `${prefix}_FormCity`, "textinput", 8, 48, 220, 32, {
    default: { formula: "Parent.Item.City" },
  }, formId, 7)).id;

  return prefix;
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("=== Phase 5.0 Acceptance Validation ===");

  const typeStudio = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@goapps/studio", "typecheck"],
    { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" },
  );
  record("Test 9 — TypeScript clean", typeStudio.status === 0, `exit=${typeStudio.status}`);
  if (typeStudio.status !== 0) process.exit(1);

  spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@goapps/formula", "build"],
    { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" },
  );

  startFormulaApi();
  await waitForFormulaApi();
  await waitForMetadata();
  await ensureStudio();

  const stamp = Date.now();
  const prefix = await setupHierarchy(stamp);

  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    browser = await chromium.launch({ channel: "msedge", headless: true });
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto(STUDIO_URL, { waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await page.getByTestId("explorer-control-tree").waitFor({ timeout: 15000 });

    // Test 1 — Gallery children visible
    const test1 =
      (await explorerNodeVisible(page, galleryId)) &&
      (await explorerNodeVisible(page, galLblId)) &&
      (await explorerNodeVisible(page, galInputId));
    record("Test 1 — Gallery children visible", test1, `gallery=${galleryId}`);

    // Test 2 — Form children visible
    const test2 =
      (await explorerNodeVisible(page, formId)) &&
      (await explorerNodeVisible(page, formNameId)) &&
      (await explorerNodeVisible(page, formCityId));
    record("Test 2 — Form children visible", test2, `form=${formId}`);

    // Test 3 — Nested controls shown with depth
    const galLblDepth = await page.locator(`[data-testid="explorer-control-${galLblId}"]`).getAttribute("data-depth");
    const formNameDepth = await page.locator(`[data-testid="explorer-control-${formNameId}"]`).getAttribute("data-depth");
    const test3 = galLblDepth === "1" && formNameDepth === "1";
    record("Test 3 — Nested controls shown correctly", test3, `galDepth=${galLblDepth}, formDepth=${formNameDepth}`);

    // Test 4 — Explorer click selects control
    await page.getByTestId(`explorer-select-${galLblId}`).click();
    await page.waitForTimeout(300);
    const test4 = (await getSelectedControlId(page)) === galLblId;
    record("Test 4 — Explorer click selects control", test4, `selected=${await getSelectedControlId(page)}`);

    // Test 5 — Canvas click updates Explorer
    const controls = await listControls(SCREEN1_ID);
    const gallery = controls.find((c) => c.id === galleryId);
    const clicked = await clickCanvasControl(page, gallery);
    await page.waitForTimeout(400);
    const test5 = clicked && (await explorerNodeSelected(page, galleryId)) === "true";
    record("Test 5 — Canvas click updates Explorer", test5, `clicked=${clicked}, selected=${await explorerNodeSelected(page, galleryId)}`);

    // Test 6 — Expand/collapse works
    const childVisibleBefore = await explorerNodeVisible(page, galLblId);
    await page.getByTestId(`explorer-expand-${galleryId}`).click();
    await page.waitForTimeout(200);
    const childHidden = !(await explorerNodeVisible(page, galLblId));
    await page.getByTestId(`explorer-expand-${galleryId}`).click();
    await page.waitForTimeout(200);
    const childVisibleAfter = await explorerNodeVisible(page, galLblId);
    const test6 = childVisibleBefore && childHidden && childVisibleAfter;
    record("Test 6 — Expand/collapse works", test6, `before=${childVisibleBefore}, hidden=${childHidden}, after=${childVisibleAfter}`);

    // Test 7 — Save + refresh preserves hierarchy
    await saveScreen(page);
    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("explorer-control-tree").waitFor({ timeout: 15000 });
    const reloaded = await listControls(SCREEN1_ID);
    const galChild = reloaded.find((c) => c.id === galLblId);
    const test7 = galChild?.parent_control_id === galleryId && (await explorerNodeVisible(page, galLblId));
    record("Test 7 — Save + refresh preserves hierarchy", test7, `parent=${galChild?.parent_control_id}`);

    // Test 8 — Runtime unaffected (runtime package + preview modal)
    const rtRes = await fetch(`${METADATA_API}/runtime/applications/${APP_ID}`, {
      headers: { "X-Tenant-Id": TENANT },
    });
    const rtBody = await rtRes.json();
    const rtScreen = rtBody.data?.screens?.find((s) => s.id === SCREEN1_ID);
    const rtGallery = rtScreen?.controls?.find((c) => c.id === galleryId);
    const rtHasChildren = (rtGallery?.children?.length ?? 0) >= 2;
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /^Preview$/i }).click();
    await page.getByText("Runtime Preview").waitFor({ timeout: 15000 });
    await page.waitForTimeout(1200);
    const modalOpen = await page.getByText("Runtime Preview").isVisible();
    const test8 = rtRes.ok && rtHasChildren && modalOpen;
    record(
      "Test 8 — Forms/Galleries/Runtime unaffected",
      test8,
      `runtime=${rtRes.ok}, children=${rtGallery?.children?.length ?? 0}, modal=${modalOpen}`,
    );
  } finally {
    await browser.close();
    await stopStudioDev();
    await cleanupByPrefix(prefix);
  }

  await stopFormulaApi();

  const failed = results.filter((r) => !r.passed).length;
  log(`=== Summary: ${results.length - failed}/${results.length} passed ===`);
  fs.writeFileSync(path.join(OUT_DIR, "results.json"), JSON.stringify(results, null, 2));
  if (failed > 0) process.exit(1);
}

run().catch(async (err) => {
  log(`FATAL: ${err.stack || err}`);
  await stopFormulaApi();
  await stopStudioDev();
  process.exit(1);
});
