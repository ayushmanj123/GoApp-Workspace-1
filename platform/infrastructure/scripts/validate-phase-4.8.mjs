/**
 * Phase 4.8 acceptance validation.
 * Run: node infrastructure/scripts/validate-phase-4.8.mjs
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../.validation-4.8");
const LOG_FILE = path.join(OUT_DIR, "validation.log");

const TENANT = "00000000-0000-4000-8000-000000000001";
const APP_ID = "00000000-0000-4000-8000-000000000003";
const SCREEN_ID = "00000000-0000-4000-8000-000000000004";
const API = "http://localhost:8082/api/v1";
const STUDIO_URL = `http://localhost:5173/studio/apps/${APP_ID}/screens/${SCREEN_ID}`;

const headers = {
  "Content-Type": "application/json",
  "X-Tenant-Id": TENANT,
};

const results = [];

function log(line) {
  const msg = `[${new Date().toISOString()}] ${line}`;
  console.log(msg);
  fs.appendFileSync(LOG_FILE, msg + "\n");
}

function record(test, passed, detail) {
  results.push({ test, passed, detail });
  log(`${passed ? "PASS" : "FAIL"} — ${test}: ${detail}`);
}

async function apiGet(pathname) {
  const res = await fetch(`${API}${pathname}`, { headers });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(JSON.stringify(body));
  return body.data;
}

async function listControls() {
  return (await apiGet(`/screens/${SCREEN_ID}/controls`)).items;
}

async function getProperties(controlId) {
  return apiGet(`/controls/${controlId}/properties`);
}

async function findControlByName(name) {
  const items = await listControls();
  return items.find((control) => control.name === name) ?? null;
}

async function saveScreen(page) {
  await page.getByTitle("Save (Ctrl+S)").click();
  await page.getByText("Changes saved").waitFor({ timeout: 15000 });
}

async function reloadStudio(page) {
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
}

async function getControl(controlId) {
  const items = await listControls();
  return items.find((control) => control.id === controlId) ?? null;
}

async function clickControlOnCanvas(page, control) {
  const canvas = page.locator('div[class*="stageContainer"] canvas').first();
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error("Canvas not found");
  }
  const stageX = Math.max((box.width - 1366) / 2, 48);
  const stageY = Math.max((box.height - 768) / 2, 48);
  const x = box.x + stageX + control.x + control.width / 2;
  const y = box.y + stageY + control.y + control.height / 2;
  await page.mouse.click(x, y);
}

async function selectControlById(page, controlId) {
  const control = await getControl(controlId);
  if (!control) {
    throw new Error(`Control not found: ${controlId}`);
  }
  await clickControlOnCanvas(page, control);
  await page.waitForTimeout(250);
}

async function openFormulaEditor(page) {
  await page.getByTestId("text-open-formula-editor").click();
  await page.getByTestId("formula-editor-input").waitFor({ timeout: 5000 });
}

async function saveFormulaEditor(page, formula) {
  await page.getByTestId("formula-editor-input").fill(formula);
  await page.getByTestId("formula-editor-save").click();
  await page.getByTestId("formula-editor-input").waitFor({
    state: "hidden",
    timeout: 5000,
  });
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("=== Phase 4.8 Acceptance Validation ===");

  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    browser = await chromium.launch({ channel: "msedge", headless: true });
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const stamp = Date.now();
  const buttonName = `EditorBtn-${stamp}`;
  let buttonId = null;

  try {
    await page.goto(STUDIO_URL, { waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });

    await page.getByRole("button", { name: "Add Button" }).click();
    await page.getByText("Unsaved changes").waitFor({ timeout: 5000 });
    await page.getByLabel("Name", { exact: true }).fill(buttonName);
    await page.getByTestId("text-mode-formula").check();
    await openFormulaEditor(page);
    await saveFormulaEditor(page, "User().FullName");

    const summaryAfterSave = await page
      .getByTestId("text-formula-summary")
      .innerText();
    const test1Ok = summaryAfterSave.includes("User().FullName");
    record(
      "Test 1 — Formula editor stores formula in property metadata",
      test1Ok,
      summaryAfterSave,
    );

    await saveScreen(page);
    buttonId = (await findControlByName(buttonName))?.id ?? null;
    await reloadStudio(page);
    await selectControlById(page, buttonId);
    const summaryAfterRefresh = await page
      .getByTestId("text-formula-summary")
      .innerText();
    const propsAfterRefresh = buttonId
      ? await getProperties(buttonId)
      : null;
    const test2Ok =
      summaryAfterRefresh.includes("User().FullName") &&
      propsAfterRefresh?.text?.formula === "User().FullName";
    record(
      "Test 2 — Formula persists after refresh",
      test2Ok,
      JSON.stringify(propsAfterRefresh?.text),
    );

    await openFormulaEditor(page);
    const preloaded = await page.getByTestId("formula-editor-input").inputValue();
    const test3Ok = preloaded === "User().FullName";
    record(
      "Test 3 — Formula editor preloads existing formula",
      test3Ok,
      preloaded,
    );

    await saveFormulaEditor(page, "Concat(User().FullName, \"!\")");
    await saveScreen(page);
    await reloadStudio(page);
    await selectControlById(page, buttonId);
    const updatedProps = buttonId ? await getProperties(buttonId) : null;
    const test4Ok =
      updatedProps?.text?.formula === 'Concat(User().FullName, "!")';
    record(
      "Test 4 — Updated formula persists after save/refresh",
      test4Ok,
      JSON.stringify(updatedProps?.text),
    );

    await openFormulaEditor(page);
    await page
      .getByTestId("formula-editor-input")
      .fill("ThisShouldBeDiscarded()");
    await page.getByTestId("formula-editor-cancel").click();
    await page.getByTestId("formula-editor-input").waitFor({
      state: "hidden",
      timeout: 5000,
    });
    const summaryAfterCancel = await page
      .getByTestId("text-formula-summary")
      .innerText();
    const test5Ok = summaryAfterCancel.includes('Concat(User().FullName, "!")');
    record(
      "Test 5 — Cancel discards editor changes",
      test5Ok,
      summaryAfterCancel,
    );

    await page.getByRole("button", { name: /^Preview$/i }).click();
    await page.getByText("Runtime Preview").waitFor({ timeout: 10000 });
    const dialog = page.locator('[class*="dialog"]');
    await dialog
      .getByText("[Formula]")
      .first()
      .waitFor({ timeout: 30000 })
      .catch(() => null);
    const previewText = await dialog.innerText();
    const test6Ok =
      !previewText.includes("Loading...") && !previewText.includes("Unknown:");
    record(
      "Test 6 — Preview opens without crashes or evaluation",
      test6Ok,
      previewText.slice(0, 220),
    );
    await page.screenshot({ path: path.join(OUT_DIR, "06-preview.png"), fullPage: true });
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.passed).length;
  log(`=== Summary: ${results.length - failed}/${results.length} passed ===`);
  fs.writeFileSync(path.join(OUT_DIR, "results.json"), JSON.stringify(results, null, 2));
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  log(`FATAL: ${err.stack || err}`);
  process.exit(1);
});
