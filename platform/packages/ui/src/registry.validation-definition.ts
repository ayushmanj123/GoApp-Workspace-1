export type ValidatorFn = (value: any, context?: any) => boolean;

export interface ValidationDefinition {
  name: string;
  validate: ValidatorFn;
  message?: string;
}

// Common validators
export const Validators = {
  required: (message = "Required"): ValidationDefinition => ({
    name: "required",
    validate: (v: any) => v !== null && v !== undefined && v !== "",
    message,
  }),
  maxLength: (max: number, message?: string): ValidationDefinition => ({
    name: "maxLength",
    validate: (v: any) => (typeof v === "string" ? v.length <= max : true),
    message: message || `Maximum length ${max}`,
  }),
};
