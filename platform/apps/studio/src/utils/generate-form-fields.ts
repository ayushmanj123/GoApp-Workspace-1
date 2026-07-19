import type { Control } from "../api/controls-api";
import type { EntityFieldRecord, EntityRecord } from "../api/entities-api";
import { createLocalControlId } from "./control-ids";
import {
  readPropertyFormula,
  readPropertyValue,
  writePropertyFormula,
  writePropertyValue,
} from "./control-properties";

const FORM_FIELD_PADDING = 12;
const FORM_FIELD_ROW_HEIGHT = 56;
const FORM_LABEL_HEIGHT = 20;
const FORM_INPUT_HEIGHT = 36;

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

export function resolveFormEntity(
  form: Control,
  entities: EntityRecord[],
): EntityRecord | null {
  const dataSource = readPropertyValue(
    "text",
    form.properties?.dataSource,
  ).trim();
  if (dataSource) {
    return entities.find((entity) => entity.name === dataSource) ?? null;
  }

  const itemFormula = readPropertyFormula(form.properties?.item).trim();
  if (itemFormula && !itemFormula.endsWith(".Selected")) {
    return entities.find((entity) => entity.name === itemFormula) ?? null;
  }

  return null;
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

function buildFieldInputControl(input: {
  form: Control;
  field: EntityFieldRecord;
  entities: EntityRecord[];
  inputName: string;
  contentWidth: number;
  y: number;
  zIndex: number;
  now: string;
}): Control {
  const { form, field, entities, inputName, contentWidth, y, zIndex, now } = input;
  const defaultBinding = writePropertyFormula(`ThisItem.${field.name}`);
  const labelText = field.display_name || field.name;

  if (field.field_type === "lookup") {
    const relatedEntityName = resolveRelatedEntityName(field, entities);
    return {
      id: createLocalControlId(),
      tenant_id: form.tenant_id,
      screen_id: form.screen_id,
      parent_control_id: form.id,
      control_type: "dropdown",
      name: inputName,
      x: FORM_FIELD_PADDING,
      y,
      width: contentWidth,
      height: FORM_INPUT_HEIGHT,
      z_index: zIndex,
      properties: {
        items: writePropertyFormula(relatedEntityName ?? "[]"),
        default: defaultBinding,
      },
      deleted_at: null,
      CreatedOn: now,
      ModifiedOn: now,
    };
  }

  if (field.field_type === "boolean") {
    return {
      id: createLocalControlId(),
      tenant_id: form.tenant_id,
      screen_id: form.screen_id,
      parent_control_id: form.id,
      control_type: "checkbox",
      name: inputName,
      x: FORM_FIELD_PADDING,
      y,
      width: contentWidth,
      height: FORM_INPUT_HEIGHT,
      z_index: zIndex,
      properties: {
        text: writePropertyValue("text", labelText),
        checked: writePropertyValue("boolean", false),
        default: defaultBinding,
      },
      deleted_at: null,
      CreatedOn: now,
      ModifiedOn: now,
    };
  }

  if (field.field_type === "date") {
    return {
      id: createLocalControlId(),
      tenant_id: form.tenant_id,
      screen_id: form.screen_id,
      parent_control_id: form.id,
      control_type: "datepicker",
      name: inputName,
      x: FORM_FIELD_PADDING,
      y,
      width: contentWidth,
      height: FORM_INPUT_HEIGHT,
      z_index: zIndex,
      properties: {
        value: writePropertyValue("text", ""),
        default: defaultBinding,
      },
      deleted_at: null,
      CreatedOn: now,
      ModifiedOn: now,
    };
  }

  return {
    id: createLocalControlId(),
    tenant_id: form.tenant_id,
    screen_id: form.screen_id,
    parent_control_id: form.id,
    control_type: "textinput",
    name: inputName,
    x: FORM_FIELD_PADDING,
    y,
    width: contentWidth,
    height: FORM_INPUT_HEIGHT,
    z_index: zIndex,
    properties: {
      value: writePropertyValue("text", ""),
      placeholder: writePropertyValue("text", labelText),
      default: defaultBinding,
    },
    deleted_at: null,
    CreatedOn: now,
    ModifiedOn: now,
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
  const contentWidth = Math.max(form.width - FORM_FIELD_PADDING * 2, 120);

  const usableFields = fields.filter(
    (field) => !RESERVED_FIELD_NAMES.has(field.name.trim().toLowerCase()),
  );

  usableFields.forEach((field, index) => {
    const y = FORM_FIELD_PADDING + index * FORM_FIELD_ROW_HEIGHT;
    const labelName = uniqueName(`${field.name}Label`, names);
    names.push(labelName);
    controls.push({
      id: createLocalControlId(),
      tenant_id: form.tenant_id,
      screen_id: form.screen_id,
      parent_control_id: form.id,
      control_type: "label",
      name: labelName,
      x: FORM_FIELD_PADDING,
      y,
      width: contentWidth,
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
        inputName,
        contentWidth,
        y: y + FORM_LABEL_HEIGHT + 4,
        zIndex: nextZIndex++,
        now,
      }),
    );
  });

  const requiredFormHeight =
    usableFields.length > 0
      ? FORM_FIELD_PADDING * 2 + usableFields.length * FORM_FIELD_ROW_HEIGHT
      : form.height;

  return { controls, requiredFormHeight };
}
