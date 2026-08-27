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



/** Data-binding formulas (Items / Item / Default / Filter) vs action/event formulas. */

const DATA_FORMULA_NAMES = new Set(["items", "item", "default", "filter", "update"]);



export function isDataFormulaProperty(definition: PropertyFieldDefinition): boolean {

  return isFormulaOnly(definition) && DATA_FORMULA_NAMES.has(definition.name);

}



export function isActionFormulaProperty(definition: PropertyFieldDefinition): boolean {

  return isFormulaOnly(definition) && !DATA_FORMULA_NAMES.has(definition.name);

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

  { name: "inputMode", label: "InputMode", type: "text" },

  { name: "disabled", label: "Disabled", type: "boolean" },

  { name: "visible", label: "Visible", type: "boolean" },

  { name: "displayMode", label: "DisplayMode", type: "text" },

  { name: "required", label: "Required", type: "boolean" },

];



const GALLERY_PROPERTIES: PropertyFieldDefinition[] = [

  { name: "items", label: "Items", type: "formula" },

  { name: "filter", label: "Filter", type: "formula" },

  { name: "sort", label: "Sort", type: "text" },

  { name: "limit", label: "Limit", type: "number" },

  { name: "pageSize", label: "PageSize", type: "number" },

  { name: "offset", label: "Offset", type: "number" },

];



const DATATABLE_PROPERTIES: PropertyFieldDefinition[] = [

  { name: "items", label: "Items", type: "formula" },

  { name: "filter", label: "Filter", type: "formula" },

  { name: "sort", label: "Sort", type: "text" },

  { name: "limit", label: "Limit", type: "number" },

  { name: "pageSize", label: "PageSize", type: "number" },

  { name: "offset", label: "Offset", type: "number" },

  { name: "columns", label: "Columns", type: "text" },

  {
    name: "showRefresh",
    label: "Show Refresh",
    type: "boolean",
  },

];



const FORM_PROPERTIES: PropertyFieldDefinition[] = [

  { name: "item", label: "Item", type: "formula" },

  { name: "dataSource", label: "DataSource", type: "text" },

  { name: "mode", label: "Mode", type: "text" },

  { name: "layout", label: "Layout", type: "text" },

  { name: "columns", label: "Columns", type: "number" },

  { name: "onSuccess", label: "OnSuccess", type: "formula" },

  { name: "onFailure", label: "OnFailure", type: "formula" },

];



const DATACARD_PROPERTIES: PropertyFieldDefinition[] = [

  { name: "dataField", label: "DataField", type: "text" },

  { name: "default", label: "Default", type: "formula" },

  { name: "update", label: "Update", type: "formula" },

  { name: "required", label: "Required", type: "boolean" },

  { name: "visible", label: "Visible", type: "boolean" },

  { name: "displayMode", label: "DisplayMode", type: "text" },

];



const TIMER_PROPERTIES: PropertyFieldDefinition[] = [

  { name: "duration", label: "Duration", type: "number" },

  { name: "onTimerEnd", label: "OnTimerEnd", type: "formula" },

];



const DROPDOWN_PROPERTIES: PropertyFieldDefinition[] = [

  { name: "items", label: "Items", type: "formula" },

  { name: "default", label: "Default", type: "formula" },

  { name: "value", label: "Value", type: "text" },

  { name: "disabled", label: "Disabled", type: "boolean" },

  { name: "visible", label: "Visible", type: "boolean" },

  { name: "displayMode", label: "DisplayMode", type: "text" },

  { name: "required", label: "Required", type: "boolean" },

  { name: "onChange", label: "OnChange", type: "formula" },

];



const CONTAINER_PROPERTIES: PropertyFieldDefinition[] = [

  { name: "direction", label: "Direction", type: "text" },

];



const CHECKBOX_PROPERTIES: PropertyFieldDefinition[] = [

  { name: "text", label: "Text", type: "text" },

  { name: "checked", label: "Checked", type: "boolean" },

  { name: "default", label: "Default", type: "formula" },

  { name: "disabled", label: "Disabled", type: "boolean" },

  { name: "visible", label: "Visible", type: "boolean" },

  { name: "displayMode", label: "DisplayMode", type: "text" },

  { name: "required", label: "Required", type: "boolean" },

  { name: "onChange", label: "OnChange", type: "formula" },

];



