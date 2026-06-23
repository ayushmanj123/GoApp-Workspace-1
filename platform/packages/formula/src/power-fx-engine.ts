import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FormulaEngine } from "./formula-engine.js";

interface EvaluateResponse {
  ok: boolean;
  value?: unknown;
  error?: string;
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(moduleDir, "../..");
const dotnetProjectDir = path.join(packageRoot, "dotnet", "GoApps.PowerFx");
const workspaceRoot = path.resolve(packageRoot, "../..");
const localDotnet = path.join(
  workspaceRoot,
  ".dotnet",
  process.platform === "win32" ? "dotnet.exe" : "dotnet",
);

function resolveDotnetExecutable(): string {
  if (existsSync(localDotnet)) {
    return localDotnet;
  }
  return process.platform === "win32" ? "dotnet.exe" : "dotnet";
}

let buildPromise: Promise<string> | null = null;

async function ensureDotnetHostBuilt(): Promise<string> {
  if (!buildPromise) {
    buildPromise = buildDotnetHost();
  }
  return buildPromise;
}

async function buildDotnetHost(): Promise<string> {
  const dotnet = resolveDotnetExecutable();
  const configuration = "Debug";
  const targetFramework = "net8.0";
  const outputDll = path.join(
    dotnetProjectDir,
    "bin",
    configuration,
    targetFramework,
    "GoApps.PowerFx.dll",
  );

  await runProcess(dotnet, [
    "build",
    dotnetProjectDir,
    "-c",
    configuration,
    "--nologo",
    "-v",
    "q",
  ]);

  return outputDll;
}

function runProcess(
  command: string,
  args: string[],
  input?: string,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: dotnetProjectDir,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          `Command failed (${code}): ${command} ${args.join(" ")}\n${stderr || stdout}`,
        ),
      );
    });

    if (input !== undefined) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

async function evaluateWithDotnetHost(
  hostDll: string,
  formula: string,
  context?: Record<string, unknown>,
): Promise<unknown> {
  const dotnet = resolveDotnetExecutable();
  const payload = JSON.stringify({ formula, context });
  const { stdout } = await runProcess(
    dotnet,
    ["exec", hostDll, "--nologo"],
    payload,
  );

  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const responseLine = lines[lines.length - 1];
  const response = JSON.parse(responseLine) as EvaluateResponse;

  if (!response.ok) {
    throw new Error(response.error ?? "Power Fx evaluation failed.");
  }

  return response.value;
}

export class PowerFxEngine implements FormulaEngine {
  private hostDll: string | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.hostDll = await ensureDotnetHostBuilt();
    await evaluateWithDotnetHost(this.hostDll, '"Hello"');
    this.initialized = true;
  }

  async evaluate(
    formula: string,
    context?: Record<string, unknown>,
  ): Promise<unknown> {
    await this.initialize();

    if (!this.hostDll) {
      throw new Error("Power Fx host is not initialized.");
    }

    return evaluateWithDotnetHost(this.hostDll, formula, context);
  }
}
