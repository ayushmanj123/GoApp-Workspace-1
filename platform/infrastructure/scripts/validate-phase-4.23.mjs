/**
 * Phase 4.23 acceptance validation — Collections Foundation.
 * Run: node infrastructure/scripts/validate-phase-4.23.mjs
 */
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-4.23");
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

async function getCollection(page, name) {
  return page.evaluate((n) => {
    const store = window.__collectionStore;
    if (!store) return null;
    return store.get(n);
  }, name);
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("=== Phase 4.23 Acceptance Validation ===");

  const build = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@goapps/formula", "build"],
    { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" },
  );
  if (build.status !== 0) throw new Error("Failed to build @goapps/formula.");

  startFormulaApi();
  await waitForFormulaApi();
  await waitForMetadata();
  await ensureScreen2();

  const stamp = Date.now();
  const testNames = new Set([
    `ColNavBtn_${stamp}`,
    `ColGoBack_${stamp}`,
  ]);

  await cleanupTestControls(testNames);

  const screens = await listScreens();
  const screen1 = screens.find((s) => s.id === SCREEN1_ID);
  const originalScreen1Name = screen1?.name ?? "Screen1";
  await renameScreen(SCREEN1_ID, "Screen1");

  await createControlViaApi(SCREEN1_ID, `ColNavBtn_${stamp}`, "button", 100, 300, 180, 44, {
    text: { value: `ColNavS2_${stamp}` },
    onSelect: { formula: `Navigate(${navScreenName})` },
  });
  await createControlViaApi(screen2Id, `ColGoBack_${stamp}`, "button", 100, 300, 180, 44, {
    text: { value: `ColNavS1_${stamp}` },
    onSelect: { formula: "Navigate(Screen1)" },
  });

  const btnNavS2 = `ColNavS2_${stamp}`;
  const btnNavS1 = `ColNavS1_${stamp}`;

  // Test 5: API regression (no preview needed)
  const user = await postEvaluate("User.FullName");
  const app = await postEvaluate("App.Name");
  const upper = await postEvaluate("Upper(User.FullName)");
  const setResult = await postEvaluate('If(varStatus = "Approved", "OK", "FAIL")');
  record(
    "Test 5 — Variables, context, functions still work",
    user.ok && user.value === "Test User" &&
    app.ok && app.value === "Demo Application" &&
    upper.ok && upper.value === "TEST USER" &&
    setResult.ok && setResult.value === "OK",
    JSON.stringify({ user: user.value, app: app.value, upper: upper.value, setResult: setResult.value }),
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
    await openPreview(page);

    // --- Test 1: Collect once ---
    const r1 = await runAction(page, 'Collect(Customers, { Name: "John" })');
    const customers1 = await getCollection(page, "Customers");
    const len1 = customers1?.length ?? 0;
    record(
      "Test 1 — Collect adds first record",
      r1.ok && len1 === 1,
      `length=${len1}, action=${JSON.stringify(r1)}`,
    );

    // --- Test 2: Collect again ---
    const r2 = await runAction(page, 'Collect(Customers, { Name: "Jane" })');
    const customers2 = await getCollection(page, "Customers");
    const len2 = customers2?.length ?? 0;
    record(
      "Test 2 — Collect appends second record",
      r2.ok && len2 === 2,
      `length=${len2}`,
    );

    // --- Test 3: ClearCollect ---
    const r3 = await runAction(page, 'ClearCollect(Customers, { Name: "Jane" })');
    const customers3 = await getCollection(page, "Customers");
    const len3 = customers3?.length ?? 0;
    const name3 = customers3?.[0]?.Name;
    record(
      "Test 3 — ClearCollect replaces collection",
      r3.ok && len3 === 1 && name3 === "Jane",
      `length=${len3}, Name=${name3}`,
    );

    // --- Test 4: Collection survives navigation ---
    await runAction(page, 'Collect(Customers, { Name: "John" })');
    await runAction(page, 'Collect(Customers, { Name: "Bob" })');
    const lenBeforeNav = (await getCollection(page, "Customers"))?.length ?? 0;
    const dialog = page.locator('[class*="dialog"]');
    await dialog.getByRole("button", { name: btnNavS2, exact: true }).click();
    await dialog.getByRole("heading", { name: navScreenName }).waitFor({ timeout: 10000 });
    const lenOnS2 = (await getCollection(page, "Customers"))?.length ?? 0;
    await dialog.getByRole("button", { name: btnNavS1, exact: true }).click();
    await dialog.getByRole("heading", { name: "Screen1" }).waitFor({ timeout: 10000 });
    const lenBackS1 = (await getCollection(page, "Customers"))?.length ?? 0;
    record(
      "Test 4 — Collection survives navigation",
      lenBeforeNav === 3 && lenOnS2 === 3 && lenBackS1 === 3,
      `before=${lenBeforeNav}, onS2=${lenOnS2}, backS1=${lenBackS1}`,
    );

    // --- Test 6: Unsupported Remove() ---
    const errsBefore6 = consoleErrors.length;
    const r6 = await runAction(page, "Remove(Customers, First(Customers))");
    record(
      "Test 6 — Unsupported Remove() returns action error",
      !r6.ok && String(r6.error).includes("[Action Error]") && consoleErrors.length === errsBefore6,
      JSON.stringify(r6),
    );

    // --- Test 8: Repeated Collect calls ---
    await runAction(page, 'ClearCollect(Customers, { Name: "Start" })');
    const errsBefore8 = consoleErrors.length;
    for (let i = 0; i < 10; i++) {
      const r = await runAction(page, `Collect(Customers, { Name: "Item${i}" })`);
      if (!r.ok) throw new Error(`Collect loop failed at ${i}: ${JSON.stringify(r)}`);
    }
    const len8 = (await getCollection(page, "Customers"))?.length ?? 0;
    record(
      "Test 8 — Repeated Collect without errors",
      len8 === 11 && consoleErrors.length === errsBefore8,
      `length=${len8}, consoleErrors=${consoleErrors.length - errsBefore8}`,
    );

    // --- Test 7: Refresh resets collections ---
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await openPreview(page);
    const customersAfterRefresh = await getCollection(page, "Customers");
    const lenAfterRefresh = customersAfterRefresh?.length ?? 0;
    record(
      "Test 7 — Refresh resets collections",
      lenAfterRefresh === 0,
      `length after refresh=${lenAfterRefresh}`,
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
