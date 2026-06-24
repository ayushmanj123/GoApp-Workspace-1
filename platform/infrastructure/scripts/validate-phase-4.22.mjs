/**
 * Phase 4.22 acceptance validation — Screen OnVisible.
 * Run: node infrastructure/scripts/validate-phase-4.22.mjs
 */
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-4.22");
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

async function listControls(screenId) {
  const res = await fetch(`${METADATA_API}/screens/${screenId}/controls`, {
    headers: { "X-Tenant-Id": TENANT },
  });
  const body = await res.json();
  return body.data?.items ?? [];
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

async function setScreenOnVisible(screenId, formula) {
  const res = await fetch(`${METADATA_API}/screens/${screenId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Tenant-Id": TENANT },
    body: JSON.stringify({ on_visible: formula }),
  });
  if (!res.ok) throw new Error(`setScreenOnVisible failed: ${res.status}`);
}

async function clearScreenOnVisible(screenId) {
  // Set to empty string — TypeScript side treats empty as falsy, so formula won't run.
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
      return;
    }
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
  log("=== Phase 4.22 Acceptance Validation ===");

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
    `OvTitleLbl_${stamp}`,
    `OvNavBtn_${stamp}`,
    `OvSetBtn_${stamp}`,
    `OvGoBack_${stamp}`,
    `OvWelcomeLbl_${stamp}`,
    `OvStatusLbl_${stamp}`,
    `OvModBtn_${stamp}`,
  ]);

  await cleanupTestControls(testNames);

  // Ensure Screen1 is named "Screen1"
  const screens = await listScreens();
  const screen1 = screens.find((s) => s.id === SCREEN1_ID);
  const originalScreen1Name = screen1?.name ?? "Screen1";
  await renameScreen(SCREEN1_ID, "Screen1");

  // Screen1 controls
  const titleLbl = await createControlViaApi(SCREEN1_ID, `OvTitleLbl_${stamp}`, "label", 100, 100, 300, 40, {
    text: { formula: "varTitle" },
  });
  await createControlViaApi(SCREEN1_ID, `OvNavBtn_${stamp}`, "button", 100, 160, 180, 44, {
    text: { value: `OvGoS2_${stamp}` },
    onSelect: { formula: `Navigate(${navScreenName})` },
  });
  await createControlViaApi(SCREEN1_ID, `OvSetBtn_${stamp}`, "button", 100, 220, 200, 44, {
    text: { value: `OvSetOther_${stamp}` },
    onSelect: { formula: 'Set(varTitle, "Other")' },
  });

  // Screen2 controls
  await createControlViaApi(screen2Id, `OvWelcomeLbl_${stamp}`, "label", 100, 100, 300, 40, {
    text: { formula: "varTitle" },
  });
  await createControlViaApi(screen2Id, `OvStatusLbl_${stamp}`, "label", 100, 160, 300, 40, {
    text: { formula: "status" },
  });
  await createControlViaApi(screen2Id, `OvGoBack_${stamp}`, "button", 100, 220, 180, 44, {
    text: { value: `OvGoS1_${stamp}` },
    onSelect: { formula: "Navigate(Screen1)" },
  });
  await createControlViaApi(screen2Id, `OvModBtn_${stamp}`, "button", 100, 280, 200, 44, {
    text: { value: `OvModTitle_${stamp}` },
    onSelect: { formula: 'Set(varTitle, "Modified")' },
  });

  const btnGoS2 = `OvGoS2_${stamp}`;
  const btnSetOther = `OvSetOther_${stamp}`;
  const btnGoS1 = `OvGoS1_${stamp}`;
  const btnModTitle = `OvModTitle_${stamp}`;

  // Test 7: Regression — Set/UpdateContext/Navigate/User/App/functions still work
  const user = await postEvaluate("User.FullName");
  const app = await postEvaluate("App.Name");
  const textInput = await postEvaluate("TextInput1.Value");
  const upper = await postEvaluate("Upper(User.FullName)");
  record(
    "Test 7 — Existing functionality still works",
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
    // --- Test 1: Initial screen OnVisible executes ---
    await setScreenOnVisible(SCREEN1_ID, 'Set(varTitle, "Home")');
    await page.goto(STUDIO_URL, { waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    const dialog1 = await openPreview(page);
    await dialog1.getByRole("heading", { name: "Screen1" }).waitFor({ timeout: 30000 });
    await page.waitForTimeout(1500); // allow OnVisible to execute
    const titleText1 = await dialog1.locator(`text=Home`).first().isVisible().catch(() => false);
    record("Test 1 — Initial screen OnVisible executes", titleText1, `varTitle = Home visible: ${titleText1}`);

    // --- Test 2: Screen2 OnVisible Set(varTitle, "Welcome") ---
    await clearScreenOnVisible(SCREEN1_ID);
    await setScreenOnVisible(screen2Id, 'Set(varTitle, "Welcome")');
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    const dialog2 = await openPreview(page);
    await dialog2.getByRole("heading", { name: "Screen1" }).waitFor({ timeout: 30000 });
    await dialog2.getByRole("button", { name: btnGoS2, exact: true }).click();
    await dialog2.getByRole("heading", { name: navScreenName }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(1000);
    const welcomeVisible = await dialog2.locator("text=Welcome").first().isVisible().catch(() => false);
    record("Test 2 — Screen2 OnVisible Set(varTitle, Welcome)", welcomeVisible, `Welcome visible: ${welcomeVisible}`);

    // --- Test 3: Screen2 OnVisible UpdateContext ---
    // Update on_visible and reload to pick up fresh pkg from the API.
    await setScreenOnVisible(screen2Id, 'UpdateContext({status: "Loaded"})');
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    const dialog3 = await openPreview(page);
    await dialog3.getByRole("heading", { name: "Screen1" }).waitFor({ timeout: 30000 });
    await dialog3.getByRole("button", { name: btnGoS2, exact: true }).click();
    await dialog3.getByRole("heading", { name: navScreenName }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(1000);
    const loadedVisible = await dialog3.locator("text=Loaded").first().isVisible().catch(() => false);
    record("Test 3 — Screen2 OnVisible UpdateContext", loadedVisible, `Loaded visible: ${loadedVisible}`);

    // --- Test 4: OnVisible fires on each navigation to Screen2 ---
    // Update on_visible and reload so pkg is fresh.
    await setScreenOnVisible(screen2Id, 'Set(varTitle, "Welcome")');
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    const dialog4 = await openPreview(page);
    await dialog4.getByRole("heading", { name: "Screen1" }).waitFor({ timeout: 30000 });
    // Set varTitle to something else on Screen1
    await dialog4.getByRole("button", { name: btnSetOther, exact: true }).click();
    await page.waitForTimeout(300);
    // Navigate to S2 → OnVisible fires, sets Welcome
    await dialog4.getByRole("button", { name: btnGoS2, exact: true }).click();
    await dialog4.getByRole("heading", { name: navScreenName }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(1000);
    const welcome4a = await dialog4.locator("text=Welcome").first().isVisible().catch(() => false);
    // Navigate back, set Other again, navigate again
    await dialog4.getByRole("button", { name: btnGoS1, exact: true }).click();
    await dialog4.getByRole("heading", { name: "Screen1" }).waitFor({ timeout: 10000 });
    await dialog4.getByRole("button", { name: btnSetOther, exact: true }).click();
    await page.waitForTimeout(300);
    await dialog4.getByRole("button", { name: btnGoS2, exact: true }).click();
    await dialog4.getByRole("heading", { name: navScreenName }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(1000);
    const welcome4b = await dialog4.locator("text=Welcome").first().isVisible().catch(() => false);
    record("Test 4 — OnVisible fires on each navigation", welcome4a && welcome4b, `S1→S2 round 1: ${welcome4a}, round 2: ${welcome4b}`);

    // --- Test 5: Variable changes alone do not re-trigger OnVisible ---
    // Still on Screen2 with on_visible = Set(varTitle, "Welcome").
    // Click Modify button → Set(varTitle, "Modified").
    // If OnVisible re-triggered, varTitle would reset to Welcome.
    const errsBefore5 = consoleErrors.length;
    await dialog4.getByRole("button", { name: btnModTitle, exact: true }).click();
    await page.waitForTimeout(500);
    const modifiedVisible = await dialog4.locator("text=Modified").first().isVisible().catch(() => false);
    record(
      "Test 5 — Variable changes do not re-trigger OnVisible",
      modifiedVisible && consoleErrors.length === errsBefore5,
      `Modified visible (no re-trigger): ${modifiedVisible}`,
    );

    // --- Test 6: Invalid OnVisible formula — no crash ---
    // Reload with a broken on_visible, then navigate to Screen2.
    await setScreenOnVisible(screen2Id, "Set("); // intentionally broken
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    const dialog6 = await openPreview(page);
    await dialog6.getByRole("heading", { name: "Screen1" }).waitFor({ timeout: 30000 });
    const errsBefore6 = consoleErrors.length;
    await dialog6.getByRole("button", { name: btnGoS2, exact: true }).click();
    await dialog6.getByRole("heading", { name: navScreenName }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(500);
    const headingStillVisible = await dialog6.getByRole("heading", { name: navScreenName }).isVisible().catch(() => false);
    record(
      "Test 6 — Invalid OnVisible formula — no crash",
      headingStillVisible,
      `Screen still visible after bad formula: ${headingStillVisible}`,
    );
    await clearScreenOnVisible(screen2Id);

    // --- Test 8: Refresh restores initial screen and runs its OnVisible ---
    await setScreenOnVisible(SCREEN1_ID, 'Set(varTitle, "Home")');
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    const dialog8 = await openPreview(page);
    await dialog8.getByRole("heading", { name: "Screen1" }).waitFor({ timeout: 30000 });
    await page.waitForTimeout(1500);
    const homeAfterRefresh = await dialog8.locator("text=Home").first().isVisible().catch(() => false);
    record("Test 8 — Refresh: initial screen OnVisible re-executes", homeAfterRefresh, `Home visible after refresh: ${homeAfterRefresh}`);

  } finally {
    await browser.close();
    await stopStudioDev();
    await cleanupTestControls(testNames);
    await clearScreenOnVisible(SCREEN1_ID);
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
