/**
 * One-off scaffold: Submit Form demo screen for an app with GoSheetsOne connector.
 * Run: node apps/studio/scripts/scaffold-submit-form-demo.mjs
 */

const BASE = process.env.API_BASE_URL ?? "http://localhost:8090/api/v1";
const TENANT = "00000000-0000-4000-8000-000000000001";
const USER = "00000000-0000-4000-8000-000000000002";
const APP_ID = "12596a9d-fbb7-4389-aa93-2515a51e5d7a";
const DATA_SOURCE = "GoSheetsOne";
const CONNECTOR_ID = "4742c6ff-f92b-43c5-9069-c9cb97a11c9c";

const FORM_NAME = "formGoSheets";
const SCREEN_NAME = "SubmitFormDemo";

const FIELD_COLUMNS = ["Column 1", "Column 2", "Column 3", "Column 4", "Column 5"];
const FORM_FIELD_PADDING = 12;
const FORM_FIELD_ROW_HEIGHT = 64;
const FORM_LABEL_HEIGHT = 20;
const FORM_INPUT_HEIGHT = 36;
const FORM_INPUT_TOP = FORM_LABEL_HEIGHT + 4;

const headers = {
  "Content-Type": "application/json",
  "X-Tenant-Id": TENANT,
  "X-User-Id": USER,
  Authorization: `Bearer dev:${TENANT}:${USER}`,
};

async function api(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...headers, ...init.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.success === false) {
    throw new Error(body?.error?.message ?? body?.error ?? `HTTP ${res.status} ${path}`);
  }
  return body.data;
}

