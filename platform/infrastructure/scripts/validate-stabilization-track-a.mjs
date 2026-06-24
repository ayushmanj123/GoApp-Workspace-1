/**
 * Stabilization Track A — Studio & Runtime Hardening validation.
 * Run: node infrastructure/scripts/validate-stabilization-track-a.mjs
 */
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-stabilization-a");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const FORMULA_API = "http://localhost:8085";
const METADATA_API = "http://localhost:8082/api/v1";
const STUDIO_BASE = "http://localhost:5173";

const TENANT = "00000000-0000-4000-8000-000000000001";
const APP_ID = "00000000-0000-4000-8000-000000000003";
const SCREEN1_ID = "00000000-0000-4000-8000-000000000004";
const STUDIO_URL = `http://localhost:5173/studio/apps/${APP_ID}/screens/${SCREEN1_ID}`;

const results = [];
let apiProcess = null;
let studioStartedByScript = false;
let studioProcess = null;

function log(line) {
  const msg = `[${new Date().toISOString()}] ${line}`;
  console.log(msg);
  fs.appendFileSync(LOG_FILE, `${msg}\n`);
}

function record(test, passed, detail) {
  results.push({ test, passed, detail });
  log(`${passed ? "PASS" : "FAIL"} — ${test}: ${detail}`);
}

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
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

async function listControls(screenId) {
  const res = await fetch(`${METADATA_API}/screens/${screenId}/controls`, {
    headers: { "X-Tenant-Id": TENANT },
  });
  const body = await res.json();
  return body.data?.items ?? [];
}

async function listScreens() {
  const res = await fetch(`${METADATA_API}/applications/${APP_ID}/screens`, {
    headers: { "X-Tenant-Id": TENANT },
  });
  const body = await res.json();
  return body.data?.items ?? [];
}

async function getScreen(screenId) {
  const items = await listScreens();
  return items.find((screen) => screen.id === screenId);
}

