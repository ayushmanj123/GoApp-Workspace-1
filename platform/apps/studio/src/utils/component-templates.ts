import type { ComponentDefinitionJson } from "../api/component-definitions-api";

export type ComponentTemplateId = "blank" | "list" | "record-form";

export function componentTemplate(id: ComponentTemplateId): ComponentDefinitionJson {
  if (id === "list") {
    return {
      properties: [{ name: "Items", direction: "input", dataType: "table" }],
      controls: [
        {
          local_id: "root",
          parent_local_id: null,
          control_type: "gallery",
          name: "Gallery1",
          x: 0,
          y: 0,
          width: 320,
          height: 240,
          z_index: 1,
          properties: {
            items: { formula: "Component.Items" },
            pageSize: { value: 10 },
            visible: { value: true },
            layout: { value: "vertical" },
            selectable: { value: true },
          },
        },
      ],
    };
  }

  if (id === "record-form") {
    return {
      properties: [
        { name: "Source", direction: "input", dataType: "text" },
        { name: "Record", direction: "input", dataType: "record" },
      ],
      controls: [
        {
          local_id: "root",
          parent_local_id: null,
          control_type: "form",
          name: "Form1",
          x: 0,
          y: 0,
          width: 320,
          height: 280,
          z_index: 1,
          properties: {
            dataSource: { formula: "Component.Source" },
            item: { formula: "Component.Record" },
            layout: { value: "Vertical" },
            columns: { value: 1 },
            visible: { value: true },
          },
        },
      ],
    };
  }

  return { properties: [], controls: [] };
}
