import { createContext, useContext, type ReactNode } from "react";
import { useTenantTables } from "../../../hooks/useTenantTables";

type TenantTablesContextValue = ReturnType<typeof useTenantTables>;

const TenantTablesContext = createContext<TenantTablesContextValue | null>(null);

export function TenantTablesProvider({ children }: { children: ReactNode }) {
  const value = useTenantTables();
  return (
    <TenantTablesContext.Provider value={value}>{children}</TenantTablesContext.Provider>
  );
}

export function useTenantTablesContext() {
  const ctx = useContext(TenantTablesContext);
  if (!ctx) {
    throw new Error("useTenantTablesContext must be used within TenantTablesProvider");
  }
  return ctx;
}
