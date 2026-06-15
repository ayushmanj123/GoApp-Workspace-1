import registry, { ComponentRegistry } from "./registry.component-registry";
import { V1 } from "./registry.components-v1";

describe("ComponentRegistry", () => {
  it("registers and retrieves components", () => {
    expect(registry.exists("Button")).toBeTruthy();
    const btn = registry.get("Button");
    expect(btn).toBeDefined();
    expect(btn!.type).toBe("Button");
  });

  it("lists components", () => {
    const list = registry.list();
    expect(Array.isArray(list)).toBeTruthy();
    expect(list.find((c) => c.type === "Form")).toBeDefined();
  });

  it("unregisters components", () => {
    const temp = new ComponentRegistry();
    const comp = {
      type: "X",
      category: "custom",
      properties: [],
      events: [],
      renderRuntime: () => null,
      renderDesigner: () => null,
    };
    temp.register(comp);
    expect(temp.exists("X")).toBeTruthy();
    temp.unregister("X");
    expect(temp.exists("X")).toBeFalsy();
  });
});
