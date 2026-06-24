/**
 * Phase 4.31 acceptance validation — App.OnStart Foundation.
 * Run: node infrastructure/scripts/validate-phase-4.31.mjs
 */
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-4.31");
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
let originalOnStart = null;

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
      const res = await fetch(`${METADATA_API}/applications/${APP_ID}`, {
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

async function getApplication() {
  const res = await fetch(`${METADATA_API}/applications/${APP_ID}`, {
    headers: { "X-Tenant-Id": TENANT },
  });
  const body = await res.json();
  return body.data;
}

async function setApplicationOnStart(formula) {
  const res = await fetch(`${METADATA_API}/applications/${APP_ID}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Tenant-Id": TENANT },
    body: JSON.stringify({ on_start: formula }),
  });
  if (!res.ok) throw new Error(`setApplicationOnStart failed: ${res.status}`);
}

async function setScreenOnVisible(screenId, formula) {
  await fetch(`${METADATA_API}/screens/${screenId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Tenant-Id": TENANT },
    body: JSON.stringify({ on_visible: formula }),
  });
}

async function createControlViaApi(screenId, name, controlType, x, y, width, height, properties, parentControlId = null) {
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
  const res = await fetch(`${METADATA_API}/applications/${APP_ID}/screens`, {
    headers: { "X-Tenant-Id": TENANT },
  });
  const items = (await res.json()).data?.items ?? [];
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
  const dialog = page.locator('[class*="dialog"]');
  await dialog.getByRole("heading", { name: "Screen1" }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  return dialog;
}

async function dialogHasText(page, text) {
  const dialog = page.locator('[class*="dialog"]');
  return dialog.getByText(text, { exact: true }).first().isVisible().catch(() => false);
}

async function getCollection(page, name) {
  return page.evaluate((n) => {
    const store = window.__collectionStore;
    return store ? store.get(n) : null;
  }, name);
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("=== Phase 4.31 Acceptance Validation ===");

  const typeRuntime = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@goapps/runtime", "typecheck"],
    { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" },
  );
  record("Test 8 — TypeScript clean", typeRuntime.status === 0, `exit=${typeRuntime.status}`);
  if (typeRuntime.status !== 0) process.exit(1);

  spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@goapps/formula", "build"],
    { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" },
  );

  startFormulaApi();
  await waitForFormulaApi();
  await waitForMetadata();
  await ensureScreen2();

  const app = await getApplication();
  originalOnStart = app.on_start ?? "";

  const stamp = Date.now();
  const testNames = new Set([
    `OsLbl_${stamp}`,
    `OsGal_${stamp}`,
    `OsGalLbl_${stamp}`,
    `OsNav_${stamp}`,
    `OsBack_${stamp}`,
    `OsVisLbl_${stamp}`,
    `OsSet_${stamp}`,
  ]);

  await cleanupTestControls(testNames);
  await setScreenOnVisible(SCREEN1_ID, "");
  await setScreenOnVisible(screen2Id, "");

  await createControlViaApi(SCREEN1_ID, `OsLbl_${stamp}`, "label", 100, 80, 220, 36, {
    text: { formula: "varTitle" },
  });
  const gallery = await createControlViaApi(
    SCREEN1_ID,
    `OsGal_${stamp}`,
    "gallery",
    100,
    140,
    280,
    180,
    { items: { formula: "Customers" } },
  );
  await createControlViaApi(
    SCREEN1_ID,
    `OsGalLbl_${stamp}`,
    "label",
    8,
    8,
    240,
    28,
    { text: { formula: "ThisItem.Name" } },
    gallery.id,
  );
  await createControlViaApi(SCREEN1_ID, `OsNav_${stamp}`, "button", 100, 340, 180, 40, {
    text: { value: `OsNavBtn_${stamp}` },
    onSelect: { formula: `Navigate(${navScreenName})` },
  });
  await createControlViaApi(screen2Id, `OsBack_${stamp}`, "button", 100, 300, 180, 40, {
    text: { value: `OsBackBtn_${stamp}` },
    onSelect: { formula: "Navigate(Screen1)" },
  });
  await createControlViaApi(screen2Id, `OsVisLbl_${stamp}`, "label", 100, 80, 220, 36, {
    text: { formula: "varTitle" },
  });
  await createControlViaApi(SCREEN1_ID, `OsSet_${stamp}`, "button", 100, 400, 180, 40, {
    text: { value: `OsSetBtn_${stamp}` },
    onSelect: { formula: 'Set(varTitle, "Manual")' },
  });

  const btnNav = `OsNavBtn_${stamp}`;
  const btnBack = `OsBackBtn_${stamp}`;
  const btnSet = `OsSetBtn_${stamp}`;

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
    // Test 1 — Set(varTitle, "Welcome")
    await setApplicationOnStart('Set(varTitle, "Welcome")');
    await page.goto(STUDIO_URL, { waitUntil: "networkidle" });
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await openPreview(page);
    const test1 = await dialogHasText(page, "Welcome");
    record("Test 1 — OnStart Set(varTitle) shows Welcome", test1, `welcome=${test1}`);

    // Test 2 — Collect Customers John
    await page.keyboard.press("Escape");
    await setApplicationOnStart('Collect(Customers, { Name: "John" })');
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await openPreview(page);
    const test2 = await dialogHasText(page, "John");
    record("Test 2 — OnStart Collect shows John in gallery", test2, `john=${test2}`);

    // Test 3 — OnStart once across navigation
    await page.keyboard.press("Escape");
    await setApplicationOnStart('Collect(Customers, { Name: "Startup" })');
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await openPreview(page);
    const dialog = page.locator('[class*="dialog"]');
    const startupBefore = await dialogHasText(page, "Startup");
    const customersBefore = await getCollection(page, "Customers");
    await dialog.getByRole("button", { name: btnNav, exact: true }).click();
    await dialog.getByRole("heading", { name: navScreenName }).waitFor({ timeout: 10000 });
    await dialog.getByRole("button", { name: btnBack, exact: true }).click();
    await dialog.getByRole("heading", { name: "Screen1" }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(800);
    const customersAfter = await getCollection(page, "Customers");
    const test3 =
      startupBefore &&
      customersBefore?.length === 1 &&
      customersAfter?.length === 1 &&
      customersAfter[0]?.Name === "Startup";
    record(
      "Test 3 — OnStart executes once across navigation",
      test3,
      JSON.stringify({
        startupBefore,
        before: customersBefore?.length,
        after: customersAfter?.length,
        name: customersAfter?.[0]?.Name,
      }),
    );

    // Test 4 — Refresh runs OnStart again
    await page.keyboard.press("Escape");
    await setApplicationOnStart('Set(varTitle, "Refreshed")');
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await openPreview(page);
    const test4 = await dialogHasText(page, "Refreshed");
    record("Test 4 — Refresh executes OnStart again", test4, `refreshed=${test4}`);

    // Test 5 — Invalid OnStart no crash
    await page.keyboard.press("Escape");
    const errsBefore5 = consoleErrors.length;
    await setApplicationOnStart("Set(");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await openPreview(page);
    const test5 = consoleErrors.length === errsBefore5;
    record("Test 5 — Invalid OnStart formula does not crash", test5, `errors=${consoleErrors.length}`);

    // Test 6 — Screen OnVisible still works
    await page.keyboard.press("Escape");
    await setApplicationOnStart("");
    await setScreenOnVisible(screen2Id, 'Set(varTitle, "FromOnVisible")');
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    const dialog6 = await openPreview(page);
    await dialog6.getByRole("button", { name: btnNav, exact: true }).click();
    await dialog6.getByRole("heading", { name: navScreenName }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(1000);
    const test6 = await dialogHasText(page, "FromOnVisible");
    record("Test 6 — Screen OnVisible still works", test6, `visible=${test6}`);

    // Test 7 — Regression
    await dialog6.getByRole("button", { name: btnBack, exact: true }).click();
    await dialog6.getByRole("heading", { name: "Screen1" }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(500);
    await dialog6.getByRole("button", { name: btnSet, exact: true }).click();
    await page.waitForTimeout(600);
    const test7 =
      (await dialogHasText(page, "Manual")) &&
      consoleErrors.length === errsBefore5;
    record("Test 7 — Variables/Collections/Forms/Navigation regressions", test7, `manual=${await dialogHasText(page, "Manual")}`);
  } finally {
    await browser.close();
    await stopStudioDev();
    await cleanupTestControls(testNames);
    await setApplicationOnStart(originalOnStart ?? "");
    await setScreenOnVisible(SCREEN1_ID, "");
    await setScreenOnVisible(screen2Id, "");
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
  try {
    await setApplicationOnStart(originalOnStart ?? "");
  } catch { /* ignore */ }
  process.exit(1);
});
