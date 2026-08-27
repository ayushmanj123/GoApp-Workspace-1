import { normalizeControlType } from "./property-metadata/registry";

import { isShapeControlType, SHAPE_CONTROL_TYPES } from "./utils/shape-control-types";



export type HtmlToolboxControlType =

  | "button"

  | "label"

  | "textinput"

  | "gallery"

  | "datatable"

  | "form"

  | "timer"

  | "dropdown"

  | "container"

  | "checkbox"

  | "toggle"

  | "image"

  | "icon"

  | "datepicker";



export type ShapeToolboxControlType = (typeof SHAPE_CONTROL_TYPES)[number];



export type ToolboxControlType = HtmlToolboxControlType | ShapeToolboxControlType;



export interface ControlDefaults {

  name: string;

  control_type: ToolboxControlType;

  x: number;

  y: number;

  width: number;

  height: number;

  properties: Record<string, { value?: string | boolean | number; formula?: string }>;

}



const SHAPE_DEFAULTS: Record<ShapeToolboxControlType, ControlDefaults> = {

  shape_rectangle: {

    name: "Rectangle",

    control_type: "shape_rectangle",

    x: 80,

    y: 80,

    width: 160,

    height: 100,

    properties: {

      fill: { value: "#4A90D9" },

      stroke: { value: "#1a1a1a" },

      strokeWidth: { value: 1 },

      opacity: { value: 1 },

    },

  },

  shape_ellipse: {

    name: "Ellipse",

    control_type: "shape_ellipse",

    x: 80,

    y: 200,

    width: 120,

    height: 80,

    properties: {

      fill: { value: "#7CB342" },

      stroke: { value: "#33691E" },

      strokeWidth: { value: 1 },

      opacity: { value: 1 },

    },

  },

  shape_line: {

    name: "Line",

    control_type: "shape_line",

    x: 80,

    y: 320,

    width: 160,

    height: 4,

    properties: {

      stroke: { value: "#333333" },

      strokeWidth: { value: 2 },

      opacity: { value: 1 },

    },

  },

  shape_arrow: {

    name: "Arrow",

    control_type: "shape_arrow",

    x: 80,

    y: 360,

    width: 120,

    height: 20,

    properties: {

      stroke: { value: "#333333" },

      strokeWidth: { value: 2 },

      opacity: { value: 1 },

    },

  },

  shape_image: {

    name: "ShapeImage",

    control_type: "shape_image",

    x: 280,

    y: 80,

    width: 160,

    height: 120,

    properties: {

      src: { value: "https://via.placeholder.com/160x120" },

      opacity: { value: 1 },

    },

  },

  shape_star: {

    name: "Star",

    control_type: "shape_star",

    x: 280,

    y: 220,

    width: 80,

    height: 80,

    properties: {

      fill: { value: "#FFB300" },

      stroke: { value: "#F57C00" },

      strokeWidth: { value: 1 },

      numPoints: { value: 5 },

      innerRadius: { value: 16 },

      opacity: { value: 1 },

    },

  },

};



const HTML_DEFAULTS: Record<HtmlToolboxControlType, ControlDefaults> = {

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

      pageSize: { value: 10 },

    },

  },

  datatable: {

    name: "DataTable",

    control_type: "datatable",

    x: 420,

    y: 250,

    width: 320,

    height: 220,

    properties: {

      items: { formula: "Customers" },

      pageSize: { value: 10 },

      showRefresh: { value: true },

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

      item: { formula: "Gallery.Selected" },

      layout: { value: "Vertical" },

      columns: { value: 2 },

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

  dropdown: {

    name: "Dropdown",

    control_type: "dropdown",

    x: 100,

    y: 380,

    width: 200,

    height: 36,

    properties: {

      items: { formula: '["Option 1","Option 2","Option 3"]' },

      default: { formula: "" },

    },

  },

  container: {

    name: "Container",

    control_type: "container",

    x: 420,

    y: 100,

    width: 280,

    height: 120,

    properties: {

      direction: { value: "vertical" },

    },

  },

  checkbox: {

    name: "Checkbox",

    control_type: "checkbox",

    x: 100,

    y: 430,

    width: 160,

    height: 28,

    properties: {

      text: { value: "Checkbox" },

      checked: { value: false },

    },

  },

  toggle: {

    name: "Toggle",

    control_type: "toggle",

    x: 100,

    y: 470,

    width: 120,

    height: 32,

    properties: {

      text: { value: "Toggle" },

      checked: { value: false },

    },

  },

  image: {

    name: "Image",

    control_type: "image",

    x: 420,

    y: 480,

    width: 160,

    height: 120,

    properties: {

      src: { value: "https://via.placeholder.com/160x120" },

    },

  },

  icon: {

    name: "Icon",

    control_type: "icon",

    x: 280,

    y: 480,

    width: 40,

    height: 40,

    properties: {

      icon: { value: "star" },

      color: { value: "#333333" },

    },

  },

  datepicker: {

    name: "DatePicker",

    control_type: "datepicker",

    x: 280,

    y: 380,

    width: 180,

    height: 36,

    properties: {

      value: { value: "" },

      default: { formula: "" },

    },

  },

};



const TOOLBOX_DEFAULTS: Record<ToolboxControlType, ControlDefaults> = {

  ...HTML_DEFAULTS,

  ...SHAPE_DEFAULTS,

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



const HTML_TOOLBOX_TYPES = new Set<string>(

  Object.keys(HTML_DEFAULTS).map((key) => normalizeControlType(key)),

);



export function isToolboxControlType(

  controlType: string,

): controlType is ToolboxControlType {

  const key = normalizeControlType(controlType);

  if (HTML_TOOLBOX_TYPES.has(key)) {

    return true;

  }

  return isShapeControlType(controlType);

}



export function isHtmlToolboxControlType(

  controlType: string,

): controlType is HtmlToolboxControlType {

  return HTML_TOOLBOX_TYPES.has(normalizeControlType(controlType));

}


