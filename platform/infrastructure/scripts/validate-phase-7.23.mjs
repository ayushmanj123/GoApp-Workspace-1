/**
 * Phase 7.23 — Workflow MVP (manual trigger + connector_action steps).
 * Run: node infrastructure/scripts/validate-phase-7.23.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.23");
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
  log("Phase 7.23 validation starting");

  const metadata = path.join(ROOT, "services/metadata");
  runGo(
    metadata,
    [
      "test",
      "./internal/services/",
      "-run",
      "ParseAndValidateDefinition|JoinURL|TruncatePreview|WorkflowRunnerExecute",
      "-count=1",
    ],
    "Test 1 — workflow definition + runner unit tests",
  );

  const migration = path.join(
    ROOT,
    "services/metadata/internal/database/migrations/000020_workflows.up.sql",
  );
  record(
    "Test 2 — migration workflows + workflow_runs",
    existsSync(migration) &&
      readFileSync(migration, "utf8").includes("CREATE TABLE IF NOT EXISTS workflows") &&
      readFileSync(migration, "utf8").includes("workflow_runs"),
    "000020_workflows.up.sql",
  );

  const svcSrc = readFileSync(
    path.join(ROOT, "services/metadata/internal/services/workflow_service.go"),
    "utf8",
  );
  const runnerSrc = readFileSync(
    path.join(ROOT, "services/metadata/internal/services/workflow_runner.go"),
    "utf8",
  );
  record(
    "Test 3 — workflow service + runner",
    svcSrc.includes("WorkflowService") &&
      svcSrc.includes("connector_action") &&
      runnerSrc.includes("Execute") &&
      runnerSrc.includes("connector_user_oauth_required"),
    "workflow_service.go / workflow_runner.go",
  );

  const routesSrc = readFileSync(
    path.join(ROOT, "services/metadata/internal/api/routes.go"),
    "utf8",
  );
  record(
    "Test 4 — workflow routes",
    routesSrc.includes("/applications/:appId/workflows") &&
      routesSrc.includes("/workflows/:id/run") &&
      routesSrc.includes("/workflows/:id/runs"),
    "routes.go",
  );

  const appSrc = readFileSync(path.join(ROOT, "apps/studio/src/App.tsx"), "utf8");
  record(
    "Test 5 — Studio workflows route not stub",
    appSrc.includes("WorkflowsManagerPage") &&
      appSrc.includes("WorkflowDetailView") &&
      !appSrc.includes('title="Workflow Manager"'),
    "App.tsx",
  );

  const apiSrc = readFileSync(
    path.join(ROOT, "apps/studio/src/api/workflows-api.ts"),
    "utf8",
  );
  const listSrc = readFileSync(
    path.join(
      ROOT,
      "apps/studio/src/components/manager/workflows/WorkflowsListView.tsx",
    ),
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
    "Test 6 — Studio API + Test run UX",
    apiSrc.includes("workflowsApi") &&
      apiSrc.includes("/run") &&
      listSrc.includes("workflowsApi.list") &&
      detailSrc.includes("Test run") &&
      detailSrc.includes("handleRun"),
    "Studio workflows",
  );

  const docs = readFileSync(path.join(ROOT, "docs/workflows.md"), "utf8");
  record(
    "Test 7 — docs/workflows.md",
    docs.includes("manual") &&
      docs.includes("connector_action") &&
      docs.includes("/workflows/:id/run"),
    "docs/workflows.md",
  );

  const instructions = readFileSync(path.join(ROOT, "instructions.md"), "utf8");
  record(
    "Test 8 — instructions 7.23 COMPLETE + next focus",
    instructions.includes("| 7.23 |") &&
      instructions.includes("Workflow MVP") &&
      instructions.includes("COMPLETE") &&
      instructions.includes("Workflow triggers v2") &&
      !instructions.includes(
        "Workflow (north-star product after auth-code + per-user OAuth MVP).",
      ),
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
