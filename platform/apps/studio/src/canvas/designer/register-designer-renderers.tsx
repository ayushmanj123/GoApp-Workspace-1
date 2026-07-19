import type { ReactNode } from "react";
import type { Control } from "../../api/controls-api";
import registry from "@goapps/ui/registry.component-registry";
import {
  DesignerButton,
  DesignerCheckbox,
  DesignerDatePicker,
  DesignerDropdown,
  DesignerIcon,
  DesignerImage,
  DesignerLabel,
  DesignerTextInput,
  DesignerTimer,
  DesignerToggle,
} from "./components/DesignerPrimitives";
import {
  DesignerComponent,
  DesignerContainer,
  DesignerDataTable,
  DesignerForm,
  DesignerGallery,
} from "./components/DesignerContainers";

const DESIGNER_TYPES = [
  "Button",
  "Label",
  "TextInput",
  "Gallery",
  "DataTable",
  "Form",
  "Component",
  "Timer",
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
] as const;

type DesignerRenderer = (props: Record<string, unknown>) => ReactNode;

function getDesignerRenderer(type: string): DesignerRenderer {
  switch (type) {
    case "Button":
      return (p) => (
        <DesignerButton
          text={p.text}
          disabled={Boolean(p.disabled)}
          selected={p.selected as boolean}
        />
      );
    case "Label":
      return (p) => (
        <DesignerLabel text={p.text} color={p.color} selected={p.selected as boolean} />
      );
    case "TextInput":
      return (p) => (
        <DesignerTextInput
          value={p.value}
          placeholder={p.placeholder}
          disabled={Boolean(p.disabled)}
          selected={p.selected as boolean}
        />
      );
    case "Gallery":
      return (p) => (
        <DesignerGallery
          items={p.items}
          templateControls={p.templateControls as never[]}
          selected={p.selected as boolean}
          renderChild={p.renderChild as (c: Control) => ReactNode}
        />
      );
    case "DataTable":
      return (p) => (
        <DesignerDataTable
          items={p.items}
          pageSize={p.pageSize}
          selected={p.selected as boolean}
        />
      );
    case "Form":
      return (p) => (
        <DesignerForm
          item={p.item}
          mode={p.mode}
          templateControls={p.templateControls as never[]}
          selected={p.selected as boolean}
          renderChild={p.renderChild as (c: Control) => ReactNode}
        />
      );
    case "Component":
      return (p) => (
        <DesignerComponent
          templateControls={p.templateControls as never[]}
          selected={p.selected as boolean}
          renderChild={p.renderChild as (c: Control) => ReactNode}
        />
      );
    case "Container":
      return (p) => (
        <DesignerContainer
          direction={p.direction}
          templateControls={p.templateControls as never[]}
          selected={p.selected as boolean}
          renderChild={p.renderChild as (c: Control) => ReactNode}
        />
      );
    case "Timer":
      return (p) => <DesignerTimer duration={p.duration} selected={p.selected as boolean} />;
    case "Dropdown":
      return (p) => (
        <DesignerDropdown
          items={p.items}
          value={p.value}
          disabled={Boolean(p.disabled)}
          selected={p.selected as boolean}
        />
      );
    case "Checkbox":
      return (p) => (
        <DesignerCheckbox
          text={p.text}
          checked={p.checked}
          selected={p.selected as boolean}
        />
      );
    case "Toggle":
      return (p) => (
        <DesignerToggle
          text={p.text}
          checked={p.checked}
          selected={p.selected as boolean}
        />
      );
    case "Image":
      return (p) => (
        <DesignerImage src={p.src} alt={p.alt} selected={p.selected as boolean} />
      );
    case "Icon":
      return (p) => (
        <DesignerIcon icon={p.icon} color={p.color} selected={p.selected as boolean} />
      );
    case "DatePicker":
      return (p) => (
        <DesignerDatePicker
          value={p.value}
          disabled={Boolean(p.disabled)}
          selected={p.selected as boolean}
        />
      );
    case "ShapeRectangle":
    case "ShapeEllipse":
    case "ShapeLine":
    case "ShapeArrow":
    case "ShapeImage":
    case "ShapeStar":
      // Shapes render on the Konva layer, not the HTML overlay.
      return () => null;
    default:
      return () => null;
  }
}

/** Studio canvas preview — does not depend on registry.renderDesigner (avoids noop / HMR wipe). */
export function renderStudioDesignerPreview(
  registryType: string,
  props: Record<string, unknown>,
): ReactNode {
  return getDesignerRenderer(registryType)(props);
}

/** Patches registry.renderDesigner after runtime registration (for any registry consumers). */
export function registerDesignerRenderers(): void {
  for (const type of DESIGNER_TYPES) {
    if (!registry.exists(type)) {
      continue;
    }
    const def = registry.get(type)!;
    registry.unregister(type);
    registry.register({
      ...def,
      renderDesigner: getDesignerRenderer(type),
    });
  }
}
