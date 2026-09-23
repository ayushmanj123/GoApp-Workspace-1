/**
 * Lightweight runtime unit checks (no vitest dependency).
 * Run: node apps/runtime/scripts/unit-check.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const provider = readFileSync(path.join(root, "src/runtime-provider.tsx"), "utf8");
const sessionClient = readFileSync(path.join(root, "src/runtime-session-client.ts"), "utf8");
const shell = readFileSync(path.join(root, "src/components/runtime-shell.tsx"), "utf8");

assert.match(provider, /setLoadError/, "runtime-provider must surface load errors");
assert.match(provider, /finally/, "loadRender must use try/finally");
assert.match(sessionClient, /status === 401/, "session client must handle 401");
assert.match(shell, /loadError/, "runtime-shell must render loadError");
assert.match(shell, /actionError/, "runtime-shell must render actionError");

const parentItem = readFileSync(
  path.join(root, "src/utils/parent-item-field.ts"),
  "utf8",
);
assert.match(parentItem, /ThisItem/, "binder must accept ThisItem.Field");
assert.match(parentItem, /Parent\\.Item/, "binder must accept Parent.Item.Field");

const form = readFileSync(path.join(root, "src/components/form.tsx"), "utf8");
assert.match(form, /updateRuntimeForm|fetchRuntimeForm/, "Form must use session form APIs");
assert.match(form, /flushPendingUpdates|registerFormUpdateFlusher/, "Form must flush updates before submit");
assert.match(form, /formRefreshTick|sessionState/, "Form must sync live mode from session");

const formFlush = readFileSync(
  path.join(root, "src/formula/form-update-flush.ts"),
  "utf8",
);
assert.match(formFlush, /flushAllFormUpdates/, "flush registry required for SubmitForm");

const actionHandler = readFileSync(
  path.join(root, "src/hooks/use-runtime-action-handler.ts"),
  "utf8",
);
assert.match(actionHandler, /flushAllFormUpdates/, "actions must flush form updates");
assert.match(actionHandler, /bumpFormRefresh/, "actions must refresh form after mode/submit");

const datacard = readFileSync(path.join(root, "src/components/datacard.tsx"), "utf8");
assert.match(datacard, /validationErrors/, "DataCard must show field errors");
assert.match(datacard, /formMode|DisplayMode|displayMode/, "DataCard must cascade DisplayMode");
assert.match(datacard, /isReadOnly|cardReadOnly|forceReadOnly/, "DataCard must cascade read-only");

const textInput = readFileSync(path.join(root, "src/components/text-input.tsx"), "utf8");
assert.match(textInput, /useEditableControlValue/, "TextInput must use editable local draft");
assert.match(textInput, /setValue\(nextValue\)/, "TextInput must update local value on change");

const editableHook = readFileSync(
  path.join(root, "src/hooks/use-editable-control-value.ts"),
  "utf8",
);
assert.match(editableHook, /focusedRef|isFocused/, "editable hook must protect focused drafts");

const formEdit = readFileSync(path.join(root, "src/form-edit-context.tsx"), "utf8");
assert.match(formEdit, /isReadOnly/, "FormEditContext must expose isReadOnly cascade");
assert.match(formEdit, /recordKey/, "FormEditContext must expose recordKey for resync");

const screen = readFileSync(path.join(root, "src/screen-renderer.tsx"), "utf8");
assert.match(screen, /runtime-surface\.module\.css/, "runtime must apply surface CSS");

assert.match(form, /form-offline-hint|Runtime service unavailable|No runtime session/, "Form must surface offline/unavailable hint");
assert.match(form, /flexDirection:\s*[\"']column[\"']|flex-direction/, "Form Vertical uses flex column");
assert.match(
  form,
  /submitFailed|validation.*Submit|Only steal focus after Submit/i,
  "Form must not autofocus invalid fields on every Update",
);
assert.match(
  form,
  /record\.recordId \?\? record\.RecordId/,
  "Form recordKey must prefer platform recordId",
);
assert.doesNotMatch(
  form,
  /record\.id \?\? record\.Id/,
  "Form recordKey must not use generic id business fields",
);

const submitOffline = readFileSync(
  path.join(root, "src/formula/execute-submit-form.ts"),
  "utf8",
);
assert.match(
  submitOffline,
  /no-session|offline/i,
  "offline SubmitForm must be documented as session-gated",
);

const datatable = readFileSync(path.join(root, "src/components/datatable.tsx"), "utf8");
assert.match(datatable, /useSessionGalleryItems/, "DataTable must use session gallery items");
assert.match(datatable, /showRefresh/, "DataTable keeps showRefresh as a Studio property");
assert.doesNotMatch(
  datatable,
  /showRefreshButton|Refreshing…/,
  "DataTable must not render an in-app Refresh toolbar",
);

assert.match(sessionClient, /fetchRuntimeGallery/, "session client must GET gallery");
assert.match(sessionClient, /reloadRuntimeGallery/, "session client must POST gallery reload");

const galleryHook = readFileSync(
  path.join(root, "src/hooks/use-session-gallery-items.ts"),
  "utf8",
);
assert.match(galleryHook, /fetchRuntimeGallery/, "session gallery hook must fetch GET gallery");

const galleryRows = readFileSync(path.join(root, "src/utils/gallery-rows.ts"), "utf8");
assert.match(galleryRows, /coalesceItemsProp|Items/, "items casing normalize helper required");
assert.match(galleryRows, /galleryRowKey/, "gallery rows must export stable row keys");
const gallerySrc = readFileSync(path.join(root, "src/components/gallery.tsx"), "utf8");
assert.match(gallerySrc, /galleryRowKey/, "Gallery must use stable row keys");
assert.doesNotMatch(
  gallerySrc,
  /key=\{`\$\{index\}-\$\{JSON\.stringify\(record\)\}`\}/,
  "Gallery must not remount rows via JSON.stringify keys",
);
assert.match(datatable, /galleryRowKey/, "DataTable must use stable row keys");
assert.doesNotMatch(
  datatable,
  /key=\{`\$\{index\}-\$\{JSON\.stringify\(record\)\}`\}/,
  "DataTable must not remount rows via JSON.stringify keys",
);
const controlRenderer = readFileSync(path.join(root, "src/control-renderer.tsx"), "utf8");
assert.match(controlRenderer, /props\.items = props\.items \?\? props\.Items/, "renderer must normalize Items");
assert.match(controlRenderer, /controlId/, "DataTable/Gallery must receive controlId");

assert.match(provider, /galleryRefreshTick/, "runtime-provider must expose galleryRefreshTick");
assert.match(provider, /bumpGalleryRefresh/, "runtime-provider must expose bumpGalleryRefresh");

const executeAction = readFileSync(
  path.join(root, "src/formula/execute-runtime-action.ts"),
  "utf8",
);
assert.match(executeAction, /bumpGalleryRefresh|Refresh/, "actions must bump gallery after Refresh/datasource");

const controlLayout = readFileSync(path.join(root, "src/utils/control-layout.ts"), "utf8");
assert.match(
  controlLayout,
  /export function readVisible/,
  "control-layout must export readVisible for chrome checks",
);
assert.match(
  controlLayout,
  /"value" in raw/,
  "readVisible must unwrap Studio { value } wrappers",
);

const button = readFileSync(path.join(root, "src/components/button.tsx"), "utf8");
assert.match(
  button,
  /disabled=\{disabled/,
  "Button must honor disabled from ControlRenderer DisplayMode cascade",
);
assert.match(
  button,
  /title=\{resolvedTooltip/,
  "Button must apply Tooltip as title",
);
assert.match(
  controlRenderer,
  /layout\.visible/,
  "ControlRenderer must gate on layout.visible",
);
assert.match(
  controlRenderer,
  /displayMode === "Disabled"|layout\.disabled/,
  "ControlRenderer must apply DisplayMode Disabled",
);

assert.match(
  textInput,
  /useRuntimeActionHandler/,
  "TextInput must run OnChange via useRuntimeActionHandler",
);

const dropdown = readFileSync(path.join(root, "src/components/dropdown.tsx"), "utf8");
assert.match(
  dropdown,
  /toDropdownOptions\(records,\s*resolvedDisplayField,\s*resolvedValueField\)/,
  "Dropdown must map DisplayField/ValueField into options",
);
assert.match(
  dropdown,
  /title=\{resolvedTooltip/,
  "Dropdown must apply Tooltip as title",
);

const datatableSrc = readFileSync(path.join(root, "src/components/datatable.tsx"), "utf8");
assert.match(
  datatableSrc,
  /resolveColumns|columns.*columnHints/,
  "DataTable must keep columns then columnHints resolve order",
);

assert.match(
  controlLayout,
  /normalizeFlexDirection/,
  "control-layout must export normalizeFlexDirection",
);
const appearance = readFileSync(path.join(root, "src/utils/appearance-style.ts"), "utf8");
assert.match(appearance, /export function appearanceCss/, "appearance helper must export appearanceCss");
const radio = readFileSync(path.join(root, "src/components/simple-controls.tsx"), "utf8");
assert.match(radio, /export const Radio/, "Radio control must be registered in simple-controls");

const containerSrc = readFileSync(path.join(root, "src/components/container.tsx"), "utf8");
assert.match(
  containerSrc,
  /normalizeFlexDirection/,
  "Container must read direction via normalizeFlexDirection",
);
assert.match(
  containerSrc,
  /display:\s*[\"']flex[\"']|display:\s*\"flex\"/,
  "Container must flex-pack nested children",
);

const imageSrc = readFileSync(path.join(root, "src/components/image.tsx"), "utf8");
assert.match(
  imageSrc,
  /useRuntimeActionHandler/,
  "Image must run OnSelect via useRuntimeActionHandler",
);
assert.match(
  imageSrc,
  /"OnSelect"/,
  "Image must pass OnSelect event name",
);

const iconSrc = readFileSync(path.join(root, "src/components/icon.tsx"), "utf8");
assert.match(
  iconSrc,
  /useRuntimeActionHandler/,
  "Icon must run OnSelect via useRuntimeActionHandler",
);
assert.match(
  iconSrc,
  /"OnSelect"/,
  "Icon must pass OnSelect event name",
);

const timerSrc = readFileSync(path.join(root, "src/components/timer.tsx"), "utf8");
assert.match(
  timerSrc,
  /autoStart/,
  "Timer must read autoStart",
);
assert.match(
  timerSrc,
  /repeat/,
  "Timer must read repeat",
);
assert.match(
  timerSrc,
  /startEnabled|readBoolean\(start/,
  "Timer must gate on start",
);

console.log("runtime unit-check: PASS");
