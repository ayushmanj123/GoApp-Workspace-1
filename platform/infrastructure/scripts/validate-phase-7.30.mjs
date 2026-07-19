/**
 * Phase 7.30 — Studio canvas UX polish (toolbox, designer chrome, container nesting).
 * Run: node infrastructure/scripts/validate-phase-7.30.mjs
 */
import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-7.30");
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
  log("Phase 7.30 validation starting");

  const footer = readFileSync(
    path.join(ROOT, "apps/studio/src/components/layout/ToolsFooter.tsx"),
    "utf8",
  );
  const footerCss = readFileSync(
    path.join(ROOT, "apps/studio/src/components/layout/ToolsFooter.module.css"),
    "utf8",
  );

  record(
    "Test 1 — single tools row + Shapes flyout",
    footer.includes("ShapesFlyout") &&
      footer.includes("resolveInsertParentId") &&
      footer.includes('data-testid="shapes-flyout-btn"') &&
      footer.includes("createPortal") &&
      !footer.includes("toolRows"),
    "ToolsFooter.tsx",
  );

  record(
    "Test 2 — nowrap horizontal scroll toolbar + portaled menu",
    footerCss.includes("flex-wrap: nowrap") &&
      footerCss.includes("overflow-x: auto") &&
      footerCss.includes("position: fixed") &&
      footerCss.includes("z-index: 1100"),
    "ToolsFooter.module.css",
  );

  const hostCss = readFileSync(
    path.join(ROOT, "apps/studio/src/components/canvas/StudioControlRenderer.module.css"),
    "utf8",
  );
  record(
    "Test 3 — host CSS no blanket span sizing",
    !hostCss.includes(".host input, .host span") &&
      !hostCss.match(/\.host span\s*\{/) &&
      hostCss.includes(".fillControl"),
    "StudioControlRenderer.module.css",
  );

  const formDesigner = readFileSync(
    path.join(ROOT, "apps/studio/src/canvas/designer/components/DesignerContainers.tsx"),
    "utf8",
  );
  record(
    "Test 4 — Form empty-state hint",
    formDesigner.includes("Drop fields or Generate fields"),
    "DesignerContainers.tsx",
  );

  record(
    "Test 5 — createControl parent-from-selection path",
    footer.includes("parent_control_id: parentId") &&
      footer.includes("isContainerType") &&
      footer.includes("containerEditId"),
    "ToolsFooter resolveInsertParentId",
  );

  const shapeLayer = readFileSync(
    path.join(ROOT, "apps/studio/src/canvas/designer/DesignerShapeLayer.tsx"),
    "utf8",
  );
  record(
    "Test 6 — shapes use absoluteBounds",
    shapeLayer.includes("absoluteBounds"),
    "DesignerShapeLayer.tsx",
  );

  const overlay = readFileSync(
    path.join(ROOT, "apps/studio/src/canvas/overlay/OverlaySystem.tsx"),
    "utf8",
  );
  record(
    "Test 7 — container edit banner",
    overlay.includes("Editing Container") && overlay.includes("Esc to exit"),
    "OverlaySystem.tsx",
  );

  const docs = readFileSync(path.join(ROOT, "docs/studio-controls.md"), "utf8");
  record(
    "Test 8 — docs mention single-line toolbox / Shapes flyout / nest",
    docs.includes("Shapes flyout") &&
      docs.includes("insert-into-selection") &&
      docs.includes("flex-wrap: nowrap"),
    "studio-controls.md",
  );

  const interactionStore = readFileSync(
    path.join(ROOT, "apps/studio/src/canvas/interaction/interactionStore.ts"),
    "utf8",
  );
  const selectionOutline = readFileSync(
    path.join(ROOT, "apps/studio/src/canvas/overlay/SelectionOutline.tsx"),
    "utf8",
  );
  const canvasSurface = readFileSync(
    path.join(ROOT, "apps/studio/src/canvas/CanvasSurface.tsx"),
    "utf8",
  );
  record(
    "Test 9 — drop target highlight",
    interactionStore.includes("dropTargetControlId") &&
      interactionStore.includes("setDropTarget") &&
      selectionOutline.includes("drop-target-outline") &&
      canvasSurface.includes("handleDragOver"),
    "dropTargetControlId + outline + dragOver",
  );

  const eventRouter = readFileSync(
    path.join(ROOT, "apps/studio/src/canvas/interaction/useCanvasEventRouter.ts"),
    "utf8",
  );
  const hitTest = readFileSync(
    path.join(ROOT, "apps/studio/src/canvas/interaction/HitTestService.ts"),
    "utf8",
  );
  record(
    "Test 10 — reparent on drag",
    eventRouter.includes("commitReparent") &&
      eventRouter.includes("parent_control_id") &&
      hitTest.includes("excludeControlId"),
    "useCanvasEventRouter + HitTestService",
  );

  const designerNodeRenderer = readFileSync(
    path.join(ROOT, "apps/studio/src/canvas/designer/DesignerNodeRenderer.tsx"),
    "utf8",
  );
  const registerDesigner = readFileSync(
    path.join(ROOT, "apps/studio/src/canvas/designer/register-designer-renderers.tsx"),
    "utf8",
  );
  const setup = readFileSync(path.join(ROOT, "apps/studio/src/registry/setup.ts"), "utf8");
  record(
    "Test 11 — designer preview bypasses noop renderDesigner",
    designerNodeRenderer.includes("renderStudioDesignerPreview") &&
      registerDesigner.includes("export function renderStudioDesignerPreview") &&
      setup.includes("Always re-apply designer patches"),
    "DesignerNodeRenderer + setup",
  );

  const failed = results.filter((r) => !r.passed);
  log(`Done: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main();
