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

import { DataTable } from "./components/datatable";

import { Form } from "./components/form";

import { DataCard } from "./components/datacard";

import { Timer } from "./components/timer";

import { Checkbox } from "./components/checkbox";

import { Toggle } from "./components/toggle";

import { Image } from "./components/image";

import { Icon } from "./components/icon";

import { DatePicker } from "./components/datepicker";

import {

  ShapeArrow,

  ShapeEllipse,

  ShapeImage,

  ShapeLine,

  ShapeRectangle,

  ShapeStar,

} from "./components/shape-primitives";



const noopDesigner = () => null;



const RUNTIME_TYPES = [

  "Button",

  "Label",

  "TextInput",

  "Dropdown",

  "Container",

  "Component",

  "Gallery",

  "DataTable",

  "Form",

  "DataCard",

  "Timer",

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

];



function registerRuntime() {

  RUNTIME_TYPES.forEach((t) => {

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

          readOnly={p.readOnly}

          controlName={p.controlName}

          id={p.id}

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

      renderRuntime: (p: any) => (

        <Dropdown

          items={p.items}

          default={p.default}

          value={p.value}

          disabled={p.disabled}

          readOnly={p.readOnly}

          controlName={p.controlName}

          name={p.name}

          id={p.id}

          onChange={p.onChange}

        />

      ),

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

      type: "DataTable",

      category: "layout",

      properties: [],

      events: [],

      renderRuntime: (p: any) => <DataTable {...p} />,

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

      type: "DataCard",

      category: "layout",

      properties: [],

      events: [],

      renderRuntime: (p: any) => <DataCard {...p} />,

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

    {

      type: "Checkbox",

      category: "input",

      properties: [],

      events: [],

      renderRuntime: (p: any) => <Checkbox {...p} />,

      renderDesigner: noopDesigner,

    },

    {

      type: "Toggle",

      category: "input",

      properties: [],

      events: [],

      renderRuntime: (p: any) => <Toggle {...p} />,

      renderDesigner: noopDesigner,

    },

    {

      type: "Image",

      category: "display",

      properties: [],

      events: [],

      renderRuntime: (p: any) => <Image {...p} />,

      renderDesigner: noopDesigner,

    },

    {

      type: "Icon",

      category: "display",

      properties: [],

      events: [],

      renderRuntime: (p: any) => <Icon {...p} />,

      renderDesigner: noopDesigner,

    },

    {

      type: "DatePicker",

      category: "input",

      properties: [],

      events: [],

      renderRuntime: (p: any) => <DatePicker {...p} />,

      renderDesigner: noopDesigner,

    },

    {

      type: "ShapeRectangle",

      category: "display",

      properties: [],

      events: [],

      renderRuntime: (p: any) => <ShapeRectangle {...p} />,

      renderDesigner: noopDesigner,

    },

    {

      type: "ShapeEllipse",

      category: "display",

      properties: [],

      events: [],

      renderRuntime: (p: any) => <ShapeEllipse {...p} />,

      renderDesigner: noopDesigner,

    },

    {

      type: "ShapeLine",

      category: "display",

      properties: [],

      events: [],

      renderRuntime: (p: any) => <ShapeLine {...p} />,

      renderDesigner: noopDesigner,

    },

    {

      type: "ShapeArrow",

      category: "display",

      properties: [],

      events: [],

      renderRuntime: (p: any) => <ShapeArrow {...p} />,

      renderDesigner: noopDesigner,

    },

    {

      type: "ShapeImage",

      category: "display",

      properties: [],

      events: [],

      renderRuntime: (p: any) => <ShapeImage {...p} />,

      renderDesigner: noopDesigner,

    },

    {

      type: "ShapeStar",

      category: "display",

      properties: [],

      events: [],

      renderRuntime: (p: any) => <ShapeStar {...p} />,

      renderDesigner: noopDesigner,

    },

  ];



  defs.forEach((d) => registry.register(d));

}



export default registerRuntime;

