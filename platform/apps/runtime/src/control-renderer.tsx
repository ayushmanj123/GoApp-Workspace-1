import React from "react";
import { ControlPackage } from "./runtime-types";
import registry from "../../../packages/ui/src/registry.component-registry";

interface Props {
  control: ControlPackage;
}

function resolveRegistryType(rawType: string): string {
  const key = rawType.trim().toLowerCase().replace(/_/g, "");
  const aliases: Record<string, string> = {
    button: "Button",
    label: "Label",
    textinput: "TextInput",
    dropdown: "Dropdown",
    container: "Container",
  };
  return aliases[key] ?? rawType;
}

export const ControlRenderer: React.FC<Props> = ({ control }) => {
  const rawType =
    (control as any).control_type || (control as any).controlType || "";
  const typeKey = resolveRegistryType(rawType);
  const def = registry.get(typeKey);
  if (!def) {
    return (
      <div data-testid={`unknown-${(control as any).id}`}>
        Unknown: {rawType}
      </div>
    );
  }
  // base props from metadata
  const props = { ...((control as any).properties || {}) };
  // formulas not executed yet — expose no-op
  if ((control as any).formulas && (control as any).formulas.length > 0) {
    props["onFormula"] = () => null;
  }
  // build child controls recursively and sort by z_index ascending
  const children = ((control as any).children || [])
    .slice()
    .sort((a: any, b: any) => (a.z_index || 0) - (b.z_index || 0));
  const childrenElements = children.map((ch: any) => (
    <ControlRenderer control={ch} key={ch.id} />
  ));
  if (childrenElements.length > 0) props["children"] = childrenElements;

  return <>{def.renderRuntime(props)}</>;
};

export default ControlRenderer;
