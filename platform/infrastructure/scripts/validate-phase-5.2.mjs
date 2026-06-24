/**
 * Phase 5.2 acceptance validation — Monaco Formula Editor Foundation.
 * Run: node infrastructure/scripts/validate-phase-5.2.mjs
 */
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-5.2");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const FORMULA_API = "http://localhost:8085";
const METADATA_API = "http://localhost:8082/api/v1";
const STUDIO_BASE = "http://localhost:5173";

const TENANT = "00000000-0000-4000-8000-000000000001";
const APP_ID = "00000000-0000-4000-8000-000000000003";
const SCREEN1_ID = "00000000-0000-4000-8000-000000000004";
const STUDIO_URL = `http://localhost:5173/studio/apps/${APP_ID}/screens/${SCREEN1_ID}`;

const FORBIDDEN_METADATA_PATHS = [
  "services/metadata/",
  "apps/runtime/",
  "packages/formula/dotnet/",
];

const results = [];
let apiProcess = null;
let studioStartedByScript = false;
let studioProcess = null;
let labelId = null;
let prefix = null;
let originalOnVisible = "";
let originalOnStart = "";

function log(line) {
  const msg = `[${new Date().toISOString()}] ${line}`;
  console.log(msg);
  fs.appendFileSync(LOG_FILE, `${msg}\n`);
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
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Formula API did not start.");
}

async function waitForMetadata(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${METADATA_API}/applications/${APP_ID}/screens`, {
        headers: { "X-Tenant-Id": TENANT },
      });
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Metadata service not available on :8082.");
}

async function ensureStudio() {
  try {
    const res = await fetch(STUDIO_BASE);
    if (res.ok || res.status === 304) return;
  } catch {
    /* not running */
  }
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
    } catch {
      /* retry */
    }
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
  return (await res.json()).data?.items ?? [];
}

async function deleteControl(controlId) {
  await fetch(`${METADATA_API}/controls/${controlId}`, {
    method: "DELETE",
    headers: { "X-Tenant-Id": TENANT },
  });
}

async function createControlViaApi(screenId, name, controlType, x, y, width, height) {
  const res = await fetch(`${METADATA_API}/screens/${screenId}/controls`, {
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
    }),
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(`Create control failed: ${JSON.stringify(body)}`);
  return body.data;
}

async function listScreens() {
  const res = await fetch(`${METADATA_API}/applications/${APP_ID}/screens`, {
    headers: { "X-Tenant-Id": TENANT },
  });
  return (await res.json()).data?.items ?? [];
}

async function getScreen(screenId) {
  const items = await listScreens();
  return items.find((screen) => screen.id === screenId) ?? null;
}

async function getControlProperties(controlId) {
  const res = await fetch(`${METADATA_API}/controls/${controlId}/properties`, {
    headers: { "X-Tenant-Id": TENANT },
  });
  const body = await res.json();
  return body.data ?? {};
}

async function setControlTextFormula(controlId, formula) {
  await fetch(`${METADATA_API}/controls/${controlId}/properties`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Tenant-Id": TENANT },
    body: JSON.stringify({
      properties: {
        text: { mode: "formula", formula },
      },
    }),
  });
}

async function setScreenOnVisible(screenId, formula) {
  await fetch(`${METADATA_API}/screens/${screenId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Tenant-Id": TENANT },
    body: JSON.stringify({ on_visible: formula }),
  });
}

async function getApplication() {
  const res = await fetch(`${METADATA_API}/applications/${APP_ID}`, {
    headers: { "X-Tenant-Id": TENANT },
  });
  return (await res.json()).data;
}