const TOGGLE_PROPERTIES: PropertyFieldDefinition[] = [

  { name: "text", label: "Text", type: "text" },

  { name: "checked", label: "Checked", type: "boolean" },

  { name: "default", label: "Default", type: "formula" },

  { name: "disabled", label: "Disabled", type: "boolean" },

  { name: "visible", label: "Visible", type: "boolean" },

  { name: "displayMode", label: "DisplayMode", type: "text" },

  { name: "required", label: "Required", type: "boolean" },

  { name: "onChange", label: "OnChange", type: "formula" },

];



const IMAGE_PROPERTIES: PropertyFieldDefinition[] = [

  { name: "src", label: "Src", type: "text" },

  { name: "alt", label: "Alt", type: "text" },

];



const ICON_PROPERTIES: PropertyFieldDefinition[] = [

  { name: "icon", label: "Icon", type: "text" },

  { name: "color", label: "Color", type: "color" },

];



const DATEPICKER_PROPERTIES: PropertyFieldDefinition[] = [

  { name: "value", label: "Value", type: "text" },

  { name: "default", label: "Default", type: "formula" },

  { name: "disabled", label: "Disabled", type: "boolean" },

  { name: "visible", label: "Visible", type: "boolean" },

  { name: "displayMode", label: "DisplayMode", type: "text" },

  { name: "required", label: "Required", type: "boolean" },

  { name: "onChange", label: "OnChange", type: "formula" },

];



const SHAPE_FILL_STROKE: PropertyFieldDefinition[] = [

  { name: "fill", label: "Fill", type: "color" },

  { name: "stroke", label: "Stroke", type: "color" },

  { name: "strokeWidth", label: "StrokeWidth", type: "number" },

  { name: "opacity", label: "Opacity", type: "number" },

];



const SHAPE_RECTANGLE_PROPERTIES: PropertyFieldDefinition[] = [...SHAPE_FILL_STROKE];



const SHAPE_ELLIPSE_PROPERTIES: PropertyFieldDefinition[] = [...SHAPE_FILL_STROKE];



const SHAPE_LINE_PROPERTIES: PropertyFieldDefinition[] = [

  { name: "stroke", label: "Stroke", type: "color" },

  { name: "strokeWidth", label: "StrokeWidth", type: "number" },

  { name: "opacity", label: "Opacity", type: "number" },

];



const SHAPE_ARROW_PROPERTIES: PropertyFieldDefinition[] = [...SHAPE_LINE_PROPERTIES];



const SHAPE_IMAGE_PROPERTIES: PropertyFieldDefinition[] = [

  { name: "src", label: "Src", type: "text" },

  { name: "opacity", label: "Opacity", type: "number" },

];



const SHAPE_STAR_PROPERTIES: PropertyFieldDefinition[] = [

  ...SHAPE_FILL_STROKE,

  { name: "numPoints", label: "NumPoints", type: "number" },

  { name: "innerRadius", label: "InnerRadius", type: "number" },

];



const PROPERTY_METADATA: Record<string, PropertyFieldDefinition[]> = {

  button: BUTTON_PROPERTIES,

  label: LABEL_PROPERTIES,

  textinput: TEXT_INPUT_PROPERTIES,

  gallery: GALLERY_PROPERTIES,

  datatable: DATATABLE_PROPERTIES,

  form: FORM_PROPERTIES,

  datacard: DATACARD_PROPERTIES,

  timer: TIMER_PROPERTIES,

  dropdown: DROPDOWN_PROPERTIES,

  container: CONTAINER_PROPERTIES,

  checkbox: CHECKBOX_PROPERTIES,

  toggle: TOGGLE_PROPERTIES,

  image: IMAGE_PROPERTIES,

  icon: ICON_PROPERTIES,

  datepicker: DATEPICKER_PROPERTIES,

  shaperectangle: SHAPE_RECTANGLE_PROPERTIES,

  shapeellipse: SHAPE_ELLIPSE_PROPERTIES,

  shapeline: SHAPE_LINE_PROPERTIES,

  shapearrow: SHAPE_ARROW_PROPERTIES,

  shapeimage: SHAPE_IMAGE_PROPERTIES,

  shapestar: SHAPE_STAR_PROPERTIES,

};



export function normalizeControlType(controlType: string): string {

  return controlType.trim().toLowerCase().replace(/_/g, "");

}



export function getPropertyDefinitions(

  controlType: string,

): PropertyFieldDefinition[] {

  return PROPERTY_METADATA[normalizeControlType(controlType)] ?? [];

}


