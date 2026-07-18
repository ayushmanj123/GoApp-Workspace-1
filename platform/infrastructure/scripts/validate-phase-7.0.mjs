/**
 * Phase 7.0 acceptance — Core loop polish.
 * Create app → seeded screen → publish → runtime session/render.
 * Run: node infrastructure/scripts/validate-phase-7.0.mjs
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.0");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const METADATA_API = "http://localhost:8082/api/v1";
const PUBLISH_API = "http://localhost:8085/api/v1";
const RUNTIME_API = "http://localhost:8083";
const STUDIO_BASE = "http://localhost:5173";

const TENANT = "00000000-0000-4000-8000-000000000001";
const USER = "00000000-0000-4000-8000-000000000002";

const results = [];
let studioStartedByScript = false;
let publishStartedByScript = false;
let studioProcess = null;
let publishProcess = null;
let createdAppId = null;

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

async function publishFetch(apiPath, options = {}) {
  const res = await fetch(`${PUBLISH_API}${apiPath}`, {
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

async function runtimeFetch(apiPath, options = {}) {
  const res = await fetch(`${RUNTIME_API}${apiPath}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer dev:${TENANT}:${USER}:dev@example.com`,
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
  await new Promise((r) => setTimeout(r, 500));
}

async function runApiLoop() {
  let screenId = null;

  try {
    const { res, body } = await metadataFetch("/applications", {
      method: "POST",
      body: JSON.stringify({
        name: `LoopPolish ${Date.now()}`,
        description: "Phase 7.0 core loop validation",
      }),
    });
    createdAppId = body.data?.id;
    const ok = res.ok && body.success && !!createdAppId;
    record(
      "Test 1 — Create application",
      ok,
      ok ? createdAppId : body.error?.message ?? res.status,
    );
    if (!ok) return;
  } catch (err) {
    record("Test 1 — Create application", false, err.message);
    return;
  }

  try {
    const { res, body } = await metadataFetch(
      `/applications/${createdAppId}/screens`,
    );
    const screens = body.data?.items ?? body.data ?? [];
    const list = Array.isArray(screens) ? screens : [];
    const first = list.find((s) => s.name === "Screen1") ?? list[0];
    screenId = first?.id ?? null;
    record(
      "Test 2 — Default Screen1 seeded",
      res.ok && !!screenId && first?.name === "Screen1",
      screenId ? `${first.name} (${screenId})` : body.error?.message ?? "no screens",
    );
  } catch (err) {
    record("Test 2 — Default Screen1 seeded", false, err.message);
  }

  try {
    const { res, body } = await publishFetch(
      `/applications/${createdAppId}/publish`,
      { method: "POST", body: JSON.stringify({}) },
    );
    const ok = res.ok && body.success && !!body.data?.version_id;
    record(
      "Test 3 — Publish application",
      ok,
      ok ? `version=${body.data.version}` : body.error?.message ?? res.status,
    );
  } catch (err) {
    record("Test 3 — Publish application", false, err.message);
  }

  try {
    const { res, body } = await metadataFetch(
      `/runtime/applications/${createdAppId}`,
    );
    const screens = body.data?.screens ?? [];
    const ok = res.ok && body.success && screens.length >= 1;
    record(
      "Test 4 — Published runtime package has screens",
      ok,
      ok ? `${screens.length} screen(s)` : body.error?.message ?? res.status,
    );
  } catch (err) {
    record("Test 4 — Published runtime package has screens", false, err.message);
  }

  try {
    const health = await fetch(`${RUNTIME_API}/health`);
    if (!health.ok) {
      record(
        "Test 5 — Runtime session + render",
        false,
        "runtime service not available on :8083 (skipped session)",
      );
      return;
    }
    const { res, body } = await runtimeFetch("/api/runtime/session", {
      method: "POST",
      body: JSON.stringify({
        appId: createdAppId,
        screen: "Screen1",
        channel: "published",
      }),
    });
    const sessionId = body.data?.sessionId;
    if (!res.ok || !sessionId) {
      record(
        "Test 5 — Runtime session + render",
        false,
        body.error?.message ?? `session failed (${res.status})`,
      );
      return;
    }
    const renderPath = screenId
      ? `/api/runtime/session/${sessionId}/render/${screenId}`
      : null;
    if (!renderPath) {
      record("Test 5 — Runtime session + render", true, `session=${sessionId} (no screen id for render)`);
      return;
    }
    const rendered = await runtimeFetch(renderPath);
    const ok = rendered.res.ok && rendered.body.success;
    record(
      "Test 5 — Runtime session + render",
      ok,
      ok
        ? `session=${sessionId}`
        : rendered.body.error?.message ?? rendered.res.status,
    );
  } catch (err) {
    record("Test 5 — Runtime session + render", false, err.message);
  }
}

async function runStudioOpenRuntime() {
  if (!createdAppId) {
    record("Test 6 — Manager Open Runtime button", false, "no app id");
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
    await page.goto(`${STUDIO_BASE}/studio/apps`, { waitUntil: "networkidle" });
    // Apps dashboard may list many cards; open the manager apps page and look for Open Runtime.
    const btn = page.getByTestId("open-runtime").first();
    const visible = await btn.isVisible({ timeout: 15000 }).catch(() => false);
    record(
      "Test 6 — Manager Open Runtime button",
      visible,
      visible ? "open-runtime control present for published apps" : "button not found (publish may be required)",
    );
  } catch (err) {
    record("Test 6 — Manager Open Runtime button", false, err.message);
  } finally {
    if (browser) await browser.close();
  }
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  if (existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);

  log("Phase 7.0 validation starting…");

  try {
    await waitForService("http://localhost:8082/health", "Metadata service");
  } catch (err) {
    log(`FATAL: ${err.message}`);
    process.exit(1);
  }

  await ensurePublishService();
  await runApiLoop();
  await runStudioOpenRuntime();
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
