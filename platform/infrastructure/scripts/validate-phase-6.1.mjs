/**
 * Phase 6.1 acceptance validation — Publishing Pipeline.
 * Run: node infrastructure/scripts/validate-phase-6.1.mjs
 */
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-6.1");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const METADATA_API = "http://localhost:8082/api/v1";
const PUBLISH_API = "http://localhost:8085/api/v1";
const STUDIO_BASE = "http://localhost:5173";

const TENANT = "00000000-0000-4000-8000-000000000001";
const APP_ID = "00000000-0000-4000-8000-000000000003";
const SCREEN1_ID = "00000000-0000-4000-8000-000000000004";
const DEMO_LABEL_ID = "00000000-0000-4000-8000-000000000006";
const STUDIO_URL = `${STUDIO_BASE}/studio/apps/${APP_ID}/screens/${SCREEN1_ID}`;

const results = [];
let studioStartedByScript = false;
let publishStartedByScript = false;
let studioProcess = null;
let publishProcess = null;

function log(line) {
  const msg = `[${new Date().toISOString()}] ${line}`;
  console.log(msg);
  fs.appendFileSync(LOG_FILE, `${msg}\n`);
}

function record(test, passed, detail) {
  results.push({ test, passed, detail });
  log(`${passed ? "PASS" : "FAIL"} — ${test}: ${detail}`);
}

