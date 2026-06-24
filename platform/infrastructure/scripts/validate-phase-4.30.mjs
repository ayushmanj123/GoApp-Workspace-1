/**
 * Phase 4.30 acceptance validation — SubmitForm Foundation.
 * Run: node infrastructure/scripts/validate-phase-4.30.mjs
 */
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-4.30");
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
    const items = await fetch(`${METADATA_API}/screens/${screenId}/controls`, {
      headers: { "X-Tenant-Id": TENANT },
    }).then((r) => r.json()).then((b) => b.data?.items ?? []);
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

async function getRecords(page, formName) {
  return page.evaluate((name) => {
    const store = window.__recordStore;
    return store ? store.getRecords(name) : null;
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
  log("=== Phase 4.30 Acceptance Validation ===");

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
  const galleryName = `SfGal_${stamp}`;
  const formName = `SfForm_${stamp}`;
  const inputName = `SfInName_${stamp}`;
  const inputCity = `SfInCity_${stamp}`;
  const testNames = new Set([
    galleryName,
    formName,
    inputName,
    inputCity,
    `SfRowLbl_${stamp}`,
    `SfVarLbl_${stamp}`,
    `SfClear_${stamp}`,
    `SfCollect_${stamp}`,
    `SfSubmit_${stamp}`,
    `SfSubmit2_${stamp}`,
    `SfBad_${stamp}`,
    `SfSet_${stamp}`,
    `SfNav_${stamp}`,
    `SfBack_${stamp}`,
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
    `SfRowLbl_${stamp}`,
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

  await createControlViaApi(SCREEN1_ID, `SfSubmit_${stamp}`, "button", 440, 280, 200, 40, {
    text: { value: `SfSubmitBtn_${stamp}` },
    onSelect: { formula: `SubmitForm(${formName})` },
  });
  await createControlViaApi(SCREEN1_ID, `SfSubmit2_${stamp}`, "button", 440, 330, 200, 40, {
    text: { value: `SfSubmit2Btn_${stamp}` },
    onSelect: { formula: `SubmitForm(${formName})` },
  });
  await createControlViaApi(SCREEN1_ID, `SfBad_${stamp}`, "button", 440, 380, 200, 40, {
    text: { value: `SfBadBtn_${stamp}` },
    onSelect: { formula: "SubmitForm(MissingForm)" },
  });
  await createControlViaApi(SCREEN1_ID, `SfVarLbl_${stamp}`, "label", 100, 520, 220, 30, {
    text: { formula: "varTitle" },
  });
  await createControlViaApi(SCREEN1_ID, `SfClear_${stamp}`, "button", 100, 300, 200, 40, {
    text: { value: `SfClearBtn_${stamp}` },
    onSelect: { formula: 'ClearCollect(Customers, { Name: "John", City: "NY" })' },
  });
  await createControlViaApi(SCREEN1_ID, `SfCollect_${stamp}`, "button", 100, 350, 200, 40, {
    text: { value: `SfCollectBtn_${stamp}` },
    onSelect: { formula: 'Collect(Customers, { Name: "Jane", City: "LA" })' },
  });
  await createControlViaApi(SCREEN1_ID, `SfSet_${stamp}`, "button", 100, 400, 200, 40, {
    text: { value: `SfSetBtn_${stamp}` },
    onSelect: { formula: 'Set(varTitle, "SubmitFormOK")' },
  });
  await createControlViaApi(SCREEN1_ID, `SfNav_${stamp}`, "button", 100, 450, 200, 40, {
    text: { value: `SfNavBtn_${stamp}` },
    onSelect: { formula: `Navigate(${navScreenName})` },
  });
  await createControlViaApi(screen2Id, `SfBack_${stamp}`, "button", 100, 300, 200, 40, {
    text: { value: `SfBackBtn_${stamp}` },
    onSelect: { formula: "Navigate(Screen1)" },
  });

  const btnClear = `SfClearBtn_${stamp}`;
  const btnCollect = `SfCollectBtn_${stamp}`;
  const btnSubmit = `SfSubmitBtn_${stamp}`;
  const btnSubmit2 = `SfSubmit2Btn_${stamp}`;
  const btnBad = `SfBadBtn_${stamp}`;
  const btnSet = `SfSetBtn_${stamp}`;
  const btnNav = `SfNavBtn_${stamp}`;
  const btnBack = `SfBackBtn_${stamp}`;

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
    await page.waitForTimeout(500);
    await dialog.getByRole("button", { name: btnCollect, exact: true }).click();
    await page.waitForTimeout(500);

    await clickGalleryRow(page, "John");
    const nameInput = dialog.getByTestId(`input-${inputName}`);
    const cityInput = dialog.getByTestId(`input-${inputCity}`);
    await nameInput.fill("Jane");
    await cityInput.fill("Boston");
    await page.waitForTimeout(400);

    await dialog.getByRole("button", { name: btnSubmit, exact: true }).click();
    await page.waitForTimeout(400);
    const records1 = await getRecords(page, formName);
    const test1 =
      records1?.length === 1 &&
      records1[0]?.Name === "Jane";
    record("Test 1 — SubmitForm stores { Name: Jane }", test1, JSON.stringify(records1));

    await clickGalleryRow(page, "John");
    await nameInput.fill("John");
    await page.waitForTimeout(300);
    await dialog.getByRole("button", { name: btnSubmit2, exact: true }).click();
    await page.waitForTimeout(400);
    const records2 = await getRecords(page, formName);
    const test2 =
      records2?.length === 2 &&
      records2[0]?.Name === "Jane" &&
      records2[1]?.Name === "John";
    record("Test 2 — Second submit appends record", test2, JSON.stringify(records2));

    const test3 =
      records2?.[0]?.Name === "Jane" &&
      records2?.[0]?.City === "Boston";
    record("Test 3 — Multiple fields stored correctly", test3, JSON.stringify(records2?.[0]));

    await dialog.getByRole("button", { name: btnNav, exact: true }).click();
    await dialog.getByRole("heading", { name: navScreenName }).waitFor({ timeout: 10000 });
    await dialog.getByRole("button", { name: btnBack, exact: true }).click();
    await dialog.getByRole("heading", { name: "Screen1" }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(600);
    const recordsAfterNav = await getRecords(page, formName);
    const test4 = consoleErrors.length === 0 && recordsAfterNav?.length === 2;
    record("Test 4 — Navigation does not crash", test4, `errors=${consoleErrors.length}, records=${recordsAfterNav?.length}`);

    await dialog.getByRole("button", { name: btnSet, exact: true }).click();
    await page.waitForTimeout(500);
    const varOk = await dialog.getByText("SubmitFormOK", { exact: true }).first().isVisible().catch(() => false);
    const johnRow = await dialog.locator("div[style*='cursor: pointer']").filter({ hasText: "John" }).first().isVisible().catch(() => false);
    const test5 = varOk && johnRow && consoleErrors.length === 0;
    record("Test 5 — Variables/Collections/Gallery regressions", test5, `var=${varOk}, gallery=${johnRow}`);

    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await openPreview(page);
    const dialog6 = page.locator('[class*="dialog"]');
    const recordsAfterRefresh = await getRecords(page, formName);
    const test6 = (recordsAfterRefresh?.length ?? 0) === 0;
    record("Test 6 — Refresh clears in-memory records", test6, JSON.stringify(recordsAfterRefresh));

    await dialog6.getByRole("button", { name: btnClear, exact: true }).click();
    await page.waitForTimeout(400);
    await clickGalleryRow(page, "John");
    await page.waitForTimeout(300);
    const badResult = await runAction(page, "SubmitForm(MissingForm)");
    const test7 = badResult.ok === false && String(badResult.error).includes("form not found");
    record("Test 7 — SubmitForm(MissingForm) returns action error", test7, JSON.stringify(badResult));

    const errsBeforeLoop = consoleErrors.length;
    for (let i = 0; i < 12; i++) {
      const result = await runAction(page, `SubmitForm(${formName})`);
      if (!result.ok) throw new Error(`Loop submit failed at ${i}: ${JSON.stringify(result)}`);
    }
    const recordsLoop = await getRecords(page, formName);
    const test8 = recordsLoop?.length === 12 && consoleErrors.length === errsBeforeLoop;
    record("Test 8 — Repeated submits (12) without errors", test8, `count=${recordsLoop?.length}`);
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
