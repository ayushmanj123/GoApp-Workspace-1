import React from "react";
import registry from "./registry.component-registry";
import { ComponentDefinition } from "./registry.component-definition";
import { PropertyDefinition } from "./registry.property-definition";
import { EventDefinition } from "./registry.event-definition";
import { Validators } from "./registry.validation-definition";

// minimal no-op renderers for v1 components (placeholder)
const noop = () => null;

function makeProps(defs: PropertyDefinition[]) {
  return defs;
}

// Common events
const onClickEvent: EventDefinition = {
  name: "onClick",
  title: "Click",
  description: "Click event",
};
const onChangeEvent: EventDefinition = {
  name: "onChange",
  title: "Change",
  description: "Value changed",
};

const Button: ComponentDefinition = {
  type: "Button",
  category: "input",
  properties: makeProps([
    {
      name: "text",
      title: "Text",
      type: "string",
      default: "Button",
      required: true,
    },
    { name: "disabled", title: "Disabled", type: "boolean", default: false },
  ]),
  events: [onClickEvent],
  validations: [Validators.required("Button text is required")],
  renderRuntime: noop,
  renderDesigner: noop,
};

const Label: ComponentDefinition = {
  type: "Label",
  category: "display",
  properties: makeProps([{ name: "text", type: "string", default: "" }]),
  events: [],
  renderRuntime: noop,
  renderDesigner: noop,
};

const TextInput: ComponentDefinition = {
  type: "TextInput",
  category: "input",
  properties: makeProps([
    { name: "value", type: "string", default: "" },
    { name: "placeholder", type: "string", default: "" },
  ]),
  events: [onChangeEvent],
  validations: [],
  renderRuntime: noop,
  renderDesigner: noop,
};

const Dropdown: ComponentDefinition = {
  type: "Dropdown",
  category: "input",
  properties: makeProps([
    { name: "options", type: "array", default: [] },
    { name: "value", type: "string" },
  ]),
  events: [onChangeEvent],
  renderRuntime: noop,
  renderDesigner: noop,
};

const Container: ComponentDefinition = {
  type: "Container",
  category: "container",
  properties: makeProps([
    { name: "direction", type: "string", default: "row" },
  ]),
  events: [],
  renderRuntime: noop,
  renderDesigner: noop,
};

const Gallery: ComponentDefinition = {
  type: "Gallery",
  category: "layout",
  properties: makeProps([{ name: "items", type: "array", default: [] }]),
  events: [],
  renderRuntime: noop,
  renderDesigner: noop,
};

const Form: ComponentDefinition = {
  type: "Form",
  category: "form",
  properties: makeProps([{ name: "model", type: "object", default: {} }]),
  events: [],
  renderRuntime: noop,
  renderDesigner: noop,
};

const Timer: ComponentDefinition = {
  type: "Timer",
  category: "input",
  properties: makeProps([
    { name: "duration", title: "Duration", type: "number", default: 1000 },
  ]),
  events: [],
  renderRuntime: noop,
  renderDesigner: noop,
};

// Register v1 components
[Button, Label, TextInput, Dropdown, Container, Gallery, Form, Timer].forEach((c) =>
  registry.register(c),
);

export const V1 = {
  Button,
  Label,
  TextInput,
  Dropdown,
  Container,
  Gallery,
  Form,
  Timer,
};
