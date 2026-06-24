/**
 * Phase 4.27 acceptance validation — Gallery Selection Foundation.
 * Run: node infrastructure/scripts/validate-phase-4.27.mjs
 */
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-4.27");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const FORMULA_API = "http://localhost:8085";
const METADATA_API = "http://localhost:8082/api/v1";
const STUDIO_BASE = "http://localhost:5173";

const TENANT = "00000000-0000-4000-8000-000000000001";
const APP_ID = "00000000-0000-4000-8000-000000000003";
const SCREEN1_ID = "00000000-0000-4000-8000-000000000004";
const STUDIO_URL = `http://localhost:5173/studio/apps/${APP_ID}/screens/${SCREEN1_ID}`;
const SCREEN2_ID_FILE = path.resolve(ROOT, ".validation-4.21", "screen2-id.txt");

const DEFAULT_CONTEXT = {
  User: { FullName: "Test User", Email: "test@example.com" },
  App: { Name: "Demo Application" },
  TextInput1: { Value: "Hello" },
  varTitle: "Hello World",
};

const results = [];
let apiProcess = null;
let studioStartedByScript = false;
let studioProcess = null;
let screen2Id = null;
let navScreenName = "Screen2Active";

function log(line) {
  const msg = `[${new Date().toISOString()}] ${line}`;
  console.log(msg);
  fs.appendFileSync(LOG_FILE, msg + "\n");
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

async function postEvaluate(formula, context) {
  const res = await fetch(`${FORMULA_API}/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ formula, context }),
  });
  return res.json();
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

async function runAction(page, formula) {
  return page.evaluate(async (f) => {
    const fn = window.__executeAction;
    if (!fn) return { ok: false, error: "__executeAction not exposed" };
    return fn(f);
  }, formula);
}

async function dialogHasText(page, text) {
  const dialog = page.locator('[class*="dialog"]');
  return dialog.getByText(text, { exact: true }).first()
    .isVisible()
    .catch(() => false);
}

async function populateCustomers(page, dialog) {
  await dialog.getByRole("button", { name: /SelClearBtn_/ }).click();
  await page.waitForTimeout(800);
  await dialog.getByRole("button", { name: /SelCollectBtn_/ }).click();
  await page.waitForTimeout(800);
}

async function clickGalleryRow(page, name) {
  const dialog = page.locator('[class*="dialog"]');
  const row = dialog.locator("div[style*='cursor: pointer']").filter({ hasText: name }).first();
  await row.click();
  await page.waitForTimeout(500);
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("=== Phase 4.27 Acceptance Validation ===");

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
  const testNames = new Set([
    "Gallery1",
    `SelRowLbl_${stamp}`,
    `SelNameLbl_${stamp}`,
    `SelUpperLbl_${stamp}`,
    `SelBadLbl_${stamp}`,
    `SelClear_${stamp}`,
    `SelCollect_${stamp}`,
    `SelNav_${stamp}`,
    `SelGoBack_${stamp}`,
    `SelSetBtn_${stamp}`,
    `SelVarLbl_${stamp}`,
  ]);

  await cleanupTestControls(testNames);

  const screens = await listScreens();
  const screen1 = screens.find((s) => s.id === SCREEN1_ID);
  const originalScreen1Name = screen1?.name ?? "Screen1";
  await renameScreen(SCREEN1_ID, "Screen1");

  const gallery = await createControlViaApi(
    SCREEN1_ID,
    "Gallery1",
    "gallery",
    100,
    80,
    320,
    200,
    { items: { formula: "Customers" } },
  );

  await createControlViaApi(
    SCREEN1_ID,
    `SelRowLbl_${stamp}`,
    "label",
    8,
    8,
    280,
    32,
    { text: { formula: "ThisItem.Name" } },
    gallery.id,
  );

  await createControlViaApi(SCREEN1_ID, `SelNameLbl_${stamp}`, "label", 440, 80, 220, 40, {
    text: { formula: 'Concatenate("SEL-", Gallery1.Selected.Name)' },
  });
  await createControlViaApi(SCREEN1_ID, `SelUpperLbl_${stamp}`, "label", 440, 130, 220, 40, {
    text: { formula: 'Concatenate("U-", Upper(Gallery1.Selected.Name))' },
  });
  await createControlViaApi(SCREEN1_ID, `SelBadLbl_${stamp}`, "label", 440, 180, 220, 40, {
    text: { formula: "Gallery1.Selected.UnknownField" },
  });

  await createControlViaApi(SCREEN1_ID, `SelClear_${stamp}`, "button", 100, 300, 220, 44, {
    text: { value: `SelClearBtn_${stamp}` },
    onSelect: { formula: 'ClearCollect(Customers, { Name: "John" })' },
  });
  await createControlViaApi(SCREEN1_ID, `SelCollect_${stamp}`, "button", 100, 360, 220, 44, {
    text: { value: `SelCollectBtn_${stamp}` },
    onSelect: { formula: 'Collect(Customers, { Name: "Jane" })' },
  });
  await createControlViaApi(SCREEN1_ID, `SelNav_${stamp}`, "button", 100, 420, 180, 44, {
    text: { value: `SelNavS2_${stamp}` },
    onSelect: { formula: `Navigate(${navScreenName})` },
  });
  await createControlViaApi(SCREEN1_ID, `SelSetBtn_${stamp}`, "button", 100, 480, 200, 44, {
    text: { value: `SelSetBtn_${stamp}` },
    onSelect: { formula: 'Set(varTitle, "SelOK")' },
  });
  await createControlViaApi(SCREEN1_ID, `SelVarLbl_${stamp}`, "label", 100, 540, 200, 40, {
    text: { formula: "varTitle" },
  });
  await createControlViaApi(screen2Id, `SelGoBack_${stamp}`, "button", 100, 300, 180, 44, {
    text: { value: `SelGoS1_${stamp}` },
    onSelect: { formula: "Navigate(Screen1)" },
  });

  const btnNavS2 = `SelNavS2_${stamp}`;
  const btnNavS1 = `SelGoS1_${stamp}`;
  const btnSet = `SelSetBtn_${stamp}`;

  const apiCtx = {
    ...DEFAULT_CONTEXT,
    Gallery1: { Selected: { Name: "Jane", City: "LA" } },
  };
  const apiSel = await postEvaluate("Gallery1.Selected.Name", apiCtx);
  const apiUpper = await postEvaluate("Upper(Gallery1.Selected.Name)", apiCtx);
  record(
    "API — Gallery1.Selected via Power Fx",
    apiSel.ok && apiSel.value === "Jane" &&
    apiUpper.ok && apiUpper.value === "JANE",
    JSON.stringify({ apiSel, apiUpper }),
  );

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

    // Test 1 — click Jane, Gallery1.Selected.Name
    await clickGalleryRow(page, "Jane");
    const test1 = await dialogHasText(page, "SEL-Jane");
    record("Test 1 — Gallery1.Selected.Name shows Jane", test1, `sel-jane=${test1}`);

    // Test 2 — click John
    await clickGalleryRow(page, "John");
    const test2 = await dialogHasText(page, "SEL-John");
    record("Test 2 — Gallery1.Selected.Name shows John", test2, `sel-john=${test2}`);

    // Test 3 — Upper(Gallery1.Selected.Name)
    const test3 = await dialogHasText(page, "U-JOHN");
    record("Test 3 — Upper(Gallery1.Selected.Name)", test3, `upper=${test3}`);

    // Test 4 — selection survives Set()
    await dialog.getByRole("button", { name: btnSet, exact: true }).click();
    await page.waitForTimeout(800);
    const test4 =
      (await dialogHasText(page, "SelOK")) &&
      (await dialogHasText(page, "SEL-John"));
    record("Test 4 — Selection survives Set()", test4, `set+sel=${test4}`);

    // Test 5 — navigation clears selection
    await clickGalleryRow(page, "Jane");
    await page.waitForTimeout(300);
    const hadSelJane = await dialogHasText(page, "SEL-Jane");
    await dialog.getByRole("button", { name: btnNavS2, exact: true }).click();
    await dialog.getByRole("heading", { name: navScreenName }).waitFor({ timeout: 10000 });
    await dialog.getByRole("button", { name: btnNavS1, exact: true }).click();
    await dialog.getByRole("heading", { name: "Screen1" }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(800);
    const selCleared = !(await dialogHasText(page, "SEL-Jane"));
    const noCrash = consoleErrors.length === 0;
    record(
      "Test 5 — Selection clears on navigation",
      hadSelJane && selCleared && noCrash,
      `hadSel=${hadSelJane}, cleared=${selCleared}, noCrash=${noCrash}`,
    );

    // Test 6 — ThisItem still works
    await populateCustomers(page, dialog);
    const test6 = (await dialogHasText(page, "John")) && (await dialogHasText(page, "Jane"));
    record("Test 6 — ThisItem continues working", test6, `thisitem=${test6}`);

    // Test 7 — variables / collections regression
    await dialog.getByRole("button", { name: btnSet, exact: true }).click();
    await page.waitForTimeout(800);
    const test7 = await dialogHasText(page, "SelOK");
    record("Test 7 — Variables continue working", test7, `var=${test7}`);

    // Test 8 — unknown selected field
    await clickGalleryRow(page, "John");
    await page.waitForTimeout(500);
    const errsBefore = consoleErrors.length;
    const test8 = await dialogHasText(page, "[Formula Error]");
    record(
      "Test 8 — Gallery1.Selected.UnknownField shows formula error",
      test8 && consoleErrors.length === errsBefore,
      `error=${test8}`,
    );

    // Test 9 — reload resets selection
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await openPreview(page);
    const dialog9 = page.locator('[class*="dialog"]');
    await populateCustomers(page, dialog9);
    await clickGalleryRow(page, "Jane");
    await page.waitForTimeout(300);
    const hadSelection = await dialogHasText(page, "SEL-Jane");
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await openPreview(page);
    const dialog9b = page.locator('[class*="dialog"]');
    await populateCustomers(page, dialog9b);
    await page.waitForTimeout(500);
    const noSelection = !(await dialogHasText(page, "SEL-Jane"));
    const test9 = hadSelection && noSelection;
    record(
      "Test 9 — Reload resets selection to default",
      test9,
      `hadBefore=${hadSelection}, clearedAfter=${noSelection}`,
    );

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
