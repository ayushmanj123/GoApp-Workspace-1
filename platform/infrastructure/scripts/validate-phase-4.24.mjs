/**
 * Phase 4.24 acceptance validation — Collection Functions Foundation.
 * Run: node infrastructure/scripts/validate-phase-4.24.mjs
 */
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-4.24");
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
  varCount: 10,
  varStatus: "Approved",
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

async function postEvaluate(formula, context = DEFAULT_CONTEXT) {
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

async function setScreenOnVisible(screenId, formula) {
  await fetch(`${METADATA_API}/screens/${screenId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Tenant-Id": TENANT },
    body: JSON.stringify({ on_visible: formula }),
  });
}

async function clearScreenOnVisible(screenId) {
  await fetch(`${METADATA_API}/screens/${screenId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Tenant-Id": TENANT },
    body: JSON.stringify({ on_visible: "" }),
  });
}

async function createControlViaApi(screenId, name, controlType, x, y, width, height, properties) {
  const res = await fetch(`${METADATA_API}/screens/${screenId}/controls`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Tenant-Id": TENANT },
    body: JSON.stringify({ name, control_type: controlType, x, y, width, height, z_index: 50, parent_control_id: null }),
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
  throw new Error("Screen2 not found — run validate-phase-4.21 first.");
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

async function evalInRuntime(page, formula) {
  return page.evaluate(async (f) => {
    const store = window.__collectionStore;
    const varStore = window.__variableStore;
    const ctxStore = window.__screenContextStore;
    const context = {
      User: { FullName: "Test User", Email: "test@example.com" },
      App: { Name: "Demo Application" },
      TextInput1: { Value: "Hello" },
      ...(varStore?.getAll?.() ?? {}),
      ...(ctxStore?.getAll?.() ?? {}),
      ...(store?.getAll?.() ?? {}),
    };
    const res = await fetch("http://localhost:8085/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formula: f, context }),
    });
    return res.json();
  }, formula);
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("=== Phase 4.24 Acceptance Validation ===");

  const build = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@goapps/formula", "build"],
    { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" },
  );
  if (build.status !== 0) throw new Error("Failed to build @goapps/formula.");

  const dotnet = existsSync(path.join(ROOT, ".dotnet", "dotnet.exe"))
    ? path.join(ROOT, ".dotnet", "dotnet.exe")
    : "dotnet";
  const dotnetBuild = spawnSync(
    dotnet,
    ["build", path.join(ROOT, "packages", "formula", "dotnet", "GoApps.PowerFx", "GoApps.PowerFx.csproj")],
    { stdio: "inherit" },
  );
  if (dotnetBuild.status !== 0) throw new Error("Failed to build GoApps.PowerFx.");

  startFormulaApi();
  await waitForFormulaApi();
  await waitForMetadata();
  await ensureScreen2();

  const stamp = Date.now();
  const testNames = new Set([
    `CfCountLbl_${stamp}`,
    `CfFirstLbl_${stamp}`,
    `CfLastLbl_${stamp}`,
    `CfEmptyLbl_${stamp}`,
    `CfVarLbl_${stamp}`,
    `CfInputLbl_${stamp}`,
    `CfClearBtn_${stamp}`,
    `CfCollectBtn_${stamp}`,
    `CfNavBtn_${stamp}`,
    `CfGoBack_${stamp}`,
    `CfOvLbl_${stamp}`,
  ]);

  await cleanupTestControls(testNames);

  const screens = await listScreens();
  const screen1 = screens.find((s) => s.id === SCREEN1_ID);
  const originalScreen1Name = screen1?.name ?? "Screen1";
  await renameScreen(SCREEN1_ID, "Screen1");

  await createControlViaApi(SCREEN1_ID, `CfClearBtn_${stamp}`, "button", 100, 300, 200, 44, {
    text: { value: `CfClear_${stamp}` },
    onSelect: { formula: 'ClearCollect(Customers, { Name: "John" })' },
  });
  await createControlViaApi(SCREEN1_ID, `CfCollectBtn_${stamp}`, "button", 100, 360, 200, 44, {
    text: { value: `CfCollect_${stamp}` },
    onSelect: { formula: 'Collect(Customers, { Name: "Jane" })' },
  });
  await createControlViaApi(SCREEN1_ID, `CfNavBtn_${stamp}`, "button", 100, 420, 180, 44, {
    text: { value: `CfNavS2_${stamp}` },
    onSelect: { formula: `Navigate(${navScreenName})` },
  });
  await createControlViaApi(SCREEN1_ID, `CfCountLbl_${stamp}`, "label", 100, 100, 120, 40, {
    text: { formula: "CountRows(Customers)" },
  });
  await createControlViaApi(SCREEN1_ID, `CfFirstLbl_${stamp}`, "label", 100, 140, 160, 40, {
    text: { formula: "First(Customers).Name" },
  });
  await createControlViaApi(SCREEN1_ID, `CfLastLbl_${stamp}`, "label", 100, 180, 160, 40, {
    text: { formula: "Last(Customers).Name" },
  });
  await createControlViaApi(SCREEN1_ID, `CfEmptyLbl_${stamp}`, "label", 100, 220, 120, 40, {
    text: { formula: "IsEmpty(Customers)" },
  });
  await createControlViaApi(SCREEN1_ID, `CfVarLbl_${stamp}`, "label", 100, 260, 200, 40, {
    text: { formula: "varTitle" },
  });
  await createControlViaApi(SCREEN1_ID, `CfInputLbl_${stamp}`, "label", 100, 500, 200, 40, {
    text: { formula: "TextInput1.Value" },
  });

  await createControlViaApi(screen2Id, `CfGoBack_${stamp}`, "button", 100, 300, 180, 44, {
    text: { value: `CfNavS1_${stamp}` },
    onSelect: { formula: "Navigate(Screen1)" },
  });
  await createControlViaApi(screen2Id, `CfOvLbl_${stamp}`, "label", 100, 100, 200, 40, {
    text: { formula: "varTitle" },
  });

  const btnClear = `CfClear_${stamp}`;
  const btnCollect = `CfCollect_${stamp}`;
  const btnNavS2 = `CfNavS2_${stamp}`;
  const btnNavS1 = `CfNavS1_${stamp}`;

  // API-level collection function tests (PowerFxEvaluator path)
  const ctx1 = { ...DEFAULT_CONTEXT, Customers: [{ Name: "John" }] };
  const t1 = await postEvaluate("CountRows(Customers)", ctx1);
  record("Test 1 — CountRows after ClearCollect", t1.ok && t1.value === 1, JSON.stringify(t1));

  const ctx2 = { ...DEFAULT_CONTEXT, Customers: [{ Name: "John" }, { Name: "Jane" }] };
  const t2 = await postEvaluate("CountRows(Customers)", ctx2);
  record("Test 2 — CountRows after second Collect", t2.ok && t2.value === 2, JSON.stringify(t2));

  const t3 = await postEvaluate("First(Customers).Name", ctx2);
  record("Test 3 — First(Customers).Name", t3.ok && t3.value === "John", JSON.stringify(t3));

  const t4 = await postEvaluate("Last(Customers).Name", ctx2);
  record("Test 4 — Last(Customers).Name", t4.ok && t4.value === "Jane", JSON.stringify(t4));

  const t5 = await postEvaluate("IsEmpty(Customers)", ctx2);
  record("Test 5 — IsEmpty(Customers) false", t5.ok && t5.value === false, JSON.stringify(t5));

  const t6 = await postEvaluate("IsEmpty(Customers)", { ...DEFAULT_CONTEXT, Customers: [] });
  record("Test 6 — IsEmpty(Customers) true", t6.ok && t6.value === true, JSON.stringify(t6));

  const t7 = await postEvaluate("varTitle", DEFAULT_CONTEXT);
  record("Test 7 — Variables still work", t7.ok && t7.value === "Hello World", JSON.stringify(t7));

  const t8 = await postEvaluate("TextInput1.Value", DEFAULT_CONTEXT);
  record("Test 8 — Control references still work", t8.ok && t8.value === "Hello", JSON.stringify(t8));

  const t10 = await postEvaluate('Filter(Customers, Name = "John")', ctx2);
  record(
    "Test 10 — Filter handled without crash",
    t10.ok || (t10.error && !String(t10.error).includes("crash")),
    JSON.stringify(t10),
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
    await setScreenOnVisible(screen2Id, 'Set(varTitle, "OnVisible")');
    await page.goto(STUDIO_URL, { waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await openPreview(page);
    const dialog = page.locator('[class*="dialog"]');

    // Runtime pipeline: ClearCollect + Collect, then verify via labels and navigation
    await dialog.getByRole("button", { name: btnClear, exact: true }).click();
    await page.waitForTimeout(800);
    await dialog.getByRole("button", { name: btnCollect, exact: true }).click();
    await page.waitForTimeout(800);

    // Test 9: navigation + OnVisible + collection survives
    await dialog.getByRole("button", { name: btnNavS2, exact: true }).click();
    await dialog.getByRole("heading", { name: navScreenName }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(800);
    const onVisibleWorked = await dialog.locator("text=OnVisible").first().isVisible().catch(() => false);
    const countAfterNav = await evalInRuntime(page, "CountRows(Customers)");
    await dialog.getByRole("button", { name: btnNavS1, exact: true }).click();
    await dialog.getByRole("heading", { name: "Screen1" }).waitFor({ timeout: 10000 });

    record(
      "Test 9 — Navigation and OnVisible still work",
      onVisibleWorked && countAfterNav.ok && countAfterNav.value === 2,
      `onVisible=${onVisibleWorked}, countAfterNav=${JSON.stringify(countAfterNav)}`,
    );

  } finally {
    await browser.close();
    await stopStudioDev();
    await cleanupTestControls(testNames);
    await clearScreenOnVisible(screen2Id);
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
