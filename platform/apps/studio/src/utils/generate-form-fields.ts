import type { Control } from "../api/controls-api";
import type { ConnectorRecord } from "../api/connectors-api";
import type { EntityFieldRecord, EntityRecord } from "../api/entities-api";
import { createLocalControlId } from "./control-ids";
import {
  readPropertyFormula,
  readPropertyValue,
  writePropertyFormula,
  writePropertyValue,
} from "./control-properties";
import { isGoogleSheetsConnector } from "./google-sheets-columns";

const FORM_FIELD_PADDING = 12;
const FORM_FIELD_ROW_HEIGHT = 64;
const FORM_LABEL_HEIGHT = 20;
const FORM_INPUT_HEIGHT = 36;
const FORM_FIELD_GAP = 8;
const FORM_INPUT_TOP = FORM_LABEL_HEIGHT + 4;

const NUMERIC_FIELD_TYPES = new Set([
  "number",
  "integer",
  "decimal",
  "currency",
]);

const CHOICE_FIELD_TYPES = new Set(["choice", "option"]);

const RESERVED_FIELD_NAMES = new Set([
  "recordid",
  "entityid",
  "version",
  "id",
  "createdon",
  "modifiedon",
  "createdby",
  "modifiedby",
]);

type FormLayoutMode = "Vertical" | "Horizontal" | "Columns";

export interface CardLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

function uniqueName(base: string, existingNames: string[]): string {
  if (!existingNames.includes(base)) {
    return base;
  }
  let index = 2;
  while (existingNames.includes(`${base}${index}`)) {
    index += 1;
  }
  return `${base}${index}`;
}

export function resolveFormDataSourceName(form: Control): string {
  const dataSourceRaw = readPropertyValue(
    "text",
    form.properties?.dataSource,
  );
  const dataSource = String(dataSourceRaw ?? "").trim();
  if (dataSource) {
    return dataSource;
  }
  const dataSourceFormula = readPropertyFormula(form.properties?.dataSource).trim();
  if (dataSourceFormula) {
    return dataSourceFormula;
  }
  const itemFormula = readPropertyFormula(form.properties?.item).trim();
  if (itemFormula && !itemFormula.endsWith(".Selected")) {
    return itemFormula;
  }
  return "";
}

export function resolveFormEntity(
  form: Control,
  entities: EntityRecord[],
): EntityRecord | null {
  const dataSource = resolveFormDataSourceName(form);
  if (!dataSource) {
    return null;
  }
  return entities.find((entity) => entity.name === dataSource) ?? null;
}

export function resolveFormGoogleSheetsConnector(
  form: Control,
  connectors: ConnectorRecord[],
): ConnectorRecord | null {
  const dataSource = resolveFormDataSourceName(form);
  if (!dataSource) {
    return null;
  }
  const connector = connectors.find((item) => item.name === dataSource);
  if (!connector || !isGoogleSheetsConnector(connector)) {
    return null;
  }
  return connector;
}

/** Build synthetic entity-field records from Google Sheet header columns. */
export function sheetColumnsToEntityFields(
  columns: string[],
): EntityFieldRecord[] {
  return columns.map((name, index) => ({
    id: `sheet-col-${index}-${name}`,
    tenant_id: "",
    entity_id: "",
    name,
    display_name: name,
    field_type: "text",
    is_required: false,
  }));
}

function resolveRelatedEntityName(
  field: EntityFieldRecord,
  entities: EntityRecord[],
): string | null {
  if (!field.related_entity_id) {
    return null;
  }
  return entities.find((entity) => entity.id === field.related_entity_id)?.name ?? null;
}

export function resolveFormLayout(form: Control): {
  layout: FormLayoutMode;
  columns: number;
} {
  const layoutRaw = String(
    readPropertyValue("text", form.properties?.layout) ?? "",
  )
    .trim()
    .toLowerCase();
  let layout: FormLayoutMode = "Vertical";
  if (layoutRaw === "horizontal") {
    layout = "Horizontal";
  } else if (layoutRaw === "columns") {
    layout = "Columns";
  }

  const columnsRaw = Number(readPropertyValue("number", form.properties?.columns));
  const columns =
    Number.isFinite(columnsRaw) && columnsRaw > 0 ? Math.floor(columnsRaw) : 2;

  return { layout, columns };
}

