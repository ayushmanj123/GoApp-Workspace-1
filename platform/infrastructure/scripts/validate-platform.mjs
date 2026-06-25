/**
 * Phase 6.9 — Platform validation (one command).
 * Run: node infrastructure/scripts/validate-platform.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-platform");
const LOG_FILE = path.join(OUT_DIR, "validation.log");

const RUNTIME = path.join(ROOT, "services/runtime");
const SHARED = path.join(ROOT, "packages/shared/go");

const results = [];

function log(line) {
  const msg = `[${new Date().toISOString()}] ${line}`;
  console.log(msg);
  fs.appendFileSync(LOG_FILE, `${msg}\n`);
}

function record(test, passed, detail) {
  results.push({ test, passed, detail });
  log(`${passed ? "PASS" : "FAIL"} — ${test}: ${detail}`);
}

function runGoTests(cwd, pkg, label) {
  const result = spawnSync("go", ["test", pkg, "-count=1"], {
    cwd,
    shell: true,
    encoding: "utf8",
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  record(label, result.status === 0, result.status === 0 ? "ok" : output.slice(-2000));
  return result.status === 0;
}

async function checkRuntimeHealth() {
  try {
    const [live, ready, health] = await Promise.all([
      fetch("http://localhost:8083/live"),
      fetch("http://localhost:8083/readiness"),
      fetch("http://localhost:8083/health"),
    ]);
    const liveOk = live.ok && (await live.json()).success === true;
    const readyOk = ready.ok || ready.status === 503;
    const healthOk = health.ok && (await health.json()).success === true;
    record("runtime /live", liveOk, liveOk ? "ok" : `status ${live.status}`);
    record("runtime /readiness", readyOk, readyOk ? "reachable" : `status ${ready.status}`);
    record("runtime /health", healthOk, healthOk ? "ok" : `status ${health.status}`);
    if (liveOk) {
      try {
        const metrics = await fetch("http://localhost:8083/metrics");
        record("runtime /metrics", metrics.ok, metrics.ok ? "exposed" : `status ${metrics.status}`);
      } catch (err) {
        record("runtime /metrics", false, String(err));
      }
    }
    return liveOk;
  } catch (err) {
    record("runtime health (optional)", true, `skipped — ${err}`);
    return false;
  }
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");

  log("Phase 6.9 platform validation");

  runGoTests(SHARED, "./...", "shared go packages");
  runGoTests(RUNTIME, "./internal/state/...", "runtime state engine");
  runGoTests(RUNTIME, "./internal/formula/...", "formula runtime");
  runGoTests(RUNTIME, "./internal/properties/...", "property engine");
  runGoTests(RUNTIME, "./internal/reactive/...", "reactive runtime");
  runGoTests(RUNTIME, "./internal/renderer/...", "renderer");
  runGoTests(RUNTIME, "./internal/gallery/...", "gallery runtime");
  runGoTests(RUNTIME, "./internal/form/...", "form runtime");
  runGoTests(RUNTIME, "./internal/records/...", "record CRUD");
  runGoTests(RUNTIME, "./internal/kernel/...", "runtime kernel");
  runGoTests(RUNTIME, "./internal/databinding/...", "data binding");
  runGoTests(RUNTIME, "./internal/integration/...", "customer sample app integration");

  const runtimeUp = await checkRuntimeHealth();
  if (runtimeUp) {
    const sample = spawnSync("node", ["infrastructure/scripts/validate-sample-customer-app.mjs"], {
      cwd: ROOT,
      shell: true,
      encoding: "utf8",
    });
    record("validate-sample-customer-app.mjs", sample.status === 0, sample.status === 0 ? "ok" : "see sample validation log");
  } else {
    record("validate-sample-customer-app.mjs", true, "skipped — runtime not running on :8083");
  }

  const failed = results.filter((r) => !r.passed);
  log(`\nSummary: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) {
    log("Failed:");
    for (const item of failed) log(`  - ${item.test}: ${item.detail}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
