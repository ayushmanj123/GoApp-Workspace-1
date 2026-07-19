/**
 * Phase 7.31 — Studio canvas editor UX (context menu, nest, Shift-snap, typing).
 * Run: node infrastructure/scripts/validate-phase-7.31.mjs
 */
import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.31");
const LOG_FILE = path.join(OUT_DIR, "validation.log");

const results = [];

function log(line) {
  const msg = `[${new Date().toISOString()}] ${line}`;
  console.log(msg);
  appendFileSync(LOG_FILE, `${msg}\n`);
}

function record(test, passed, detail) {
  results.push({ test, passed, detail });
  log(`${passed ? "PASS" : "FAIL"} — ${test}: ${detail}`);
}

function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(LOG_FILE, "");
  log("Phase 7.31 validation starting");

  const menu = readFileSync(
    path.join(ROOT, "apps/studio/src/canvas/overlay/ControlContextMenu.tsx"),
    "utf8",
  );
  record(
    "Test 1 — context menu Lock / Duplicate / Remove / Layering",
    menu.includes("Lock") &&
      menu.includes("Duplicate") &&
      menu.includes("Remove") &&
      menu.includes("Layering") &&
      menu.includes("To Front") &&
      menu.includes("Insert into Container") &&
      menu.includes("Nest into Container"),
    "ControlContextMenu.tsx",
  );

  const store = readFileSync(
    path.join(ROOT, "apps/studio/src/store/applicationStore.ts"),
    "utf8",
  );
  record(
    "Test 2 — duplicateControl + setControlLocked",
    store.includes("duplicateControl:") && store.includes("setControlLocked:"),
    "applicationStore.ts",
  );

  const router = readFileSync(
    path.join(ROOT, "apps/studio/src/canvas/interaction/useCanvasEventRouter.ts"),
    "utf8",
  );
  record(
    "Test 3 — Shift-gated snap + contextmenu + Delete",
    router.includes("ev.shiftKey") &&
      router.includes("onContextMenu") &&
      router.includes('event.key === "Delete"') &&
      router.includes("isEditableKeyboardTarget"),
    "useCanvasEventRouter.ts",
  );

  const editable = readFileSync(
    path.join(ROOT, "apps/studio/src/utils/editable-keyboard-target.ts"),
    "utf8",
  );
  const propPanel = readFileSync(
    path.join(ROOT, "apps/studio/src/components/layout/PropertyPanel.tsx"),
    "utf8",
  );
  record(
    "Test 4 — typing guards + PropRow draft",
    editable.includes("isEditableKeyboardTarget") &&
      propPanel.includes("focusedRef") &&
      propPanel.includes("setDraft"),
    "editable-keyboard-target + PropertyPanel",
  );

  const overlay = readFileSync(
    path.join(ROOT, "apps/studio/src/canvas/overlay/OverlaySystem.tsx"),
    "utf8",
  );
  record(
    "Test 5 — nest banner tip + ControlContextMenu mounted",
    overlay.includes("Drop or insert tools here") &&
      overlay.includes("ControlContextMenu"),
    "OverlaySystem.tsx",
  );

  const docs = readFileSync(path.join(ROOT, "docs/studio-controls.md"), "utf8");
  record(
    "Test 6 — docs context menu / Shift-snap",
    docs.includes("context menu") &&
      docs.includes("Shift") &&
      (docs.includes("snap") || docs.includes("alignment")),
    "studio-controls.md",
  );

  const failed = results.filter((r) => !r.passed);
  log(`Done: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main();
