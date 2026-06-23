/**
 * Phase 4.11 acceptance validation.
 * Run: node infrastructure/scripts/validate-phase-4.11.mjs
 */
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-4.11");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const FORMULA_API = "http://localhost:8085";
const METADATA_API = "http://localhost:8082/api/v1";
const STUDIO_BASE = "http://localhost:5173";

const TENANT = "00000000-0000-4000-8000-000000000001";
const APP_ID = "00000000-0000-4000-8000-000000000003";
const SCREEN_ID = "00000000-0000-4000-8000-000000000004";
const STUDIO_URL = `http://localhost:5173/studio/apps/${APP_ID}/screens/${SCREEN_ID}`;

const results = [];
let apiProcess = null;
let studioProcess = null;
let studioStartedByScript = false;

function startStudioDev() {
  studioStartedByScript = true;
  studioProcess = spawn(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@goapps/studio", "dev"],
    {
      cwd: ROOT,
      stdio: "ignore",
      shell: process.platform === "win32",
    },
  );
}

async function waitForStudio(timeoutMs = 90000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(STUDIO_BASE);
      if (res.ok || res.status === 304) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Studio dev server did not start in time.");
}

async function ensureStudio() {
  try {
    const res = await fetch(STUDIO_BASE);
    if (res.ok || res.status === 304) {
      return;
    }
  } catch {
    // not running
  }
  startStudioDev();
  await waitForStudio();
}

async function waitForMetadata(timeoutMs = 30000) {
  const started = Date.now();
  const headers = { "X-Tenant-Id": TENANT };
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${METADATA_API}/screens/${SCREEN_ID}/controls`, {
        headers,
      });
      if (res.ok) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    "Metadata service is not available on :8082. Start it before running validation.",
  );
}

async function stopStudioDev() {
  if (studioStartedByScript && studioProcess && !studioProcess.killed) {
    studioProcess.kill();
    studioProcess = null;
    studioStartedByScript = false;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

function log(line) {
  const msg = `[${new Date().toISOString()}] ${line}`;
  console.log(msg);
  fs.appendFileSync(LOG_FILE, msg + "\n");
}

function record(test, passed, detail) {
  results.push({ test, passed, detail });
  log(`${passed ? "PASS" : "FAIL"} — ${test}: ${detail}`);
}

async function waitForFormulaApi(timeoutMs = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${FORMULA_API}/health`);
      if (res.ok) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Formula API did not start in time.");
}

function startFormulaApi() {
  const localDotnet = path.join(
    ROOT,
    ".dotnet",
    process.platform === "win32" ? "dotnet.exe" : "dotnet",
  );
  const dotnet = existsSync(localDotnet) ? localDotnet : "dotnet";
  const projectDir = path.join(
    ROOT,
    "packages",
    "formula",
    "dotnet",
    "GoApps.PowerFx",
  );

  apiProcess = spawn(
    dotnet,
    ["run", "--project", projectDir, "--", "--serve", "--port", "8085"],
    {
      cwd: projectDir,
      stdio: "ignore",
      detached: false,
    },
  );
}

async function stopFormulaApi() {
  if (apiProcess && !apiProcess.killed) {
    apiProcess.kill();
    apiProcess = null;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function postEvaluate(formula) {
  const res = await fetch(`${FORMULA_API}/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ formula }),
  });
  return res.json();
}

async function addControl(page, toolboxLabel, controlName) {
  await page.getByRole("button", { name: toolboxLabel }).click();
  await page.getByText("Unsaved changes").waitFor({ timeout: 10000 });
  const expandProperties = page.getByTitle("Expand Properties");
  if (await expandProperties.isVisible().catch(() => false)) {
    await expandProperties.click();
  }
  await page.getByText("Properties", { exact: true }).waitFor({ timeout: 10000 });
  const nameField = page.getByRole("textbox", { name: "Name", exact: true });
  await nameField.waitFor({ timeout: 15000 });
  await nameField.fill(controlName);
}

async function setFormula(page, formula) {
  await page.getByTestId("text-mode-formula").check({ force: true });
  const openEditor = page.getByTestId("text-open-formula-editor");
  await openEditor.waitFor({ state: "visible", timeout: 10000 });
  await openEditor.click({ force: true });
  const input = page.getByTestId("formula-editor-input");
  await input.waitFor({ timeout: 10000 });
  await input.fill(formula);
  await page.getByTestId("formula-editor-save").click();
  await input.waitFor({ state: "hidden", timeout: 10000 });
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
  log("=== Phase 4.11 Acceptance Validation ===");

  const build = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@goapps/formula", "build"],
    { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" },
  );
  if (build.status !== 0) {
    throw new Error("Failed to build @goapps/formula.");
  }

  startFormulaApi();
  await waitForFormulaApi();
  record("Test 1 — Formula API starts", true, `${FORMULA_API}/health`);

  const hello = await postEvaluate('"Hello"');
  record(
    "Test 2 — RemoteFormulaEngine evaluates string literal",
    hello.ok === true && hello.value === "Hello",
    JSON.stringify(hello),
  );

  const number = await postEvaluate("123");
  record(
    "Test 3 — RemoteFormulaEngine evaluates number literal",
    number.ok === true && number.value === 123,
    JSON.stringify(number),
  );

  const bool = await postEvaluate("true");
  record(
    "Test 4 — RemoteFormulaEngine evaluates boolean literal",
    bool.ok === true && bool.value === true,
    JSON.stringify(bool),
  );

  const invalid = await postEvaluate("abc(");
  record(
    "Test 7 — Invalid formula returns error from API",
    invalid.ok === false && typeof invalid.error === "string",
    JSON.stringify(invalid),
  );

  const { createDefaultFormulaEngine, LiteralFormulaEngine } = await import(
    pathToFileURL(path.join(ROOT, "packages/formula/dist/src/index.js")).href
  );
  const previous = process.env.FORMULA_API_URL;
  delete process.env.FORMULA_API_URL;
  const engine = createDefaultFormulaEngine();
  const isLiteral = engine instanceof LiteralFormulaEngine;
  if (previous) {
    process.env.FORMULA_API_URL = previous;
  }
  record(
    "Test 8 — Fallback to LiteralFormulaEngine when API unavailable",
    isLiteral,
    engine.constructor.name,
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

  try {
    await page.goto(STUDIO_URL, { waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });

    await addControl(page, "Add Button", `RemoteBtn-${stamp}`);
    await setFormula(page, '"Hello"');
    await waitForCanvasText(page, "Hello");
    record("Test 5 — Studio renders evaluated value", true, "Hello on canvas");

    await page.getByTitle("Save (Ctrl+S)").click();
    await page.getByText("Changes saved").waitFor({ timeout: 15000 });
    await page.reload({ waitUntil: "networkidle" });
    await waitForCanvasText(page, "Hello");

    await page.getByRole("button", { name: /^Preview$/i }).click();
    await page.getByText("Runtime Preview").waitFor({ timeout: 10000 });
    const dialog = page.locator('[class*="dialog"]');
    await dialog.getByText("Hello").first().waitFor({ timeout: 30000 });
    record("Test 6 — Preview renders evaluated value", true, "Hello in preview");
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