async function setApplicationOnStart(formula) {
  const res = await fetch(`${METADATA_API}/applications/${APP_ID}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Tenant-Id": TENANT },
    body: JSON.stringify({ on_start: formula }),
  });
  return res.ok;
}

async function cleanupByPrefix(p) {
  const items = await listControls(SCREEN1_ID);
  for (const c of items) {
    if (c.name.startsWith(p)) {
      await deleteControl(c.id);
    }
  }
}

async function openStudio(page) {
  await page.goto(STUDIO_URL, { waitUntil: "networkidle" });
  await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
}

async function selectControl(page, controlId) {
  await page.getByTestId(`explorer-select-${controlId}`).click();
  await page.waitForTimeout(200);
}

async function deselectControl(page) {
  await page.evaluate(() => window.__studioStore?.getState().selectControl(null));
  await page.waitForTimeout(200);
}

async function openTextFormulaEditor(page) {
  await page.getByTestId("text-open-formula-editor").click();
  await page.getByTestId("formula-editor-monaco").waitFor({ timeout: 10000 });
}

async function fillFormulaEditor(page, formula) {
  await page.getByTestId("formula-editor-input").fill(formula);
  await page.waitForTimeout(100);
}

async function waitForValidation(page, testId, timeoutMs = 8000) {
  try {
    await page.getByTestId(testId).waitFor({ timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

function metadataPathsChanged() {
  const status = spawnSync("git", ["status", "--porcelain"], { cwd: ROOT });
  const lines = status.stdout.toString().split("\n").filter(Boolean);
  return lines
    .map((line) => line.slice(3).replace(/\\/g, "/"))
    .filter((file) => FORBIDDEN_METADATA_PATHS.some((prefixPath) => file.startsWith(prefixPath)));
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("=== Phase 5.2 Acceptance Validation ===");

  const typeStudio = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@goapps/studio", "typecheck"],
    { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" },
  );
  record("Test 10 — TypeScript clean", typeStudio.status === 0, `exit=${typeStudio.status}`);
  if (typeStudio.status !== 0) process.exit(1);

  spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@goapps/formula", "build"],
    { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" },
  );

  startFormulaApi();
  await waitForFormulaApi();
  await waitForMetadata();
  await ensureStudio();

  const screen = await getScreen(SCREEN1_ID);
  originalOnVisible = screen?.on_visible ?? "";
  originalOnStart = (await getApplication()).on_start ?? "";

  prefix = `Fx52_${Date.now()}`;
  await cleanupByPrefix(prefix);
  labelId = (await createControlViaApi(SCREEN1_ID, `${prefix}_Lbl`, "label", 80, 80, 160, 36)).id;
  await setControlTextFormula(labelId, "User().FullName");

  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    browser = await chromium.launch({ channel: "msedge", headless: true });
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await openStudio(page);
    await page.getByTestId("explorer-control-tree").waitFor({ timeout: 15000 });
    await selectControl(page, labelId);

    // Test 1 — Monaco renders
    await page.getByTestId("text-open-formula-editor").click();
    await page.getByTestId("formula-editor-monaco").waitFor({ timeout: 10000 });
    await page.locator(".monaco-editor").first().waitFor({ timeout: 15000 });
    const monacoVisible = await page.locator(".monaco-editor").first().isVisible();
    const monacoShell = await page.getByTestId("formula-editor-monaco").isVisible();
    record(
      "Test 1 — Monaco renders",
      monacoVisible && monacoShell,
      `monaco=${monacoVisible}, shell=${monacoShell}`,
    );
    await page.getByTestId("formula-editor-cancel").click();

    // Test 2 — Existing formula loads
    await openTextFormulaEditor(page);
    const loaded = await page.getByTestId("formula-editor-input").inputValue();
    record("Test 2 — Existing formula loads", loaded === "User().FullName", `value=${loaded}`);
    await page.getByTestId("formula-editor-cancel").click();

    // Test 3 — Formula saves
    await openTextFormulaEditor(page);
    const nextFormula = 'Concatenate("Hello ", User.FullName)';
    await fillFormulaEditor(page, nextFormula);
    await page.getByTestId("formula-editor-save").click();
    await page.getByTestId("formula-editor-monaco").waitFor({ state: "hidden", timeout: 5000 });
    const summaryAfterSave = await page.getByTestId("text-formula-summary").innerText();
    const test3 = summaryAfterSave.includes("Concatenate");
    record("Test 3 — Formula saves", test3, summaryAfterSave);

    // Test 4 — Autocomplete shows functions
    await openTextFormulaEditor(page);
    await page.getByTestId("formula-editor-monaco").click();
    await page.keyboard.press("Control+A");
    await page.keyboard.type("Se");
    await page.keyboard.press("Control+Space");
    await page.waitForTimeout(500);
    const suggestSet = await page.locator(".monaco-list-row", { hasText: "Set" }).first().isVisible();
    record("Test 4 — Autocomplete shows functions", suggestSet, `setVisible=${suggestSet}`);
    await page.getByTestId("formula-editor-cancel").click();

    // Test 5 — Validation shows valid formula
    await openTextFormulaEditor(page);
    await fillFormulaEditor(page, 'Upper("Valid")');
    const validShown = await waitForValidation(page, "formula-editor-status-valid");
    record("Test 5 — Validation shows valid formula", validShown, `valid=${validShown}`);
    await page.getByTestId("formula-editor-cancel").click();

    // Test 6 — Validation shows invalid formula
    await openTextFormulaEditor(page);
    await fillFormulaEditor(page, "Set(");
    const invalidShown = await waitForValidation(page, "formula-editor-status-error");
    record("Test 6 — Validation shows invalid formula", invalidShown, `invalid=${invalidShown}`);
    await page.getByTestId("formula-editor-cancel").click();

    // Test 7 — OnVisible editing still works
    await deselectControl(page);
    const onVisibleFormula = `Set(varStatus, "${prefix}_OnVisible")`;
    await page.getByTestId("on_visible-open-formula-editor").click();
    await page.getByTestId("formula-editor-monaco").waitFor({ timeout: 10000 });
    await fillFormulaEditor(page, onVisibleFormula);
    await page.getByTestId("formula-editor-save").click();
    await page.waitForTimeout(300);
    const summary = await page.getByTestId("on_visible-formula-summary").innerText();
    const test7 = summary.includes(`${prefix}_OnVisible`);
    record("Test 7 — OnVisible editing still works", test7, `summary=${summary}`);

    // Test 8 — OnStart editing still works (metadata API)
    const onStartFormula = `Set(varTitle, "${prefix}_OnStart")`;
    const onStartOk = await setApplicationOnStart(onStartFormula);
    const appAfter = await getApplication();
    const test8 = onStartOk && appAfter.on_start === onStartFormula;
    record("Test 8 — OnStart editing still works", test8, `on_start=${appAfter.on_start}`);

    // Test 9 — No metadata changes
    const changedForbidden = metadataPathsChanged();
    const test9 = changedForbidden.length === 0;
    record(
      "Test 9 — No metadata changes",
      test9,
      test9 ? "no forbidden paths changed" : changedForbidden.join(", "),
    );
  } finally {
    await browser.close();
    await stopStudioDev();
    if (prefix) await cleanupByPrefix(prefix);
    await setScreenOnVisible(SCREEN1_ID, originalOnVisible);
    await setApplicationOnStart(originalOnStart ?? "");
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
  if (prefix) await cleanupByPrefix(prefix);
  await setScreenOnVisible(SCREEN1_ID, originalOnVisible).catch(() => {});
  await setApplicationOnStart(originalOnStart ?? "").catch(() => {});
  process.exit(1);
});
