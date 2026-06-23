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
const testProject = path.join(
  packageRoot,
  "dotnet",
  "GoApps.PowerFx.Tests",
  "GoApps.PowerFx.Tests.csproj",
);

const child = spawn(dotnet, ["test", testProject, "--nologo"], {
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
