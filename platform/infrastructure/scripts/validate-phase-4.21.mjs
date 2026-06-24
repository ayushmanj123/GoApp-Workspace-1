/**
 * Phase 4.21 acceptance validation — Navigation Foundation.
 * Run: node infrastructure/scripts/validate-phase-4.21.mjs
 */
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-4.21");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const FORMULA_API = "http://localhost:8085";
const METADATA_API = "http://localhost:8082/api/v1";
const STUDIO_BASE = "http://localhost:5173";

const TENANT = "00000000-0000-4000-8000-000000000001";
const APP_ID = "00000000-0000-4000-8000-000000000003";
const SCREEN1_ID = "00000000-0000-4000-8000-000000000004";
const STUDIO_URL = `http://localhost:5173/studio/apps/${APP_ID}/screens/${SCREEN1_ID}`;

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
let originalScreen1Name = "Home";
let navScreenName = "Screen2";
const SCREEN2_ID_FILE = path.join(OUT_DIR, "screen2-id.txt");

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

async function listControls(screenId) {
  const res = await fetch(`${METADATA_API}/screens/${screenId}/controls`, {
    headers: { "X-Tenant-Id": TENANT },
  });
  const body = await res.json();
  return body.data?.items ?? [];
}

async function cleanupNavTestControls() {
  const patterns = /^(NavBtn_|NavBtn2_|SetBtn_|CtxBtn_|BackBtn_|VarLbl_|StatusLbl_|GoBackBtn_)/;
  for (const screenId of [SCREEN1_ID, screen2Id].filter(Boolean)) {
    const items = await listControls(screenId);
    for (const c of items) {
      if (patterns.test(c.name)) {
        await fetch(`${METADATA_API}/controls/${c.id}`, {
          method: "DELETE",
          headers: { "X-Tenant-Id": TENANT },
        });
      }
    }
  }
}

