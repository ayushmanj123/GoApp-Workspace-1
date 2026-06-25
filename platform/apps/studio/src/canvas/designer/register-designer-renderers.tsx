import type { ReactNode } from "react";
import type { Control } from "../../api/controls-api";
import registry from "../../../../../packages/ui/src/registry.component-registry";
import {
  DesignerButton,
  DesignerLabel,
  DesignerTextInput,
  DesignerTimer,
} from "./components/DesignerPrimitives";
import {
  DesignerComponent,
  DesignerForm,
  DesignerGallery,
} from "./components/DesignerContainers";

const DESIGNER_TYPES = [
  "Button",
  "Label",
  "TextInput",
  "Gallery",
  "Form",
  "Component",
  "Timer",
] as const;

/** Patches registry renderDesigner after runtime registration. */
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

function getDesignerRenderer(type: string) {
  switch (type) {
    case "Button":
      return (p: Record<string, unknown>) => (
        <DesignerButton
          text={p.text}
          disabled={Boolean(p.disabled)}
          selected={p.selected as boolean}
        />
      );
    case "Label":
      return (p: Record<string, unknown>) => (
        <DesignerLabel text={p.text} color={p.color} selected={p.selected as boolean} />
      );
    case "TextInput":
      return (p: Record<string, unknown>) => (
        <DesignerTextInput
          value={p.value}
          placeholder={p.placeholder}
          disabled={Boolean(p.disabled)}
          selected={p.selected as boolean}
        />
      );
    case "Gallery":
      return (p: Record<string, unknown>) => (
        <DesignerGallery
          items={p.items}
          templateControls={p.templateControls as never[]}
          selected={p.selected as boolean}
          renderChild={p.renderChild as (c: Control) => ReactNode}
        />
      );
    case "Form":
      return (p: Record<string, unknown>) => (
        <DesignerForm
          item={p.item}
          mode={p.mode}
          templateControls={p.templateControls as never[]}
          selected={p.selected as boolean}
          renderChild={p.renderChild as (c: Control) => ReactNode}
        />
      );
    case "Component":
      return (p: Record<string, unknown>) => (
        <DesignerComponent
          templateControls={p.templateControls as never[]}
          selected={p.selected as boolean}
          renderChild={p.renderChild as (c: Control) => ReactNode}
        />
      );
    case "Timer":
      return (p: Record<string, unknown>) => (
        <DesignerTimer duration={p.duration} selected={p.selected as boolean} />
      );
    default:
      return () => null;
  }
}