export function computeCardLayout(input: {
  form: Control;
  index: number;
  fieldCount: number;
  layout: FormLayoutMode;
  columns: number;
}): CardLayout {
  const { form, index, fieldCount, layout, columns } = input;
  const contentWidth = Math.max(form.width - FORM_FIELD_PADDING * 2, 120);

  if (layout === "Horizontal") {
    const gap = FORM_FIELD_GAP;
    const cardWidth = Math.max(
      Math.floor((contentWidth - gap * Math.max(fieldCount - 1, 0)) / Math.max(fieldCount, 1)),
      80,
    );
    return {
      x: FORM_FIELD_PADDING + index * (cardWidth + gap),
      y: FORM_FIELD_PADDING,
      width: cardWidth,
      height: FORM_FIELD_ROW_HEIGHT,
    };
  }

  if (layout === "Columns") {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const gap = FORM_FIELD_GAP;
    const columnWidth = Math.max(
      Math.floor((contentWidth - gap * (columns - 1)) / columns),
      80,
    );
    return {
      x: FORM_FIELD_PADDING + col * (columnWidth + gap),
      y: FORM_FIELD_PADDING + row * FORM_FIELD_ROW_HEIGHT,
      width: columnWidth,
      height: FORM_FIELD_ROW_HEIGHT,
    };
  }

  return {
    x: FORM_FIELD_PADDING,
    y: FORM_FIELD_PADDING + index * FORM_FIELD_ROW_HEIGHT,
    width: contentWidth,
    height: FORM_FIELD_ROW_HEIGHT,
  };
}

export function computeRequiredFormHeight(input: {
  form: Control;
  fieldCount: number;
  layout: FormLayoutMode;
  columns: number;
}): number {
  const { form, fieldCount, layout, columns } = input;
  if (fieldCount <= 0) {
    return form.height;
  }

  if (layout === "Horizontal") {
    return FORM_FIELD_PADDING * 2 + FORM_FIELD_ROW_HEIGHT;
  }

  if (layout === "Columns") {
    const rows = Math.ceil(fieldCount / columns);
    return FORM_FIELD_PADDING * 2 + rows * FORM_FIELD_ROW_HEIGHT;
  }

  return FORM_FIELD_PADDING * 2 + fieldCount * FORM_FIELD_ROW_HEIGHT;
}

function resolveFieldOptions(field: EntityFieldRecord): string[] {
  const raw = field.options;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((option) => String(option ?? "").trim())
    .filter((option) => option.length > 0);
}

function buildChoiceItemsFormula(options: string[]): { formula: string } {
  if (options.length === 0) {
    return writePropertyFormula("[]");
  }
  const serialized = options.map((option) => JSON.stringify(option)).join(", ");
  return writePropertyFormula(`[${serialized}]`);
}

function buildFieldInputControl(input: {
  form: Control;
  field: EntityFieldRecord;
  entities: EntityRecord[];
  datacardId: string;
  inputName: string;
  cardWidth: number;
  zIndex: number;
  now: string;
}): Control {
  const { form, field, entities, datacardId, inputName, cardWidth, zIndex, now } =
    input;
  const defaultBinding = writePropertyFormula(`ThisItem.${field.name}`);
  const labelText = field.display_name || field.name;
  const base = {
    tenant_id: form.tenant_id,
    screen_id: form.screen_id,
    parent_control_id: datacardId,
    x: 0,
    y: FORM_INPUT_TOP,
    width: cardWidth,
    height: FORM_INPUT_HEIGHT,
    z_index: zIndex,
    deleted_at: null,
    CreatedOn: now,
    ModifiedOn: now,
  };

  if (field.field_type === "lookup") {
    const relatedEntityName = resolveRelatedEntityName(field, entities);
    return {
      ...base,
      id: createLocalControlId(),
      control_type: "dropdown",
      name: inputName,
      properties: {
        items: writePropertyFormula(relatedEntityName ?? "[]"),
        default: defaultBinding,
      },
    };
  }

  if (CHOICE_FIELD_TYPES.has(field.field_type)) {
    const options = resolveFieldOptions(field);
    return {
      ...base,
      id: createLocalControlId(),
      control_type: "dropdown",
      name: inputName,
      properties: {
        items: buildChoiceItemsFormula(options),
        default: defaultBinding,
      },
    };
  }

  if (field.field_type === "boolean") {
    return {
      ...base,
      id: createLocalControlId(),
      control_type: "checkbox",
      y: 0,
      height: FORM_FIELD_ROW_HEIGHT - 8,
      name: inputName,
      properties: {
        // Label control carries the display name; keep checkbox text empty.
        text: writePropertyValue("text", ""),
        checked: writePropertyValue("boolean", false),
        default: defaultBinding,
      },
    };
  }

  if (field.field_type === "date") {
    return {
      ...base,
      id: createLocalControlId(),
      control_type: "datepicker",
      name: inputName,
      properties: {
        value: writePropertyValue("text", ""),
        default: defaultBinding,
      },
    };
  }

  if (NUMERIC_FIELD_TYPES.has(field.field_type)) {
    const placeholderHint =
      field.field_type === "currency"
        ? `${labelText} (currency)`
        : `${labelText} (number)`;
    return {
      ...base,
      id: createLocalControlId(),
      control_type: "textinput",
      name: inputName,
      properties: {
        value: writePropertyValue("text", ""),
        placeholder: writePropertyValue("text", placeholderHint),
        inputMode: writePropertyValue("text", "decimal"),
        default: defaultBinding,
      },
    };
  }

  return {
    ...base,
    id: createLocalControlId(),
    control_type: "textinput",
    name: inputName,
    properties: {
      value: writePropertyValue("text", ""),
      placeholder: writePropertyValue("text", labelText),
      default: defaultBinding,
    },
  };
}

