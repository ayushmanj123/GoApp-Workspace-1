/**
 * Phase 4.19 acceptance validation — Button OnSelect Execution.
 * Run: node infrastructure/scripts/validate-phase-4.19.mjs
 */
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-4.19");
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

async function openPreview(page) {
  await page.getByRole("button", { name: /^Preview$/i }).click();
  await page.getByText("Runtime Preview").waitFor({ timeout: 10000 });
  return page.locator('[class*="dialog"]');
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("=== Phase 4.19 Acceptance Validation ===");

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
    `Lbl1_${stamp}`,
    `Btn1_${stamp}`,
    `Lbl2_${stamp}`,
    `Btn2_${stamp}`,
    `Lbl3_${stamp}`,
    `Btn3_${stamp}`,
    `BtnNav_${stamp}`,
    `LblNav_${stamp}`,
    `BtnMulti_${stamp}`,
    `LblMulti_${stamp}`,
  ]);

  await cleanupTestControls(testNames);

  // Test 1: Set(varTitle) on click
  await createControlViaApi(`Lbl1_${stamp}`, "label", 100, 300, 220, 40, {
    text: { formula: "varTitle" },
  });
  await createControlViaApi(`Btn1_${stamp}`, "button", 100, 360, 160, 44, {
    text: { value: "Approve" },
    onSelect: { formula: 'Set(varTitle, "Approved")' },
  });

  // Test 2: Set(varCount, 25)
  await createControlViaApi(`Lbl2_${stamp}`, "label", 100, 420, 220, 40, {
    text: { formula: "varCount" },
  });
  await createControlViaApi(`Btn2_${stamp}`, "button", 100, 480, 160, 44, {
    text: { value: "Set Count" },
    onSelect: { formula: "Set(varCount, 25)" },
  });

  // Test 3: Set(varNew, "Created")
  await createControlViaApi(`Lbl3_${stamp}`, "label", 100, 540, 220, 40, {
    text: { formula: "varNew" },
  });
  await createControlViaApi(`Btn3_${stamp}`, "button", 100, 600, 160, 44, {
    text: { value: "Create Var" },
    onSelect: { formula: 'Set(varNew, "Created")' },
  });

  // Test 4: Navigate unsupported
  await createControlViaApi(`LblNav_${stamp}`, "label", 350, 300, 220, 40, {
    text: { formula: "varTitle" },
  });
  await createControlViaApi(`BtnNav_${stamp}`, "button", 350, 360, 160, 44, {
    text: { value: "Navigate" },
    onSelect: { formula: "Navigate(Screen2)" },
  });

  // Test 7: Multiple clicks
  await createControlViaApi(`LblMulti_${stamp}`, "label", 350, 420, 220, 40, {
    text: { formula: "varCount" },
  });
  await createControlViaApi(`BtnMulti_${stamp}`, "button", 350, 480, 160, 44, {
    text: { value: "Bump Count" },
    onSelect: { formula: "Set(varCount, 25)" },
  });

  // Test 5: API regression
  const user = await postEvaluate("User.FullName");
  const app = await postEvaluate("App.Name");
  const textInput = await postEvaluate("TextInput1.Value");
  record(
    "Test 5 — Existing formulas still work",
    user.ok && user.value === "Test User" &&
    app.ok && app.value === "Demo Application" &&
    textInput.ok && textInput.value === "Hello",
    JSON.stringify({ user, app, textInput }),
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

    // Test 1
    await dialog.getByText("Hello World", { exact: true }).first().waitFor({ timeout: 30000 });
    await dialog.getByRole("button", { name: "Approve", exact: true }).click();
    await dialog.getByText("Approved", { exact: true }).first().waitFor({ timeout: 10000 });
    record("Test 1 — Button click updates varTitle label", true, "Hello World → Approved");

    // Test 2
    await dialog.getByText("10", { exact: true }).first().waitFor({ timeout: 10000 });
    await dialog.getByRole("button", { name: "Set Count", exact: true }).click();
    await dialog.getByText("25", { exact: true }).first().waitFor({ timeout: 10000 });
    record("Test 2 — Button click sets varCount to 25", true, "10 → 25");

    // Test 3
    await dialog.getByRole("button", { name: "Create Var", exact: true }).click();
    await dialog.getByText("Created", { exact: true }).first().waitFor({ timeout: 10000 });
    record("Test 3 — Button click creates varNew dynamically", true, "Created visible");

    // Test 4 — unsupported action must not crash the preview
    const errorsBefore = consoleErrors.length;
    await dialog.getByRole("button", { name: "Navigate", exact: true }).click();
    await page.waitForTimeout(500);
    // varTitle was already changed to Approved by Test 1; verify preview is still alive
    await dialog.getByText("Approved", { exact: true }).first().waitFor({ timeout: 5000 });
    const noCrash = consoleErrors.length === errorsBefore;
    record(
      "Test 4 — Navigate action errors without crash",
      noCrash,
      noCrash ? "Preview still usable after unsupported action" : `Page errors: ${consoleErrors.join("; ")}`,
    );

    // Test 7 — multiple clicks
    const errorsBeforeMulti = consoleErrors.length;
    const multiBtn = dialog.getByRole("button", { name: "Bump Count", exact: true });
    await multiBtn.click();
    await multiBtn.click();
    await multiBtn.click();
    await dialog.getByText("25", { exact: true }).first().waitFor({ timeout: 5000 });
    const noMultiErrors = consoleErrors.length === errorsBeforeMulti;
    record(
      "Test 7 — Multiple clicks without errors",
      noMultiErrors,
      noMultiErrors ? "3 clicks, varCount stays 25" : `Errors: ${consoleErrors.slice(errorsBeforeMulti).join("; ")}`,
    );

    // Test 6 — reload resets defaults, click still works
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    const dialog2 = await openPreview(page);
    await dialog2.getByText("Hello World", { exact: true }).first().waitFor({ timeout: 30000 });
    await dialog2.getByRole("button", { name: "Approve", exact: true }).click();
    await dialog2.getByText("Approved", { exact: true }).first().waitFor({ timeout: 10000 });
    record("Test 6 — Refresh + preview, button action still works", true, "Defaults restored, click updates label");
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
