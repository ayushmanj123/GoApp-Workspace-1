/**
 * Phase 4.17 acceptance validation — Writable Variables (Set).
 * Run: node infrastructure/scripts/validate-phase-4.17.mjs
 */
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-4.17");
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

/**
 * Simulate Set() locally: evaluate the value expression against the given
 * context, then return an updated context with the new variable value.
 * This mirrors what executeSet + InMemoryVariableStore do at runtime.
 */
async function simulateSet(varName, valueExpr, context) {
  const result = await postEvaluate(valueExpr, context);
  if (!result.ok) throw new Error(`Value evaluation failed: ${result.error}`);
  return { ...context, [varName]: result.value };
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

async function waitForPreviewText(dialog, text, timeout = 30000) {
  await dialog.getByText(text, { exact: true }).first().waitFor({ timeout });
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("=== Phase 4.17 Acceptance Validation ===");

  const build = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@goapps/formula", "build"],
    { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" },
  );
  if (build.status !== 0) throw new Error("Failed to build @goapps/formula.");

  startFormulaApi();
  await waitForFormulaApi();

  // ── Test 1: initial varTitle read ─────────────────────────────────────────
  const t1 = await postEvaluate("varTitle");
  record("Test 1 — varTitle initial read", t1.ok && t1.value === "Hello World", JSON.stringify(t1));

  // ── Test 2: Set(varTitle, "Approved") then re-read ───────────────────────
  const ctx2 = await simulateSet("varTitle", '"Approved"', DEFAULT_CONTEXT);
  const t2 = await postEvaluate("varTitle", ctx2);
  record("Test 2 — Set(varTitle) then read", t2.ok && t2.value === "Approved", JSON.stringify(t2));

  // ── Test 3: Set(varCount, 25) then re-read ───────────────────────────────
  const ctx3 = await simulateSet("varCount", "25", DEFAULT_CONTEXT);
  const t3 = await postEvaluate("varCount", ctx3);
  record("Test 3 — Set(varCount, 25) then read", t3.ok && t3.value === 25, JSON.stringify(t3));

  // ── Test 4: Set creates new variable ────────────────────────────────────
  const ctx4 = await simulateSet("varNew", '"Created"', DEFAULT_CONTEXT);
  const t4 = await postEvaluate("varNew", ctx4);
  record("Test 4 — Set(varNew) creates dynamic variable", t4.ok && t4.value === "Created", JSON.stringify(t4));

  // ── Test 6: Existing formulas regression ─────────────────────────────────
  const user = await postEvaluate("User.FullName");
  const app = await postEvaluate("App.Name");
  const textInput = await postEvaluate("TextInput1.Value");
  record(
    "Test 6 — Existing formulas still work",
    user.ok && user.value === "Test User" &&
    app.ok && app.value === "Demo Application" &&
    textInput.ok && textInput.value === "Hello",
    JSON.stringify({ user, app, textInput }),
  );

  // ── Browser tests (Test 5 + Test 7) ─────────────────────────────────────
  await waitForMetadata();
  await ensureStudio();

  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    browser = await chromium.launch({ channel: "msedge", headless: true });
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const stamp = Date.now();
  const labelName = `SetLabel_${stamp}`;
  const testNames = new Set([labelName]);

  try {
    await cleanupTestControls(testNames);
    await createControlViaApi(labelName, "label", 100, 400, 220, 40, {
      text: { formula: "varTitle" },
    });

    await page.goto(STUDIO_URL, { waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });

    // Open preview
    await page.getByRole("button", { name: /^Preview$/i }).click();
    await page.getByText("Runtime Preview").waitFor({ timeout: 10000 });
    const dialog = page.locator('[class*="dialog"]');

    // Initial state: label shows default value
    await waitForPreviewText(dialog, "Hello World");

    // ── Test 5: store.set() triggers reactive update ──────────────────────
    await page.evaluate(() => {
      const store = window.__variableStore;
      if (!store) throw new Error("__variableStore not exposed on window");
      store.set("varTitle", "Approved");
    });
    await waitForPreviewText(dialog, "Approved");
    record("Test 5 — store.set() triggers reactive UI update", true, "Label updated to Approved without reload");

    // ── Test 7: Refresh resets variables to defaults ──────────────────────
    // Close the preview dialog and reload the page
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });

    await page.getByRole("button", { name: /^Preview$/i }).click();
    await page.getByText("Runtime Preview").waitFor({ timeout: 10000 });
    const dialog2 = page.locator('[class*="dialog"]');
    await waitForPreviewText(dialog2, "Hello World");
    record("Test 7 — Refresh resets variables to defaults", true, "Hello World shown after reload");
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
