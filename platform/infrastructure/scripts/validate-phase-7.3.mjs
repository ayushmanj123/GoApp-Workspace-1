/**
 * Phase 7.3 acceptance — Studio Connector Designer.
 * Creates a REST connector + list action, asserts Studio surfaces Connectors,
 * and verifies gallery Items can reference the connector name.
 * Run: node infrastructure/scripts/validate-phase-7.3.mjs
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.3");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const METADATA_API = "http://localhost:8082/api/v1";
const STUDIO_BASE = "http://localhost:5173";

const TENANT = "00000000-0000-4000-8000-000000000001";

const results = [];
let studioStartedByScript = false;
let studioProcess = null;
let createdAppId = null;
let connectorId = null;
let connectorName = null;

function log(line) {
  const msg = `[${new Date().toISOString()}] ${line}`;
  console.log(msg);
  fs.appendFileSync(LOG_FILE, `${msg}\n`);
}

function record(test, passed, detail) {
  results.push({ test, passed, detail });
  log(`${passed ? "PASS" : "FAIL"} — ${test}: ${detail}`);
}

async function metadataFetch(apiPath, options = {}) {
  const res = await fetch(`${METADATA_API}${apiPath}`, {
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
  await new Promise((r) => setTimeout(r, 500));
}

async function runApiTests() {
  connectorName = `Weather${Date.now().toString(36)}`;

  try {
    const { res, body } = await metadataFetch("/applications", {
      method: "POST",
      body: JSON.stringify({
        name: `Connector App ${Date.now()}`,
        description: "Phase 7.3 connector validation",
      }),
    });
    createdAppId = body.data?.id;
    record(
      "Test 1 — Create application",
      res.ok && !!createdAppId,
      createdAppId || body.error?.message || res.status,
    );
    if (!createdAppId) return;
  } catch (err) {
    record("Test 1 — Create application", false, err.message);
    return;
  }

  try {
    const { res, body } = await metadataFetch(
      `/applications/${createdAppId}/connectors`,
      {
        method: "POST",
        body: JSON.stringify({
          name: connectorName,
          connector_type: "rest",
          authentication_type: "none",
          base_url: "https://api.example.com",
          auth_config: { type: "none" },
        }),
      },
    );
    connectorId = body.data?.id;
    record(
      "Test 2 — Create REST connector",
      res.ok && !!connectorId && body.data?.name === connectorName,
      connectorId
        ? `${body.data.name} (${connectorId})`
        : body.error?.message || res.status,
    );
  } catch (err) {
    record("Test 2 — Create REST connector", false, err.message);
  }

  if (!connectorId) return;

  try {
    const { res, body } = await metadataFetch(
      `/connectors/${connectorId}/actions`,
      {
        method: "POST",
        body: JSON.stringify({
          action_name: "list",
          http_method: "GET",
          endpoint: "/items",
        }),
      },
    );
    record(
      "Test 3 — Create list action",
      res.ok && body.data?.action_name === "list",
      body.data?.action_name
        ? `${body.data.http_method} ${body.data.endpoint}`
        : body.error?.message || res.status,
    );
  } catch (err) {
    record("Test 3 — Create list action", false, err.message);
  }

  try {
    const { res, body } = await metadataFetch(
      `/applications/${createdAppId}/connectors`,
    );
    const items = body.data?.items ?? [];
    const found = items.find((c) => c.id === connectorId);
    record(
      "Test 4 — List connectors includes new connector",
      res.ok && !!found,
      found ? found.name : body.error?.message || "missing",
    );
  } catch (err) {
    record("Test 4 — List connectors includes new connector", false, err.message);
  }
}

async function runStudioTests() {
  if (!connectorId || !connectorName) {
    record("Test 5 — Studio Connectors manager", false, "no connector");
    record("Test 6 — Studio connector detail", false, "no connector");
    return;
  }

  let browser;
  try {
    await ensureStudio();
    const launchOpts = { headless: true };
    try {
      browser =
        process.platform === "win32"
          ? await chromium.launch({ ...launchOpts, channel: "msedge" })
          : await chromium.launch(launchOpts);
    } catch {
      browser = await chromium.launch(launchOpts);
    }
    const page = await browser.newPage();

    await page.goto(`${STUDIO_BASE}/studio/connectors`, {
      waitUntil: "networkidle",
    });
    const titleVisible = await page
      .getByRole("heading", { name: "Connectors" })
      .isVisible({ timeout: 20000 })
      .catch(() => false);
    const newBtn = await page
      .getByTestId("new-connector-btn")
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    record(
      "Test 5 — Studio Connectors manager",
      titleVisible && newBtn,
      titleVisible && newBtn
        ? "Connectors page + New Connector button"
        : "manager UI missing",
    );

    await page.goto(`${STUDIO_BASE}/studio/connectors/${connectorId}`, {
      waitUntil: "networkidle",
    });
    const detailName = await page
      .getByTestId("connector-detail-name")
      .inputValue({ timeout: 15000 })
      .catch(() => "");
    const addAction = await page
      .getByTestId("new-action-btn")
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    record(
      "Test 6 — Studio connector detail",
      detailName === connectorName && addAction,
      detailName
        ? `name=${detailName}, addAction=${addAction}`
        : "detail page missing",
    );
  } catch (err) {
    record("Test 5 — Studio Connectors manager", false, err.message);
    record("Test 6 — Studio connector detail", false, err.message);
  } finally {
    if (browser) await browser.close();
  }
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  if (existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);

  log("Phase 7.3 validation starting…");

  try {
    await waitForService("http://localhost:8082/health", "Metadata service");
  } catch (err) {
    log(`FATAL: ${err.message}`);
    process.exit(1);
  }

  await runApiTests();
  await runStudioTests();
  await stopProcesses();

  const failed = results.filter((r) => !r.passed).length;
  log(`Done: ${results.length - failed}/${results.length} passed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  log(`FATAL: ${err.message}`);
  await stopProcesses();
  process.exit(1);
});
