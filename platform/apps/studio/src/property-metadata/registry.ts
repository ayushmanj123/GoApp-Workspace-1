export type PropertyFieldType = "text" | "boolean" | "number" | "color" | "formula";

export type PropertyMode = "static" | "formula";

export interface PropertyFieldDefinition {
  name: string;
  label: string;
  type: PropertyFieldType;
}

export function supportsFormulaMode(definition: PropertyFieldDefinition): boolean {
  return definition.type === "text" || definition.type === "color";
}

/** Properties of type "formula" are always formula-only — no static mode. */
export function isFormulaOnly(definition: PropertyFieldDefinition): boolean {
  return definition.type === "formula";
}

const BUTTON_PROPERTIES: PropertyFieldDefinition[] = [
  { name: "text", label: "Text", type: "text" },
  { name: "disabled", label: "Disabled", type: "boolean" },
  { name: "onSelect", label: "OnSelect", type: "formula" },
];

const LABEL_PROPERTIES: PropertyFieldDefinition[] = [
  { name: "text", label: "Text", type: "text" },
  { name: "color", label: "Color", type: "color" },
];

const TEXT_INPUT_PROPERTIES: PropertyFieldDefinition[] = [
  { name: "value", label: "Value", type: "text" },
  { name: "default", label: "Default", type: "formula" },
  { name: "placeholder", label: "Placeholder", type: "text" },
  { name: "disabled", label: "Disabled", type: "boolean" },
];

const GALLERY_PROPERTIES: PropertyFieldDefinition[] = [
  { name: "items", label: "Items", type: "formula" },
];

const FORM_PROPERTIES: PropertyFieldDefinition[] = [
  { name: "item", label: "Item", type: "formula" },
  { name: "mode", label: "Mode", type: "text" },
];

const TIMER_PROPERTIES: PropertyFieldDefinition[] = [
  { name: "duration", label: "Duration", type: "number" },
  { name: "onTimerEnd", label: "OnTimerEnd", type: "formula" },
];

const PROPERTY_METADATA: Record<string, PropertyFieldDefinition[]> = {
  button: BUTTON_PROPERTIES,
  label: LABEL_PROPERTIES,
  textinput: TEXT_INPUT_PROPERTIES,
  gallery: GALLERY_PROPERTIES,
  form: FORM_PROPERTIES,
  timer: TIMER_PROPERTIES,
};

export function normalizeControlType(controlType: string): string {
  return controlType.trim().toLowerCase().replace(/_/g, "");
}

export function getPropertyDefinitions(
  controlType: string,
): PropertyFieldDefinition[] {
  return PROPERTY_METADATA[normalizeControlType(controlType)] ?? [];
}
