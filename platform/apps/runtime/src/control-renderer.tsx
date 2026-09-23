import React from "react";
import { ControlPackage } from "./runtime-types";
import registry from "../../../packages/ui/src/registry.component-registry";
import { LayoutControlFrame } from "./layout-control-frame";
import {
  fillParentStyle,
  resolveControlLayout,
} from "./utils/control-layout";
import { mergeFormulasIntoProps } from "./utils/merge-control-formulas";
import { useResolvedPropertyBag } from "./hooks/use-resolved-property-bag";
import { useFormEditContext } from "./form-edit-context";

interface Props {
  control: ControlPackage;
  /** When true, layout is applied by the parent container instead of a frame. */
  nested?: boolean;
  /** Cascade read-only from Form/DataCard. */
  forceReadOnly?: boolean;
  /** Optional id for label association (DataCard field input). */
  inputId?: string;
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
    datacard: "DataCard",
    timer: "Timer",
    checkbox: "Checkbox",
    toggle: "Toggle",
    image: "Image",
    icon: "Icon",
    datepicker: "DatePicker",
    radio: "Radio",
    slider: "Slider",
    link: "Link",
    badge: "Badge",
    progress: "Progress",
    spinner: "Spinner",
    rating: "Rating",
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

export const ControlRenderer: React.FC<Props> = ({
  control,
  nested = false,
  forceReadOnly = false,
  inputId,
}) => {
  const formEdit = useFormEditContext();
  const resolvedProperties = useResolvedPropertyBag(
    mergeFormulasIntoProps(
      { ...((control as { properties?: Record<string, unknown> }).properties || {}) },
      (control as { formulas?: Parameters<typeof mergeFormulasIntoProps>[1] }).formulas,
    ),
  );
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

  const props = { ...resolvedProperties };

  const layoutSource = {
    ...control,
    properties: resolvedProperties,
  };
  const layout = resolveControlLayout(layoutSource);
  const disabledFlag = resolvedProperties.disabled ?? resolvedProperties.Disabled;
  if (
    layout.displayMode === "Disabled" ||
    disabledFlag === true ||
    disabledFlag === "true" ||
    disabledFlag === 1
  ) {
    layout.disabled = true;
  }
  if (!layout.visible) {
    return null;
  }

  const controlName = (control as any).name;
  if (controlName) {
    props.controlName = controlName;
    props.name = controlName;
  }
  if (layout.disabled) {
    props.disabled = true;
  }
  const readOnly =
    forceReadOnly ||
    layout.displayMode === "View" ||
    Boolean(formEdit?.isReadOnly);
  props.readOnly = readOnly;
  if (readOnly) {
    props.disabled = props.disabled || layout.displayMode === "Disabled";
  }
  if (inputId) {
    props.id = inputId;
  }
  props.style = { ...(props.style || {}), ...fillParentStyle() };

  const childControls = sortByZIndex((control as any).children || []);

  // Normalize Items casing from server render merge / package metadata.
  props.items = props.items ?? props.Items;

  if (typeKey === "Gallery") {
    props.templateControls = childControls;
    props.name = (control as any).name;
    props.controlId = (control as any).id ?? (control as any).name;
  } else if (typeKey === "DataTable") {
    props.name = (control as any).name;
    props.controlId = (control as any).id ?? (control as any).name;
    if (
      Array.isArray((control as any).properties?.columnHints) &&
      props.columnHints === undefined
    ) {
      props.columnHints = (control as any).properties.columnHints;
    }
  } else if (typeKey === "Form") {
    props.templateControls = childControls;
    props.name = (control as any).name;
    props.controlId = (control as any).id;
  } else if (typeKey === "DataCard") {
    props.templateControls = childControls;
    props.name = (control as any).name;
  } else if (typeKey === "Component" || typeKey === "Container") {
    props.templateControls = childControls;
  } else if (typeKey === "Label" && inputId) {
    props.htmlFor = inputId;
  }

  const rendered = <>{def.renderRuntime(props)}</>;

  if (nested) {
    return rendered;
  }

  return (
    <LayoutControlFrame control={control} layout={layout}>
      {rendered}
    </LayoutControlFrame>
  );
};

export default ControlRenderer;
