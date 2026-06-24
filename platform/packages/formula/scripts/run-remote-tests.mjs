import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  fileURLToPath(new URL("..", import.meta.url)),
);
const workspaceRoot = path.resolve(packageRoot, "../..");
const localDotnet = path.join(
  workspaceRoot,
  ".dotnet",
  process.platform === "win32" ? "dotnet.exe" : "dotnet",
);
const dotnet = existsSync(localDotnet) ? localDotnet : "dotnet";
const projectDir = path.join(packageRoot, "dotnet", "GoApps.PowerFx");

async function waitForHealth(timeoutMs = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch("http://localhost:8085/health");
      if (res.ok) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Formula API did not become healthy.");
}

function runNodeTests() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--test",
        "dist/tests/remote-formula-engine.test.js",
        "dist/tests/formula-context.test.js",
        "dist/tests/control-reference.test.js",
        "dist/tests/formula-variables.test.js",
        "dist/tests/formula-functions.test.js",
      ],
      {
        cwd: packageRoot,
        stdio: "inherit",
        env: {
          ...process.env,
          FORMULA_API_URL: "http://localhost:8085",
        },
      },
    );
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`remote tests failed with ${code}`));
    });
  });
}

const api = spawn(
  dotnet,
  ["run", "--project", projectDir, "--", "--serve", "--port", "8085"],
  { cwd: projectDir, stdio: "ignore" },
);

const shutdown = () => {
  if (!api.killed) {
    api.kill();
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

try {
  await waitForHealth();
  await runNodeTests();
  shutdown();
  process.exit(0);
} catch (error) {
  shutdown();
  console.error(error);
  process.exit(1);
}
