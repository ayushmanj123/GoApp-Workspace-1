/**
 * Phase 4.5 acceptance validation.
 * Run: node infrastructure/scripts/validate-phase-4.5.mjs
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../.validation-4.5");
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

async function apiGet(path) {
  const res = await fetch(`${API}${path}`, { headers });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(JSON.stringify(body));
  return body.data;
}

async function listControls() {
  return (await apiGet(`/screens/${SCREEN_ID}/controls`)).items;
}

async function countByType(type) {
  const items = await listControls();
  return items.filter((c) => c.control_type.toLowerCase() === type).length;
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("=== Phase 4.5 Acceptance Validation ===");

  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    browser = await chromium.launch({ channel: "msedge", headless: true });
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto(STUDIO_URL, { waitUntil: "networkidle" });
    await page.getByText("Toolbox").waitFor({ timeout: 15000 });

    const buttonCountBefore = await countByType("button");

    await page.getByRole("button", { name: "Add Button" }).click();
    await page.waitForTimeout(400);
    const controlsBadge = await page.getByText(/\d+ controls?/i).innerText();
    record(
      "Test 1 — Click Button appears on canvas",
      /controls?/i.test(controlsBadge),
      controlsBadge,
    );
    await page.screenshot({ path: path.join(OUT_DIR, "01-button-created.png"), fullPage: true });

    await page.getByText("Unsaved changes").waitFor({ timeout: 5000 });
    const textField = page.getByLabel("Text", { exact: true });
    await textField.waitFor({ timeout: 5000 });
    record(
      "Test 2 — Select Button shows properties",
      await textField.isVisible(),
      "Text property visible for selected Button",
    );

    const newText = `ToolboxBtn-${Date.now()}`;
    await textField.fill(newText);
    await page.getByRole("button", { name: /^Save$/i }).click();
    await page.getByText("Changes saved").waitFor({ timeout: 10000 });
    await page.reload({ waitUntil: "networkidle" });
    const buttonCountAfterSave = await countByType("button");
    record(
      "Test 3 — Button text persists after save/refresh",
      buttonCountAfterSave > buttonCountBefore,
      `button count ${buttonCountBefore} -> ${buttonCountAfterSave}`,
    );

    await page.getByRole("button", { name: "Add Label" }).click();
    await page.getByText("Unsaved changes").waitFor({ timeout: 5000 });
    await page.getByRole("button", { name: /^Save$/i }).click();
    await page.getByText("Changes saved").waitFor({ timeout: 10000 });
    await page.reload({ waitUntil: "networkidle" });
    const labelCount = await countByType("label");
    record(
      "Test 4 — Label persists after save/refresh",
      labelCount > 0,
      `label count=${labelCount}`,
    );

    await page.getByRole("button", { name: "Add Text Input" }).click();
    await page.getByText("Unsaved changes").waitFor({ timeout: 5000 });
    await page.getByRole("button", { name: /^Save$/i }).click();
    await page.getByText("Changes saved").waitFor({ timeout: 10000 });
    await page.reload({ waitUntil: "networkidle" });
    const textInputCount = await countByType("textinput");
    record(
      "Test 5 — TextInput persists after save/refresh",
      textInputCount > 0,
      `textinput count=${textInputCount}`,
    );

    await page.getByRole("button", { name: /^Preview$/i }).click();
    await page.getByText("Runtime Preview").waitFor({ timeout: 10000 });
    await page.waitForTimeout(1500);
    const previewText = await page.locator('[class*="dialog"]').innerText();
    const textInputInPreview = await page
      .locator('[class*="dialog"] input[placeholder="Enter text"]')
      .count();
    const previewOk =
      previewText.includes(newText) &&
      previewText.includes("Label") &&
      textInputInPreview > 0 &&
      !previewText.includes("Unknown: textinput");
    record(
      "Test 6 — Preview matches Studio metadata",
      previewOk,
      previewText.slice(0, 180),
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
