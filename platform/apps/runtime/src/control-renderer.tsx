import React from "react";
import { ControlPackage } from "./runtime-types";
import registry from "../../../packages/ui/src/registry.component-registry";
import { LayoutControlFrame } from "./layout-control-frame";
import {
  fillParentStyle,
  resolveControlLayout,
} from "./utils/control-layout";
import { mergeFormulasIntoProps } from "./utils/merge-control-formulas";

interface Props {
  control: ControlPackage;
  /** When true, layout is applied by the parent container instead of a frame. */
  nested?: boolean;
}

function resolveRegistryType(rawType: string): string {
  const key = rawType.trim().toLowerCase().replace(/_/g, "");
  const aliases: Record<string, string> = {
    button: "Button",
    label: "Label",
    textinput: "TextInput",
    dropdown: "Dropdown",
    container: "Container",
    component: "Component",
    gallery: "Gallery",
    datatable: "DataTable",
    form: "Form",
    timer: "Timer",
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
  return aliases[key] ?? rawType;
}

function sortByZIndex(controls: ControlPackage[]): ControlPackage[] {
  return controls
    .slice()
    .sort((left, right) => (left.z_index ?? 0) - (right.z_index ?? 0));
}

export const ControlRenderer: React.FC<Props> = ({ control, nested = false }) => {
  const rawType =
    (control as any).control_type || (control as any).controlType || "";
  const typeKey = resolveRegistryType(rawType);
  const def = registry.get(typeKey);
  if (!def) {
    if (!nested) {
      return (
        <LayoutControlFrame control={control}>
          <div data-testid={`unknown-${(control as any).id}`}>
            Unknown: {rawType}
          </div>
        </LayoutControlFrame>
      );
    }
    return (
      <div data-testid={`unknown-${(control as any).id}`}>
        Unknown: {rawType}
      </div>
    );
  }

  const layout = resolveControlLayout(control);
  if (!layout.visible) {
    return null;
  }

  const props = mergeFormulasIntoProps(
    { ...((control as any).properties || {}) },
    (control as any).formulas,
  );
  const controlName = (control as any).name;
  if (controlName) {
    props.controlName = controlName;
    props.name = controlName;
  }
  if (layout.disabled) {
    props.disabled = true;
  }
  props.readOnly = layout.displayMode === "View";
  props.style = { ...(props.style || {}), ...fillParentStyle() };

  const childControls = sortByZIndex((control as any).children || []);

  if (typeKey === "Gallery") {
    props.templateControls = childControls;
    props.name = (control as any).name;
  } else if (typeKey === "DataTable") {
    props.name = (control as any).name;
  } else if (typeKey === "Form") {
    props.templateControls = childControls;
    props.name = (control as any).name;
  } else if (typeKey === "Component" || typeKey === "Container") {
    props.templateControls = childControls;
  }

  const rendered = <>{def.renderRuntime(props)}</>;

  if (nested) {
    return rendered;
  }

  return <LayoutControlFrame control={control}>{rendered}</LayoutControlFrame>;
};

export default ControlRenderer;
