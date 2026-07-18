#!/usr/bin/env node
/**
 * Stop local Docker infrastructure started by the dev launcher.
 */
import path from "node:path";
import { infraComposeFile } from "./dev-manifest.mjs";
import { error, info, repoRoot, spawnProcess, success } from "./dev-utils.mjs";

const composePath = path.join(repoRoot, infraComposeFile);

info("Stopping GoApps Docker infrastructure...");

const child = spawnProcess("docker", ["compose", "-f", composePath, "down"], {
  cwd: repoRoot,
  stdio: "inherit",
});

child.on("error", (err) => {
  error(err.message);
  process.exit(1);
});

child.on("exit", (code) => {
  if (code === 0) {
    success("Infrastructure stopped");
    return;
  }
  error(`docker compose down exited with code ${code}`);
  process.exit(code ?? 1);
});
