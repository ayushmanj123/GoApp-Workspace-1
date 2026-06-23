/**
 * Phase 4.3.8 acceptance validation — API + Studio UI (system Chrome).
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../.validation-4.3.8");
const LOG_FILE = path.join(OUT_DIR, "validation.log");

const TENANT = "00000000-0000-4000-8000-000000000001";
const APP_ID = "00000000-0000-4000-8000-000000000003";
const SCREEN_ID = "00000000-0000-4000-8000-000000000004";
const BUTTON_ID = "00000000-0000-4000-8000-000000000007";
const API = "http://localhost:8082/api/v1";
const STUDIO_URL = `http://localhost:5173/studio/apps/${APP_ID}/screens/${SCREEN_ID}`;

const ARTBOARD_W = 1366;
const ARTBOARD_H = 768;
const PADDING = 48;

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
  if (!res.ok || !body.success) {
    throw new Error(`GET ${path} failed: ${JSON.stringify(body)}`);
  }
  return body.data;
}

async function apiPut(path, payload) {
  const res = await fetch(`${API}${path}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
  if (res.status === 204) return null;
  const body = await res.json();
  if (!res.ok || (body.success === false)) {
    throw new Error(`PUT ${path} failed: ${JSON.stringify(body)}`);
  }
  return body.data;
}

function readTextValue(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "value" in value) {
    return String(value.value ?? "");
  }
  return "";
}

function buildPropertiesPayload(properties) {
  if (!properties) return null;
  const payload = {};
  if ("text" in properties) {
    payload.text = { value: readTextValue(properties.text) };
  }
  return Object.keys(payload).length > 0 ? payload : null;
}

/** Mirrors applicationStore.saveScreen() */
async function saveScreen(controls) {
  const errors = [];
  await Promise.all(
    controls.map(async (control) => {
      try {
        await apiPut(`/controls/${control.id}`, {
          name: control.name,
          control_type: control.control_type,
          x: control.x,
          y: control.y,
          width: control.width,
          height: control.height,
          z_index: control.z_index,
          parent_control_id: control.parent_control_id,
        });
      } catch (err) {
        errors.push(`${control.name}: ${err.message}`);
      }
      const props = buildPropertiesPayload(control.properties);
      if (!props) return;
      try {
        await apiPut(`/controls/${control.id}/properties`, { properties: props });
      } catch (err) {
        errors.push(`${control.name} properties: ${err.message}`);
      }
    }),
  );
  return { success: errors.length === 0, errors };
}

/** Mirrors applicationStore.loadControls() */
async function loadControls(screenId) {
  const data = await apiGet(`/screens/${screenId}/controls`);
  return Promise.all(
    data.items.map(async (control) => {
      try {
        const properties = await apiGet(`/controls/${control.id}/properties`);
        return { ...control, properties };
      } catch {
        return { ...control, properties: control.properties ?? null };
      }
    }),
  );
}

async function getRuntimeButtonText() {
  const pkg = await apiGet(`/runtime/applications/${APP_ID}`);
  const screen = pkg.screens?.find((s) => s.id === SCREEN_ID);
  const findButton = (nodes) => {
    for (const node of nodes ?? []) {
      if (node.id === BUTTON_ID) return node;
      const child = findButton(node.children);
      if (child) return child;
    }
    return null;
  };
  const button = findButton(screen?.controls);
  return readTextValue(button?.properties?.text);
}

async function runApiTests(baseline) {
  log("--- API validation (mirrors saveScreen/loadControls) ---");

  let controls = await loadControls(SCREEN_ID);
  let button = controls.find((c) => c.id === BUTTON_ID);
  button = { ...button, x: 150, y: 130 };
  controls = controls.map((c) => (c.id === BUTTON_ID ? button : c));
  let save = await saveScreen(controls);
  record("Test 1 — Position persistence (API)", save.success, save.errors.join("; ") || "saved x=150 y=130");
  controls = await loadControls(SCREEN_ID);
  button = controls.find((c) => c.id === BUTTON_ID);
  record(
    "Test 1 — Position reload (API)",
    button.x === 150 && button.y === 130,
    `x=${button.x}, y=${button.y}`,
  );

  button = { ...button, width: 220, height: 66 };
  controls = controls.map((c) => (c.id === BUTTON_ID ? button : c));
  save = await saveScreen(controls);
  record("Test 2 — Resize persistence (API)", save.success, save.errors.join("; ") || "saved w=220 h=66");
  controls = await loadControls(SCREEN_ID);
  button = controls.find((c) => c.id === BUTTON_ID);
  record(
    "Test 2 — Resize reload (API)",
    button.width === 220 && button.height === 66,
    `w=${button.width}, h=${button.height}`,
  );

  const testText = `Validated-${Date.now()}`;
  button = {
    ...button,
    properties: { ...(button.properties ?? {}), text: { value: testText } },
  };
  controls = controls.map((c) => (c.id === BUTTON_ID ? button : c));
  save = await saveScreen(controls);
  record("Test 3 — Text persistence (API)", save.success, save.errors.join("; ") || `saved text=${testText}`);
  controls = await loadControls(SCREEN_ID);
  button = controls.find((c) => c.id === BUTTON_ID);
  const loadedText = readTextValue(button.properties?.text);
  record("Test 3 — Text reload (API)", loadedText === testText, `text='${loadedText}'`);

  const previewText = `Preview-${Date.now()}`;
  button = {
    ...button,
    properties: { ...(button.properties ?? {}), text: { value: previewText } },
  };
  controls = controls.map((c) => (c.id === BUTTON_ID ? button : c));
  await saveScreen(controls);
  const runtimeText = await getRuntimeButtonText();
  record(
    "Test 4 — Preview consistency (runtime API)",
    runtimeText === previewText,
    `runtime text='${runtimeText}' expected='${previewText}'`,
  );

  // Restore baseline
  const restoreControls = controls.map((c) =>
    c.id === BUTTON_ID
      ? {
          ...baseline.control,
          properties: baseline.properties,
        }
      : c,
  );
  await saveScreen(restoreControls);
  log("Baseline restored via API");
}

