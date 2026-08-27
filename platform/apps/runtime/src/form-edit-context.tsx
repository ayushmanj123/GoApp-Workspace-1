import { createContext, useContext } from "react";

export interface FormEditContextValue {
  reportUpdate: (field: string, value: unknown) => void;
  flushPendingUpdates?: () => Promise<void>;
  validationErrors?: Array<{ field?: string; message: string }>;
  formMode?: "View" | "Edit" | "New";
  /** True when Form is View (or otherwise locked). Cascades to child inputs. */
  isReadOnly?: boolean;
  /** Stable key for the current Form item so inputs resync on selection change. */
  recordKey?: string | null;
  /** Optional field id prefix for label association. */
  inputIdForField?: (fieldName: string) => string;
}

export const FormEditContext = createContext<FormEditContextValue | null>(null);

export function useFormEditContext(): FormEditContextValue | null {
  return useContext(FormEditContext);
}
