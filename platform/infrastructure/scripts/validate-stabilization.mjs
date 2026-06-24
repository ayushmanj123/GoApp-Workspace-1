/**
 * Stabilization sprint gate — runs canvas, screens, and formula validators.
 * Run: node infrastructure/scripts/validate-stabilization.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const scripts = [
  "validate-stabilization-canvas.mjs",
  "validate-stabilization-screens.mjs",
  "validate-stabilization-formulas.mjs",
];

let failed = false;

for (const script of scripts) {
  console.log(`\n>>> Running ${script}`);
  const result = spawnSync(process.execPath, [path.join(__dirname, script)], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    failed = true;
  }
}

if (failed) {
  console.error("\nStabilization gate FAILED");
  process.exit(1);
}

console.log("\nStabilization gate PASSED");