async function setScreenOnVisible(screenId, formula) {
  await fetch(`${METADATA_API}/screens/${screenId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Tenant-Id": TENANT },
    body: JSON.stringify({ on_visible: formula }),
  });
}

async function deleteControl(controlId) {
  await fetch(`${METADATA_API}/controls/${controlId}`, {
    method: "DELETE",
    headers: { "X-Tenant-Id": TENANT },
  });
}

async function cleanupControlsByPrefix(prefixes) {
  const items = await listControls(SCREEN1_ID);
  for (const control of items) {
    if (prefixes.some((prefix) => control.name.startsWith(prefix))) {
      await deleteControl(control.id);
    }
  }
}

function validateA1Static() {
  const canvasCss = readFile("apps/studio/src/components/canvas/CanvasPanel.module.css");
  const rendererCss = readFile("apps/studio/src/components/canvas/StudioControlRenderer.module.css");
  const canvasTsx = readFile("apps/studio/src/components/canvas/CanvasPanel.tsx");

  const previewClickThrough =
    canvasCss.includes(".controlPreview") &&
    canvasCss.includes(".controlPreview *") &&
    canvasCss.includes("pointer-events: none") &&
    rendererCss.includes(".host") &&
    rendererCss.includes(".host *") &&
    rendererCss.includes("pointer-events: none");

  const childHitTargetSkipped =
    canvasTsx.includes("if (control.parent_control_id)") &&
    canvasTsx.includes("return null");

  record(
    "A1 — Preview overlays are click-through (CSS)",
    previewClickThrough,
    `css=${previewClickThrough}`,
  );
  record(
    "A1 — Gallery/Form children skip separate hit targets",
    childHitTargetSkipped,
    `tsx=${childHitTargetSkipped}`,
  );
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

async function getCollection(page, name) {
  return page.evaluate((n) => {
    const store = window.__collectionStore;
    if (!store) return null;
    return store.get(n);
  }, name);
}

async function getScreenContext(page) {
  return page.evaluate(() => {
    const store = window.__screenContextStore;
    if (!store) return null;
    return store.getAll();
  });
}

async function runStudioTests() {
  await ensureStudio();

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
    await page.waitForTimeout(500);

    const hasStoreHook = await page.evaluate(() => Boolean(window.__applicationStore));
    record("Studio dev hooks exposed", hasStoreHook, `hook=${hasStoreHook}`);
    if (!hasStoreHook) return;

    await cleanupControlsByPrefix(["StabAGal_", "StabALbl_", "StabAFrm_", "StabAFrmLbl_"]);
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await page.waitForTimeout(500);

    // A2 — parent_control_id save hardening
    const stamp = Date.now();
    const a2 = await page.evaluate(async (ts) => {
      const app = window.__applicationStore.getState();
      app.createControl("gallery");
      const gallery = window.__applicationStore
        .getState()
        .controls.find((c) => c.control_type === "gallery" && !c.parent_control_id);
      if (!gallery) return { ok: false, error: "gallery not created" };

      app.createControl("label");
      const label = window.__applicationStore
        .getState()
        .controls.find(
          (c) =>
            c.control_type === "label" &&
            c.id !== gallery.id &&
            !c.parent_control_id,
        );
      if (!label) return { ok: false, error: "label not created" };

      const galleryName = `StabAGal_${ts}`;
      const labelName = `StabALbl_${ts}`;
      app.updateControl(gallery.id, { name: galleryName });
      app.updateControl(label.id, {
        name: labelName,
        parent_control_id: gallery.id,
        x: 12,
        y: 12,
        width: 120,
        height: 28,
      });

      app.createControl("form");
      const form = window.__applicationStore
        .getState()
        .controls.find((c) => c.control_type === "form" && !c.parent_control_id);
      if (!form) return { ok: false, error: "form not created" };

      app.createControl("label");
      const formLabel = window.__applicationStore
        .getState()
        .controls.find(
          (c) =>
            c.control_type === "label" &&
            c.id !== label.id &&
            !c.parent_control_id,
        );
      if (!formLabel) return { ok: false, error: "form label not created" };

      const formName = `StabAFrm_${ts}`;
      const formLabelName = `StabAFrmLbl_${ts}`;
      app.updateControl(form.id, { name: formName });
      app.updateControl(formLabel.id, {
        name: formLabelName,
        parent_control_id: form.id,
        x: 8,
        y: 8,
        width: 100,
        height: 24,
      });

      const save = await app.saveScreen();
      return {
        ok: save.success,
        errors: save.errors,
        galleryName,
        labelName,
        formName,
        formLabelName,
        stamp: ts,
      };
    }, stamp);

    await page.waitForTimeout(1500);

    const controlsAfterSave = await listControls(SCREEN1_ID);
    const savedGallery = controlsAfterSave.find((c) => c.name === a2.galleryName);
    const savedLabel = controlsAfterSave.find((c) => c.name === a2.labelName);
    const savedForm = controlsAfterSave.find((c) => c.name === a2.formName);
    const savedFormLabel = controlsAfterSave.find((c) => c.name === a2.formLabelName);

    const galleryChildOk =
      savedGallery &&
      savedLabel &&
      savedLabel.parent_control_id === savedGallery.id;
    const formChildOk =
      savedForm &&
      savedFormLabel &&
      savedFormLabel.parent_control_id === savedForm.id;

    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await page.waitForTimeout(800);

    const controlsAfterReload = await listControls(SCREEN1_ID);
    const reloadedGallery = controlsAfterReload.find((c) => c.id === savedGallery?.id);
    const reloadedLabel = controlsAfterReload.find((c) => c.id === savedLabel?.id);
    const reloadedForm = controlsAfterReload.find((c) => c.id === savedForm?.id);
    const reloadedFormLabel = controlsAfterReload.find((c) => c.id === savedFormLabel?.id);

    const hierarchyPersisted =
      reloadedGallery &&
      reloadedLabel?.parent_control_id === reloadedGallery.id &&
      reloadedForm &&
      reloadedFormLabel?.parent_control_id === reloadedForm.id;

    record(
      "A2 — Gallery child parent_control_id survives save",
      galleryChildOk,
      JSON.stringify({
        save: a2.ok,
        errors: a2.errors,
        parent: savedLabel?.parent_control_id,
        galleryId: savedGallery?.id,
      }),
    );
    record(
      "A2 — Form child parent_control_id survives save",
      formChildOk,
      JSON.stringify({
        parent: savedFormLabel?.parent_control_id,
        formId: savedForm?.id,
      }),
    );
    record(
      "A2 — Hierarchy preserved after refresh",
      hierarchyPersisted,
      `gallery=${Boolean(reloadedLabel?.parent_control_id === reloadedGallery?.id)}, form=${Boolean(reloadedFormLabel?.parent_control_id === reloadedForm?.id)}`,
    );

    // A3 — dirty preview guard
    let confirmShown = false;
    page.once("dialog", async (dialog) => {
      confirmShown = dialog.message().includes("unsaved changes");
      await dialog.dismiss();
    });
    await page.evaluate(() => {
      window.__studioStore.getState().setDirty(true);
    });
    await page.getByRole("button", { name: /^Preview$/i }).click();
    await page.waitForTimeout(500);
    const previewBlocked = !(await page.getByText("Runtime Preview").isVisible().catch(() => false));
    record(
      "A3 — Dirty state blocks preview until confirmed",
      confirmShown && previewBlocked,
      `confirm=${confirmShown}, blocked=${previewBlocked}`,
    );
    await page.evaluate(() => {
      window.__studioStore.getState().setDirty(false);
    });

    // A4 — OnVisible studio authoring
    const onVisibleFormula = `Set(varTitle, "StabA_${stamp}")`;
    await page.evaluate(() => {
      window.__applicationStore.getState().selectScreen(
        window.__applicationStore.getState().selectedScreenId,
      );
      window.__studioStore.getState().selectControl(null);
    });
    await page.getByTestId("on_visible-open-formula-editor").click();
    await page.getByTestId("formula-editor-input").fill(onVisibleFormula);
    await page.getByTestId("formula-editor-save").click();
    await page.getByRole("button", { name: /^Save/ }).click();
    await page.waitForTimeout(2000);

    const screenAfterSave = await getScreen(SCREEN1_ID);
    const onVisibleSaved = screenAfterSave?.on_visible === onVisibleFormula;

    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Toolbox", { exact: true }).waitFor({ timeout: 15000 });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      window.__studioStore.getState().selectControl(null);
    });
    const summaryText = await page.getByTestId("on_visible-formula-summary").textContent();
    const onVisibleReloaded = summaryText?.includes(`StabA_${stamp}`) ?? false;

    record(
      "A4 — OnVisible saved to metadata API",
      onVisibleSaved,
      `api=${screenAfterSave?.on_visible}`,
    );
    record(
      "A4 — OnVisible persists after reload in PropertyPanel",
      onVisibleReloaded,
      `summary=${summaryText}`,
    );

    await setScreenOnVisible(SCREEN1_ID, "");

    // A5 — parser hardening via runtime preview
    await openPreview(page);
    const updateResult = await runAction(
      page,
      'UpdateContext({ status: "Approved", customer: "John" })',
    );
    const ctx = await getScreenContext(page);
    const updateOk =
      updateResult.ok &&
      ctx?.status === "Approved" &&
      ctx?.customer === "John";
    record(
      "A5 — UpdateContext multi-field",
      updateOk,
      JSON.stringify({ updateResult, ctx }),
    );

    const collectResult = await runAction(
      page,
      'Collect(Customers, { Name: "John", Age: 25, Active: true })',
    );
    const customers = await getCollection(page, "Customers");
    const last = customers?.[customers.length - 1];
    const collectOk =
      collectResult.ok &&
      last?.Name === "John" &&
      last?.Age === 25 &&
      last?.Active === true;
    record(
      "A5 — Collect with string, number, boolean fields",
      collectOk,
      JSON.stringify({ collectResult, last }),
    );

    // A5 regression — single-field forms still work
    const singleUpdate = await runAction(
      page,
      'UpdateContext({ status: "Single" })',
    );
    const singleCollect = await runAction(
      page,
      'Collect(Customers, { Name: "Jane" })',
    );
    const customers2 = await getCollection(page, "Customers");
    const regressionOk =
      singleUpdate.ok &&
      singleCollect.ok &&
      (await getScreenContext(page))?.status === "Single" &&
      customers2?.some((item) => item?.Name === "Jane");
    record(
      "A5 — Single-field UpdateContext/Collect regression",
      regressionOk,
      `singleUpdate=${singleUpdate.ok}, singleCollect=${singleCollect.ok}`,
    );

    // Cleanup A2 controls
    for (const control of [savedGallery, savedLabel, savedForm, savedFormLabel]) {
      if (control?.id) await deleteControl(control.id);
    }
  } finally {
    await browser.close();
  }
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("=== Stabilization Track A Validation ===");

  const typeRuntime = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@goapps/runtime", "typecheck"],
    { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" },
  );
  if (typeRuntime.status !== 0) throw new Error("Runtime typecheck failed.");

  const typeStudio = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@goapps/studio", "typecheck"],
    { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" },
  );
  if (typeStudio.status !== 0) throw new Error("Studio typecheck failed.");

  const build = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@goapps/formula", "build"],
    { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" },
  );
  if (build.status !== 0) throw new Error("Failed to build @goapps/formula.");

  validateA1Static();

  startFormulaApi();
  await waitForFormulaApi();
  await waitForMetadata();

  try {
    await runStudioTests();
  } finally {
    await stopFormulaApi();
    await stopStudioDev();
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
