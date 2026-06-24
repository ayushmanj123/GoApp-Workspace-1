/**
 * Phase 5.1 acceptance validation — Layers & Canvas UX Foundation.
 * Run: node infrastructure/scripts/validate-phase-5.1.mjs
 */
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-5.1");
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
let btnId = null;
let lblId = null;
let galId = null;
let galChildId = null;
let prefix = null;

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
  return (await res.json()).data?.items ?? [];
}

async function deleteControl(controlId) {
  await fetch(`${METADATA_API}/controls/${controlId}`, {
    method: "DELETE",
    headers: { "X-Tenant-Id": TENANT },
  });
}

async function createControlViaApi(screenId, name, controlType, x, y, width, height, parentControlId = null, zIndex = 50) {
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
  return body.data;
}

async function updateControlZ(controlId, zIndex) {
  const items = await listControls(SCREEN1_ID);
  const control = items.find((c) => c.id === controlId);
  if (!control) return;
  await fetch(`${METADATA_API}/controls/${controlId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Tenant-Id": TENANT },
    body: JSON.stringify({
      name: control.name,
      control_type: control.control_type,
      x: control.x,
      y: control.y,
      width: control.width,
      height: control.height,
      z_index: zIndex,
      parent_control_id: control.parent_control_id,
    }),
  });
}

async function cleanupByPrefix(p) {
  const items = await listControls(SCREEN1_ID);
  for (const c of items) {
    if (c.name.startsWith(p)) {
      await deleteControl(c.id);
    }
  }
}

async function setupLayerControls(stamp) {
  const p = `Ex51_${stamp}`;
  await cleanupByPrefix(p);

  btnId = (await createControlViaApi(SCREEN1_ID, `${p}_Btn`, "button", 80, 80, 120, 40, null, 1)).id;
  lblId = (await createControlViaApi(SCREEN1_ID, `${p}_Lbl`, "label", 220, 80, 120, 36, null, 2)).id;
  galId = (await createControlViaApi(SCREEN1_ID, `${p}_Gal`, "gallery", 80, 160, 260, 140, null, 3)).id;
  galChildId = (await createControlViaApi(SCREEN1_ID, `${p}_GalLbl`, "label", 8, 8, 180, 28, galId, 4)).id;
  return p;
}

async function setTestZOrder() {
  await updateControlZ(btnId, 10001);
  await updateControlZ(lblId, 10002);
  await updateControlZ(galId, 10003);
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

async function getZ(page, controlId) {
  return page.evaluate((id) => {
    const control = window.__applicationStore?.getState().controls.find((c) => c.id === id);
    return control?.z_index ?? null;
  }, controlId);
}

async function getSelectedId(page) {
  return page.evaluate(() => window.__studioStore?.getState().selectedControlId ?? null);
}

async function getRootRenderOrder(page) {
  return page.evaluate(() => {
    const controls = window.__applicationStore
      ?.getState()
      .controls.filter((c) => !c.parent_control_id)
      .slice()
      .sort((a, b) => a.z_index - b.z_index)
      .map((c) => c.id);
    return controls ?? [];
  });
}

async function saveScreen(page) {
  await page.getByTitle("Save (Ctrl+S)").click();
  await page.waitForTimeout(1500);
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("=== Phase 5.1 Acceptance Validation ===");

  const typeStudio = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@goapps/studio", "typecheck"],
    { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" },
  );
  record("Test 10 — TypeScript clean", typeStudio.status === 0, `exit=${typeStudio.status}`);
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

  prefix = await setupLayerControls(Date.now());

  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    browser = await chromium.launch({ channel: "msedge", headless: true });
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await openStudio(page);

    // Test 1 — Bring Forward
    await setTestZOrder();
    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("explorer-control-tree").waitFor({ timeout: 15000 });
    await selectControl(page, btnId);
    const btnBefore1 = await getZ(page, btnId);
    const lblBefore1 = await getZ(page, lblId);
    await page.getByTestId("explorer-layer-forward").click();
    await page.waitForTimeout(200);
    const btnAfter1 = await getZ(page, btnId);
    const lblAfter1 = await getZ(page, lblId);
    const test1 = btnBefore1 < lblBefore1 && btnAfter1 > lblAfter1;
    record("Test 1 — Bring Forward changes order", test1, `before=${btnBefore1}/${lblBefore1}, after=${btnAfter1}/${lblAfter1}`);

    // Test 2 — Send Backward
    await setTestZOrder();
    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("explorer-control-tree").waitFor({ timeout: 15000 });
    await selectControl(page, lblId);
    const btnBefore2 = await getZ(page, btnId);
    const lblBefore2 = await getZ(page, lblId);
    await page.getByTestId("explorer-layer-backward").click();
    await page.waitForTimeout(200);
    const btnAfter2 = await getZ(page, btnId);
    const lblAfter2 = await getZ(page, lblId);
    const test2 = lblBefore2 > btnBefore2 && lblAfter2 < btnAfter2;
    record("Test 2 — Send Backward changes order", test2, `before=${btnBefore2}/${lblBefore2}, after=${btnAfter2}/${lblAfter2}`);

    // Test 3 — Bring To Front
    await setTestZOrder();
    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("explorer-control-tree").waitFor({ timeout: 15000 });
    await selectControl(page, btnId);
    await page.getByTestId("explorer-layer-to-front").click();
    await page.waitForTimeout(200);
    const btnZ3 = await getZ(page, btnId);
    const lblZ3 = await getZ(page, lblId);
    const galZ3 = await getZ(page, galId);
    const test3 = btnZ3 > lblZ3 && btnZ3 > galZ3;
    record("Test 3 — Bring To Front changes order", test3, `btn=${btnZ3}, lbl=${lblZ3}, gal=${galZ3}`);

    // Test 4 — Send To Back
    await setTestZOrder();
    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("explorer-control-tree").waitFor({ timeout: 15000 });
    await selectControl(page, galId);
    await page.getByTestId("explorer-layer-to-back").click();
    await page.waitForTimeout(200);
    const galZ4 = await getZ(page, galId);
    const btnZ4 = await getZ(page, btnId);
    const test4 = galZ4 < btnZ4 && galZ4 < (await getZ(page, lblId));
    record("Test 4 — Send To Back changes order", test4, `gal=${galZ4}`);

    // Test 5 — Save + refresh preserves order
    await saveScreen(page);
    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("explorer-control-tree").waitFor({ timeout: 15000 });
    const saved = await listControls(SCREEN1_ID);
    const savedGal = saved.find((c) => c.id === galId);
    const savedBtn = saved.find((c) => c.id === btnId);
    const test5 = savedGal && savedBtn && savedGal.z_index < savedBtn.z_index;
    record("Test 5 — Save + refresh preserves order", test5, `galZ=${savedGal?.z_index}, btnZ=${savedBtn?.z_index}`);

    // Test 6 — Selection preserved
    await selectControl(page, btnId);
    await page.getByTestId("explorer-layer-forward").click();
    await page.waitForTimeout(200);
    const test6 = (await getSelectedId(page)) === btnId;
    record("Test 6 — Explorer selection preserved", test6, `selected=${await getSelectedId(page)}`);

    // Test 7 — Canvas render order updates
    await setTestZOrder();
    await page.reload({ waitUntil: "networkidle" });
    await page.getByTestId("explorer-control-tree").waitFor({ timeout: 15000 });
    await selectControl(page, btnId);
    await page.getByTestId("explorer-layer-to-front").click();
    await page.waitForTimeout(200);
    const order = await getRootRenderOrder(page);
    const test7 = order.indexOf(btnId) > order.indexOf(lblId);
    record("Test 7 — Canvas render order updates", test7, `order=${order.join(",")}`);

    // Test 8 — Hierarchy unaffected
    const child = (await listControls(SCREEN1_ID)).find((c) => c.id === galChildId);
    const test8 = child?.parent_control_id === galId;
    record("Test 8 — Hierarchy unaffected", test8, `parent=${child?.parent_control_id}`);

    // Test 9 — Runtime unaffected
    const rtRes = await fetch(`${METADATA_API}/runtime/applications/${APP_ID}`, {
      headers: { "X-Tenant-Id": TENANT },
    });
    const rtBody = await rtRes.json();
    const rtGal = rtBody.data?.screens
      ?.find((s) => s.id === SCREEN1_ID)
      ?.controls?.find((c) => c.id === galId);
    const test9 = rtRes.ok && (rtGal?.children?.length ?? 0) >= 1;
    record("Test 9 — Runtime unaffected", test9, `children=${rtGal?.children?.length ?? 0}`);
  } finally {
    await browser.close();
    await stopStudioDev();
    if (prefix) await cleanupByPrefix(prefix);
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
  if (prefix) await cleanupByPrefix(prefix);
  process.exit(1);
});
