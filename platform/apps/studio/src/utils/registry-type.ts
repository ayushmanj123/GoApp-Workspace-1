const REGISTRY_ALIASES: Record<string, string> = {
  button: "Button",
  label: "Label",
  textinput: "TextInput",
  gallery: "Gallery",
  form: "Form",
  timer: "Timer",
  component: "Component",
};

const STUDIO_REGISTRY_TYPES = new Set(["Button", "Label", "TextInput", "Gallery", "Form", "Timer", "Component"]);

export function resolveRegistryType(rawType: string): string {
  const key = rawType.trim().toLowerCase().replace(/_/g, "");
  return REGISTRY_ALIASES[key] ?? rawType;
}

export function supportsStudioRegistryRendering(controlType: string): boolean {
  return STUDIO_REGISTRY_TYPES.has(resolveRegistryType(controlType));
}