async function cleanupTestControls(names) {
  for (const screenId of [SCREEN1_ID, screen2Id].filter(Boolean)) {
    const items = await listControls(screenId);
    for (const c of items) {
      if (names.has(c.name)) {
        await fetch(`${METADATA_API}/controls/${c.id}`, {
          method: "DELETE",
          headers: { "X-Tenant-Id": TENANT },
        });
      }
    }
  }
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

async function renameScreen(screenId, name) {
  await fetch(`${METADATA_API}/screens/${screenId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Tenant-Id": TENANT },
    body: JSON.stringify({ name }),
  });
}

async function listScreens() {
  const res = await fetch(`${METADATA_API}/applications/${APP_ID}/screens`, {
    headers: { "X-Tenant-Id": TENANT },
  });
  const body = await res.json();
  return body.data?.items ?? [];
}

async function ensureScreen2() {
  const items = await listScreens();
  const existing = items.find((s) => s.name === "Screen2" || s.name === "Screen2Active");
  if (existing) {
    screen2Id = existing.id;
    navScreenName = existing.name;
    fs.writeFileSync(SCREEN2_ID_FILE, screen2Id);
    return;
  }

  if (fs.existsSync(SCREEN2_ID_FILE)) {
    const savedId = fs.readFileSync(SCREEN2_ID_FILE, "utf8").trim();
    const saved = items.find((s) => s.id === savedId);
    if (saved) {
      screen2Id = saved.id;
      navScreenName = saved.name;
      return;
    }
  }

  for (const candidate of ["Screen2", "Screen2Active"]) {
    const createRes = await fetch(`${METADATA_API}/applications/${APP_ID}/screens`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tenant-Id": TENANT },
      body: JSON.stringify({ name: candidate, display_order: 1, layout_type: "responsive" }),
    });
    const createBody = await createRes.json();
    if (createRes.ok && createBody.success) {
      screen2Id = createBody.data.id;
      navScreenName = candidate;
      fs.writeFileSync(SCREEN2_ID_FILE, screen2Id);
      return;
    }
  }

  const retryItems = await listScreens();
  const retry = retryItems.find((s) => s.name === "Screen2" || s.name === "Screen2Active");
  if (retry) {
    screen2Id = retry.id;
    navScreenName = retry.name;
    fs.writeFileSync(SCREEN2_ID_FILE, screen2Id);
    return;
  }

  throw new Error("Unable to ensure navigation target screen exists.");
}

async function openPreview(page) {
  await page.getByRole("button", { name: /^Preview$/i }).click();
  await page.getByText("Runtime Preview").waitFor({ timeout: 10000 });
  return page.locator('[class*="dialog"]');
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("=== Phase 4.21 Acceptance Validation ===");

  const build = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@goapps/formula", "build"],
    { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" },
  );
  if (build.status !== 0) throw new Error("Failed to build @goapps/formula.");

  startFormulaApi();
  await waitForFormulaApi();
  await waitForMetadata();

  const stamp = Date.now();
  const testNames = new Set([
    `NavBtn_${stamp}`,
    `NavBtn2_${stamp}`,
    `BackBtn_${stamp}`,
    `SetBtn_${stamp}`,
    `CtxBtn_${stamp}`,
    `VarLbl_${stamp}`,
    `StatusLbl_${stamp}`,
    `GoBackBtn_${stamp}`,
  ]);

  await cleanupTestControls(testNames);

  const screensRes = await fetch(`${METADATA_API}/applications/${APP_ID}/screens`, {
    headers: { "X-Tenant-Id": TENANT },
  });
  const screensBody = await screensRes.json();
  const screen1 = (screensBody.data?.items ?? []).find((s) => s.id === SCREEN1_ID);
  if (screen1?.name) originalScreen1Name = screen1.name;
  await renameScreen(SCREEN1_ID, "Screen1");
  await ensureScreen2();

  await ensureScreen2();
  await cleanupNavTestControls();

  // Screen1 controls
  await createControlViaApi(SCREEN1_ID, `NavBtn_${stamp}`, "button", 100, 300, 180, 44, {
    text: { value: `NavS2_${stamp}` },
    onSelect: { formula: `Navigate(${navScreenName})` },
  });
  await createControlViaApi(SCREEN1_ID, `NavBtn2_${stamp}`, "button", 100, 360, 200, 44, {
    text: { value: `NavS2None_${stamp}` },
    onSelect: { formula: `Navigate(${navScreenName}, None)` },
  });
  await createControlViaApi(SCREEN1_ID, `SetBtn_${stamp}`, "button", 100, 420, 180, 44, {
    text: { value: `SetStat_${stamp}` },
    onSelect: { formula: 'Set(varStatus, "Approved")' },
  });
  await createControlViaApi(SCREEN1_ID, `CtxBtn_${stamp}`, "button", 100, 480, 180, 44, {
    text: { value: `SetCtx_${stamp}` },
    onSelect: { formula: 'UpdateContext({status: "Approved"})' },
  });
  await createControlViaApi(SCREEN1_ID, `BackBtn_${stamp}`, "button", 100, 540, 160, 44, {
    text: { value: `Back_${stamp}` },
    onSelect: { formula: "Back()" },
  });

  // Screen2 controls
  await createControlViaApi(screen2Id, `VarLbl_${stamp}`, "label", 100, 300, 220, 40, {
    text: { formula: "varStatus" },
  });
  await createControlViaApi(screen2Id, `StatusLbl_${stamp}`, "label", 100, 360, 220, 40, {
    text: { formula: "status" },
  });
  await createControlViaApi(screen2Id, `GoBackBtn_${stamp}`, "button", 100, 420, 180, 44, {
    text: { value: `NavS1_${stamp}` },
    onSelect: { formula: "Navigate(Screen1)" },
  });

  const btnNavS2 = `NavS2_${stamp}`;
  const btnNavS2None = `NavS2None_${stamp}`;
  const btnSetStat = `SetStat_${stamp}`;
  const btnSetCtx = `SetCtx_${stamp}`;
  const btnBack = `Back_${stamp}`;
  const btnNavS1 = `NavS1_${stamp}`;

  // Test 8: API regression
  const user = await postEvaluate("User.FullName");
  const app = await postEvaluate("App.Name");
  const textInput = await postEvaluate("TextInput1.Value");
  const upper = await postEvaluate("Upper(User.FullName)");
  record(
    "Test 8 — Existing functionality still works",
    user.ok && user.value === "Test User" &&
    app.ok && app.value === "Demo Application" &&
    textInput.ok && textInput.value === "Hello" &&
    upper.ok && upper.value === "TEST USER",
    JSON.stringify({ user, app, textInput, upper }),
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

    const dialog = await openPreview(page);
    await dialog.getByRole("heading", { name: "Screen1" }).waitFor({ timeout: 30000 });

    // Test 1
    await dialog.getByRole("button", { name: btnNavS2, exact: true }).click();
    await dialog.getByRole("heading", { name: navScreenName }).waitFor({ timeout: 10000 });
    record("Test 1 — Navigate(Screen2) renders Screen2", true, `${navScreenName} visible`);

    await dialog.getByRole("button", { name: btnNavS1, exact: true }).click();
    await dialog.getByRole("heading", { name: "Screen1" }).waitFor({ timeout: 10000 });
    await dialog.getByRole("button", { name: btnNavS2None, exact: true }).click();
    await dialog.getByRole("heading", { name: navScreenName }).waitFor({ timeout: 10000 });
    record("Test 2 — Navigate(Screen2, None) succeeds", true, `${navScreenName} visible`);

    await dialog.getByRole("button", { name: btnNavS1, exact: true }).click();
    await dialog.getByRole("heading", { name: "Screen1" }).waitFor({ timeout: 10000 });
    await dialog.getByRole("button", { name: btnSetStat, exact: true }).click();
    await dialog.getByRole("button", { name: btnNavS2, exact: true }).click();
    await dialog.getByText("Approved", { exact: true }).first().waitFor({ timeout: 10000 });
    record("Test 3 — Variables survive navigation", true, "varStatus = Approved on Screen2");

    await dialog.getByRole("button", { name: btnNavS1, exact: true }).click();
    await dialog.getByRole("heading", { name: "Screen1" }).waitFor({ timeout: 10000 });
    await dialog.getByRole("button", { name: btnSetCtx, exact: true }).click();
    await dialog.getByRole("button", { name: btnNavS2, exact: true }).click();
    await dialog.getByText("[Formula Error]").first().waitFor({ timeout: 10000 });
    record("Test 4 — Screen context cleared after navigation", true, "status no longer resolves");

    await dialog.getByRole("button", { name: btnNavS1, exact: true }).click();
    const errorsBefore = consoleErrors.length;
    await dialog.getByRole("button", { name: btnBack, exact: true }).click();
    await page.waitForTimeout(500);
    await dialog.getByRole("heading", { name: "Screen1" }).waitFor({ timeout: 5000 });
    record(
      "Test 5 — Back() returns action error without crash",
      consoleErrors.length === errorsBefore,
      "Preview still usable",
    );

    const errorsBeforeNav = consoleErrors.length;
    for (let i = 0; i < 3; i++) {
      await dialog.getByRole("button", { name: btnNavS2, exact: true }).click();
      await dialog.getByRole("heading", { name: navScreenName }).waitFor({ timeout: 5000 });
      await dialog.getByRole("button", { name: btnNavS1, exact: true }).click();
      await dialog.getByRole("heading", { name: "Screen1" }).waitFor({ timeout: 5000 });
    }
    record(
      "Test 6 — Repeated navigation without errors",
      consoleErrors.length === errorsBeforeNav,
      "Screen1 ↔ Screen2 x3",
    );

    // Test 7 — refresh restores initial screen
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    const dialog2 = await openPreview(page);
    await dialog2.getByRole("heading", { name: "Screen1" }).waitFor({ timeout: 30000 });
    record("Test 7 — Refresh restores initial screen", true, "Screen1 shown after reload");
  } finally {
    await browser.close();
    await stopStudioDev();
    await cleanupTestControls(testNames);
    await cleanupNavTestControls();
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
