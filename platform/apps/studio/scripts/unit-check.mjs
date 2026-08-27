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

console.log("studio unit-check: PASS");
