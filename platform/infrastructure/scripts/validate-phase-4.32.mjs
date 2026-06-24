/**
 * Phase 4.32 acceptance validation — Timer Control Foundation.
 * Run: node infrastructure/scripts/validate-phase-4.32.mjs
 */
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-4.32");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const FORMULA_API = "http://localhost:8085";
const METADATA_API = "http://localhost:8082/api/v1";
const STUDIO_BASE = "http://localhost:5173";

const TENANT = "00000000-0000-4000-8000-000000000001";
const APP_ID = "00000000-0000-4000-8000-000000000003";
const SCREEN1_ID = "00000000-0000-4000-8000-000000000004";
const STUDIO_URL = `http://localhost:5173/studio/apps/${APP_ID}/screens/${SCREEN1_ID}`;
const SCREEN2_ID_FILE = path.resolve(ROOT, ".validation-4.21", "screen2-id.txt");

const results = [];
let apiProcess = null;
let studioStartedByScript = false;
let studioProcess = null;
let screen2Id = null;
let navScreenName = "Screen2Active";
let originalOnStart = null;

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
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Formula API did not start.");
}

async function waitForMetadata(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${METADATA_API}/applications/${APP_ID}`, {
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

async function setApplicationOnStart(formula) {
  await fetch(`${METADATA_API}/applications/${APP_ID}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Tenant-Id": TENANT },
    body: JSON.stringify({ on_start: formula }),
  });
}

