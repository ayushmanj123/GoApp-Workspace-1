/**
 * Lightweight studio unit checks (no vitest dependency).
 * Run: node apps/studio/scripts/unit-check.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientSrc = readFileSync(path.join(root, "src/api/metadata-client.ts"), "utf8");
const sessionSrc = readFileSync(path.join(root, "src/auth/session.ts"), "utf8");
const generateFormFieldsSrc = readFileSync(
  path.join(root, "src/utils/generate-form-fields.ts"),
  "utf8",
);
const googleSheetsColumnsSrc = readFileSync(
  path.join(root, "src/utils/google-sheets-columns.ts"),
  "utf8",
);
const propertyPanelSrc = readFileSync(
  path.join(root, "src/components/layout/PropertyPanel.tsx"),
  "utf8",
);
const dataPanelSrc = readFileSync(
  path.join(root, "src/components/layout/DataPanel.tsx"),
  "utf8",
);

assert.match(clientSrc, /res\.status === 401/, "metadata-client must handle 401");
assert.match(clientSrc, /clearSession/, "metadata-client must clear session on 401");
assert.match(sessionSrc, /VITE_KEYCLOAK_URL is required in production/, "keycloakConfig must require URL in PROD");
assert.match(sessionSrc, /import\.meta\.env\.PROD/, "session must gate on PROD");

assert.match(
  generateFormFieldsSrc,
  /sheetColumnsToEntityFields/,
  "generate-form-fields must map sheet columns to form fields",
);
assert.match(
  generateFormFieldsSrc,
  /resolveFormGoogleSheetsConnector/,
  "generate-form-fields must resolve google_sheets connectors",
);
assert.match(
  generateFormFieldsSrc,
  /control_type: "datacard"/,
  "generate-form-fields must wrap fields in DataCard controls",
);
assert.match(
  generateFormFieldsSrc,
  /ThisItem\.\$\{field\.name\}/,
  "generate-form-fields must bind defaults to ThisItem",
);
assert.match(
  generateFormFieldsSrc,
  /resolveFormLayout/,
  "generate-form-fields must respect form layout properties",
);
assert.match(
  googleSheetsColumnsSrc,
  /previewGoogleSheet/,
  "google-sheets-columns helper must call preview API",
);
assert.match(
  propertyPanelSrc,
  /form-datasource-picker/,
  "PropertyPanel must expose Form dataSource picker",
);
assert.match(
  propertyPanelSrc,
  /property-refresh-data-btn/,
  "PropertyPanel must expose Refresh data for Gallery/DataTable",
);
assert.match(
  propertyPanelSrc,
  /showRefresh/,
  "PropertyPanel must keep showRefresh as a Data property",
);
assert.match(
  dataPanelSrc,
  /data-sheet-column-/,
  "DataPanel must render sheet columns under connectors",
);

const registrySrc = readFileSync(
  path.join(root, "src/property-metadata/registry.ts"),
  "utf8",
);
assert.match(
  registrySrc,
  /BUTTON_PROPERTIES[\s\S]*name:\s*"visible"/,
  "Button registry must expose Visible",
);
assert.match(
  registrySrc,
  /LABEL_PROPERTIES[\s\S]*name:\s*"visible"/,
  "Label registry must expose Visible",
);
assert.match(
  registrySrc,
  /LABEL_PROPERTIES[\s\S]*name:\s*"size"/,
  "Label registry must expose Size",
);
assert.match(
  registrySrc,
  /LABEL_PROPERTIES[\s\S]*name:\s*"weight"/,
  "Label registry must expose Weight",
);
assert.match(
  registrySrc,
  /LABEL_PROPERTIES[\s\S]*name:\s*"align"/,
  "Label registry must expose Align",
);
assert.match(
  registrySrc,
  /GALLERY_PROPERTIES[\s\S]*name:\s*"visible"/,
  "Gallery registry must expose Visible",
);
assert.match(
  registrySrc,
  /FORM_PROPERTIES[\s\S]*name:\s*"visible"/,
  "Form registry must expose Visible",
);
assert.match(
  registrySrc,
  /BUTTON_PROPERTIES[\s\S]*name:\s*"displayMode"/,
  "Button registry must expose DisplayMode",
);
assert.match(
  registrySrc,
  /TEXT_INPUT_PROPERTIES[\s\S]*name:\s*"onChange"/,
  "TextInput registry must expose OnChange",
);
assert.match(
  registrySrc,
  /DROPDOWN_PROPERTIES[\s\S]*name:\s*"displayField"/,
  "Dropdown registry must expose DisplayField",
);
assert.match(
  registrySrc,
  /DROPDOWN_PROPERTIES[\s\S]*name:\s*"valueField"/,
  "Dropdown registry must expose ValueField",
);
assert.match(
  registrySrc,
  /BUTTON_PROPERTIES[\s\S]*name:\s*"tooltip"/,
  "Button registry must expose Tooltip",
);
assert.match(
  registrySrc,
  /BUTTON_PROPERTIES[\s\S]*?\.\.\.BOX_CHROME/,
  "Button registry must expose shared appearance",
);
assert.match(
  registrySrc,
  /RADIO_PROPERTIES[\s\S]*name:\s*"items"/,
  "Radio registry must expose Items",
);
assert.match(
  registrySrc,
  /IMAGE_PROPERTIES[\s\S]*name:\s*"onSelect"/,
  "Image registry must expose OnSelect",
);
assert.match(
  registrySrc,
  /ICON_PROPERTIES[\s\S]*name:\s*"onSelect"/,
  "Icon registry must expose OnSelect",
);
assert.match(
  registrySrc,
  /TIMER_PROPERTIES[\s\S]*name:\s*"autoStart"/,
  "Timer registry must expose AutoStart",
);
assert.match(
  registrySrc,
  /TIMER_PROPERTIES[\s\S]*name:\s*"start"/,
  "Timer registry must expose Start",
);
assert.match(
  registrySrc,
  /TIMER_PROPERTIES[\s\S]*name:\s*"repeat"/,
  "Timer registry must expose Repeat",
);
assert.match(
  registrySrc,
  /CONTAINER_PROPERTIES[\s\S]*name:\s*"direction"/,
  "Container registry must expose direction",
);

assert.match(
  propertyPanelSrc,
  /type === "gallery" \|\| type === "datatable"/,
  "Form Item picker must include DataTable selection sources",
);
assert.match(
  propertyPanelSrc,
  /datatable-columns-picker|DataTableColumnsPicker/,
  "PropertyPanel must expose DataTable columns picker",
);

const defaultsSrc = readFileSync(path.join(root, "src/control-defaults.ts"), "utf8");
assert.match(
  defaultsSrc,
  /button:[\s\S]*visible:\s*\{\s*value:\s*true\s*\}/,
  "Button defaults must set visible true",
);
assert.match(
  defaultsSrc,
  /timer:[\s\S]*autoStart:\s*\{\s*value:\s*true\s*\}/,
  "Timer defaults must set autoStart true",
);
assert.match(
  defaultsSrc,
  /timer:[\s\S]*start:\s*\{\s*value:\s*true\s*\}/,
  "Timer defaults must set start true",
);
assert.match(
  defaultsSrc,
  /timer:[\s\S]*repeat:\s*\{\s*value:\s*false\s*\}/,
  "Timer defaults must set repeat false",
);

console.log("studio unit-check: PASS");
