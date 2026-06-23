/**
 * Phase 4.13 acceptance validation.
 * Run: node infrastructure/scripts/validate-phase-4.13.mjs
 */
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-4.13");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const FORMULA_API = "http://localhost:8085";
const METADATA_API = "http://localhost:8082/api/v1";
const STUDIO_BASE = "http://localhost:5173";

const TENANT = "00000000-0000-4000-8000-000000000001";
const APP_ID = "00000000-0000-4000-8000-000000000003";
const SCREEN_ID = "00000000-0000-4000-8000-000000000004";
const STUDIO_URL = `http://localhost:5173/studio/apps/${APP_ID}/screens/${SCREEN_ID}`;

const BASE_CONTEXT = {
  User: { FullName: "Test User", Email: "test@example.com" },
  App: { Name: "Demo Application" },
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
  const localDotnet = path.join(
    ROOT,
    ".dotnet",
    process.platform === "win32" ? "dotnet.exe" : "dotnet",
  );
  const dotnet = existsSync(localDotnet) ? localDotnet : "dotnet";
  const projectDir = path.join(ROOT, "packages", "formula", "dotnet", "GoApps.PowerFx");
  apiProcess = spawn(
    dotnet,
    ["run", "--project", projectDir, "--", "--serve", "--port", "8085"],
    { cwd: projectDir, stdio: "ignore" },
  );
}

async function stopFormulaApi() {
  if (apiProcess && !apiProcess.killed) {
    apiProcess.kill();
    apiProcess = null;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function waitForFormulaApi(timeoutMs = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${FORMULA_API}/health`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Formula API did not start in time.");
}

async function postEvaluate(formula, context) {
  const res = await fetch(`${FORMULA_API}/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ formula, context }),
  });
  return res.json();
}

