/**
 * Phase 4.28 acceptance validation — Display Form Foundation.
 * Run: node infrastructure/scripts/validate-phase-4.28.mjs
 */
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-4.28");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const FORMULA_API = "http://localhost:8085";
const METADATA_API = "http://localhost:8082/api/v1";
const STUDIO_BASE = "http://localhost:5173";

const TENANT = "00000000-0000-4000-8000-000000000001";
const APP_ID = "00000000-0000-4000-8000-000000000003";
const SCREEN1_ID = "00000000-0000-4000-8000-000000000004";
const STUDIO_URL = `http://localhost:5173/studio/apps/${APP_ID}/screens/${SCREEN1_ID}`;
const SCREEN2_ID_FILE = path.resolve(ROOT, ".validation-4.21", "screen2-id.txt");

const results = [];
let apiProcess = null;
let studioStartedByScript = false;
let studioProcess = null;
let screen2Id = null;
let navScreenName = "Screen2Active";
let formId = null;
let galleryName = "Gallery1";
let formName = "Form1";

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

async function listScreens() {
  const res = await fetch(`${METADATA_API}/applications/${APP_ID}/screens`, {
    headers: { "X-Tenant-Id": TENANT },
  });
  const body = await res.json();
  return body.data?.items ?? [];
}

async function listControls(screenId) {
  const res = await fetch(`${METADATA_API}/screens/${screenId}/controls`, {
    headers: { "X-Tenant-Id": TENANT },
  });
  const body = await res.json();
  return body.data?.items ?? [];
}

