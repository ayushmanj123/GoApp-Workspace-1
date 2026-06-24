/**
 * Phase 4.29 acceptance validation — Edit Form Foundation.
 * Run: node infrastructure/scripts/validate-phase-4.29.mjs
 */
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-4.29");
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

async function clickGalleryRow(page, name) {
  const dialog = page.locator('[class*="dialog"]');
  const row = dialog.locator("div[style*='cursor: pointer']").filter({ hasText: name }).first();
  await row.click();
  await page.waitForTimeout(600);
}

async function getFormUpdates(page, formName) {
  return page.evaluate((name) => {
    const store = window.__formUpdatesStore;
    return store ? store.get(name) : null;
  }, formName);
}

async function runAction(page, formula) {
  return page.evaluate(async (f) => {
    const fn = window.__executeAction;
    if (!fn) return { ok: false, error: "__executeAction not exposed" };
    return fn(f);
  }, formula);
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("=== Phase 4.29 Acceptance Validation ===");

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
  const galleryName = `EdGal_${stamp}`;
  const formName = `EdForm_${stamp}`;
  const inputName = `EdInName_${stamp}`;
  const inputCity = `EdInCity_${stamp}`;
  const testNames = new Set([
    galleryName,
    formName,
    inputName,
    inputCity,
    `EdRowLbl_${stamp}`,
    `EdVarLbl_${stamp}`,
    `EdClear_${stamp}`,
    `EdCollect_${stamp}`,
    `EdMike_${stamp}`,
    `EdSet_${stamp}`,
    `EdNav_${stamp}`,
    `EdBack_${stamp}`,
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
    200,
    { items: { formula: "Customers" } },
  );
  await createControlViaApi(
    SCREEN1_ID,
    `EdRowLbl_${stamp}`,
    "label",
    8,
    8,
    260,
    28,
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
    180,
    {
      item: { formula: `${galleryName}.Selected` },
      mode: { value: "Edit" },
    },
  );

  await createControlViaApi(
    SCREEN1_ID,
    inputName,
    "textinput",
    8,
    8,
    240,
    32,
    { default: { formula: "Parent.Item.Name" } },
    form.id,
  );
  await createControlViaApi(
    SCREEN1_ID,
    inputCity,
    "textinput",
    8,
    48,
    240,
    32,
    { default: { formula: "Parent.Item.City" } },
    form.id,
  );

  await createControlViaApi(SCREEN1_ID, `EdVarLbl_${stamp}`, "label", 100, 520, 220, 30, {
    text: { formula: "varTitle" },
  });
  await createControlViaApi(SCREEN1_ID, `EdClear_${stamp}`, "button", 100, 300, 200, 40, {
    text: { value: `EdClearBtn_${stamp}` },
    onSelect: { formula: 'ClearCollect(Customers, { Name: "John", City: "NY" })' },
  });
  await createControlViaApi(SCREEN1_ID, `EdCollect_${stamp}`, "button", 100, 350, 200, 40, {
    text: { value: `EdCollectBtn_${stamp}` },
    onSelect: { formula: 'Collect(Customers, { Name: "Jane", City: "LA" })' },
  });
  await createControlViaApi(SCREEN1_ID, `EdMike_${stamp}`, "button", 100, 400, 200, 40, {
    text: { value: `EdMikeBtn_${stamp}` },
    onSelect: { formula: 'Collect(Customers, { Name: "Mike", City: "Chicago" })' },
  });
  await createControlViaApi(SCREEN1_ID, `EdSet_${stamp}`, "button", 100, 450, 200, 40, {
    text: { value: `EdSetBtn_${stamp}` },
    onSelect: { formula: 'Set(varTitle, "EditFormOK")' },
  });
  await createControlViaApi(SCREEN1_ID, `EdNav_${stamp}`, "button", 100, 500, 200, 40, {
    text: { value: `EdNavBtn_${stamp}` },
    onSelect: { formula: `Navigate(${navScreenName})` },
  });
  await createControlViaApi(screen2Id, `EdBack_${stamp}`, "button", 100, 300, 200, 40, {
    text: { value: `EdBackBtn_${stamp}` },
    onSelect: { formula: "Navigate(Screen1)" },
  });

  const btnClear = `EdClearBtn_${stamp}`;
  const btnCollect = `EdCollectBtn_${stamp}`;
  const btnMike = `EdMikeBtn_${stamp}`;
  const btnSet = `EdSetBtn_${stamp}`;
  const btnNav = `EdNavBtn_${stamp}`;
  const btnBack = `EdBackBtn_${stamp}`;

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

    await dialog.getByRole("button", { name: btnClear, exact: true }).click();
    await page.waitForTimeout(600);
    await dialog.getByRole("button", { name: btnCollect, exact: true }).click();
    await page.waitForTimeout(600);
    await dialog.getByRole("button", { name: btnMike, exact: true }).click();
    await page.waitForTimeout(600);

    await clickGalleryRow(page, "John");
    const nameInput = dialog.getByTestId(`input-${inputName}`);
    const cityInput = dialog.getByTestId(`input-${inputCity}`);
    const nameValue1 = await nameInput.inputValue();
    const test1 = nameValue1 === "John";
    record("Test 1 — Parent.Item.Name shows John in TextInput", test1, `value=${nameValue1}`);

    await nameInput.fill("Jane");
    await page.waitForTimeout(400);
    const nameValue2 = await nameInput.inputValue();
    const test2 = nameValue2 === "Jane";
    record("Test 2 — User edit updates TextInput visually", test2, `value=${nameValue2}`);

    const updates3 = await getFormUpdates(page, formName);
    const test3 = updates3?.Name === "Jane";
    record("Test 3 — Form.Updates returns edited Name", test3, JSON.stringify(updates3));

    await cityInput.fill("Boston");
    await page.waitForTimeout(400);
    const updates4 = await getFormUpdates(page, formName);
    const test4 = updates4?.Name === "Jane" && updates4?.City === "Boston";
    record("Test 4 — Form.Updates tracks multiple fields", test4, JSON.stringify(updates4));

    await clickGalleryRow(page, "Mike");
    const nameValue5 = await nameInput.inputValue();
    const cityValue5 = await cityInput.inputValue();
    const updates5 = await getFormUpdates(page, formName);
    const test5 =
      nameValue5 === "Mike" &&
      cityValue5 === "Chicago" &&
      updates5?.Name === "Mike" &&
      updates5?.City === "Chicago";
    record(
      "Test 5 — Gallery selection reloads form item values",
      test5,
      JSON.stringify({ nameValue5, cityValue5, updates5 }),
    );

    await dialog.getByRole("button", { name: btnSet, exact: true }).click();
    await page.waitForTimeout(600);
    const varOk = await dialog.getByText("EditFormOK", { exact: true }).first().isVisible().catch(() => false);
    const johnRow = await dialog.locator("div[style*='cursor: pointer']").filter({ hasText: "John" }).first().isVisible().catch(() => false);
    const test6 = varOk && johnRow && consoleErrors.length === 0;
    record("Test 6 — Variables/Collections/ThisItem/Gallery.Selected regressions", test6, `var=${varOk}, gallery=${johnRow}`);

    await dialog.getByRole("button", { name: btnNav, exact: true }).click();
    await dialog.getByRole("heading", { name: navScreenName }).waitFor({ timeout: 10000 });
    await dialog.getByRole("button", { name: btnBack, exact: true }).click();
    await dialog.getByRole("heading", { name: "Screen1" }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(800);
    const test7 = consoleErrors.length === 0;
    record("Test 7 — Navigation continues working", test7, `errors=${consoleErrors.length}`);

    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await openPreview(page);
    const dialog8 = page.locator('[class*="dialog"]');
    await dialog8.getByRole("button", { name: btnClear, exact: true }).click();
    await page.waitForTimeout(500);
    await dialog8.getByRole("button", { name: btnCollect, exact: true }).click();
    await page.waitForTimeout(500);
    await clickGalleryRow(page, "John");
    const nameInput8 = dialog8.getByTestId(`input-${inputName}`);
    const test8 =
      (await nameInput8.inputValue()) === "John" &&
      consoleErrors.length === 0;
    record("Test 8 — Refresh loads edit form without crashes", test8, `errors=${consoleErrors.length}`);
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