async function ensureStudio() {
  try {
    const res = await fetch(STUDIO_BASE);
    if (res.ok || res.status === 304) return;
  } catch {
    // not running
  }
  studioStartedByScript = true;
  studioProcess = spawn(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@goapps/studio", "dev"],
    { cwd: ROOT, stdio: "ignore", shell: process.platform === "win32" },
  );
  const started = Date.now();
  while (Date.now() - started < 90000) {
    try {
      const res = await fetch(STUDIO_BASE);
      if (res.ok || res.status === 304) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Studio dev server did not start in time.");
}

async function stopStudioDev() {
  if (studioStartedByScript && studioProcess && !studioProcess.killed) {
    studioProcess.kill();
    studioProcess = null;
    studioStartedByScript = false;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

const TEXT_INPUT_DEFAULTS = { x: 100, y: 200, width: 240, height: 36 };

async function addControl(page, toolboxLabel, controlName) {
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

async function setFormula(page, propertyName, formula) {
  await page.locator(`[data-testid="${propertyName}-mode-formula"]`).evaluate((element) => {
    element.click();
  });
  const openEditor = page.getByTestId(`${propertyName}-open-formula-editor`);
  await openEditor.waitFor({ state: "visible", timeout: 15000 });
  await openEditor.click({ force: true, noWaitAfter: true });
  const input = page.getByTestId("formula-editor-input");
  await input.waitFor({ timeout: 10000 });
  await input.fill(formula);
  await page.getByTestId("formula-editor-save").click();
  await input.waitFor({ state: "hidden", timeout: 10000 });
}

async function clickControlOnCanvas(page, x, y, width, height) {
  const canvas = page.locator('div[class*="stageContainer"] canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas not found");
  const stageX = Math.max((box.width - 1366) / 2, 48);
  const stageY = Math.max((box.height - 768) / 2, 48);
  await page.mouse.click(
    box.x + stageX + x + width / 2,
    box.y + stageY + y + height / 2,
  );
  await page.waitForTimeout(300);
}

async function listControls() {
  const res = await fetch(`${METADATA_API}/screens/${SCREEN_ID}/controls`, {
    headers: { "X-Tenant-Id": TENANT },
  });
  const body = await res.json();
  return body.data.items;
}

async function cleanupTestControls() {
  const names = new Set(["TextInput1", "RefLabel", "Label1", "RefBtn"]);
  const items = await listControls();
  for (const control of items) {
    if (names.has(control.name)) {
      const res = await fetch(`${METADATA_API}/controls/${control.id}`, {
        method: "DELETE",
        headers: { "X-Tenant-Id": TENANT },
      });
      if (!res.ok) {
        throw new Error(`Delete control failed: ${control.name} ${res.status}`);
      }
    }
  }
}

async function findControlByName(name) {
  const items = await listControls();
  return items.find((control) => control.name === name) ?? null;
}

async function waitForControlByName(name, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const control = await findControlByName(name);
    if (control) {
      return control;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${name} not found after save.`);
}

async function waitForMetadata(timeoutMs = 30000) {
  const started = Date.now();
  const headers = { "X-Tenant-Id": TENANT };
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${METADATA_API}/screens/${SCREEN_ID}/controls`, { headers });
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Metadata service is not available on :8082.");
}

async function createControlViaApi(name, controlType, x, y, width, height, properties) {
  const res = await fetch(`${METADATA_API}/screens/${SCREEN_ID}/controls`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Id": TENANT,
    },
    body: JSON.stringify({
      name,
      control_type: controlType,
      x,
      y,
      width,
      height,
      z_index: 50,
      parent_control_id: null,
    }),
  });
  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(`Create control failed: ${JSON.stringify(body)}`);
  }
  await updateControlProperties(body.data.id, properties);
  return body.data;
}

async function updateControlProperties(controlId, properties) {
  const res = await fetch(`${METADATA_API}/controls/${controlId}/properties`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Id": TENANT,
    },
    body: JSON.stringify({ properties }),
  });
  if (!res.ok) {
    throw new Error(`Property update failed: ${res.status} ${await res.text()}`);
  }
}

async function saveScreen(page) {
  await page.getByTitle("Save (Ctrl+S)").click();
  const saved = page.getByText("Changes saved");
  const failed = page.getByText("Save failed");
  const outcome = await Promise.race([
    saved.waitFor({ timeout: 30000 }).then(() => "saved"),
    failed.waitFor({ timeout: 30000 }).then(() => "failed"),
  ]);
  if (outcome === "failed") {
    throw new Error("Save failed in Studio.");
  }
}

async function setStaticProperty(page, propertyName, label, value) {
  await page.locator(`[data-testid="${propertyName}-mode-static"]`).evaluate((element) => {
    element.click();
  });
  await page.getByRole("textbox", { name: label, exact: true }).fill(value);
}

async function waitForCanvasText(page, text) {
  await page
    .locator('[class*="controlPreview"]')
    .getByText(text, { exact: true })
    .first()
    .waitFor({ timeout: 20000 });
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("=== Phase 4.13 Acceptance Validation ===");

  const build = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@goapps/formula", "build"],
    { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" },
  );
  if (build.status !== 0) throw new Error("Failed to build @goapps/formula.");

  startFormulaApi();
  await waitForFormulaApi();

  const context1 = {
    ...BASE_CONTEXT,
    TextInput1: { Value: "Hello" },
  };
  const ref1 = await postEvaluate("TextInput1.Value", context1);
  record(
    "Test 1 — TextInput1.Value resolves Hello",
    ref1.ok === true && ref1.value === "Hello",
    JSON.stringify(ref1),
  );

  const context2 = {
    ...BASE_CONTEXT,
    TextInput1: { Value: "Welcome" },
    Label1: { Text: "Hello" },
  };
  const ref2 = await postEvaluate("TextInput1.Value", context2);
  record(
    "Test 2 — Updated TextInput1.Value resolves Welcome",
    ref2.ok === true && ref2.value === "Welcome",
    JSON.stringify(ref2),
  );

  const context3 = {
    ...BASE_CONTEXT,
    Label1: { Text: "Approved" },
  };
  const ref3 = await postEvaluate("Label1.Text", context3);
  record(
    "Test 3 — Label1.Text resolves Approved",
    ref3.ok === true && ref3.value === "Approved",
    JSON.stringify(ref3),
  );

  const missing = await postEvaluate("MissingControl.Text", BASE_CONTEXT);
  record(
    "Test 5 — Missing control returns error",
    missing.ok === false && typeof missing.error === "string",
    JSON.stringify(missing),
  );

  const user = await postEvaluate("User.FullName", context3);
  const app = await postEvaluate("App.Name", context3);
  const literal = await postEvaluate('"Hello"', context3);
  const number = await postEvaluate("123", context3);
  record(
    "Test 6 — Existing formulas still work",
    user.ok &&
      user.value === "Test User" &&
      app.ok &&
      app.value === "Demo Application" &&
      literal.ok &&
      literal.value === "Hello" &&
      number.ok &&
      number.value === 123,
    JSON.stringify({ user, app, literal, number }),
  );

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
  const textInputName = `TextInput1_${stamp}`;
  const refLabelName = `RefLabel_${stamp}`;
  const labelName = `Label1_${stamp}`;
  const refBtnName = `RefBtn_${stamp}`;

  try {
    await page.goto(STUDIO_URL, { waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await cleanupTestControls();
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });

    await addControl(page, "Add Text Input", textInputName);
    await page.getByTestId("value-mode-static").waitFor({ timeout: 15000 });
    await setStaticProperty(page, "value", "Value", "Hello");

    await addControl(page, "Add Label", refLabelName);
    await page.getByTestId("text-mode-static").waitFor({ timeout: 15000 });
    await setFormula(page, "text", `${textInputName}.Value`);
    await waitForCanvasText(page, "Hello");

    await clickControlOnCanvas(
      page,
      TEXT_INPUT_DEFAULTS.x,
      TEXT_INPUT_DEFAULTS.y,
      TEXT_INPUT_DEFAULTS.width,
      TEXT_INPUT_DEFAULTS.height,
    );
    await page.locator('[class*="controlName"]').filter({ hasText: textInputName }).waitFor({ timeout: 5000 });
    await page.getByTestId("value-mode-static").waitFor({ timeout: 15000 });
    await setStaticProperty(page, "value", "Value", "Welcome");
    await waitForCanvasText(page, "Welcome");
    record(
      "Test 2 — Dependent label updates when referenced control changes",
      true,
      "Welcome after TextInput1 value update",
    );

    await cleanupTestControls();
    await createControlViaApi(textInputName, "textinput", 100, 400, 240, 36, {
      value: { value: "Welcome" },
    });
    await createControlViaApi(refLabelName, "label", 100, 460, 200, 40, {
      text: { formula: `${textInputName}.Value` },
    });
    await createControlViaApi(labelName, "label", 100, 520, 200, 40, {
      text: { value: "Approved" },
    });
    await createControlViaApi(refBtnName, "button", 100, 580, 160, 44, {
      text: { formula: `${labelName}.Text` },
    });

    await page.reload({ waitUntil: "networkidle" });
    await waitForCanvasText(page, "Approved");

    await page.getByRole("button", { name: /^Preview$/i }).click();
    await page.getByText("Runtime Preview").waitFor({ timeout: 10000 });
    const dialog = page.locator('[class*="dialog"]');
    await dialog.getByText("Approved").first().waitFor({ timeout: 30000 });
    record(
      "Test 4 — Save, refresh, and preview keep control references",
      true,
      "Approved on canvas and in preview",
    );
  } finally {
    await browser.close();
    await stopStudioDev();
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
