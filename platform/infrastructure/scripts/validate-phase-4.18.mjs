/**
 * Phase 4.18 acceptance validation — Action / Event Foundation.
 * Run: node infrastructure/scripts/validate-phase-4.18.mjs
 */
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-4.18");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const FORMULA_API = "http://localhost:8085";
const METADATA_API = "http://localhost:8082/api/v1";
const STUDIO_BASE = "http://localhost:5173";

const TENANT = "00000000-0000-4000-8000-000000000001";
const APP_ID = "00000000-0000-4000-8000-000000000003";
const SCREEN_ID = "00000000-0000-4000-8000-000000000004";
const STUDIO_URL = `http://localhost:5173/studio/apps/${APP_ID}/screens/${SCREEN_ID}`;

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
      const res = await fetch(`${METADATA_API}/screens/${SCREEN_ID}/controls`, {
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

async function listControls() {
  const res = await fetch(`${METADATA_API}/screens/${SCREEN_ID}/controls`, {
    headers: { "X-Tenant-Id": TENANT },
  });
  return (await res.json()).data.items;
}

async function cleanupTestControls(names) {
  const items = await listControls();
  for (const c of items) {
    if (names.has(c.name)) {
      await fetch(`${METADATA_API}/controls/${c.id}`, {
        method: "DELETE",
        headers: { "X-Tenant-Id": TENANT },
      });
    }
  }
}

async function createControlViaApi(name, controlType, x, y, width, height, properties) {
  const res = await fetch(`${METADATA_API}/screens/${SCREEN_ID}/controls`, {
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

async function getControlProperties(controlId) {
  const res = await fetch(`${METADATA_API}/controls/${controlId}/properties`, {
    headers: { "X-Tenant-Id": TENANT },
  });
  return (await res.json()).data;
}

async function addControlViaToolbox(page, toolboxLabel, controlName) {
  await page.getByRole("button", { name: toolboxLabel }).click();
  await page.getByText("Unsaved changes").waitFor({ timeout: 15000 });
  const expandProperties = page.getByTitle("Expand Properties");
  if (await expandProperties.isVisible().catch(() => false)) {
    await expandProperties.click();
  }
  await page.getByText("Properties", { exact: true }).waitFor({ timeout: 15000 });
  const nameField = page.getByRole("textbox", { name: "Name", exact: true });
  await nameField.waitFor({ timeout: 20000 });
  await nameField.fill(controlName);
  await page.locator('[class*="controlName"]').filter({ hasText: controlName }).waitFor({ timeout: 10000 });
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("=== Phase 4.18 Acceptance Validation ===");

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
  const btnName = `ActionBtn_${stamp}`;
  const lblName = `ActionLbl_${stamp}`;
  const testNames = new Set([btnName, lblName]);
  const ON_SELECT_FORMULA = `Set(varTitle, "Approved")`;

  await cleanupTestControls(testNames);

  // ── Test 1: Button with onSelect formula saves correctly ─────────────────
  const btn = await createControlViaApi(btnName, "button", 100, 500, 160, 44, {
    text: { value: "Save" },
    onSelect: { formula: ON_SELECT_FORMULA },
  });

  const savedProps = await getControlProperties(btn.id);
  const savedFormula = savedProps?.onSelect?.formula ?? null;
  record(
    "Test 1 — onSelect formula saves via PUT properties",
    savedFormula === ON_SELECT_FORMULA,
    JSON.stringify({ savedFormula }),
  );

  // ── Test 3: Reload from API restores the formula ──────────────────────────
  const reloadedProps = await getControlProperties(btn.id);
  const reloadedFormula = reloadedProps?.onSelect?.formula ?? null;
  record(
    "Test 3 — onSelect formula reloads from API unchanged",
    reloadedFormula === ON_SELECT_FORMULA,
    JSON.stringify({ reloadedFormula }),
  );

  // ── Test 6: Existing text formulas still work ─────────────────────────────
  const user = await postEvaluate("User.FullName");
  const app = await postEvaluate("App.Name");
  const textInput = await postEvaluate("TextInput1.Value");
  const varTitle = await postEvaluate("varTitle");
  record(
    "Test 6 — Existing formulas still work",
    user.ok && user.value === "Test User" &&
    app.ok && app.value === "Demo Application" &&
    textInput.ok && textInput.value === "Hello" &&
    varTitle.ok && varTitle.value === "Hello World",
    JSON.stringify({ user, app, textInput, varTitle }),
  );

  // ── Browser tests ─────────────────────────────────────────────────────────
  await ensureStudio();

  // Create a label that displays varTitle so we can see reactive updates
  await createControlViaApi(lblName, "label", 100, 400, 220, 40, {
    text: { formula: "varTitle" },
  });

  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    browser = await chromium.launch({ channel: "msedge", headless: true });
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto(STUDIO_URL, { waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });

    // ── Test 2: OnSelect property row is visible for Button controls ─────────
    // Add a button via toolbox — it auto-selects and shows the property panel.
    const toolboxBtnName = `ToolboxBtn_${stamp}`;
    testNames.add(toolboxBtnName);
    await addControlViaToolbox(page, "Add Button", toolboxBtnName);
    const onSelectEditor = page.getByTestId("onSelect-open-formula-editor");
    const onSelectVisible = await onSelectEditor.isVisible().catch(() => false);
    record(
      "Test 2 — OnSelect property row appears for Button in Studio",
      onSelectVisible,
      onSelectVisible ? "onSelect-open-formula-editor visible" : "NOT visible",
    );

    // ── Test 4 + 5: executeAction via window.__executeAction ─────────────────
    await page.getByRole("button", { name: /^Preview$/i }).click();
    await page.getByText("Runtime Preview").waitFor({ timeout: 10000 });
    const dialog = page.locator('[class*="dialog"]');
    await dialog.getByText("Hello World").first().waitFor({ timeout: 30000 });

    // Test 4: executeAction delegates Set() to executeSet, updates the store
    const t4 = await page.evaluate(async () => {
      const fn = window.__executeAction;
      if (!fn) return { ok: false, error: "__executeAction not exposed" };
      return fn(`Set(varTitle, "Approved")`);
    });
    record(
      "Test 4 — executeAction(Set(...)) updates variable",
      t4?.ok === true,
      JSON.stringify(t4),
    );

    // Verify reactive update happened in the UI
    await dialog.getByText("Approved", { exact: true }).first().waitFor({ timeout: 10000 });

    // Test 5: unsupported action returns error, no crash
    const t5 = await page.evaluate(async () => {
      const fn = window.__executeAction;
      if (!fn) return { ok: false, error: "__executeAction not exposed" };
      return fn("Navigate(Screen2)");
    });
    record(
      "Test 5 — executeAction(Navigate(...)) returns action error, no crash",
      t5?.ok === false && typeof t5?.error === "string" && t5.error.includes("[Action Error]"),
      JSON.stringify(t5),
    );

    // ── Test 7: Reload, no regressions ────────────────────────────────────────
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await page.getByRole("button", { name: /^Preview$/i }).click();
    await page.getByText("Runtime Preview").waitFor({ timeout: 10000 });
    const dialog2 = page.locator('[class*="dialog"]');
    await dialog2.getByText("Hello World").first().waitFor({ timeout: 30000 });
    record("Test 7 — Refresh + preview, no regressions", true, "Hello World visible after reload");
  } finally {
    await browser.close();
    await stopStudioDev();
    await cleanupTestControls(testNames);
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
