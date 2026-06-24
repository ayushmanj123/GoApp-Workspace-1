// Bridge to register runtime renderers into shared registry
import registry from "../../../packages/ui/src/registry.component-registry";
import { ComponentDefinition } from "../../../packages/ui/src/registry.component-definition";
import { Button } from "./components/button";
import { Label } from "./components/label";
import { TextInput } from "./components/text-input";
import { Dropdown } from "./components/dropdown";
import { Container } from "./components/container";
import { Component } from "./components/component";
import { Gallery } from "./components/gallery";
import { Form } from "./components/form";
import { Timer } from "./components/timer";

const noopDesigner = () => null;

function registerRuntime() {
  // override v1 noop components by unregistering then registering runtime-aware versions
  ["Button", "Label", "TextInput", "Dropdown", "Container", "Component", "Gallery", "Form", "Timer"].forEach((t) => {
    if (registry.exists(t)) registry.unregister(t);
  });

  const defs: ComponentDefinition[] = [
    {
      type: "Button",
      category: "input",
      properties: [],
      events: [],
      renderRuntime: (p: any) => <Button {...p} />,
      renderDesigner: noopDesigner,
    },
    {
      type: "Label",
      category: "display",
      properties: [],
      events: [],
      renderRuntime: (p: any) => <Label {...p} />,
      renderDesigner: noopDesigner,
    },
    {
      type: "TextInput",
      category: "input",
      properties: [],
      events: [],
      renderRuntime: (p: any) => (
        <TextInput
          value={p.value}
          default={p.default}
          placeholder={p.placeholder}
          disabled={p.disabled}
          controlName={p.controlName}
          onChange={p.onChange}
        />
      ),
      renderDesigner: noopDesigner,
    },
    {
      type: "Dropdown",
      category: "input",
      properties: [],
      events: [],
      renderRuntime: (p: any) => <Dropdown {...p} />,
      renderDesigner: noopDesigner,
    },
    {
      type: "Container",
      category: "container",
      properties: [],
      events: [],
      renderRuntime: (p: any) => <Container {...p}>{p.children}</Container>,
      renderDesigner: noopDesigner,
    },
    {
      type: "Component",
      category: "container",
      properties: [],
      events: [],
      renderRuntime: (p: any) => <Component {...p}>{p.children}</Component>,
      renderDesigner: noopDesigner,
    },
    {
      type: "Gallery",
      category: "layout",
      properties: [],
      events: [],
      renderRuntime: (p: any) => <Gallery {...p} />,
      renderDesigner: noopDesigner,
    },
    {
      type: "Form",
      category: "layout",
      properties: [],
      events: [],
      renderRuntime: (p: any) => <Form {...p} />,
      renderDesigner: noopDesigner,
    },
    {
      type: "Timer",
      category: "input",
      properties: [],
      events: [],
      renderRuntime: (p: any) => <Timer {...p} />,
      renderDesigner: noopDesigner,
    },
  ];

  defs.forEach((d) => registry.register(d));
}

export default registerRuntime;
