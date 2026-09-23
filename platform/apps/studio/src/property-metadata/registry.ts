export type PropertyFieldType = "text" | "boolean" | "number" | "color" | "formula";



export type PropertyMode = "static" | "formula";



export interface PropertyFieldDefinition {

  name: string;

  label: string;

  type: PropertyFieldType;

}



export function supportsFormulaMode(definition: PropertyFieldDefinition): boolean {

  return (
    definition.type === "text" ||
    definition.type === "color" ||
    definition.type === "number" ||
    definition.type === "boolean"
  );

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



const BOX_CHROME: PropertyFieldDefinition[] = [
  { name: "fill", label: "Fill", type: "color" },
  { name: "borderColor", label: "BorderColor", type: "color" },
  { name: "borderThickness", label: "BorderThickness", type: "number" },
  { name: "radius", label: "Radius", type: "number" },
  { name: "padding", label: "Padding", type: "number" },
  { name: "opacity", label: "Opacity", type: "number" },
];

const TEXT_CHROME: PropertyFieldDefinition[] = [
  { name: "color", label: "Color", type: "color" },
  { name: "font", label: "Font", type: "text" },
  { name: "size", label: "Size", type: "number" },
  { name: "fontWeight", label: "FontWeight", type: "text" },
  { name: "align", label: "Align", type: "text" },
];

const INTERACTION_CHROME: PropertyFieldDefinition[] = [
  { name: "hoverFill", label: "HoverFill", type: "color" },
  { name: "pressedFill", label: "PressedFill", type: "color" },
  { name: "disabledFill", label: "DisabledFill", type: "color" },
  { name: "hoverColor", label: "HoverColor", type: "color" },
  { name: "pressedColor", label: "PressedColor", type: "color" },
  { name: "focusedBorderColor", label: "FocusedBorderColor", type: "color" },
];

const TAB_INDEX: PropertyFieldDefinition = {
  name: "tabIndex",
  label: "TabIndex",
  type: "number",
};

const TOOLTIP: PropertyFieldDefinition = {
  name: "tooltip",
  label: "Tooltip",
  type: "text",
};

const BUTTON_PROPERTIES: PropertyFieldDefinition[] = [

  { name: "text", label: "Text", type: "text" },

  { name: "disabled", label: "Disabled", type: "boolean" },

  { name: "visible", label: "Visible", type: "boolean" },

  { name: "displayMode", label: "DisplayMode", type: "text" },

  { name: "tooltip", label: "Tooltip", type: "text" },

  { name: "onSelect", label: "OnSelect", type: "formula" },

  { name: "autoDisableOnSelect", label: "AutoDisableOnSelect", type: "boolean" },

  { name: "icon", label: "Icon", type: "text" },

  ...BOX_CHROME,

  ...TEXT_CHROME,

  ...INTERACTION_CHROME,

  TAB_INDEX,

];



const LABEL_PROPERTIES: PropertyFieldDefinition[] = [

  { name: "text", label: "Text", type: "text" },

  { name: "color", label: "Color", type: "color" },

  { name: "size", label: "Size", type: "number" },

  { name: "weight", label: "Weight", type: "text" },

  { name: "align", label: "Align", type: "text" },

  { name: "visible", label: "Visible", type: "boolean" },

  { name: "font", label: "Font", type: "text" },

  { name: "wrap", label: "Wrap", type: "boolean" },

  { name: "autoHeight", label: "AutoHeight", type: "boolean" },

  { name: "overflow", label: "Overflow", type: "text" },

  { name: "italic", label: "Italic", type: "boolean" },

  { name: "underline", label: "Underline", type: "boolean" },

  { name: "lineHeight", label: "LineHeight", type: "number" },

  TOOLTIP,

  ...BOX_CHROME,

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

  { name: "tooltip", label: "Tooltip", type: "text" },

  { name: "onChange", label: "OnChange", type: "formula" },

  { name: "mode", label: "Mode", type: "text" },

  { name: "maxLength", label: "MaxLength", type: "number" },

  { name: "clear", label: "Clear", type: "boolean" },

  { name: "delayOutput", label: "DelayOutput", type: "boolean" },

  ...BOX_CHROME,

  ...TEXT_CHROME,

  ...INTERACTION_CHROME,

  TAB_INDEX,

];



const GALLERY_PROPERTIES: PropertyFieldDefinition[] = [

  { name: "items", label: "Items", type: "formula" },

  { name: "filter", label: "Filter", type: "formula" },

  { name: "sort", label: "Sort", type: "text" },

  { name: "limit", label: "Limit", type: "number" },

  { name: "pageSize", label: "PageSize", type: "number" },

  { name: "offset", label: "Offset", type: "number" },

  { name: "visible", label: "Visible", type: "boolean" },

  { name: "layout", label: "Layout", type: "text" },

  { name: "templateSize", label: "TemplateSize", type: "number" },

  { name: "templatePadding", label: "TemplatePadding", type: "number" },

  { name: "showScrollbar", label: "ShowScrollbar", type: "boolean" },

  { name: "selectable", label: "Selectable", type: "boolean" },

  { name: "default", label: "Default", type: "formula" },

  { name: "onSelect", label: "OnSelect", type: "formula" },

  TOOLTIP,

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

  { name: "visible", label: "Visible", type: "boolean" },

  { name: "noDataText", label: "NoDataText", type: "text" },

  { name: "headerFill", label: "HeaderFill", type: "color" },

  { name: "hoverFill", label: "HoverFill", type: "color" },

  { name: "selectedFill", label: "SelectedFill", type: "color" },

  { name: "onSelect", label: "OnSelect", type: "formula" },

  TOOLTIP,

];



const FORM_PROPERTIES: PropertyFieldDefinition[] = [

  { name: "item", label: "Item", type: "formula" },

  { name: "dataSource", label: "DataSource", type: "text" },

  { name: "mode", label: "Mode", type: "text" },

  { name: "layout", label: "Layout", type: "text" },

  { name: "columns", label: "Columns", type: "number" },

  { name: "visible", label: "Visible", type: "boolean" },

  { name: "onSuccess", label: "OnSuccess", type: "formula" },

  { name: "onFailure", label: "OnFailure", type: "formula" },

  { name: "onReset", label: "OnReset", type: "formula" },

  { name: "displayMode", label: "DisplayMode", type: "text" },

  TOOLTIP,

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

  { name: "autoStart", label: "AutoStart", type: "boolean" },

  { name: "start", label: "Start", type: "boolean" },

  { name: "repeat", label: "Repeat", type: "boolean" },

  { name: "visible", label: "Visible", type: "boolean" },

  { name: "displayMode", label: "DisplayMode", type: "text" },

  { name: "onTimerEnd", label: "OnTimerEnd", type: "formula" },

  { name: "onTimerStart", label: "OnTimerStart", type: "formula" },

  { name: "autoPause", label: "AutoPause", type: "boolean" },

];



const DROPDOWN_PROPERTIES: PropertyFieldDefinition[] = [

  { name: "items", label: "Items", type: "formula" },

  { name: "default", label: "Default", type: "formula" },

  { name: "value", label: "Value", type: "text" },

  { name: "displayField", label: "DisplayField", type: "text" },

  { name: "valueField", label: "ValueField", type: "text" },

  { name: "disabled", label: "Disabled", type: "boolean" },

  { name: "visible", label: "Visible", type: "boolean" },

  { name: "displayMode", label: "DisplayMode", type: "text" },

  { name: "required", label: "Required", type: "boolean" },

  { name: "tooltip", label: "Tooltip", type: "text" },

  { name: "onChange", label: "OnChange", type: "formula" },

  { name: "allowEmptySelection", label: "AllowEmptySelection", type: "boolean" },

  { name: "isSearchable", label: "IsSearchable", type: "boolean" },

  ...BOX_CHROME,

  ...TEXT_CHROME,

  ...INTERACTION_CHROME,

  TAB_INDEX,

];



const CONTAINER_PROPERTIES: PropertyFieldDefinition[] = [

  { name: "direction", label: "Direction", type: "text" },

  { name: "visible", label: "Visible", type: "boolean" },

  { name: "gap", label: "Gap", type: "number" },

  { name: "alignItems", label: "AlignItems", type: "text" },

  { name: "justifyContent", label: "JustifyContent", type: "text" },

  { name: "wrap", label: "Wrap", type: "boolean" },

  { name: "overflow", label: "Overflow", type: "text" },

  TOOLTIP,

  ...BOX_CHROME,

];



const CHECKBOX_PROPERTIES: PropertyFieldDefinition[] = [

  { name: "text", label: "Text", type: "text" },

  { name: "checked", label: "Checked", type: "boolean" },

  { name: "default", label: "Default", type: "formula" },

  { name: "disabled", label: "Disabled", type: "boolean" },

  { name: "visible", label: "Visible", type: "boolean" },

  { name: "displayMode", label: "DisplayMode", type: "text" },

  { name: "required", label: "Required", type: "boolean" },

  { name: "tooltip", label: "Tooltip", type: "text" },

  { name: "onChange", label: "OnChange", type: "formula" },

  { name: "onCheck", label: "OnCheck", type: "formula" },

  { name: "onUncheck", label: "OnUncheck", type: "formula" },

  ...BOX_CHROME,

  ...TEXT_CHROME,

  ...INTERACTION_CHROME,

  TAB_INDEX,

];



const TOGGLE_PROPERTIES: PropertyFieldDefinition[] = [

  { name: "text", label: "Text", type: "text" },

  { name: "checked", label: "Checked", type: "boolean" },

  { name: "default", label: "Default", type: "formula" },

  { name: "disabled", label: "Disabled", type: "boolean" },

  { name: "visible", label: "Visible", type: "boolean" },

  { name: "displayMode", label: "DisplayMode", type: "text" },

  { name: "required", label: "Required", type: "boolean" },

  { name: "tooltip", label: "Tooltip", type: "text" },

  { name: "onChange", label: "OnChange", type: "formula" },

  { name: "trueText", label: "TrueText", type: "text" },

  { name: "falseText", label: "FalseText", type: "text" },

  ...BOX_CHROME,

  ...TEXT_CHROME,

  ...INTERACTION_CHROME,

  TAB_INDEX,

];



const IMAGE_PROPERTIES: PropertyFieldDefinition[] = [

  { name: "src", label: "Src", type: "text" },

  { name: "alt", label: "Alt", type: "text" },

  { name: "visible", label: "Visible", type: "boolean" },

  { name: "onSelect", label: "OnSelect", type: "formula" },

  { name: "imagePosition", label: "ImagePosition", type: "text" },

  TOOLTIP,

  ...BOX_CHROME,

];



const ICON_PROPERTIES: PropertyFieldDefinition[] = [

  { name: "icon", label: "Icon", type: "text" },

  { name: "color", label: "Color", type: "color" },

  { name: "visible", label: "Visible", type: "boolean" },

  { name: "onSelect", label: "OnSelect", type: "formula" },

  { name: "rotation", label: "Rotation", type: "number" },

  { name: "size", label: "Size", type: "number" },

  TOOLTIP,

];



const DATEPICKER_PROPERTIES: PropertyFieldDefinition[] = [

  { name: "value", label: "Value", type: "text" },

  { name: "default", label: "Default", type: "formula" },

  { name: "disabled", label: "Disabled", type: "boolean" },

  { name: "visible", label: "Visible", type: "boolean" },

  { name: "displayMode", label: "DisplayMode", type: "text" },

  { name: "required", label: "Required", type: "boolean" },

  { name: "tooltip", label: "Tooltip", type: "text" },

  { name: "onChange", label: "OnChange", type: "formula" },

  { name: "format", label: "Format", type: "text" },

  { name: "startOfWeek", label: "StartOfWeek", type: "text" },

  { name: "minDate", label: "MinDate", type: "text" },

  { name: "maxDate", label: "MaxDate", type: "text" },

  ...BOX_CHROME,

  ...TEXT_CHROME,

  ...INTERACTION_CHROME,

  TAB_INDEX,

];



const SHAPE_FILL_STROKE: PropertyFieldDefinition[] = [

  { name: "fill", label: "Fill", type: "color" },

  { name: "stroke", label: "Stroke", type: "color" },

  { name: "strokeWidth", label: "StrokeWidth", type: "number" },

  { name: "opacity", label: "Opacity", type: "number" },

];



const SHAPE_ON_SELECT: PropertyFieldDefinition = {
  name: "onSelect",
  label: "OnSelect",
  type: "formula",
};

const SHAPE_RECTANGLE_PROPERTIES: PropertyFieldDefinition[] = [
  ...SHAPE_FILL_STROKE,
  { name: "radius", label: "Radius", type: "number" },
  SHAPE_ON_SELECT,
];



const SHAPE_ELLIPSE_PROPERTIES: PropertyFieldDefinition[] = [
  ...SHAPE_FILL_STROKE,
  SHAPE_ON_SELECT,
];



const SHAPE_LINE_PROPERTIES: PropertyFieldDefinition[] = [

  { name: "stroke", label: "Stroke", type: "color" },

  { name: "strokeWidth", label: "StrokeWidth", type: "number" },

  { name: "opacity", label: "Opacity", type: "number" },

];



const SHAPE_ARROW_PROPERTIES: PropertyFieldDefinition[] = [
  ...SHAPE_LINE_PROPERTIES,
  SHAPE_ON_SELECT,
];



const SHAPE_IMAGE_PROPERTIES: PropertyFieldDefinition[] = [

  { name: "src", label: "Src", type: "text" },

  { name: "opacity", label: "Opacity", type: "number" },

];



const SHAPE_STAR_PROPERTIES: PropertyFieldDefinition[] = [

  ...SHAPE_FILL_STROKE,

  { name: "numPoints", label: "NumPoints", type: "number" },

  { name: "innerRadius", label: "InnerRadius", type: "number" },

  SHAPE_ON_SELECT,

];



const RADIO_PROPERTIES: PropertyFieldDefinition[] = [
  { name: "items", label: "Items", type: "formula" },
  { name: "default", label: "Default", type: "formula" },
  { name: "value", label: "Value", type: "text" },
  { name: "layout", label: "Layout", type: "text" },
  { name: "disabled", label: "Disabled", type: "boolean" },
  { name: "visible", label: "Visible", type: "boolean" },
  { name: "displayMode", label: "DisplayMode", type: "text" },
  { name: "required", label: "Required", type: "boolean" },
  TOOLTIP,
  { name: "onChange", label: "OnChange", type: "formula" },
  ...BOX_CHROME,
  ...TEXT_CHROME,
  ...INTERACTION_CHROME,
  TAB_INDEX,
];

const SLIDER_PROPERTIES: PropertyFieldDefinition[] = [
  { name: "min", label: "Min", type: "number" },
  { name: "max", label: "Max", type: "number" },
  { name: "value", label: "Value", type: "text" },
  { name: "default", label: "Default", type: "formula" },
  { name: "showValue", label: "ShowValue", type: "boolean" },
  { name: "disabled", label: "Disabled", type: "boolean" },
  { name: "visible", label: "Visible", type: "boolean" },
  { name: "displayMode", label: "DisplayMode", type: "text" },
  TOOLTIP,
  { name: "onChange", label: "OnChange", type: "formula" },
  ...BOX_CHROME,
  ...INTERACTION_CHROME,
  TAB_INDEX,
];

const LINK_PROPERTIES: PropertyFieldDefinition[] = [
  { name: "text", label: "Text", type: "text" },
  { name: "href", label: "Href", type: "text" },
  { name: "visible", label: "Visible", type: "boolean" },
  TOOLTIP,
  { name: "onSelect", label: "OnSelect", type: "formula" },
  ...BOX_CHROME,
  ...TEXT_CHROME,
];

const BADGE_PROPERTIES: PropertyFieldDefinition[] = [
  { name: "text", label: "Text", type: "text" },
  { name: "visible", label: "Visible", type: "boolean" },
  ...BOX_CHROME,
  ...TEXT_CHROME,
];

const PROGRESS_PROPERTIES: PropertyFieldDefinition[] = [
  { name: "value", label: "Value", type: "number" },
  { name: "max", label: "Max", type: "number" },
  { name: "visible", label: "Visible", type: "boolean" },
  ...BOX_CHROME,
];

const SPINNER_PROPERTIES: PropertyFieldDefinition[] = [
  { name: "visible", label: "Visible", type: "boolean" },
  { name: "color", label: "Color", type: "color" },
];

const RATING_PROPERTIES: PropertyFieldDefinition[] = [
  { name: "max", label: "Max", type: "number" },
  { name: "value", label: "Value", type: "text" },
  { name: "default", label: "Default", type: "formula" },
  { name: "disabled", label: "Disabled", type: "boolean" },
  { name: "visible", label: "Visible", type: "boolean" },
  { name: "displayMode", label: "DisplayMode", type: "text" },
  TOOLTIP,
  { name: "onChange", label: "OnChange", type: "formula" },
  ...BOX_CHROME,
  TAB_INDEX,
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

  radio: RADIO_PROPERTIES,

  slider: SLIDER_PROPERTIES,

  link: LINK_PROPERTIES,

  badge: BADGE_PROPERTIES,

  progress: PROGRESS_PROPERTIES,

  spinner: SPINNER_PROPERTIES,

  rating: RATING_PROPERTIES,

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