export function buildFormFieldControls(input: {
  form: Control;
  fields: EntityFieldRecord[];
  entities: EntityRecord[];
  existingNames: string[];
  nextZIndex: number;
  now: string;
}): { controls: Control[]; requiredFormHeight: number } {
  const { form, fields, entities, existingNames, now } = input;
  let nextZIndex = input.nextZIndex;
  const names = [...existingNames];
  const controls: Control[] = [];
  const { layout, columns } = resolveFormLayout(form);

  const usableFields = fields.filter(
    (field) => !RESERVED_FIELD_NAMES.has(field.name.trim().toLowerCase()),
  );

  usableFields.forEach((field, index) => {
    const cardLayout = computeCardLayout({
      form,
      index,
      fieldCount: usableFields.length,
      layout,
      columns,
    });

    const cardName = uniqueName(`${field.name}Card`, names);
    names.push(cardName);
    const datacardId = createLocalControlId();
    const defaultBinding = writePropertyFormula(`ThisItem.${field.name}`);

    controls.push({
      id: datacardId,
      tenant_id: form.tenant_id,
      screen_id: form.screen_id,
      parent_control_id: form.id,
      control_type: "datacard",
      name: cardName,
      x: cardLayout.x,
      y: cardLayout.y,
      width: cardLayout.width,
      height: cardLayout.height,
      z_index: nextZIndex++,
      properties: {
        dataField: writePropertyValue("text", field.name),
        default: defaultBinding,
        required: writePropertyValue("boolean", Boolean(field.is_required)),
        displayMode: writePropertyValue("text", "Edit"),
        visible: writePropertyValue("boolean", true),
      },
      deleted_at: null,
      CreatedOn: now,
      ModifiedOn: now,
    });

    const labelName = uniqueName(`${field.name}Label`, names);
    names.push(labelName);
    controls.push({
      id: createLocalControlId(),
      tenant_id: form.tenant_id,
      screen_id: form.screen_id,
      parent_control_id: datacardId,
      control_type: "label",
      name: labelName,
      x: 0,
      y: 0,
      width: cardLayout.width,
      height: FORM_LABEL_HEIGHT,
      z_index: nextZIndex++,
      properties: {
        text: writePropertyValue("text", field.display_name || field.name),
      },
      deleted_at: null,
      CreatedOn: now,
      ModifiedOn: now,
    });

    const inputName = uniqueName(`${field.name}Input`, names);
    names.push(inputName);
    controls.push(
      buildFieldInputControl({
        form,
        field,
        entities,
        datacardId,
        inputName,
        cardWidth: cardLayout.width,
        zIndex: nextZIndex++,
        now,
      }),
    );
  });

  const requiredFormHeight = computeRequiredFormHeight({
    form,
    fieldCount: usableFields.length,
    layout,
    columns,
  });

  return { controls, requiredFormHeight };
}
