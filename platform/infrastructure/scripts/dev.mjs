#!/usr/bin/env node
/**
 * GoApps Platform — unified local development launcher.
 *
 * Usage:
 *   pnpm dev
 *   pnpm dev:full
 *   node infrastructure/scripts/dev.mjs --profile studio --only metadata,runtime,studio
 *   node infrastructure/scripts/dev.mjs --no-infra --list
 */
import path from "node:path";
import {
  devServices,
  infraComposeFile,
  infraEndpoints,
  selectServices,
} from "./dev-manifest.mjs";
import {
  error,
  formatCommand,
  info,
  loadRootEnv,
  log,
  prefixLines,
  repoRoot,
  resolveCommand,
  spawnProcess,
  success,
  waitForHealth,
  waitForPort,
  warn,
} from "./dev-utils.mjs";

const args = process.argv.slice(2);

function printHelp() {
  log(`
${"\x1b[1m"}GoApps Platform — Development Launcher${"\x1b[0m"}

Usage:
  pnpm dev                     Start studio profile (default)
  pnpm dev:full                Start all backend + frontend apps
  node infrastructure/scripts/dev.mjs [options]

Options:
  --profile <studio|full>      Service set to start (default: studio)
  --only <id,id,...>           Start only the listed service ids
  --no-infra                   Skip Docker infrastructure startup
  --infra-only                 Start Docker infrastructure and exit
  --no-wait                    Do not wait for health checks
  --list                       List services for the selected profile
  --help                       Show this help

Studio profile:
  Docker + metadata, runtime, publish, gateway, formula-api, studio

Full profile:
  Studio profile + auth, connector, environment, audit, search,
  runtime app
`);
}

