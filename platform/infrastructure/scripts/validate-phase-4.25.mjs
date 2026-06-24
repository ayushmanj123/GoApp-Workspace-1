/**
 * Phase 4.25 acceptance validation — Gallery Foundation.
 * Run: node infrastructure/scripts/validate-phase-4.25.mjs
 */
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-4.25");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const FORMULA_API = "http://localhost:8085";
const METADATA_API = "http://localhost:8082/api/v1";
const STUDIO_BASE = "http://localhost:5173";

const TENANT = "00000000-0000-4000-8000-000000000001";
const APP_ID = "00000000-0000-4000-8000-000000000003";
const SCREEN1_ID = "00000000-0000-4000-8000-000000000004";
const STUDIO_URL = `http://localhost:5173/studio/apps/${APP_ID}/screens/${SCREEN1_ID}`;
const SCREEN2_ID_FILE = path.resolve(ROOT, ".validation-4.21", "screen2-id.txt");
const GALLERY_ID_FILE = path.join(OUT_DIR, "gallery-id.txt");

const results = [];
let apiProcess = null;
let studioStartedByScript = false;
let studioProcess = null;
let screen2Id = null;
let navScreenName = "Screen2Active";
let galleryId = null;
let filterGalleryId = null;

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
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function waitForFormulaApi(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(`${FORMULA_API}/health`)).ok) return;
    } catch { /* retry */ }
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
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Metadata service not available on :8082.");
}

async function ensureStudio() {
  try {
    const res = await fetch(STUDIO_BASE);
    if (res.ok || res.status === 304) return;
  } catch { /* not running */ }
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
    } catch { /* retry */ }
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

async function listScreens() {
  const res = await fetch(`${METADATA_API}/applications/${APP_ID}/screens`, {
    headers: { "X-Tenant-Id": TENANT },
  });
  const body = await res.json();
  return body.data?.items ?? [];
}

async function listControls(screenId) {
  const res = await fetch(`${METADATA_API}/screens/${screenId}/controls`, {
    headers: { "X-Tenant-Id": TENANT },
  });
  const body = await res.json();
  return body.data?.items ?? [];
}

