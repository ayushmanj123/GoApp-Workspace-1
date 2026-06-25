import { createContext, useContext, type ReactNode } from "react";

export interface DesignModeValue {
  readOnly: boolean;
  isDesignSurface: boolean;
}

const defaultValue: DesignModeValue = {
  readOnly: false,
  isDesignSurface: false,
};

export const DesignModeContext = createContext<DesignModeValue>(defaultValue);

export function DesignModeProvider({
  children,
  value,
}: {
  children: ReactNode;
  value?: Partial<DesignModeValue>;
}) {
  const merged = { ...defaultValue, ...value };
  return (
    <DesignModeContext.Provider value={merged}>{children}</DesignModeContext.Provider>
  );
}

export function useDesignMode(): DesignModeValue {
  return useContext(DesignModeContext);
}

export function useIsDesignSurface(): boolean {
  return useContext(DesignModeContext).isDesignSurface;
}
