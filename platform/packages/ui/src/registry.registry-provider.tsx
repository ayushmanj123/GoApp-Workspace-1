import React, { createContext, useContext } from "react";
import registry, { ComponentRegistry } from "./registry.component-registry";
import { ComponentDefinition } from "./registry.component-definition";

const RegistryContext = createContext<ComponentRegistry>(registry);

export const RegistryProvider: React.FC<{
  children: React.ReactNode;
  registryInstance?: ComponentRegistry;
}> = ({ children, registryInstance }) => {
  return (
    <RegistryContext.Provider value={registryInstance || registry}>
      {children}
    </RegistryContext.Provider>
  );
};

export function useRegistry() {
  return useContext(RegistryContext);
}

export function useComponent<Props = any>(
  type: string,
): ComponentDefinition<Props> | undefined {
  return useRegistry().get<Props>(type);
}

export function useComponentOrThrow<Props = any>(
  type: string,
): ComponentDefinition<Props> {
  return useRegistry().getOrThrow<Props>(type);
}
