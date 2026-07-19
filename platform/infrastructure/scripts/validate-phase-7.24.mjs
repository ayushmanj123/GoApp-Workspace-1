/**
 * Phase 7.24 — Workflow triggers v2 (schedule + webhook).
 * Run: node infrastructure/scripts/validate-phase-7.24.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.24");
const LOG_FILE = path.join(OUT_DIR, "validation.log");

const results = [];

function log(line) {
  const msg = `[${new Date().toISOString()}] ${line}`;
  console.log(msg);
  appendFileSync(LOG_FILE, `${msg}\n`);
}

function record(test, passed, detail) {
  results.push({ test, passed, detail });
  log(`${passed ? "PASS" : "FAIL"} — ${test}: ${detail}`);
}

function runGo(cwd, args, label) {
  const proc = spawnSync("go", args, { cwd, encoding: "utf8" });
  const ok = proc.status === 0;
  record(label, ok, ok ? "ok" : `${proc.stdout}\n${proc.stderr}`);
  return ok;
}

function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(LOG_FILE, "");
  log("Phase 7.24 validation starting");

  const metadata = path.join(ROOT, "services/metadata");
  runGo(
    metadata,
    [
      "test",
      "./internal/services/",
      "-run",
      "ParseAndValidate|NextSchedule|JoinURL|Truncate|Webhook|WorkflowRunnerExecute|GenerateWebhook",
      "-count=1",
    ],
    "Test 1 — workflow trigger + webhook unit tests",
  );

  const migration = path.join(
    ROOT,
    "services/metadata/internal/database/migrations/000021_workflow_triggers.up.sql",
  );
  const migSrc = existsSync(migration) ? readFileSync(migration, "utf8") : "";
  record(
    "Test 2 — migration schedule/webhook columns",
    migSrc.includes("schedule_next_run_at") &&
      migSrc.includes("webhook_secret_id") &&
      migSrc.includes("trigger_source"),
    "000021_workflow_triggers.up.sql",
  );

  const svcSrc = readFileSync(
    path.join(ROOT, "services/metadata/internal/services/workflow_service.go"),
    "utf8",
  );
  const schedSrc = readFileSync(
    path.join(ROOT, "services/metadata/internal/services/workflow_scheduler.go"),
    "utf8",
  );
  record(
    "Test 3 — schedule + webhook service",
    svcSrc.includes("TriggerSchedule") &&
      svcSrc.includes("RunWebhook") &&
      svcSrc.includes("RotateWebhookSecret") &&
      schedSrc.includes("ClaimDueScheduledWorkflows") &&
      schedSrc.includes("TriggerSchedule"),
    "workflow_service.go / workflow_scheduler.go",
  );

  const routesSrc = readFileSync(
    path.join(ROOT, "services/metadata/internal/api/routes.go"),
    "utf8",
  );
  record(
    "Test 4 — public hook + webhook-secret routes",
    routesSrc.includes("/api/v1/public") &&
      routesSrc.includes("/workflows/:id/hook") &&
      routesSrc.includes("/workflows/:id/webhook-secret"),
    "routes.go",
  );

  const gatewaySrc = readFileSync(
    path.join(ROOT, "services/gateway/internal/server/server.go"),
    "utf8",
  );
  const proxySrc = readFileSync(
    path.join(ROOT, "services/gateway/internal/proxy/handler.go"),
    "utf8",
  );
  record(
    "Test 5 — gateway public proxy",
    gatewaySrc.includes("/api/v1/public/") &&
      proxySrc.includes("ForwardPublic"),
    "gateway public routes",
  );

  const apiSrc = readFileSync(
    path.join(ROOT, "apps/studio/src/api/workflows-api.ts"),
    "utf8",
  );
  const detailSrc = readFileSync(
    path.join(
      ROOT,
      "apps/studio/src/components/manager/workflows/WorkflowDetailView.tsx",
    ),
    "utf8",
  );
  record(
    "Test 6 — Studio trigger editor + secret UX",
    apiSrc.includes("rotateWebhookSecret") &&
      apiSrc.includes("schedule") &&
      apiSrc.includes("webhook") &&
      detailSrc.includes("workflow-trigger-type") &&
      detailSrc.includes("rotateWebhookSecret") &&
      detailSrc.includes("trigger_source"),
    "Studio workflows",
  );

  const docs = readFileSync(path.join(ROOT, "docs/workflows.md"), "utf8");
  record(
    "Test 7 — docs/workflows.md triggers v2",
    docs.includes("schedule") &&
      docs.includes("webhook") &&
      docs.includes("/public/workflows/") &&
      docs.includes("WORKFLOW_SCHEDULER_ENABLED"),
    "docs/workflows.md",
  );

  const instructions = readFileSync(path.join(ROOT, "instructions.md"), "utf8");
  record(
    "Test 8 — instructions 7.24 COMPLETE + next focus",
    instructions.includes("| 7.24 |") &&
      instructions.includes("Workflow triggers v2") &&
      instructions.includes("COMPLETE") &&
      instructions.includes("entity-change") &&
      instructions.includes("validate-phase-7.24.mjs"),
    "instructions.md",
  );

  const failed = results.filter((r) => !r.passed).length;
  log("---");
  log(`Results: ${results.length - failed} passed, ${failed} failed`);
  for (const r of results) {
    log(`  ${r.passed ? "✓" : "✗"} ${r.test}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main();
