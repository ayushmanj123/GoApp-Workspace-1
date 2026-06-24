import { createContext, useContext } from "react";

export interface FormEditContextValue {
  reportUpdate: (field: string, value: unknown) => void;
}

export const FormEditContext = createContext<FormEditContextValue | null>(null);

export function useFormEditContext(): FormEditContextValue | null {
  return useContext(FormEditContext);
}
