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
const dotnet = existsSync(localDotnet)
  ? localDotnet
  : process.platform === "win32"
    ? "dotnet.exe"
    : "dotnet";
const projectDir = path.join(packageRoot, "dotnet", "GoApps.PowerFx");

const child = spawn(
  dotnet,
  ["run", "--project", projectDir, "--", "--serve", "--port", "8085"],
  {
    cwd: projectDir,
    stdio: "inherit",
    env: process.env,
  },
);

const shutdown = () => {
  if (!child.killed) {
    child.kill();
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("exit", shutdown);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
