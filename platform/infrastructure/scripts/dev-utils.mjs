import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptDir, "../..");

const COLORS = [
  "\x1b[36m",
  "\x1b[33m",
  "\x1b[35m",
  "\x1b[32m",
  "\x1b[34m",
  "\x1b[96m",
  "\x1b[92m",
  "\x1b[93m",
  "\x1b[95m",
  "\x1b[94m",
  "\x1b[91m",
  "\x1b[97m",
];
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";

const colorById = new Map();

export function colorFor(id) {
  if (!colorById.has(id)) {
    colorById.set(id, COLORS[colorById.size % COLORS.length]);
  }
  return colorById.get(id);
}

export function log(message = "") {
  console.log(message);
}

export function info(message) {
  console.log(`${DIM}${message}${RESET}`);
}

export function success(message) {
  console.log(`${BOLD}\x1b[32m✓${RESET} ${message}`);
}

export function warn(message) {
  console.log(`${BOLD}\x1b[33m!${RESET} ${message}`);
}

export function error(message) {
  console.error(`${BOLD}\x1b[31m✗${RESET} ${message}`);
}

export function prefixLines(id, chunk, stream) {
  const color = colorFor(id);
  const text = chunk.toString();
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const isLastPartial = index === lines.length - 1 && !text.endsWith("\n");
    if (line.length === 0 && !isLastPartial) {
      stream.write("\n");
      continue;
    }
    if (line.length === 0) {
      continue;
    }
    stream.write(`${color}[${id}]${RESET} ${line}\n`);
  }
}

export function loadRootEnv() {
  const envPath = path.join(repoRoot, ".env");
  if (!existsSync(envPath)) {
    return { ...process.env };
  }

  const merged = { ...process.env };
  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separator = line.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    merged[key] = value;
  }
  return merged;
}

export function waitForPort(port, host = "127.0.0.1", timeoutMs = 120_000) {
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect({ port, host }, () => {
        socket.end();
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
          return;
        }
        setTimeout(attempt, 1_000);
      });
    };
    attempt();
  });
}

export async function waitForHealth(url, label, timeoutMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(4_000) });
      if (response.ok) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`${label} did not become healthy at ${url}`);
}

/**
 * Spawn a child process without shell interpolation so paths with spaces
 * (common on Windows under OneDrive) are passed correctly to the executable.
 *
 * On Windows, `.cmd`/`.bat` shims (e.g. pnpm.cmd) cannot be spawned directly
 * without a shell — doing so throws EINVAL. Those are routed through cmd.exe
 * while keeping argument boundaries intact.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {import('node:child_process').SpawnOptions} [options]
 */
function quoteCmdArg(value) {
  const text = String(value);
  if (!/\s|"/.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

function sanitizeWherePath(line) {
  return line
    .trim()
    .replace(/^"+|"+$/g, "")
    .replace(/\\"/g, '"');
}

function pickBestExecutable(lines) {
  const globalShim = lines.find(
    (line) => /\\AppData\\Roaming\\npm\\/i.test(line) && /\.cmd$/i.test(line),
  );
  if (globalShim) {
    return globalShim;
  }
  const localPnpm = lines.find((line) =>
    /\\AppData\\Local\\pnpm\\pnpm\.exe$/i.test(line),
  );
  if (localPnpm) {
    return localPnpm;
  }
  return lines.find((line) => !/\\store\\/i.test(line)) ?? lines[0];
}

function resolveWindowsExecutable(command) {
  const base = path.basename(command).toLowerCase().replace(/\.(cmd|bat|exe)$/i, "");
  const lookup =
    base === command.toLowerCase() ? base : path.basename(command);
  const candidates =
    lookup.toLowerCase() === lookup
      ? [`${lookup}.cmd`, lookup]
      : [command];

  for (const candidate of candidates) {
    try {
      const output = execFileSync("where.exe", [candidate], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const lines = output
        .split(/\r?\n/)
        .map(sanitizeWherePath)
        .filter(Boolean);
      const match = pickBestExecutable(lines);
      if (match) {
        return match;
      }
    } catch {
      // try next candidate
    }
  }

  return command;
}

export function spawnProcess(command, args, options = {}) {
  const { shell: _ignoredShell, ...rest } = options;

  if (process.platform === "win32") {
    const resolved = resolveWindowsExecutable(command);
    const ext = path.extname(resolved).toLowerCase();
    if (ext === ".cmd" || ext === ".bat" || needsWindowsCmdWrapper(command)) {
      const commandLine = [resolved, ...args].map(quoteCmdArg).join(" ");
      return spawn(commandLine, {
        ...rest,
        shell: true,
      });
    }
    return spawn(resolved, args, {
      ...rest,
      shell: false,
    });
  }

  return spawn(command, args, {
    ...rest,
    shell: false,
  });
}

function needsWindowsCmdWrapper(command) {
  const base = path.basename(command).toLowerCase().replace(/\.(cmd|bat)$/i, "");
  return base === "pnpm" || base === "npm" || base === "npx";
}

export function formatCommand(command, args) {
  return [command, ...args]
    .map((part) => (/\s/.test(part) ? `"${part}"` : part))
    .join(" ");
}

export function resolveCommand(service) {
  if (service.kind === "go") {
    return {
      command: "go",
      args: ["run", "./cmd/server"],
      cwd: path.join(repoRoot, service.cwd),
    };
  }

  if (service.kind === "pnpm") {
    return {
      command: "pnpm",
      args: ["run", service.pnpmScript],
      cwd: path.join(repoRoot, service.cwd),
    };
  }

  throw new Error(`Unsupported service kind: ${service.kind}`);
}
