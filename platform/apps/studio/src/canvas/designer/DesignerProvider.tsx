import { type ReactNode } from "react";
import { DesignModeProvider } from "./DesignModeContext";

/** Lightweight studio canvas provider — no formula/runtime execution. */
export function DesignerProvider({ children }: { children: ReactNode }) {
  return (
    <DesignModeProvider value={{ readOnly: true, isDesignSurface: true }}>
      {children}
    </DesignModeProvider>
  );
}
