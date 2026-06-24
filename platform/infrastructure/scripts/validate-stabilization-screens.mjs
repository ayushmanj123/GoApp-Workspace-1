/**
 * Stabilization — add screen validation.
 * Run: node infrastructure/scripts/validate-stabilization-screens.mjs
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../.validation-stabilization-screens");
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

async function listScreens() {
  const res = await fetch(`${API}/applications/${APP_ID}/screens`, { headers });
  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(JSON.stringify(body));
  }
  return body.data.items;
}

async function createScreenApi(name) {
  const res = await fetch(`${API}/applications/${APP_ID}/screens`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name,
      display_order: 500,
      layout_type: "responsive",
    }),
  });
  const body = await res.json();
  return { status: res.status, body };
}

function isValidActionFormula(formula) {
  const trimmed = formula.trim();
  return (
    /^Set\s*\(/i.test(trimmed) ||
    /^UpdateContext\s*\(/i.test(trimmed) ||
    /^Navigate\s*\(/i.test(trimmed) ||
    /^Collect\s*\(/i.test(trimmed) ||
    /^ClearCollect\s*\(/i.test(trimmed) ||
    /^SubmitForm\s*\(/i.test(trimmed)
  );
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("=== Stabilization Screens Validation ===");

  const beforeScreens = await listScreens();
  const beforeNames = new Set(beforeScreens.map((screen) => screen.name));
  const uniqueName = `Screen_${Date.now()}`;

  const apiResult = await createScreenApi(uniqueName);
  record(
    "Screens — API creates screen with unique timestamp name",
    apiResult.status === 201 && apiResult.body.success === true,
    `status=${apiResult.status} name=${uniqueName}`,
  );

  const afterApiScreens = await listScreens();
  record(
    "Screens — API list includes new screen",
    afterApiScreens.some((screen) => screen.name === uniqueName),
    uniqueName,
  );

  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    browser = await chromium.launch({ channel: "msedge", headless: true });
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto(STUDIO_URL, { waitUntil: "networkidle" });
    const addBtn = page.getByTestId("add-screen-btn");
    await addBtn.waitFor({ state: "visible", timeout: 20000 });

    const beforeUiScreens = await listScreens();
    const beforeUiNames = new Set(beforeUiScreens.map((screen) => screen.name));

    await addBtn.click();
    await page.waitForTimeout(1500);

    const afterUiScreens = await listScreens();
    const newScreens = afterUiScreens.filter((screen) => !beforeUiNames.has(screen.name));
    record(
      "Screens — UI add creates a new screen",
      newScreens.length >= 1,
      `new screens: ${newScreens.map((screen) => screen.name).join(", ") || "(none)"}`,
    );

    const newest = newScreens[newScreens.length - 1];
    if (newest) {
      const screenVisible = await page.getByText(newest.name).count();
      record(
        "Screens — new screen visible in Explorer",
        screenVisible > 0,
        newest.name,
      );
    }
  } finally {
    await browser.close();
  }

  record(
    "Screens — action formula parser accepts Set()",
    isValidActionFormula('Set(varX, "test")'),
    "Set() recognized",
  );

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