async function renameScreen(screenId, name) {
  await fetch(`${METADATA_API}/screens/${screenId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Tenant-Id": TENANT },
    body: JSON.stringify({ name }),
  });
}

async function createControlViaApi(
  screenId,
  name,
  controlType,
  x,
  y,
  width,
  height,
  properties,
  parentControlId = null,
) {
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
  const propRes = await fetch(`${METADATA_API}/controls/${body.data.id}/properties`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Tenant-Id": TENANT },
    body: JSON.stringify({ properties }),
  });
  if (!propRes.ok) throw new Error(`Property update failed: ${propRes.status}`);
  return body.data;
}

async function updateControlProperties(controlId, properties) {
  const res = await fetch(`${METADATA_API}/controls/${controlId}/properties`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Tenant-Id": TENANT },
    body: JSON.stringify({ properties }),
  });
  if (!res.ok) throw new Error(`Property update failed: ${res.status}`);
}

async function cleanupTestControls(testNames) {
  for (const screenId of [SCREEN1_ID, screen2Id].filter(Boolean)) {
    const items = await listControls(screenId);
    for (const c of items) {
      if (testNames.has(c.name)) {
        await fetch(`${METADATA_API}/controls/${c.id}`, {
          method: "DELETE",
          headers: { "X-Tenant-Id": TENANT },
        });
      }
    }
  }
}

async function ensureScreen2() {
  const items = await listScreens();
  const existing = items.find((s) => s.name === "Screen2" || s.name === "Screen2Active");
  if (existing) {
    screen2Id = existing.id;
    navScreenName = existing.name;
    return;
  }
  if (existsSync(SCREEN2_ID_FILE)) {
    const savedId = fs.readFileSync(SCREEN2_ID_FILE, "utf8").trim();
    const saved = items.find((s) => s.id === savedId);
    if (saved) {
      screen2Id = saved.id;
      navScreenName = saved.name;
      return;
    }
  }
  throw new Error("Screen2 not found.");
}

async function openPreview(page) {
  await page.getByRole("button", { name: /^Preview$/i }).click();
  await page.getByText("Runtime Preview").waitFor({ timeout: 10000 });
  await page.waitForTimeout(500);
}

async function dialogHasText(page, text) {
  const dialog = page.locator('[class*="dialog"]');
  return dialog.getByText(text, { exact: true }).first().isVisible().catch(() => false);
}

async function clickGalleryRow(page, name) {
  const dialog = page.locator('[class*="dialog"]');
  const row = dialog.locator("div[style*='cursor: pointer']").filter({ hasText: name }).first();
  await row.click();
  await page.waitForTimeout(500);
}

async function populateCustomers(page, dialog) {
  await dialog.getByRole("button", { name: /FrmClearBtn_/ }).click();
  await page.waitForTimeout(700);
  await dialog.getByRole("button", { name: /FrmCollectBtn_/ }).click();
  await page.waitForTimeout(700);
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("=== Phase 4.28 Acceptance Validation ===");

  spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@goapps/formula", "build"],
    { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" },
  );

  startFormulaApi();
  await waitForFormulaApi();
  await waitForMetadata();
  await ensureScreen2();

  const stamp = Date.now();
  galleryName = `FormGal_${stamp}`;
  formName = `FormMain_${stamp}`;
  const testNames = new Set([
    galleryName,
    formName,
    `FrmRowLbl_${stamp}`,
    `FrmUpperLbl_${stamp}`,
    `FrmVarLbl_${stamp}`,
    `FrmClear_${stamp}`,
    `FrmCollect_${stamp}`,
    `FrmSet_${stamp}`,
    `FrmNav_${stamp}`,
    `FrmBack_${stamp}`,
  ]);

  await cleanupTestControls(testNames);

  const screens = await listScreens();
  const screen1 = screens.find((s) => s.id === SCREEN1_ID);
  const originalScreen1Name = screen1?.name ?? "Screen1";
  await renameScreen(SCREEN1_ID, "Screen1");

  const gallery = await createControlViaApi(
    SCREEN1_ID,
    galleryName,
    "gallery",
    100,
    80,
    300,
    220,
    { items: { formula: "Customers" } },
  );
  await createControlViaApi(
    SCREEN1_ID,
    `FrmRowLbl_${stamp}`,
    "label",
    8,
    8,
    260,
    30,
    { text: { formula: "ThisItem.Name" } },
    gallery.id,
  );

  const form = await createControlViaApi(
    SCREEN1_ID,
    formName,
    "form",
    440,
    80,
    280,
    220,
    { item: { formula: `${galleryName}.Selected` } },
  );
  formId = form.id;

  await createControlViaApi(SCREEN1_ID, `FrmUpperLbl_${stamp}`, "label", 440, 320, 220, 30, {
    text: { formula: `Upper(${galleryName}.Selected.Name)` },
  });
  await createControlViaApi(SCREEN1_ID, `FrmVarLbl_${stamp}`, "label", 100, 560, 220, 30, {
    text: { formula: "varTitle" },
  });
  await createControlViaApi(SCREEN1_ID, `FrmClear_${stamp}`, "button", 100, 320, 220, 40, {
    text: { value: `FrmClearBtn_${stamp}` },
    onSelect: { formula: 'ClearCollect(Customers, { Name: "John", City: "NY" })' },
  });
  await createControlViaApi(SCREEN1_ID, `FrmCollect_${stamp}`, "button", 100, 370, 220, 40, {
    text: { value: `FrmCollectBtn_${stamp}` },
    onSelect: { formula: 'Collect(Customers, { Name: "Jane", City: "LA" })' },
  });
  await createControlViaApi(SCREEN1_ID, `FrmSet_${stamp}`, "button", 100, 420, 220, 40, {
    text: { value: `FrmSetBtn_${stamp}` },
    onSelect: { formula: 'Set(varTitle, "FormOK")' },
  });
  await createControlViaApi(SCREEN1_ID, `FrmNav_${stamp}`, "button", 100, 470, 220, 40, {
    text: { value: `FrmNavBtn_${stamp}` },
    onSelect: { formula: `Navigate(${navScreenName})` },
  });
  await createControlViaApi(screen2Id, `FrmBack_${stamp}`, "button", 100, 300, 220, 40, {
    text: { value: `FrmBackBtn_${stamp}` },
    onSelect: { formula: "Navigate(Screen1)" },
  });

  const btnNav = `FrmNavBtn_${stamp}`;
  const btnBack = `FrmBackBtn_${stamp}`;
  const btnSet = `FrmSetBtn_${stamp}`;

  await ensureStudio();

  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    browser = await chromium.launch({ channel: "msedge", headless: true });
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  try {
    await page.goto(STUDIO_URL, { waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await openPreview(page);
    const dialog = page.locator('[class*="dialog"]');

    await populateCustomers(page, dialog);

    // Test 1
    await clickGalleryRow(page, "John");
    const test1 = (await dialogHasText(page, "Name: John")) && (await dialogHasText(page, "City: NY"));
    record("Test 1 — Form1.Item = Gallery1.Selected renders John", test1, `john=${test1}`);

    // Test 2
    await clickGalleryRow(page, "Jane");
    const test2 = (await dialogHasText(page, "Name: Jane")) && (await dialogHasText(page, "City: LA"));
    record("Test 2 — Selecting different row updates Form", test2, `jane=${test2}`);

    // Test 3
    await updateControlProperties(formId, { item: { formula: "First(Customers)" } });
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await openPreview(page);
    const dialog3 = page.locator('[class*="dialog"]');
    await populateCustomers(page, dialog3);
    const test3 = (await dialogHasText(page, "Name: John")) && (await dialogHasText(page, "City: NY"));
    record("Test 3 — Form item formula First(Customers)", test3, `first=${test3}`);

    // Test 4
    await updateControlProperties(formId, { item: { formula: `${galleryName}.Selected` } });
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await openPreview(page);
    const dialog4 = page.locator('[class*="dialog"]');
    await populateCustomers(page, dialog4);
    await clickGalleryRow(page, "Jane");
    const test4 = (await dialogHasText(page, "Name: Jane")) && (await dialogHasText(page, "JANE"));
    record("Test 4 — Form and Upper(Gallery1.Selected.Name) both work", test4, `form+upper=${test4}`);

    // Test 5
    await dialog4.getByRole("button", { name: btnSet, exact: true }).click();
    await page.waitForTimeout(700);
    await dialog4.getByRole("button", { name: btnNav, exact: true }).click();
    await dialog4.getByRole("heading", { name: navScreenName }).waitFor({ timeout: 10000 });
    await dialog4.getByRole("button", { name: btnBack, exact: true }).click();
    await dialog4.getByRole("heading", { name: "Screen1" }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(800);
    const test5 =
      (await dialogHasText(page, "FormOK")) &&
      (await dialogHasText(page, "John")) &&
      consoleErrors.length === 0;
    record("Test 5 — Variables/Collections/ThisItem/Navigation regressions", test5, `regression=${test5}`);

    // Test 6
    await updateControlProperties(formId, { item: { formula: `${galleryName}.Selected(` } });
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await openPreview(page);
    const dialog6 = page.locator('[class*="dialog"]');
    await populateCustomers(page, dialog6);
    await clickGalleryRow(page, "John");
    const errsBefore6 = consoleErrors.length;
    const test6 = (await dialogHasText(page, "No Record")) && consoleErrors.length === errsBefore6;
    record("Test 6 — Invalid form item formula does not crash", test6, `noRecord=${test6}`);

    // Test 7
    await updateControlProperties(formId, { item: { formula: `${galleryName}.Selected` } });
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await openPreview(page);
    const dialog7 = page.locator('[class*="dialog"]');
    await populateCustomers(page, dialog7);
    await clickGalleryRow(page, "Jane");
    const beforeNav = await dialogHasText(page, "Name: Jane");
    await dialog7.getByRole("button", { name: btnNav, exact: true }).click();
    await dialog7.getByRole("heading", { name: navScreenName }).waitFor({ timeout: 10000 });
    await dialog7.getByRole("button", { name: btnBack, exact: true }).click();
    await dialog7.getByRole("heading", { name: "Screen1" }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(800);
    const afterNavNoRecord = await dialogHasText(page, "No Record");
    const test7 = beforeNav && afterNavNoRecord && consoleErrors.length === 0;
    record("Test 7 — Navigation rebinds form without crashes", test7, `before=${beforeNav}, afterNoRecord=${afterNavNoRecord}`);

    // Test 8
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await openPreview(page);
    const dialog8 = page.locator('[class*="dialog"]');
    await populateCustomers(page, dialog8);
    await clickGalleryRow(page, "John");
    const test8 = (await dialogHasText(page, "Name: John")) && (await dialogHasText(page, "City: NY"));
    record("Test 8 — Form loads correctly after reload", test8, `reload=${test8}`);

    // Test 9
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    const controlsAfter = await listControls(SCREEN1_ID);
    const persistedForm = controlsAfter.find((c) => c.id === formId);
    await openPreview(page);
    const dialog9 = page.locator('[class*="dialog"]');
    await populateCustomers(page, dialog9);
    await clickGalleryRow(page, "Jane");
    const rendersAfterReload = (await dialogHasText(page, "Name: Jane")) && (await dialogHasText(page, "City: LA"));
    const test9 = persistedForm?.control_type === "form" && rendersAfterReload;
    record("Test 9 — Form metadata persists after save/reload", test9, `type=${persistedForm?.control_type}, render=${rendersAfterReload}`);
  } finally {
    await browser.close();
    await stopStudioDev();
    await cleanupTestControls(testNames);
    await renameScreen(SCREEN1_ID, originalScreen1Name);
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
