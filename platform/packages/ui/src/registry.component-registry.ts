import { ComponentDefinition } from "./registry.component-definition";

export class ComponentRegistry {
  private components: Map<string, ComponentDefinition<any>> = new Map();

  register(component: ComponentDefinition<any>) {
    if (this.components.has(component.type)) {
      throw new Error(`component already registered: ${component.type}`);
    }
    this.components.set(component.type, component);
  }

  unregister(type: string) {
    this.components.delete(type);
  }

  get<Props = any>(type: string): ComponentDefinition<Props> | undefined {
    return this.components.get(type) as ComponentDefinition<Props> | undefined;
  }

  getOrThrow<Props = any>(type: string): ComponentDefinition<Props> {
    const c = this.get<Props>(type);
    if (!c) throw new Error(`component not found: ${type}`);
    return c;
  }

  exists(type: string): boolean {
    return this.components.has(type);
  }

  list(): ComponentDefinition[] {
    return Array.from(this.components.values());
  }
}

// singleton for runtime and studio
export const registry = new ComponentRegistry();
export default registry;