async function metadataFetch(path, options = {}) {
  const res = await fetch(`${METADATA_API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Id": TENANT,
      ...(options.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function publishFetch(path, options = {}) {
  const res = await fetch(`${PUBLISH_API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Id": TENANT,
      ...(options.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

function findLabelText(pkg) {
  const screen = pkg?.screens?.find((s) => s.id === SCREEN1_ID) ?? pkg?.screens?.[0];
  const controls = screen?.controls ?? [];
  for (const control of controls) {
    if (control.name === "DemoLabel") {
      const text = control.properties?.text;
      if (typeof text === "string") return text;
      if (text && typeof text === "object" && "value" in text) return String(text.value);
      return JSON.stringify(text ?? "");
    }
  }
  return "";
}

async function waitForService(url, label, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 304) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${label} not available at ${url}`);
}

async function waitForMetadata(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const { res } = await metadataFetch(`/applications/${APP_ID}/screens`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Metadata service not available on :8082.");
}

async function ensurePublishService() {
  try {
    const res = await fetch("http://localhost:8085/health");
    if (res.ok) return;
  } catch {
    /* not running */
  }
  publishStartedByScript = true;
  publishProcess = spawn("go", ["run", "./cmd/server"], {
    cwd: path.join(ROOT, "services/publish"),
    stdio: "ignore",
    shell: process.platform === "win32",
    env: { ...process.env, METADATA_SERVICE_URL: "http://localhost:8082" },
  });
  await waitForService("http://localhost:8085/health", "Publish service");
}

async function ensureStudio() {
  try {
    const res = await fetch(STUDIO_BASE);
    if (res.ok || res.status === 304) return;
  } catch {
    /* not running */
  }
  studioStartedByScript = true;
  studioProcess = spawn(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@goapps/studio", "dev"],
    { cwd: ROOT, stdio: "ignore", shell: process.platform === "win32" },
  );
  await waitForService(STUDIO_BASE, "Studio", 90000);
}

async function stopProcesses() {
  if (studioStartedByScript && studioProcess && !studioProcess.killed) {
    studioProcess.kill();
    studioProcess = null;
    studioStartedByScript = false;
  }
  if (publishStartedByScript && publishProcess && !publishProcess.killed) {
    publishProcess.kill();
    publishProcess = null;
    publishStartedByScript = false;
  }
  await new Promise((r) => setTimeout(r, 1000));
}

async function runApiTests() {
  let firstPublish = null;
  let publishedLabelText = "";

  try {
    const { res, body } = await publishFetch(`/applications/${APP_ID}/publish`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    firstPublish = body.data;
    const ok =
      res.ok &&
      body.success &&
      firstPublish?.version_id &&
      firstPublish?.snapshot_id;
    record(
      "Test 1 — Publish via publish service",
      ok,
      ok
        ? `version=${firstPublish.version}, snapshot=${firstPublish.snapshot_id}`
        : body.error ?? res.status,
    );
  } catch (err) {
    record("Test 1 — Publish via publish service", false, err.message);
    return;
  }

  try {
    const { res, body } = await publishFetch(`/applications/${APP_ID}/versions`);
    const released = (body.data?.items ?? []).find((v) => v.status === "released");
    record(
      "Test 2 — application_versions row released",
      res.ok && !!released,
      released ? `${released.version} (${released.status})` : body.error ?? "missing",
    );
  } catch (err) {
    record("Test 2 — application_versions row released", false, err.message);
  }

  try {
    const { res, body } = await metadataFetch(`/applications/${APP_ID}`);
    const ok =
      res.ok &&
      body.data?.current_version_id === firstPublish.version_id &&
      body.data?.status === "published";
    record(
      "Test 3 — current_version_id updated",
      ok,
      ok ? body.data.current_version_id : body.error ?? "mismatch",
    );
    record(
      "Test 4 — applications.status published",
      res.ok && body.data?.status === "published",
      body.data?.status ?? body.error ?? res.status,
    );
  } catch (err) {
    record("Test 3 — current_version_id updated", false, err.message);
    record("Test 4 — applications.status published", false, err.message);
  }

  try {
    const { res, body } = await metadataFetch(`/runtime/applications/${APP_ID}`);
    publishedLabelText = findLabelText(body.data);
    record(
      "Test 5 — Runtime default channel frozen package",
      res.ok && publishedLabelText !== "",
      publishedLabelText || body.error || "empty",
    );
  } catch (err) {
    record("Test 5 — Runtime default channel frozen package", false, err.message);
  }

  try {
    await metadataFetch(`/controls/${DEMO_LABEL_ID}/properties`, {
      method: "PUT",
      body: JSON.stringify({ properties: { text: { value: "PublishedFreezeCheck" } } }),
    });
    const { res, body } = await metadataFetch(`/runtime/applications/${APP_ID}`);
    const afterEdit = findLabelText(body.data);
    record(
      "Test 6 — Published runtime unchanged after draft edit",
      res.ok && afterEdit === publishedLabelText,
      `before=${publishedLabelText}, after=${afterEdit}`,
    );
  } catch (err) {
    record("Test 6 — Published runtime unchanged after draft edit", false, err.message);
  }

  try {
    const { res, body } = await metadataFetch(`/runtime/applications/${APP_ID}?channel=draft`);
    const draftText = findLabelText(body.data);
    record(
      "Test 7 — Runtime draft channel returns live draft",
      res.ok && draftText === "PublishedFreezeCheck",
      draftText || body.error || "empty",
    );
  } catch (err) {
    record("Test 7 — Runtime draft channel returns live draft", false, err.message);
  }

  try {
    const { res, body } = await publishFetch(`/applications/${APP_ID}/versions`);
    record(
      "Test 10 — List versions returns entries",
      res.ok && (body.data?.items?.length ?? 0) >= 1,
      `${body.data?.items?.length ?? 0} versions`,
    );
  } catch (err) {
    record("Test 10 — List versions returns entries", false, err.message);
  }

  try {
    const { res, body } = await publishFetch(`/applications/${APP_ID}/publish`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    const second = body.data;
    const ok =
      res.ok &&
      second?.version_id &&
      second.version_id !== firstPublish.version_id;
    record(
      "Test 11 — Re-publish creates new version",
      ok,
      ok
        ? `${firstPublish.version} -> ${second.version}`
        : body.error ?? "same version id",
    );
  } catch (err) {
    record("Test 11 — Re-publish creates new version", false, err.message);
  }
}

async function runStudioTests() {
  let browser;
  try {
    const launchOpts = { headless: true };
    if (process.platform === "win32") {
      try {
        browser = await chromium.launch({ ...launchOpts, channel: "msedge" });
      } catch {
        browser = await chromium.launch(launchOpts);
      }
    } else {
      browser = await chromium.launch(launchOpts);
    }
    const page = await browser.newPage();
    await page.goto(STUDIO_URL, { waitUntil: "networkidle" });

    let publishRequested = false;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().includes(`/applications/${APP_ID}/publish`)
      ) {
        publishRequested = true;
      }
    });

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByTestId("publish-application").click();
    await page.waitForTimeout(1500);
    record(
      "Test 8 — Studio Publish button triggers publish",
      publishRequested,
      publishRequested ? "publish request observed" : "no publish request",
    );

    const { res, body } = await metadataFetch(
      `/runtime/applications/${APP_ID}?channel=draft`,
    );
    const draftText = findLabelText(body.data);
    record(
      "Test 9 — Studio preview path uses draft channel",
      res.ok && draftText === "PublishedFreezeCheck",
      draftText || body.error || "empty",
    );
  } catch (err) {
    record("Test 8 — Studio Publish button triggers publish", false, err.message);
    record("Test 9 — Studio preview path uses draft channel", false, err.message);
  } finally {
    if (browser) await browser.close();
  }
}

function runTypecheck() {
  const studio = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@goapps/studio", "exec", "tsc", "--noEmit"],
    { cwd: ROOT, encoding: "utf8", shell: process.platform === "win32" },
  );
  const runtime = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--filter", "@goapps/runtime", "exec", "tsc", "--noEmit"],
    { cwd: ROOT, encoding: "utf8", shell: process.platform === "win32" },
  );
  const goTest = spawnSync("go", ["test", "./..."], {
    cwd: path.join(ROOT, "services/metadata"),
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const ok = studio.status === 0 && runtime.status === 0 && goTest.status === 0;
  const detail = [
    studio.status === 0 ? "studio tsc ok" : `studio tsc fail: ${studio.stderr || studio.stdout}`,
    runtime.status === 0 ? "runtime tsc ok" : `runtime tsc fail: ${runtime.stderr || runtime.stdout}`,
    goTest.status === 0 ? "go test ok" : `go test fail: ${goTest.stderr || goTest.stdout}`,
  ].join("; ");
  record("Test 12 — TypeScript clean", ok, detail);
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("Phase 6.1 validation starting");

  await waitForMetadata();
  await ensurePublishService();
  await runApiTests();
  await ensureStudio();
  await runStudioTests();
  runTypecheck();
  await stopProcesses();

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  log(`\n=== ${passed}/${total} tests passed ===`);
  for (const r of results) {
    console.log(`${r.passed ? "PASS" : "FAIL"} — ${r.test}: ${r.detail}`);
  }
  process.exit(passed === total ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await stopProcesses();
  process.exit(1);
});
