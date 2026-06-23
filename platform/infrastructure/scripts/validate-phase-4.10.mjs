/**
 * Phase 4.10 acceptance validation.
 * Run: node infrastructure/scripts/validate-phase-4.10.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../.validation-4.10");
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

async function findControlByName(name) {
  const items = (await apiGet(`/screens/${SCREEN_ID}/controls`)).items;
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
  const items = (await apiGet(`/screens/${SCREEN_ID}/controls`)).items;
  return items.find((control) => control.id === controlId) ?? null;
}

async function clickControlOnCanvas(page, control) {
  const canvas = page.locator('div[class*="stageContainer"] canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas not found");
  const stageX = Math.max((box.width - 1366) / 2, 48);
  const stageY = Math.max((box.height - 768) / 2, 48);
  await page.mouse.click(
    box.x + stageX + control.x + control.width / 2,
    box.y + stageY + control.y + control.height / 2,
  );
  await page.waitForTimeout(300);
}

async function addControl(page, toolboxLabel, controlName) {
  await page.getByRole("button", { name: toolboxLabel }).click();
  await page.getByText("Unsaved changes").waitFor({ timeout: 5000 });
  const nameField = page.getByLabel("Name", { exact: true });
  await nameField.waitFor({ timeout: 10000 });
  await nameField.fill(controlName);
}

async function setFormula(page, formula) {
  await page.getByTestId("text-mode-formula").check();
  await page.getByTestId("text-open-formula-editor").click();
  await page.getByTestId("formula-editor-input").fill(formula);
  await page.getByTestId("formula-editor-save").click();
}

async function setPlaceholderFormula(page, formula) {
  await page.getByTestId("placeholder-mode-formula").check();
  await page.getByTestId("placeholder-open-formula-editor").click();
  await page.getByTestId("formula-editor-input").fill(formula);
  await page.getByTestId("formula-editor-save").click();
}

async function waitForEvaluatedText(page, text) {
  await page
    .locator('[class*="controlPreview"]')
    .getByText(text, { exact: true })
    .first()
    .waitFor({ timeout: 15000 });
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("=== Phase 4.10 Acceptance Validation ===");

  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    browser = await chromium.launch({ channel: "msedge", headless: true });
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const stamp = Date.now();
  const buttonName = `EvalBtn-${stamp}`;

  try {
    await page.goto(STUDIO_URL, { waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });

    await addControl(page, "Add Button", buttonName);
    await setFormula(page, '"Hello"');
    await waitForEvaluatedText(page, "Hello");
    record("Test 1 — Button.Text formula renders Hello", true, "Hello visible on canvas");

    const labelName = `EvalLabel-${stamp}`;
    await addControl(page, "Add Label", labelName);
    await setFormula(page, '"World"');
    await waitForEvaluatedText(page, "World");
    record("Test 2 — Label.Text formula renders World", true, "World visible on canvas");

    const inputName = `EvalInput-${stamp}`;
    await addControl(page, "Add Text Input", inputName);
    await setPlaceholderFormula(page, '"Enter Name"');
    const placeholderInput = page.locator('input[placeholder="Enter Name"]').first();
    await placeholderInput.waitFor({ timeout: 15000 });
    record(
      "Test 3 — TextInput.Placeholder formula renders Enter Name",
      await placeholderInput.isVisible(),
      'placeholder="Enter Name"',
    );

    const numberName = `EvalNumber-${stamp}`;
    await addControl(page, "Add Label", numberName);
    await setFormula(page, "123");
    await waitForEvaluatedText(page, "123");
    record("Test 4 — Number literal renders 123", true, "123 visible on canvas");

    const boolName = `EvalBool-${stamp}`;
    await addControl(page, "Add Label", boolName);
    await setFormula(page, "true");
    await waitForEvaluatedText(page, "true");
    record("Test 5 — Boolean literal renders true", true, "true visible on canvas");

    const errorName = `EvalError-${stamp}`;
    await addControl(page, "Add Button", errorName);
    await setFormula(page, "abc(");
    await waitForEvaluatedText(page, "[Formula Error]");
    record("Test 6 — Invalid formula renders [Formula Error]", true, "[Formula Error] visible");

    await saveScreen(page);
    await reloadStudio(page);

    const savedButton = await findControlByName(buttonName);
    if (savedButton) {
      await clickControlOnCanvas(page, savedButton);
    }
    await waitForEvaluatedText(page, "Hello");

    await page.getByRole("button", { name: /^Preview$/i }).click();
    await page.getByText("Runtime Preview").waitFor({ timeout: 10000 });
    const dialog = page.locator('[class*="dialog"]');
    await dialog.getByText("Hello").first().waitFor({ timeout: 30000 });
    const previewText = await dialog.innerText();
    const previewOk =
      previewText.includes("Hello") &&
      previewText.includes("World") &&
      !previewText.includes("[Formula]") &&
      !previewText.includes("Loading...");
    record("Test 7 — Save/refresh/preview evaluates formulas", previewOk, previewText.slice(0, 220));
    await page.screenshot({ path: path.join(OUT_DIR, "07-preview.png"), fullPage: true });
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
