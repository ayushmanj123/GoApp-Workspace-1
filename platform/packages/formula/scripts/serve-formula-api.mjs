/**
 * Start the Power Fx formula API on port 8085 (used by Studio/Runtime via /formula-api proxy).
 * Run: pnpm --filter @goapps/formula serve
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspaceRoot = path.resolve(packageRoot, "../..");
const localDotnet = path.join(
  workspaceRoot,
  ".dotnet",
  process.platform === "win32" ? "dotnet.exe" : "dotnet",
);
const dotnet = existsSync(localDotnet) ? localDotnet : "dotnet";
const projectDir = path.join(packageRoot, "dotnet", "GoApps.PowerFx");
const port = process.env.FORMULA_API_PORT ?? "8085";

const child = spawn(
  dotnet,
  ["run", "--project", projectDir, "--", "--serve", "--port", port],
  { stdio: "inherit", cwd: workspaceRoot },
);

child.on("exit", (code) => process.exit(code ?? 1));

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
