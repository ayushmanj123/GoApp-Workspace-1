/**
 * Phase 4.26 acceptance validation — Gallery ThisItem Foundation.
 * Run: node infrastructure/scripts/validate-phase-4.26.mjs
 */
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-4.26");
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
let galleryId = null;
let galleryLabelId = null;

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

async function runAction(page, formula) {
  return page.evaluate(async (f) => {
    const fn = window.__executeAction;
    if (!fn) return { ok: false, error: "__executeAction not exposed" };
    return fn(f);
  }, formula);
}

async function dialogHasTexts(page, texts) {
  const dialog = page.locator('[class*="dialog"]');
  for (const text of texts) {
    const visible = await dialog.getByText(text, { exact: true }).first()
      .isVisible()
      .catch(() => false);
    if (!visible) return false;
  }
  return true;
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("=== Phase 4.26 Acceptance Validation ===");

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
    `TiGal_${stamp}`,
    `TiLbl_${stamp}`,
    `TiLblBad_${stamp}`,
    `TiClear_${stamp}`,
    `TiCollect_${stamp}`,
    `TiNav_${stamp}`,
    `TiGoBack_${stamp}`,
    `TiSetBtn_${stamp}`,
    `TiVarLbl_${stamp}`,
  ]);

  await cleanupTestControls(testNames);

  const screens = await listScreens();
  const screen1 = screens.find((s) => s.id === SCREEN1_ID);
  const originalScreen1Name = screen1?.name ?? "Screen1";
  await renameScreen(SCREEN1_ID, "Screen1");

  const gallery = await createControlViaApi(
    SCREEN1_ID,
    `TiGal_${stamp}`,
    "gallery",
    100,
    80,
    320,
    200,
    { items: { formula: "Customers" } },
  );
  galleryId = gallery.id;

  const label = await createControlViaApi(
    SCREEN1_ID,
    `TiLbl_${stamp}`,
    "label",
    8,
    8,
    280,
    32,
    { text: { formula: "ThisItem.Name" } },
    galleryId,
  );
  galleryLabelId = label.id;

  await createControlViaApi(
    SCREEN1_ID,
    `TiLblBad_${stamp}`,
    "label",
    8,
    48,
    280,
    32,
    { text: { formula: "ThisItem.UnknownField" } },
    galleryId,
  );

  await createControlViaApi(SCREEN1_ID, `TiClear_${stamp}`, "button", 100, 300, 220, 44, {
    text: { value: `TiClearBtn_${stamp}` },
    onSelect: { formula: 'ClearCollect(Customers, { Name: "John" })' },
  });
  await createControlViaApi(SCREEN1_ID, `TiCollect_${stamp}`, "button", 100, 360, 220, 44, {
    text: { value: `TiCollectBtn_${stamp}` },
    onSelect: { formula: 'Collect(Customers, { Name: "Jane" })' },
  });
  await createControlViaApi(SCREEN1_ID, `TiNav_${stamp}`, "button", 100, 420, 180, 44, {
    text: { value: `TiNavS2_${stamp}` },
    onSelect: { formula: `Navigate(${navScreenName})` },
  });
  await createControlViaApi(SCREEN1_ID, `TiSetBtn_${stamp}`, "button", 100, 480, 200, 44, {
    text: { value: `TiSetBtn_${stamp}` },
    onSelect: { formula: 'Set(varTitle, "ThisItemOK")' },
  });
  await createControlViaApi(SCREEN1_ID, `TiVarLbl_${stamp}`, "label", 100, 540, 200, 40, {
    text: { formula: "varTitle" },
  });
  await createControlViaApi(screen2Id, `TiGoBack_${stamp}`, "button", 100, 300, 180, 44, {
    text: { value: `TiGoS1_${stamp}` },
    onSelect: { formula: "Navigate(Screen1)" },
  });

  const btnClear = `TiClearBtn_${stamp}`;
  const btnCollect = `TiCollectBtn_${stamp}`;
  const btnNavS2 = `TiNavS2_${stamp}`;
  const btnNavS1 = `TiGoS1_${stamp}`;
  const btnSet = `TiSetBtn_${stamp}`;

  // API sanity: ThisItem.Name via context injection
  const apiCtx = {
    ...DEFAULT_CONTEXT,
    ThisItem: { Name: "John", City: "NY" },
  };
  const apiName = await postEvaluate("ThisItem.Name", apiCtx);
  const apiUpper = await postEvaluate("Upper(ThisItem.Name)", apiCtx);
  const apiConcat = await postEvaluate(
    'Concatenate(ThisItem.Name, " - ", ThisItem.City)',
    apiCtx,
  );
  record(
    "API — ThisItem formulas via Power Fx",
    apiName.ok && apiName.value === "John" &&
    apiUpper.ok && apiUpper.value === "JOHN" &&
    apiConcat.ok && apiConcat.value === "John - NY",
    JSON.stringify({ apiName, apiUpper, apiConcat }),
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

    // Test 1
    await dialog.getByRole("button", { name: btnClear, exact: true }).click();
    await page.waitForTimeout(1000);
    const test1 = await dialogHasTexts(page, ["John"]);
    record("Test 1 — ThisItem.Name renders John", test1, `john=${test1}`);

    // Test 2
    await dialog.getByRole("button", { name: btnCollect, exact: true }).click();
    await page.waitForTimeout(1000);
    const test2 = await dialogHasTexts(page, ["John", "Jane"]);
    record("Test 2 — Collect appends Jane via ThisItem", test2, `john+jane=${test2}`);

    // Test 3 — Upper(ThisItem.Name)
    await updateControlProperties(galleryLabelId, {
      text: { formula: "Upper(ThisItem.Name)" },
    });
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await openPreview(page);
    const dialog3 = page.locator('[class*="dialog"]');
    await dialog3.getByRole("button", { name: btnClear, exact: true }).click();
    await page.waitForTimeout(800);
    await dialog3.getByRole("button", { name: btnCollect, exact: true }).click();
    await page.waitForTimeout(1000);
    const test3 = await dialogHasTexts(page, ["JOHN", "JANE"]);
    record("Test 3 — Upper(ThisItem.Name)", test3, `upper=${test3}`);

    // Test 4 — Concatenate with City
    await updateControlProperties(galleryLabelId, {
      text: { formula: 'Concatenate(ThisItem.Name, " - ", ThisItem.City)' },
    });
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await openPreview(page);
    const dialog4 = page.locator('[class*="dialog"]');
    await runAction(page, 'ClearCollect(Customers, { Name: "John", City: "NY" })');
    await page.waitForTimeout(800);
    await runAction(page, 'Collect(Customers, { Name: "Jane", City: "LA" })');
    await page.waitForTimeout(1000);
    const test4 = await dialogHasTexts(page, ["John - NY", "Jane - LA"]);
    record("Test 4 — Concatenate(ThisItem.Name, City)", test4, `concat=${test4}`);

    // Test 5 — navigation
    await dialog4.getByRole("button", { name: btnNavS2, exact: true }).click();
    await dialog4.getByRole("heading", { name: navScreenName }).waitFor({ timeout: 10000 });
    await dialog4.getByRole("button", { name: btnNavS1, exact: true }).click();
    await dialog4.getByRole("heading", { name: "Screen1" }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(800);
    const test5 = await dialogHasTexts(page, ["John - NY", "Jane - LA"]);
    record("Test 5 — Navigation continues working", test5, `afterNav=${test5}`);

    // Test 6 — regression
    await dialog4.getByRole("button", { name: btnSet, exact: true }).click();
    await page.waitForTimeout(800);
    const test6 = await dialog4.getByText("ThisItemOK", { exact: true }).first().isVisible().catch(() => false);
    record("Test 6 — Set/variables continue working", test6, `var=${test6}`);

    // Test 7 — unknown field
    const errsBefore = consoleErrors.length;
    const hasFormulaError = await dialog4.getByText("[Formula Error]", { exact: true }).first()
      .isVisible()
      .catch(() => false);
    record(
      "Test 7 — ThisItem.UnknownField shows formula error",
      hasFormulaError && consoleErrors.length === errsBefore,
      `errorVisible=${hasFormulaError}`,
    );

    // Test 8 — reload persists template
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    const controlsAfter = await listControls(SCREEN1_ID);
    const child = controlsAfter.find((c) => c.id === galleryLabelId);
    await openPreview(page);
    const dialog8 = page.locator('[class*="dialog"]');
    await runAction(page, 'ClearCollect(Customers, { Name: "John", City: "NY" })');
    await page.waitForTimeout(1000);
    const test8 = child?.parent_control_id === galleryId &&
      await dialogHasTexts(page, ["John - NY"]);
    record(
      "Test 8 — Template metadata persists after reload",
      test8,
      `parent=${child?.parent_control_id}, rendered=${test8}`,
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
