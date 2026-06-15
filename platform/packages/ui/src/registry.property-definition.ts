export type PropertyType =
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "json"
  | "array"
  | "object";

export interface PropertyOption {
  label: string;
  value: any;
}

export interface PropertyDefinition {
  name: string;
  title?: string;
  description?: string;
  type: PropertyType;
  default?: any;
  options?: PropertyOption[];
  editor?: string;
  required?: boolean;
}