async function setScreenOnVisible(screenId, formula) {
  await fetch(`${METADATA_API}/screens/${screenId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Tenant-Id": TENANT },
    body: JSON.stringify({ on_visible: formula }),
  });
}

async function createControlViaApi(screenId, name, controlType, x, y, width, height, properties, parentControlId = null) {
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
      parent_control_id: parentControlId,
    }),
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
    const items = await fetch(`${METADATA_API}/screens/${screenId}/controls`, {
      headers: { "X-Tenant-Id": TENANT },
    }).then((r) => r.json()).then((b) => b.data?.items ?? []);
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
  const res = await fetch(`${METADATA_API}/applications/${APP_ID}/screens`, {
    headers: { "X-Tenant-Id": TENANT },
  });
  const items = (await res.json()).data?.items ?? [];
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
  const dialog = page.locator('[class*="dialog"]');
  await dialog.getByRole("heading", { name: "Screen1" }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(500);
  return dialog;
}

async function dialogHasText(page, text) {
  const dialog = page.locator('[class*="dialog"]');
  return dialog.getByText(text, { exact: true }).first().isVisible().catch(() => false);
}

async function getCollection(page, name) {
  return page.evaluate((n) => {
    const store = window.__collectionStore;
    return store ? store.get(n) : null;
  }, name);
}

async function waitForTimer(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function waitForText(page, text, timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await dialogHasText(page, text)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("=== Phase 4.32 Acceptance Validation ===");

  const typeRuntime = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@goapps/runtime", "typecheck"],
    { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" },
  );
  record("Test 9 — TypeScript clean", typeRuntime.status === 0, `exit=${typeRuntime.status}`);
  if (typeRuntime.status !== 0) process.exit(1);

  spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@goapps/formula", "build"],
    { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" },
  );

  startFormulaApi();
  await waitForFormulaApi();
  await waitForMetadata();
  await ensureScreen2();

  const appRes = await fetch(`${METADATA_API}/applications/${APP_ID}`, {
    headers: { "X-Tenant-Id": TENANT },
  });
  originalOnStart = (await appRes.json()).data?.on_start ?? "";

  const stamp = Date.now();
  const testNames = new Set([
    `TmLbl_${stamp}`,
    `TmOnce_${stamp}`,
    `TmGal_${stamp}`,
    `TmGalLbl_${stamp}`,
    `TmCol_${stamp}`,
    `TmColGal_${stamp}`,
    `TmColLbl_${stamp}`,
    `TmNav_${stamp}`,
    `TmBad_${stamp}`,
    `TmSet_${stamp}`,
    `TmVisLbl7_${stamp}`,
    `TmBack_${stamp}`,
    `TmOnStart_${stamp}`,
    `TmReg7_${stamp}`,
    `TmReg8_${stamp}`,
  ]);

  await cleanupTestControls(testNames);
  await setApplicationOnStart("");
  await setScreenOnVisible(SCREEN1_ID, "");
  await setScreenOnVisible(screen2Id, "");

  await createControlViaApi(SCREEN1_ID, `TmLbl_${stamp}`, "label", 100, 80, 220, 36, {
    text: { formula: "varTitle" },
  });

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
    // Test 1 — Set(varTitle, "Finished") after 100ms
    await createControlViaApi(SCREEN1_ID, `TmSet_${stamp}`, "timer", 100, 130, 100, 28, {
      duration: { value: 100 },
      onTimerEnd: { formula: 'Set(varTitle, "Finished")' },
    });
    await page.goto(STUDIO_URL, { waitUntil: "networkidle" });
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await openPreview(page);
    const test1 = await waitForText(page, "Finished");
    record("Test 1 — OnTimerEnd Set shows Finished", test1, `finished=${test1}`);

    // Test 2 — Timer fires exactly once
    await page.keyboard.press("Escape");
    await cleanupTestControls(new Set([`TmSet_${stamp}`, `TmOnce_${stamp}`, `TmGal_${stamp}`, `TmGalLbl_${stamp}`]));
    const gallery = await createControlViaApi(
      SCREEN1_ID,
      `TmGal_${stamp}`,
      "gallery",
      100,
      180,
      260,
      160,
      { items: { formula: "TimerOnce" } },
    );
    await createControlViaApi(
      SCREEN1_ID,
      `TmGalLbl_${stamp}`,
      "label",
      8,
      8,
      200,
      28,
      { text: { formula: "ThisItem.Name" } },
      gallery.id,
    );
    await createControlViaApi(SCREEN1_ID, `TmOnce_${stamp}`, "timer", 100, 360, 100, 28, {
      duration: { value: 100 },
      onTimerEnd: { formula: 'Collect(TimerOnce, { Name: "Once" })' },
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await openPreview(page);
    await waitForTimer(600);
    const onceAfter = await getCollection(page, "TimerOnce");
    await waitForTimer(800);
    const onceLater = await getCollection(page, "TimerOnce");
    const test2 =
      onceAfter?.length === 1 &&
      onceLater?.length === 1 &&
      onceAfter[0]?.Name === "Once";
    record("Test 2 — Timer fires exactly once", test2, JSON.stringify({ after: onceAfter?.length, later: onceLater?.length }));

    // Test 3 — Collect action works
    await page.keyboard.press("Escape");
    await cleanupTestControls(new Set([`TmOnce_${stamp}`, `TmGal_${stamp}`, `TmGalLbl_${stamp}`, `TmCol_${stamp}`, `TmColGal_${stamp}`, `TmColLbl_${stamp}`]));
    const colGallery = await createControlViaApi(
      SCREEN1_ID,
      `TmColGal_${stamp}`,
      "gallery",
      100,
      180,
      260,
      160,
      { items: { formula: "TimerCol" } },
    );
    await createControlViaApi(
      SCREEN1_ID,
      `TmColLbl_${stamp}`,
      "label",
      8,
      8,
      200,
      28,
      { text: { formula: "ThisItem.Name" } },
      colGallery.id,
    );
    await createControlViaApi(SCREEN1_ID, `TmCol_${stamp}`, "timer", 100, 400, 100, 28, {
      duration: { value: 100 },
      onTimerEnd: { formula: 'Collect(TimerCol, { Name: "John" })' },
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await openPreview(page);
    const test3 = await waitForText(page, "John");
    const colData = await getCollection(page, "TimerCol");
    record("Test 3 — Collect action works", test3, `john=${test3}, col=${colData?.length}`);

    // Test 4 — Navigate action works
    await page.keyboard.press("Escape");
    await cleanupTestControls(new Set([`TmCol_${stamp}`, `TmColGal_${stamp}`, `TmColLbl_${stamp}`, `TmNav_${stamp}`]));
    await createControlViaApi(screen2Id, `TmBack_${stamp}`, "button", 100, 300, 160, 40, {
      text: { value: `TmBackBtn_${stamp}` },
      onSelect: { formula: "Navigate(Screen1)" },
    });
    await createControlViaApi(SCREEN1_ID, `TmNav_${stamp}`, "timer", 100, 450, 100, 28, {
      duration: { value: 100 },
      onTimerEnd: { formula: `Navigate(${navScreenName})` },
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    const dialog4 = await openPreview(page);
    await waitForTimer(600);
    const test4 = await dialog4.getByRole("heading", { name: navScreenName }).isVisible().catch(() => false);
    record("Test 4 — Navigate action works", test4, `navigated=${test4}`);

    // Test 5 — Invalid formula does not crash
    await page.keyboard.press("Escape");
    await cleanupTestControls(new Set([`TmNav_${stamp}`, `TmBad_${stamp}`]));
    const errsBefore5 = consoleErrors.length;
    await createControlViaApi(SCREEN1_ID, `TmBad_${stamp}`, "timer", 100, 480, 100, 28, {
      duration: { value: 100 },
      onTimerEnd: { formula: "Set(" },
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await openPreview(page);
    await waitForTimer(600);
    const test5 = consoleErrors.length === errsBefore5;
    record("Test 5 — Invalid formula does not crash", test5, `errors=${consoleErrors.length}`);

    // Test 6 — OnStart still works
    await page.keyboard.press("Escape");
    await cleanupTestControls(new Set([`TmBad_${stamp}`]));
    await setApplicationOnStart('Set(varTitle, "OnStartOK")');
    await createControlViaApi(SCREEN1_ID, `TmOnStart_${stamp}`, "timer", 100, 130, 100, 28, {
      duration: { value: 5000 },
      onTimerEnd: { formula: 'Set(varTitle, "TimerWins")' },
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await openPreview(page);
    const test6 = await waitForText(page, "OnStartOK");
    record("Test 6 — OnStart still works", test6, `onStart=${test6}`);

    // Test 7 — OnVisible still works
    await page.keyboard.press("Escape");
    await cleanupTestControls(new Set([`TmOnStart_${stamp}`, `TmReg7_${stamp}`]));
    await setApplicationOnStart("");
    await setScreenOnVisible(screen2Id, 'Set(varTitle, "OnVisibleOK")');
    await createControlViaApi(screen2Id, `TmVisLbl7_${stamp}`, "label", 100, 80, 220, 36, {
      text: { formula: "varTitle" },
    });
    await createControlViaApi(SCREEN1_ID, `TmReg7_${stamp}`, "button", 100, 520, 160, 40, {
      text: { value: `TmGoS2_${stamp}` },
      onSelect: { formula: `Navigate(${navScreenName})` },
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    const dialog7 = await openPreview(page);
    await dialog7.getByRole("button", { name: `TmGoS2_${stamp}`, exact: true }).click();
    await dialog7.getByRole("heading", { name: navScreenName }).waitFor({ timeout: 10000 });
    const test7 = await waitForText(page, "OnVisibleOK");
    record("Test 7 — OnVisible still works", test7, `onVisible=${test7}`);

    // Test 8 — Regressions
    await dialog7.getByRole("button", { name: `TmBackBtn_${stamp}`, exact: true }).click();
    await dialog7.getByRole("heading", { name: "Screen1" }).waitFor({ timeout: 10000 });
    await createControlViaApi(SCREEN1_ID, `TmReg8_${stamp}`, "button", 100, 560, 160, 40, {
      text: { value: `TmRegBtn_${stamp}` },
      onSelect: { formula: 'Set(varTitle, "RegOK")' },
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    const dialog8 = await openPreview(page);
    await dialog8.getByRole("button", { name: `TmRegBtn_${stamp}`, exact: true }).click();
    const test8 =
      (await waitForText(page, "RegOK")) &&
      consoleErrors.length === errsBefore5;
    record("Test 8 — Forms/Galleries/Variables/Collections regressions", test8, `regOk=${await dialogHasText(page, "RegOK")}`);
  } finally {
    await browser.close();
    await stopStudioDev();
    await cleanupTestControls(testNames);
    await setApplicationOnStart(originalOnStart ?? "");
    await setScreenOnVisible(SCREEN1_ID, "");
    await setScreenOnVisible(screen2Id, "");
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
  try {
    await setApplicationOnStart(originalOnStart ?? "");
  } catch { /* ignore */ }
  process.exit(1);
});
