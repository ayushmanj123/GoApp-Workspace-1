/**
 * Phase 4.7 acceptance validation.
 * Run: node infrastructure/scripts/validate-phase-4.7.mjs
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../.validation-4.7");
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
let lastButtonId = null;
let lastLabelId = null;
let lastTextInputId = null;

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

async function latestControlId(controlType) {
  const items = await listControls();
  const matches = items.filter(
    (control) => control.control_type.toLowerCase() === controlType,
  );
  if (matches.length === 0) return null;
  matches.sort((a, b) => new Date(b.ModifiedOn) - new Date(a.ModifiedOn));
  return matches[0].id;
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

async function saveAndReload(page) {
  await page.getByTitle("Save (Ctrl+S)").click();
  await page.getByText("Changes saved").waitFor({ timeout: 15000 });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("=== Phase 4.7 Acceptance Validation ===");

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

    const stamp = Date.now();
    const buttonName = `FormulaBtn-${stamp}`;

    await page.getByRole("button", { name: "Add Button" }).click();
    await page.getByText("Unsaved changes").waitFor({ timeout: 5000 });
    await page.getByLabel("Name", { exact: true }).fill(buttonName);
    await page.getByTestId("text-mode-formula").check();
    await page.getByLabel("Text", { exact: true }).fill("User().FullName");
    await saveAndReload(page);
    const savedButton = await findControlByName(buttonName);
    lastButtonId = savedButton?.id ?? null;
    const buttonProps = lastButtonId ? await getProperties(lastButtonId) : null;
    const buttonFormulaOk =
      buttonProps?.text?.formula === "User().FullName" &&
      buttonProps?.text?.value === undefined;
    record(
      "Test 1 — Button.Text formula persists after save/refresh",
      buttonFormulaOk,
      JSON.stringify(buttonProps?.text),
    );

    if (!lastButtonId) {
      throw new Error("Saved formula button not found");
    }
    await selectControlById(page, lastButtonId);
    await page.getByTestId("text-mode-static").check();
    await page.getByLabel("Text", { exact: true }).fill("Save");
    await saveAndReload(page);
    const buttonStaticProps = await getProperties(lastButtonId);
    const buttonStaticOk =
      buttonStaticProps?.text?.value === "Save" &&
      buttonStaticProps?.text?.formula === undefined;
    record(
      "Test 2 — Button.Text static value persists after save/refresh",
      buttonStaticOk,
      JSON.stringify(buttonStaticProps?.text),
    );

    const labelName = `FormulaLabel-${stamp}`;
    await page.getByRole("button", { name: "Add Label" }).click();
    await page.getByText("Unsaved changes").waitFor({ timeout: 5000 });
    await page.getByLabel("Name", { exact: true }).fill(labelName);
    await page.getByTestId("text-mode-formula").check();
    await page.getByLabel("Text", { exact: true }).fill('Concat("Hi", User().Name)');
    await saveAndReload(page);
    const savedLabel = await findControlByName(labelName);
    lastLabelId = savedLabel?.id ?? null;
    const labelProps = lastLabelId ? await getProperties(lastLabelId) : null;
    const labelFormulaOk =
      labelProps?.text?.formula === 'Concat("Hi", User().Name)';
    record(
      "Test 3 — Label.Text formula persists after save/refresh",
      labelFormulaOk,
      JSON.stringify(labelProps?.text),
    );

    const textInputName = `FormulaInput-${stamp}`;
    await page.getByRole("button", { name: "Add Text Input" }).click();
    await page.getByText("Unsaved changes").waitFor({ timeout: 5000 });
    await page.getByLabel("Name", { exact: true }).fill(textInputName);
    await page.getByTestId("placeholder-mode-formula").check();
    await page.getByLabel("Placeholder", { exact: true }).fill("User().Email");
    await saveAndReload(page);
    const savedTextInput = await findControlByName(textInputName);
    lastTextInputId = savedTextInput?.id ?? null;
    const textInputProps = lastTextInputId
      ? await getProperties(lastTextInputId)
      : null;
    const placeholderFormulaOk =
      textInputProps?.placeholder?.formula === "User().Email";
    record(
      "Test 4 — TextInput.Placeholder formula persists after save/refresh",
      placeholderFormulaOk,
      JSON.stringify(textInputProps?.placeholder),
    );

    await page.getByRole("button", { name: /^Preview$/i }).click();
    await page.getByText("Runtime Preview").waitFor({ timeout: 10000 });
    const dialog = page.locator('[class*="dialog"]');
    await dialog
      .getByText("[Formula]")
      .first()
      .waitFor({ timeout: 30000 })
      .catch(async () => {
        await dialog.getByRole("button", { name: "Save" }).first().waitFor({
          timeout: 30000,
        });
      });
    const previewText = await dialog.innerText();
    const previewOk =
      !previewText.includes("Loading...") &&
      !previewText.includes("Unknown:") &&
      (previewText.includes("[Formula]") || previewText.includes("Save"));
    record(
      "Test 5 — Preview opens without crashes or evaluation",
      previewOk,
      previewText.slice(0, 220),
    );
    await page.screenshot({ path: path.join(OUT_DIR, "05-preview.png"), fullPage: true });
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
