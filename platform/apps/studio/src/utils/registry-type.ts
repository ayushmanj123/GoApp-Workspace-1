const REGISTRY_ALIASES: Record<string, string> = {

  button: "Button",

  label: "Label",

  textinput: "TextInput",

  gallery: "Gallery",

  datatable: "DataTable",

  form: "Form",

  timer: "Timer",

  component: "Component",

  dropdown: "Dropdown",

  container: "Container",

  checkbox: "Checkbox",

  toggle: "Toggle",

  image: "Image",

  icon: "Icon",

  datepicker: "DatePicker",

  shaperectangle: "ShapeRectangle",

  shapeellipse: "ShapeEllipse",

  shapeline: "ShapeLine",

  shapearrow: "ShapeArrow",

  shapeimage: "ShapeImage",

  shapestar: "ShapeStar",

};



const STUDIO_REGISTRY_TYPES = new Set([

  "Button",

  "Label",

  "TextInput",

  "Gallery",

  "DataTable",

  "Form",

  "Timer",

  "Component",

  "Dropdown",

  "Container",

  "Checkbox",

  "Toggle",

  "Image",

  "Icon",

  "DatePicker",

  "ShapeRectangle",

  "ShapeEllipse",

  "ShapeLine",

  "ShapeArrow",

  "ShapeImage",

  "ShapeStar",

]);



export function resolveRegistryType(rawType: string): string {

  const key = rawType.trim().toLowerCase().replace(/_/g, "");

  return REGISTRY_ALIASES[key] ?? rawType;

}



export function supportsStudioRegistryRendering(controlType: string): boolean {

  return STUDIO_REGISTRY_TYPES.has(resolveRegistryType(controlType));

}