async function renameScreen(screenId, name) {
  await fetch(`${METADATA_API}/screens/${screenId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Tenant-Id": TENANT },
    body: JSON.stringify({ name }),
  });
}

async function createControlViaApi(screenId, name, controlType, x, y, width, height, properties) {
  const res = await fetch(`${METADATA_API}/screens/${screenId}/controls`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Tenant-Id": TENANT },
    body: JSON.stringify({ name, control_type: controlType, x, y, width, height, z_index: 50, parent_control_id: null }),
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(`Create control failed: ${JSON.stringify(body)}`);
  const propRes = await fetch(`${METADATA_API}/controls/${body.data.id}/properties`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Tenant-Id": TENANT },
    body: JSON.stringify({ properties }),
  });
  if (!propRes.ok) throw new Error(`Property update failed: ${propRes.status}`);
  return body.data;
}

async function cleanupTestControls(testNames) {
  for (const screenId of [SCREEN1_ID, screen2Id].filter(Boolean)) {
    const items = await listControls(screenId);
    for (const c of items) {
      if (testNames.has(c.name)) {
        await fetch(`${METADATA_API}/controls/${c.id}`, {
          method: "DELETE",
          headers: { "X-Tenant-Id": TENANT },
        });
      }
    }
  }
}

async function ensureScreen2() {
  const items = await listScreens();
  const existing = items.find((s) => s.name === "Screen2" || s.name === "Screen2Active");
  if (existing) {
    screen2Id = existing.id;
    navScreenName = existing.name;
    return;
  }
  if (existsSync(SCREEN2_ID_FILE)) {
    const savedId = fs.readFileSync(SCREEN2_ID_FILE, "utf8").trim();
    const saved = items.find((s) => s.id === savedId);
    if (saved) {
      screen2Id = saved.id;
      navScreenName = saved.name;
      return;
    }
  }
  throw new Error("Screen2 not found.");
}

async function openPreview(page) {
  await page.getByRole("button", { name: /^Preview$/i }).click();
  await page.getByText("Runtime Preview").waitFor({ timeout: 10000 });
  await page.waitForTimeout(500);
}

async function runAction(page, formula) {
  return page.evaluate(async (f) => {
    const fn = window.__executeAction;
    if (!fn) return { ok: false, error: "__executeAction not exposed" };
    return fn(f);
  }, formula);
}

async function galleryHasTexts(page, names) {
  const dialog = page.locator('[class*="dialog"]');
  for (const name of names) {
    const visible = await dialog.getByText(name, { exact: true }).first()
      .isVisible()
      .catch(() => false);
    if (!visible) return false;
  }
  return true;
}

async function filterGalleryShowsJohnOnly(page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('[class*="dialog"]');
    if (!dialog) return false;
    const galleries = Array.from(
      dialog.querySelectorAll("div[style*='flex-direction: column']"),
    );
    return galleries.some((gallery) => {
      const rowTexts = Array.from(gallery.children)
        .map((el) => el.textContent?.trim() ?? "")
        .filter(Boolean);
      return rowTexts.length === 1 && rowTexts[0] === "John";
    });
  });
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("=== Phase 4.25 Acceptance Validation ===");

  const build = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@goapps/formula", "build"],
    { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" },
  );
  if (build.status !== 0) throw new Error("Failed to build @goapps/formula.");

  const dotnet = existsSync(path.join(ROOT, ".dotnet", "dotnet.exe"))
    ? path.join(ROOT, ".dotnet", "dotnet.exe")
    : "dotnet";
  const dotnetBuild = spawnSync(
    dotnet,
    ["build", path.join(ROOT, "packages", "formula", "dotnet", "GoApps.PowerFx", "GoApps.PowerFx.csproj")],
    { stdio: "inherit" },
  );
  if (dotnetBuild.status !== 0) throw new Error("Failed to build GoApps.PowerFx.");

  startFormulaApi();
  await waitForFormulaApi();
  await waitForMetadata();
  await ensureScreen2();

  const stamp = Date.now();
  const testNames = new Set([
    `GalClear_${stamp}`,
    `GalCollect_${stamp}`,
    `GalNav_${stamp}`,
    `GalGoBack_${stamp}`,
    `GalVarLbl_${stamp}`,
    `GalSetBtn_${stamp}`,
    `GalMain_${stamp}`,
    `GalFilter_${stamp}`,
    `GalBad_${stamp}`,
  ]);

  await cleanupTestControls(testNames);

  const screens = await listScreens();
  const screen1 = screens.find((s) => s.id === SCREEN1_ID);
  const originalScreen1Name = screen1?.name ?? "Screen1";
  await renameScreen(SCREEN1_ID, "Screen1");

  const gallery = await createControlViaApi(SCREEN1_ID, `GalMain_${stamp}`, "gallery", 100, 80, 280, 180, {
    items: { formula: "Customers" },
  });
  galleryId = gallery.id;
  fs.writeFileSync(GALLERY_ID_FILE, galleryId);

  const filterGallery = await createControlViaApi(SCREEN1_ID, `GalFilter_${stamp}`, "gallery", 420, 80, 280, 180, {
    items: { formula: 'Filter(Customers, Name = "John")' },
  });
  filterGalleryId = filterGallery.id;

  await createControlViaApi(SCREEN1_ID, `GalClear_${stamp}`, "button", 100, 300, 200, 44, {
    text: { value: `GalClearBtn_${stamp}` },
    onSelect: { formula: 'ClearCollect(Customers, { Name: "John" })' },
  });
  await createControlViaApi(SCREEN1_ID, `GalCollect_${stamp}`, "button", 100, 360, 200, 44, {
    text: { value: `GalCollectBtn_${stamp}` },
    onSelect: { formula: 'Collect(Customers, { Name: "Jane" })' },
  });
  await createControlViaApi(SCREEN1_ID, `GalNav_${stamp}`, "button", 100, 420, 180, 44, {
    text: { value: `GalNavS2_${stamp}` },
    onSelect: { formula: `Navigate(${navScreenName})` },
  });
  await createControlViaApi(SCREEN1_ID, `GalSetBtn_${stamp}`, "button", 100, 480, 200, 44, {
    text: { value: `GalSetBtn_${stamp}` },
    onSelect: { formula: 'Set(varTitle, "GalleryOK")' },
  });
  await createControlViaApi(SCREEN1_ID, `GalVarLbl_${stamp}`, "label", 100, 540, 200, 40, {
    text: { formula: "varTitle" },
  });
  await createControlViaApi(screen2Id, `GalGoBack_${stamp}`, "button", 100, 300, 180, 44, {
    text: { value: `GalGoS1_${stamp}` },
    onSelect: { formula: "Navigate(Screen1)" },
  });

  const badGallery = await createControlViaApi(SCREEN1_ID, `GalBad_${stamp}`, "gallery", 100, 600, 280, 120, {
    items: { formula: "MissingCollection" },
  });

  const btnClear = `GalClearBtn_${stamp}`;
  const btnCollect = `GalCollectBtn_${stamp}`;
  const btnNavS2 = `GalNavS2_${stamp}`;
  const btnNavS1 = `GalGoS1_${stamp}`;
  const btnSet = `GalSetBtn_${stamp}`;

  await ensureStudio();

  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    browser = await chromium.launch({ channel: "msedge", headless: true });
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  try {
    await page.goto(STUDIO_URL, { waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await openPreview(page);
    const dialog = page.locator('[class*="dialog"]');

    // Test 1
    await dialog.getByRole("button", { name: btnClear, exact: true }).click();
    await page.waitForTimeout(1000);
    const test1 = await galleryHasTexts(page, ["John"]);
    record("Test 1 — ClearCollect shows John in gallery", test1, `john=${test1}`);

    // Test 2
    await dialog.getByRole("button", { name: btnCollect, exact: true }).click();
    await page.waitForTimeout(1000);
    const test2 = await galleryHasTexts(page, ["John", "Jane"]);
    record("Test 2 — Collect appends Jane", test2, `john+jane=${test2}`);

    // Test 3 — Filter gallery shows only John
    const test3 = await filterGalleryShowsJohnOnly(page);
    record("Test 3 — Filter gallery shows John only", test3, `filtered=${test3}`);

    // Test 4 — reactive (no reload between actions above)
    record("Test 4 — Collection updates reactively", test2, "no refresh used");

    // Test 5 — navigation
    await dialog.getByRole("button", { name: btnNavS2, exact: true }).click();
    await dialog.getByRole("heading", { name: navScreenName }).waitFor({ timeout: 10000 });
    await dialog.getByRole("button", { name: btnNavS1, exact: true }).click();
    await dialog.getByRole("heading", { name: "Screen1" }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(800);
    const test5 = await galleryHasTexts(page, ["John", "Jane"]);
    record("Test 5 — Gallery survives navigation", test5, `afterNav=${test5}`);

    // Test 6 — regression
    await dialog.getByRole("button", { name: btnSet, exact: true }).click();
    await page.waitForTimeout(800);
    const varOk = await dialog.getByText("GalleryOK", { exact: true }).first().isVisible().catch(() => false);
    record("Test 6 — Variables/Set continue working", varOk, `varTitle visible: ${varOk}`);

    // Test 7 — invalid items
    const errsBefore = consoleErrors.length;
    await page.waitForTimeout(300);
    const badRows = await page.evaluate(() => {
      const dialog = document.querySelector('[class*="dialog"]');
      if (!dialog) return -1;
      const galleries = Array.from(dialog.querySelectorAll("div[style*='flex-direction: column']"));
      return galleries.length;
    });
    record(
      "Test 7 — Invalid Items formula does not crash",
      consoleErrors.length === errsBefore && badRows >= 1,
      `galleries=${badRows}, errors=${consoleErrors.length - errsBefore}`,
    );

    // Test 8 — reload persists gallery metadata
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    const controlsAfter = await listControls(SCREEN1_ID);
    const persisted = controlsAfter.find((c) => c.id === galleryId);
    await openPreview(page);
    const dialog2 = page.locator('[class*="dialog"]');
    await dialog2.getByRole("button", { name: btnClear, exact: true }).click();
    await page.waitForTimeout(1000);
    const afterReload = await galleryHasTexts(page, ["John"]);
    record(
      "Test 8 — Gallery metadata persists after reload",
      persisted?.control_type === "gallery" && afterReload,
      `type=${persisted?.control_type}, john=${afterReload}`,
    );

  } finally {
    await browser.close();
    await stopStudioDev();
    await cleanupTestControls(testNames);
    await renameScreen(SCREEN1_ID, originalScreen1Name);
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
