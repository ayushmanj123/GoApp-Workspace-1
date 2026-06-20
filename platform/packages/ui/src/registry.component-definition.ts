import { ReactNode } from "react";
import { PropertyDefinition } from "./registry.property-definition";
import { EventDefinition } from "./registry.event-definition";
import { ValidationDefinition } from "./registry.validation-definition";

export type ComponentCategory =
  | "input"
  | "display"
  | "container"
  | "form"
  | "layout"
  | "media"
  | "custom";

export interface ComponentDefinition<Props = any> {
  type: string;
  category: ComponentCategory;
  properties: PropertyDefinition[];
  events: EventDefinition[];
  validations?: ValidationDefinition[];
  renderRuntime: (props: Props) => ReactNode;
  renderDesigner: (
    props: Props & { selected?: boolean; onSelect?: () => void },
  ) => ReactNode;
}
