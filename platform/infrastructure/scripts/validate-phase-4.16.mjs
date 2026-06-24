/**
 * Phase 4.16 acceptance validation.
 * Behavior is identical to 4.14 — verifies the RuntimeVariableStore
 * produces the same results as the former HARDCODED_VARIABLES.
 * Run: node infrastructure/scripts/validate-phase-4.16.mjs
 */
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-4.16");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const FORMULA_API = "http://localhost:8085";
const METADATA_API = "http://localhost:8082/api/v1";
const STUDIO_BASE = "http://localhost:5173";

const TENANT = "00000000-0000-4000-8000-000000000001";
const APP_ID = "00000000-0000-4000-8000-000000000003";
const SCREEN_ID = "00000000-0000-4000-8000-000000000004";
const STUDIO_URL = `http://localhost:5173/studio/apps/${APP_ID}/screens/${SCREEN_ID}`;

const FULL_CONTEXT = {
  User: { FullName: "Test User", Email: "test@example.com" },
  App: { Name: "Demo Application" },
  TextInput1: { Value: "Hello" },
  Label1: { Text: "Approved" },
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

async function postEvaluate(formula, context = FULL_CONTEXT) {
  const res = await fetch(`${FORMULA_API}/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ formula, context }),
  });
  return res.json();
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

async function listControls() {
  const res = await fetch(`${METADATA_API}/screens/${SCREEN_ID}/controls`, {
    headers: { "X-Tenant-Id": TENANT },
  });
  return (await res.json()).data.items;
}

async function cleanupTestControls(names) {
  const items = await listControls();
  for (const control of items) {
    if (names.has(control.name)) {
      await fetch(`${METADATA_API}/controls/${control.id}`, {
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
  const propRes = await fetch(`${METADATA_API}/controls/${body.data.id}/properties`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Tenant-Id": TENANT },
    body: JSON.stringify({ properties }),
  });
  if (!propRes.ok) {
    throw new Error(`Property update failed: ${propRes.status}`);
  }
  return body.data;
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
  log("=== Phase 4.16 Acceptance Validation ===");

  // TypeScript build verifies the new store types compile cleanly
  const build = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@goapps/formula", "build"],
    { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" },
  );
  if (build.status !== 0) throw new Error("Failed to build @goapps/formula.");

  startFormulaApi();
  await waitForFormulaApi();

  const title = await postEvaluate("varTitle");
  record("Test 1 — varTitle from store", title.ok && title.value === "Hello World", JSON.stringify(title));

  const count = await postEvaluate("varCount");
  record("Test 2 — varCount from store", count.ok && count.value === 10, JSON.stringify(count));

  const status = await postEvaluate("varStatus");
  record("Test 3 — varStatus from store", status.ok && status.value === "Approved", JSON.stringify(status));

  const user = await postEvaluate("User.FullName");
  const app = await postEvaluate("App.Name");
  record(
    "Test 4 — User/App formulas still work",
    user.ok && user.value === "Test User" && app.ok && app.value === "Demo Application",
    JSON.stringify({ user, app }),
  );

  const textInput = await postEvaluate("TextInput1.Value");
  const label = await postEvaluate("Label1.Text");
  record(
    "Test 5 — Control references still work",
    textInput.ok && textInput.value === "Hello" && label.ok && label.value === "Approved",
    JSON.stringify({ textInput, label }),
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
  const varLabelName = `VarLabel_${stamp}`;
  const testNames = new Set([varLabelName]);

  try {
    await cleanupTestControls(testNames);
    await createControlViaApi(varLabelName, "label", 100, 400, 220, 40, {
      text: { formula: "varTitle" },
    });

    await page.goto(STUDIO_URL, { waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await waitForCanvasText(page, "Hello World");

    await page.reload({ waitUntil: "networkidle" });
    await waitForCanvasText(page, "Hello World");

    await page.getByRole("button", { name: /^Preview$/i }).click();
    await page.getByText("Runtime Preview").waitFor({ timeout: 10000 });
    const dialog = page.locator('[class*="dialog"]');
    await dialog.getByText("Hello World").first().waitFor({ timeout: 30000 });
    record(
      "Test 6 — Refresh and preview still resolve variables from store",
      true,
      "Hello World on canvas and in preview",
    );
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
