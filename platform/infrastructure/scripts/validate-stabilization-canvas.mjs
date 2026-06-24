/**
 * Stabilization — canvas selection validation.
 * Run: node infrastructure/scripts/validate-stabilization-canvas.mjs
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../.validation-stabilization-canvas");
const LOG_FILE = path.join(OUT_DIR, "validation.log");

const APP_ID = "00000000-0000-4000-8000-000000000003";
const SCREEN_ID = "00000000-0000-4000-8000-000000000004";
const STUDIO_URL = `http://localhost:5173/studio/apps/${APP_ID}/screens/${SCREEN_ID}`;

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

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("=== Stabilization Canvas Validation ===");

  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    browser = await chromium.launch({ channel: "msedge", headless: true });
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto(STUDIO_URL, { waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 20000 });

    const badgeBefore = await page.getByText(/\d+ controls?/i).innerText().catch(() => "0 controls");

    await page.getByRole("button", { name: "Add Button" }).click();
    await page.waitForTimeout(1000);

    const badgeAfter = await page.getByText(/\d+ controls?/i).innerText().catch(() => "");
    record(
      "Canvas — toolbox insert increases control count",
      badgeAfter !== badgeBefore,
      `${badgeBefore} -> ${badgeAfter}`,
    );

    const selectedVisible = (await page.locator("footer").getByText("Selected:").count()) > 0;
    record(
      "Canvas — inserted control is selected",
      selectedVisible,
      selectedVisible ? "status bar shows Selected" : "no selection shown",
    );

    const textFieldVisible = await page
      .getByLabel("Text", { exact: true })
      .isVisible()
      .catch(() => false);
    record(
      "Canvas — properties panel shows control fields",
      textFieldVisible,
      textFieldVisible ? "Text field visible" : "Text field not visible",
    );

    const designModeHint = await page.getByText(
      "Design mode — use Preview to test formulas",
    ).count();
    record(
      "Canvas — design mode hint visible",
      designModeHint > 0,
      `hint count=${designModeHint}`,
    );

    await page.screenshot({
      path: path.join(OUT_DIR, "canvas-controls.png"),
      fullPage: true,
    });
  } finally {
    await browser.close();
  }

  const failed = results.filter((item) => !item.passed);
  log(`=== ${results.length - failed.length}/${results.length} passed ===`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
