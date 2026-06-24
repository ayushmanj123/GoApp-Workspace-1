import { normalizeControlType } from "./property-metadata/registry";

export type ToolboxControlType = "button" | "label" | "textinput" | "gallery" | "form" | "timer";

export interface ControlDefaults {
  name: string;
  control_type: ToolboxControlType;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: Record<string, { value?: string | boolean | number; formula?: string }>;
}

const TOOLBOX_DEFAULTS: Record<ToolboxControlType, ControlDefaults> = {
  button: {
    name: "Button",
    control_type: "button",
    x: 100,
    y: 100,
    width: 160,
    height: 44,
    properties: {
      text: { value: "Button" },
    },
  },
  label: {
    name: "Label",
    control_type: "label",
    x: 100,
    y: 150,
    width: 200,
    height: 40,
    properties: {
      text: { value: "Label" },
    },
  },
  textinput: {
    name: "TextInput",
    control_type: "textinput",
    x: 100,
    y: 200,
    width: 240,
    height: 36,
    properties: {
      value: { value: "" },
      placeholder: { value: "Enter text" },
    },
  },
  gallery: {
    name: "Gallery",
    control_type: "gallery",
    x: 100,
    y: 250,
    width: 280,
    height: 200,
    properties: {
      items: { formula: "Customers" },
    },
  },
  form: {
    name: "Form",
    control_type: "form",
    x: 420,
    y: 250,
    width: 280,
    height: 200,
    properties: {
      item: { formula: "Gallery1.Selected" },
    },
  },
  timer: {
    name: "Timer",
    control_type: "timer",
    x: 100,
    y: 320,
    width: 120,
    height: 32,
    properties: {
      duration: { value: 1000 },
    },
  },
};

export function getControlDefaults(
  controlType: ToolboxControlType,
): ControlDefaults {
  return TOOLBOX_DEFAULTS[controlType];
}

export function buildControlName(
  controlType: ToolboxControlType,
  existingNames: string[],
): string {
  const base = getControlDefaults(controlType).name;
  if (!existingNames.includes(base)) {
    return base;
  }

  let index = 2;
  while (existingNames.includes(`${base}${index}`)) {
    index += 1;
  }
  return `${base}${index}`;
}

export function isToolboxControlType(
  controlType: string,
): controlType is ToolboxControlType {
  const key = normalizeControlType(controlType);
  return key === "button" || key === "label" || key === "textinput" || key === "gallery" || key === "form" || key === "timer";
}