function parseArgs(argv) {
  /** @type {{ profile: 'studio' | 'full', only?: string[], noInfra: boolean, infraOnly: boolean, noWait: boolean, list: boolean, help: boolean }} */
  const options = {
    profile: "studio",
    only: undefined,
    noInfra: false,
    infraOnly: false,
    noWait: false,
    list: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    switch (token) {
      case "--profile":
        options.profile = /** @type {'studio' | 'full'} */ (argv[++index] ?? "studio");
        break;
      case "--only":
        options.only = (argv[++index] ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
        break;
      case "--no-infra":
        options.noInfra = true;
        break;
      case "--infra-only":
        options.infraOnly = true;
        break;
      case "--no-wait":
        options.noWait = true;
        break;
      case "--list":
        options.list = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown option: ${token}`);
    }
  }

  if (!["studio", "full"].includes(options.profile)) {
    throw new Error(`Invalid profile "${options.profile}". Use studio or full.`);
  }

  return options;
}

function runCommand(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(command, commandArgs, {
      cwd: options.cwd ?? repoRoot,
      env: options.env ?? process.env,
      stdio: options.stdio ?? "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(`${formatCommand(command, commandArgs)} exited with code ${code}`),
      );
    });
  });
}

async function startInfrastructure() {
  const composePath = path.join(repoRoot, infraComposeFile);
  info("Starting Docker infrastructure...");
  try {
    await runCommand("docker", ["compose", "-f", composePath, "up", "-d"]);
  } catch (composeError) {
    const message =
      composeError instanceof Error ? composeError.message : String(composeError);
    // Docker Desktop sometimes returns API 500 while containers are already up.
    try {
      await waitForPort(5432, "127.0.0.1", 3_000);
      warn(
        `docker compose failed (${message}). PostgreSQL is already reachable on :5432 — continuing.`,
      );
      warn(
        "If services fail next, restart Docker Desktop, then re-run `pnpm dev` (or use `pnpm exec node infrastructure/scripts/dev.mjs --no-infra`).",
      );
      for (const endpoint of infraEndpoints) {
        info(`  ${endpoint.label.padEnd(14)} ${endpoint.url}`);
      }
      return;
    } catch {
      error(
        "Docker infrastructure failed to start and PostgreSQL is not reachable on :5432.",
      );
      error(
        "Fix: open Docker Desktop, wait until it is Running, then retry `pnpm dev`.",
      );
      throw composeError;
    }
  }
  info("Waiting for PostgreSQL on :5432...");
  await waitForPort(5432);
  success("Infrastructure is ready");
  for (const endpoint of infraEndpoints) {
    info(`  ${endpoint.label.padEnd(14)} ${endpoint.url}`);
  }
}

/** @type {import('node:child_process').ChildProcess[]} */
const children = [];

function shutdown(exitCode = 0) {
  if (children.length > 0) {
    info("Stopping services...");
    for (const child of children) {
      if (!child.killed) {
        child.kill("SIGTERM");
      }
    }
    setTimeout(() => {
      for (const child of children) {
        if (!child.killed) {
          child.kill("SIGKILL");
        }
      }
      process.exit(exitCode);
    }, 2_000).unref();
    return;
  }
  process.exit(exitCode);
}

function spawnService(service, baseEnv) {
  const { command, args, cwd } = resolveCommand(service);
  const child = spawnProcess(command, args, {
    cwd,
    env: { ...baseEnv, ...service.env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => prefixLines(service.id, chunk, process.stdout));
  child.stderr.on("data", (chunk) => prefixLines(service.id, chunk, process.stderr));
  child.on("error", (spawnError) => {
    error(`${service.label} failed to start: ${spawnError.message}`);
    shutdown(1);
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      warn(`${service.label} stopped (${signal})`);
      return;
    }
    if (code && code !== 0) {
      error(`${service.label} exited with code ${code}`);
      shutdown(code ?? 1);
    }
  });

  children.push(child);
  return child;
}

async function waitForDependencies(service, started, noWait) {
  if (noWait || !service.dependsOn?.length) {
    return;
  }

  for (const dependencyId of service.dependsOn) {
    const dependency = started.get(dependencyId);
    if (!dependency?.port || !dependency.healthPath) {
      continue;
    }
    const url = `http://127.0.0.1:${dependency.port}${dependency.healthPath}`;
    info(`Waiting for ${dependency.label} before starting ${service.label}...`);
    await waitForHealth(url, dependency.label);
  }
}

function printReadyBanner(services) {
  log("");
  log(`${"\x1b[1m"}GoApps development environment is running${"\x1b[0m"}`);
  log("Press Ctrl+C to stop all services.");
  log("");
  for (const service of services) {
    if (service.url) {
      log(`  ${service.label.padEnd(14)} ${service.url}`);
    }
  }
  log("");
}

async function main() {
  const options = parseArgs(args);
  if (options.help) {
    printHelp();
    return;
  }

  const services = selectServices(options.profile, options.only);
  if (options.list) {
    log(`Services for profile "${options.profile}":`);
    for (const service of services) {
      const port = service.port ? `:${service.port}` : "";
      log(`  - ${service.id.padEnd(14)} ${service.label}${port}`);
    }
    return;
  }

  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));

  const baseEnv = loadRootEnv();

  if (!options.noInfra) {
    await startInfrastructure();
    if (options.infraOnly) {
      return;
    }
  } else if (options.infraOnly) {
    throw new Error("--infra-only requires Docker startup; remove --no-infra.");
  }

  if (services.length === 0) {
    throw new Error("No services selected. Check --profile or --only.");
  }

  log("");
  info(
    `Starting ${services.length} service${services.length === 1 ? "" : "s"} ` +
      `(profile: ${options.profile})...`,
  );
  log("");

  /** @type {Map<string, import('./dev-manifest.mjs').DevService>} */
  const started = new Map();

  for (const service of services) {
    await waitForDependencies(service, started, options.noWait);
    spawnService(service, baseEnv);
    started.set(service.id, service);
  }

  if (!options.noWait) {
    for (const service of services) {
      if (!service.port || !service.healthPath) {
        continue;
      }
      const url = `http://127.0.0.1:${service.port}${service.healthPath}`;
      try {
        await waitForHealth(url, service.label, 180_000);
        success(`${service.label} is ready`);
      } catch (waitError) {
        warn(
          `${service.label} health check timed out — it may still be starting (${waitError.message})`,
        );
      }
    }
  }

  printReadyBanner(services);

  await new Promise(() => {
    // keep process alive until interrupted
  });
}

main().catch((err) => {
  error(err instanceof Error ? err.message : String(err));
  shutdown(1);
});
