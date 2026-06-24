/**
 * Stabilization — formula validation.
 * Run: node infrastructure/scripts/validate-stabilization-formulas.mjs
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-stabilization-formulas");
const LOG_FILE = path.join(OUT_DIR, "validation.log");
const FORMULA_API = "http://localhost:8085";

const APP_ID = "00000000-0000-4000-8000-000000000003";
const SCREEN_ID = "00000000-0000-4000-8000-000000000004";
const STUDIO_URL = `http://localhost:5173/studio/apps/${APP_ID}/screens/${SCREEN_ID}`;

const DEFAULT_CONTEXT = {
  User: { FullName: "Test User", Email: "test@example.com" },
  App: { Name: "Demo Application" },
  TextInput1: { Value: "Hello" },
  varTitle: "Hello World",
  varCount: 10,
  varStatus: "Approved",
};

const results = [];
let apiProcess = null;

function log(line) {
  const msg = `[${new Date().toISOString()}] ${line}`;
  console.log(msg);
  fs.appendFileSync(LOG_FILE, msg + "\n");
}

function record(test, passed, detail) {
  results.push({ test, passed, detail });
  log(`${passed ? "PASS" : "FAIL"} — ${test}: ${detail}`);
}

function isValidActionFormula(formula) {
  const trimmed = formula.trim();
  return (
    /^Set\s*\(/i.test(trimmed) ||
    /^UpdateContext\s*\(/i.test(trimmed) ||
    /^Navigate\s*\(/i.test(trimmed) ||
    /^Collect\s*\(/i.test(trimmed) ||
    /^ClearCollect\s*\(/i.test(trimmed) ||
    /^SubmitForm\s*\(/i.test(trimmed)
  );
}

function startFormulaApi() {
  const localDotnet = path.join(
    ROOT,
    ".dotnet",
    process.platform === "win32" ? "dotnet.exe" : "dotnet",
  );
  const dotnet = existsSync(localDotnet) ? localDotnet : "dotnet";
  const projectDir = path.join(ROOT, "packages", "formula", "dotnet", "GoApps.PowerFx");
  apiProcess = spawn(
    dotnet,
    ["run", "--project", projectDir, "--", "--serve", "--port", "8085"],
    { cwd: projectDir, stdio: "ignore" },
  );
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
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Formula API did not start.");
}

async function postEvaluate(formula, context = DEFAULT_CONTEXT) {
  const res = await fetch(`${FORMULA_API}/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ formula, context }),
  });
  return res.json();
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "");
  log("=== Stabilization Formula Validation ===");

  startFormulaApi();
  await waitForFormulaApi();

  try {
    const varTitleResult = await postEvaluate("varTitle");
    record(
      "Formula — varTitle evaluates with context",
      varTitleResult.ok === true && varTitleResult.value === "Hello World",
      JSON.stringify(varTitleResult),
    );

    const userResult = await postEvaluate("User.FullName");
    record(
      "Formula — User.FullName evaluates with context",
      userResult.ok === true && userResult.value === "Test User",
      JSON.stringify(userResult),
    );

    const textInputResult = await postEvaluate("TextInput1.Value");
    record(
      "Formula — TextInput1.Value evaluates with context",
      textInputResult.ok === true && textInputResult.value === "Hello",
      JSON.stringify(textInputResult),
    );

    record(
      "Formula — action parser accepts Set()",
      isValidActionFormula('Set(varX, "test")'),
      "Set() recognized",
    );

    record(
      "Formula — action parser rejects bare expression",
      !isValidActionFormula("varTitle"),
      "bare symbol rejected as action",
    );

    let browser;
    try {
      browser = await chromium.launch({ channel: "chrome", headless: true });
    } catch {
      browser = await chromium.launch({ channel: "msedge", headless: true });
    }

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    try {
      await page.goto(STUDIO_URL, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Add Label" }).click();
      await page.waitForTimeout(1000);

      const formulaHealth = await page
        .getByText("Formula engine unavailable")
        .count();
      record(
        "Formula — studio does not show engine unavailable banner",
        formulaHealth === 0,
        `banner count=${formulaHealth}`,
      );
    } finally {
      await browser.close();
    }
  } finally {
    await stopFormulaApi();
  }

  const failed = results.filter((item) => !item.passed);
  log(`=== ${results.length - failed.length}/${results.length} passed ===`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

run().catch(async (error) => {
  console.error(error);
  await stopFormulaApi();
  process.exit(1);
});