async function createControl(screenId, payload) {
  return api(`/screens/${screenId}/controls`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function setProperties(controlId, properties) {
  return api(`/controls/${controlId}/properties`, {
    method: "PUT",
    body: JSON.stringify({ properties }),
  });
}

function propValue(value) {
  return { value };
}

function propFormula(formula) {
  return { formula };
}

async function main() {
  const preview = await api(
    `/connectors/${CONNECTOR_ID}/google/preview?sheet=Sheet1&limit=1`,
  );
  const columns = (preview.columns ?? []).filter((c) => c !== "Id");
  const fields = (columns.length > 0 ? columns : FIELD_COLUMNS).filter((c) => c !== "Id");

  const screens = await api(`/applications/${APP_ID}/screens?limit=50`);
  const existing = screens.items?.find((s) => s.name === SCREEN_NAME);
  let screen;
  if (existing) {
    console.log(`Screen "${SCREEN_NAME}" already exists (${existing.id}), reusing.`);
    screen = existing;
    const controls = await api(`/screens/${screen.id}/controls?limit=200`);
    for (const control of controls.items ?? []) {
      await api(`/controls/${control.id}`, { method: "DELETE" });
    }
  } else {
    screen = await api(`/applications/${APP_ID}/screens`, {
      method: "POST",
      body: JSON.stringify({ name: SCREEN_NAME, display_order: 1, layout_type: "responsive" }),
    });
    console.log(`Created screen ${SCREEN_NAME} (${screen.id})`);
  }

  await api(`/screens/${screen.id}`, {
    method: "PUT",
    body: JSON.stringify({ on_visible: `NewForm(${FORM_NAME})` }),
  });

  const formHeight = FORM_FIELD_PADDING * 2 + fields.length * FORM_FIELD_ROW_HEIGHT;

  const titleLabel = await createControl(screen.id, {
    name: "lblTitle",
    control_type: "label",
    x: 80,
    y: 24,
    width: 520,
    height: 28,
    z_index: 1,
    parent_control_id: null,
  });
  await setProperties(titleLabel.id, {
    text: propValue("Submit a row to Google Sheets (GoSheetsOne)"),
  });

  const hintLabel = await createControl(screen.id, {
    name: "lblHint",
    control_type: "label",
    x: 80,
    y: 52,
    width: 520,
    height: 40,
    z_index: 2,
    parent_control_id: null,
  });
  await setProperties(hintLabel.id, {
    text: propValue(
      "Fill the fields below, then click Submit. Connect Google in Runtime if prompted.",
    ),
  });

  const form = await createControl(screen.id, {
    name: FORM_NAME,
    control_type: "form",
    x: 80,
    y: 100,
    width: 480,
    height: formHeight,
    z_index: 3,
    parent_control_id: null,
  });
  await setProperties(form.id, {
    dataSource: propValue(DATA_SOURCE),
    item: propFormula(`Defaults(${DATA_SOURCE})`),
    mode: propValue("New"),
    layout: propValue("Vertical"),
    columns: propValue(1),
    onSuccess: propFormula(`Refresh(${DATA_SOURCE})`),
    onFailure: propFormula(""),
  });

  let z = 10;
  await Promise.all(
    fields.map((fieldName, index) => {
      const y = FORM_FIELD_PADDING + index * FORM_FIELD_ROW_HEIGHT;
      const width = 480 - FORM_FIELD_PADDING * 2;
      const binding = `ThisItem.${fieldName}`;
      const safe = fieldName.replace(/\s+/g, "");
      return (async () => {
        const card = await createControl(screen.id, {
          name: `${safe}Card`,
          control_type: "datacard",
          x: FORM_FIELD_PADDING,
          y,
          width,
          height: FORM_FIELD_ROW_HEIGHT,
          z_index: z++,
          parent_control_id: form.id,
        });
        await setProperties(card.id, {
          dataField: propValue(fieldName),
          default: propFormula(binding),
          required: propValue(false),
          displayMode: propValue("Edit"),
          visible: propValue(true),
        });

        const label = await createControl(screen.id, {
          name: `${safe}Label`,
          control_type: "label",
          x: 0,
          y: 0,
          width,
          height: FORM_LABEL_HEIGHT,
          z_index: z++,
          parent_control_id: card.id,
        });
        await setProperties(label.id, { text: propValue(fieldName) });

        const input = await createControl(screen.id, {
          name: `${safe}Input`,
          control_type: "textinput",
          x: 0,
          y: FORM_INPUT_TOP,
          width,
          height: FORM_INPUT_HEIGHT,
          z_index: z++,
          parent_control_id: card.id,
        });
        await setProperties(input.id, {
          value: propValue(""),
          placeholder: propValue(fieldName),
          default: propFormula(binding),
        });
      })();
    }),
  );

  const btnY = 100 + formHeight + 16;
  const btnSubmit = await createControl(screen.id, {
    name: "btnSubmit",
    control_type: "button",
    x: 80,
    y: btnY,
    width: 140,
    height: 44,
    z_index: 50,
    parent_control_id: null,
  });
  await setProperties(btnSubmit.id, {
    text: propValue("Submit"),
    onSelect: propFormula(`SubmitForm(${FORM_NAME})`),
  });

  const btnReset = await createControl(screen.id, {
    name: "btnReset",
    control_type: "button",
    x: 232,
    y: btnY,
    width: 140,
    height: 44,
    z_index: 51,
    parent_control_id: null,
  });
  await setProperties(btnReset.id, {
    text: propValue("Reset"),
    onSelect: propFormula(`ResetForm(${FORM_NAME})`),
  });

  const btnNew = await createControl(screen.id, {
    name: "btnNew",
    control_type: "button",
    x: 384,
    y: btnY,
    width: 140,
    height: 44,
    z_index: 52,
    parent_control_id: null,
  });
  await setProperties(btnNew.id, {
    text: propValue("New row"),
    onSelect: propFormula(`NewForm(${FORM_NAME})`),
  });

  console.log("\nDone! Open in Studio:");
  console.log(`http://localhost:5173/studio/apps/${APP_ID}/screens/${screen.id}`);
  console.log("\nThen Publish and Open Runtime. Connect Google OAuth if prompted.");
  console.log(`Submit uses: SubmitForm(${FORM_NAME}) → appends row to ${DATA_SOURCE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