async function restoreSeedBaseline() {
  const controls = await loadControls(SCREEN_ID);
  const updated = controls.map((c) => {
    if (c.id === BUTTON_ID) {
      return {
        ...c,
        x: 32,
        y: 120,
        width: 160,
        height: 44,
        properties: { text: { value: "Save" } },
      };
    }
    return c;
  });
  await saveScreen(updated);
}

async function selectSaveButton(page) {
  const stage = page.locator('[class*="stageContainer"]').first();
  await stage.waitFor({ state: "visible", timeout: 15000 });
  const box = await stage.boundingBox();
  if (!box) throw new Error("stage container has no bounding box");
  const stageX = Math.max((box.width - ARTBOARD_W) / 2, PADDING);
  const stageY = Math.max((box.height - ARTBOARD_H) / 2, PADDING);
  const control = await apiGet(`/screens/${SCREEN_ID}/controls`).then((d) =>
    d.items.find((c) => c.id === BUTTON_ID),
  );
  await page.mouse.click(
    box.x + stageX + control.x + control.width / 2,
    box.y + stageY + control.y + control.height / 2,
  );
  await page.waitForTimeout(400);
  await page.locator("footer").getByText(BUTTON_ID.slice(0, 8), { exact: false }).waitFor({
    state: "visible",
    timeout: 8000,
  });
}

async function runUiTests() {
  log("--- UI validation (Studio + system Chrome) ---");
  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    try {
      browser = await chromium.launch({ channel: "msedge", headless: true });
    } catch (err) {
      record("UI tests", false, `No system Chrome/Edge available: ${err.message}`);
      return;
    }
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto(STUDIO_URL, { waitUntil: "networkidle" });
    await page.getByText(/3 controls/i).waitFor({ timeout: 20000 });
    await page.screenshot({ path: path.join(OUT_DIR, "ui-00-loaded.png"), fullPage: true });

    await selectSaveButton(page);
    const currentX = await page.getByLabel("X", { exact: true }).inputValue();
    const nextX = String(Number(currentX) + 17);
    await page.getByLabel("X", { exact: true }).fill(nextX);
    const dirty = await page.getByText("Unsaved changes").isVisible();
    record("Test 5 — Dirty state (UI)", dirty, dirty ? "StatusBar shows Unsaved changes" : "missing dirty indicator");
    await page.screenshot({ path: path.join(OUT_DIR, "ui-05-dirty.png"), fullPage: true });

    await page.getByRole("button", { name: /^Save$/i }).click();
    await page.getByText("Changes saved").waitFor({ timeout: 10000 });
    const dirtyAfter = await page.getByText("Unsaved changes").isVisible().catch(() => false);
    record("Test 5 — Dirty cleared (UI)", !dirtyAfter, "Unsaved changes cleared after save");
    await page.screenshot({ path: path.join(OUT_DIR, "ui-05-saved.png"), fullPage: true });

    await page.reload({ waitUntil: "networkidle" });
    await selectSaveButton(page);
    const xVal = await page.getByLabel("X", { exact: true }).inputValue();
    record("Test 1 — Position persistence (UI)", xVal === nextX, `property panel X=${xVal} expected ${nextX}`);
    await page.screenshot({ path: path.join(OUT_DIR, "ui-01-position.png"), fullPage: true });

    const uiText = `UI-Text-${Date.now()}`;
    await page.getByLabel("Text", { exact: true }).fill(uiText);
    await page.getByRole("button", { name: /^Save$/i }).click();
    await page.getByText("Changes saved").waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: /^Preview$/i }).click();
    await page.getByText("Runtime Preview").waitFor({ timeout: 10000 });
    await page.waitForTimeout(2000);
    const dialogText = await page.locator('[class*="dialog"]').innerText();
    const previewOk = dialogText.includes(uiText);
    record("Test 4 — Preview consistency (UI)", previewOk, previewOk ? `found '${uiText}'` : dialogText.slice(0, 120));
    await page.screenshot({ path: path.join(OUT_DIR, "ui-04-preview.png"), fullPage: true });
  } finally {
    await browser.close();
  }
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("=== Phase 4.3.8 Acceptance Validation ===");

  const baselineControl = (await apiGet(`/screens/${SCREEN_ID}/controls`)).items.find(
    (c) => c.id === BUTTON_ID,
  );
  const baselineProps = await apiGet(`/controls/${BUTTON_ID}/properties`);
  const baseline = { control: baselineControl, properties: baselineProps };
  log(`Baseline: x=${baselineControl.x}, text=${JSON.stringify(baselineProps.text)}`);

  await runApiTests(baseline);
  await restoreSeedBaseline();
  await runUiTests();
  await restoreSeedBaseline();

  const failed = results.filter((r) => !r.passed).length;
  log(`=== Summary: ${results.length - failed}/${results.length} passed ===`);
  fs.writeFileSync(path.join(OUT_DIR, "results.json"), JSON.stringify(results, null, 2));
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  log(`FATAL: ${err.stack || err}`);
  process.exit(1);
});
