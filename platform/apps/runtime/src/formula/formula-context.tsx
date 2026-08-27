import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createDefaultFormulaEngine,
  type FormulaEngine,
  type FormulaControlContextInput,
} from "@goapps/formula";
import {
  buildFormulaRuntimeContext,
  HARDCODED_USER,
} from "./formula-runtime-context";
import {
  defaultScreenContextStore,
  type RuntimeScreenContextStore,
} from "./runtime-screen-context-store";
import {
  defaultCollectionStore,
  type RuntimeCollectionStore,
} from "./runtime-collection-store";
import {
  defaultGallerySelectionStore,
  type RuntimeGallerySelectionStore,
} from "./runtime-gallery-selection-store";
import {
  defaultFormUpdatesStore,
  type RuntimeFormUpdatesStore,
} from "./runtime-form-updates-store";
import {
  defaultRecordStore,
  type RuntimeRecordStore,
} from "./runtime-record-store";
import {
  defaultControlValueStore,
  type RuntimeControlValueStore,
} from "./runtime-control-value-store";
import {
  defaultVariableStore,
  type RuntimeVariableStore,
} from "./runtime-variable-store";
import { executeSet } from "./execute-set";

const FormulaContext = createContext<FormulaEngine | null>(null);
const FormulaEvaluationContext = createContext<Record<string, unknown>>(
  buildFormulaRuntimeContext(),
);
const VariableStoreContext =
  createContext<RuntimeVariableStore>(defaultVariableStore);

const ScreenContextStoreContext =
  createContext<RuntimeScreenContextStore>(defaultScreenContextStore);

const CollectionStoreContext =
  createContext<RuntimeCollectionStore>(defaultCollectionStore);

const GallerySelectionStoreContext = createContext<RuntimeGallerySelectionStore>(
  defaultGallerySelectionStore,
);

const FormUpdatesStoreContext = createContext<RuntimeFormUpdatesStore>(
  defaultFormUpdatesStore,
);

const RecordStoreContext = createContext<RuntimeRecordStore>(defaultRecordStore);

const ControlValueStoreContext = createContext<RuntimeControlValueStore>(
  defaultControlValueStore,
);

interface FormulaProviderProps {
  engine?: FormulaEngine;
  appName?: string;
  controls?: FormulaControlContextInput[];
  variableStore?: RuntimeVariableStore;
  screenContextStore?: RuntimeScreenContextStore;
  collectionStore?: RuntimeCollectionStore;
  gallerySelectionStore?: RuntimeGallerySelectionStore;
  formUpdatesStore?: RuntimeFormUpdatesStore;
  recordStore?: RuntimeRecordStore;
  controlValueStore?: RuntimeControlValueStore;
  children: ReactNode;
}

export function FormulaProvider({
  engine,
  appName,
  controls = [],
  variableStore,
  screenContextStore,
  collectionStore,
  gallerySelectionStore,
  formUpdatesStore,
  recordStore,
  controlValueStore,
  children,
}: FormulaProviderProps) {
  const resolvedStore = variableStore ?? defaultVariableStore;
  const resolvedScreenStore = screenContextStore ?? defaultScreenContextStore;
  const resolvedCollectionStore = collectionStore ?? defaultCollectionStore;
  const resolvedGallerySelectionStore =
    gallerySelectionStore ?? defaultGallerySelectionStore;
  const resolvedFormUpdatesStore = formUpdatesStore ?? defaultFormUpdatesStore;
  const resolvedRecordStore = recordStore ?? defaultRecordStore;
  const resolvedControlValueStore = controlValueStore ?? defaultControlValueStore;

  const formulaEngine = useMemo(
    () => engine ?? createDefaultFormulaEngine(),
    [engine],
  );

  const [contextVersion, setContextVersion] = useState(0);

  useEffect(() => {
    return resolvedStore.subscribe(() => setContextVersion((v) => v + 1));
  }, [resolvedStore]);

  useEffect(() => {
    return resolvedScreenStore.subscribe(() => setContextVersion((v) => v + 1));
  }, [resolvedScreenStore]);

  useEffect(() => {
    return resolvedCollectionStore.subscribe(() => setContextVersion((v) => v + 1));
  }, [resolvedCollectionStore]);

  useEffect(() => {
    return resolvedGallerySelectionStore.subscribe(() =>
      setContextVersion((v) => v + 1),
    );
  }, [resolvedGallerySelectionStore]);

  useEffect(() => {
    return resolvedFormUpdatesStore.subscribe(() => setContextVersion((v) => v + 1));
  }, [resolvedFormUpdatesStore]);

  useEffect(() => {
    return resolvedControlValueStore.subscribe(() => setContextVersion((v) => v + 1));
  }, [resolvedControlValueStore]);

  useEffect(() => {
    void formulaEngine.initialize().catch((error) => {
      console.warn(
        "[formula] engine initialization failed — is the formula API running on port 8091?",
        error,
      );
    });
  }, [formulaEngine]);

  const evaluationContext = useMemo(
    () =>
      buildFormulaRuntimeContext(
        appName,
        controls,
        resolvedStore,
        resolvedScreenStore,
        resolvedCollectionStore,
        resolvedGallerySelectionStore,
        resolvedFormUpdatesStore,
        resolvedControlValueStore,
      ),
    [
      appName,
      controls,
      resolvedStore,
      resolvedScreenStore,
      resolvedCollectionStore,
      resolvedGallerySelectionStore,
      resolvedFormUpdatesStore,
      resolvedControlValueStore,
      contextVersion,
    ],
  );

  return (
    <FormulaContext.Provider value={formulaEngine}>
      <FormulaEvaluationContext.Provider value={evaluationContext}>
        <VariableStoreContext.Provider value={resolvedStore}>
          <ScreenContextStoreContext.Provider value={resolvedScreenStore}>
            <CollectionStoreContext.Provider value={resolvedCollectionStore}>
              <GallerySelectionStoreContext.Provider
                value={resolvedGallerySelectionStore}
              >
                <FormUpdatesStoreContext.Provider value={resolvedFormUpdatesStore}>
                  <RecordStoreContext.Provider value={resolvedRecordStore}>
                    <ControlValueStoreContext.Provider value={resolvedControlValueStore}>
                      {children}
                    </ControlValueStoreContext.Provider>
                  </RecordStoreContext.Provider>
                </FormUpdatesStoreContext.Provider>
              </GallerySelectionStoreContext.Provider>
            </CollectionStoreContext.Provider>
          </ScreenContextStoreContext.Provider>
        </VariableStoreContext.Provider>
      </FormulaEvaluationContext.Provider>
    </FormulaContext.Provider>
  );
}

export function useFormulaEngine(): FormulaEngine {
  const engine = useContext(FormulaContext);
  if (!engine) {
    throw new Error("useFormulaEngine must be used within FormulaProvider");
  }
  return engine;
}

export function useFormulaEvaluationContext(): Record<string, unknown> {
  return useContext(FormulaEvaluationContext);
}

/** Scopes formula evaluation to a single gallery row via ThisItem. */
export function GalleryRowProvider({
  thisItem,
  children,
}: {
  thisItem: Record<string, unknown>;
  children: ReactNode;
}) {
  const parentContext = useFormulaEvaluationContext();
  const rowContext = useMemo(
    () => ({ ...parentContext, ThisItem: thisItem }),
    [parentContext, thisItem],
  );

  return (
    <FormulaEvaluationContext.Provider value={rowContext}>
      {children}
    </FormulaEvaluationContext.Provider>
  );
}

export function useVariableStore(): RuntimeVariableStore {
  return useContext(VariableStoreContext);
}

export function useScreenContextStore(): RuntimeScreenContextStore {
  return useContext(ScreenContextStoreContext);
}

export function useCollectionStore(): RuntimeCollectionStore {
  return useContext(CollectionStoreContext);
}

/** Scopes formula evaluation to a form item via Parent.Item and ThisItem. */
export function FormItemProvider({
  item,
  children,
}: {
  item: Record<string, unknown>;
  children: ReactNode;
}) {
  const parentContext = useFormulaEvaluationContext();
  const formContext = useMemo(
    () => ({
      ...parentContext,
      ThisItem: item,
      Parent: { Item: item },
    }),
    [parentContext, item],
  );

  return (
    <FormulaEvaluationContext.Provider value={formContext}>
      {children}
    </FormulaEvaluationContext.Provider>
  );
}

export function useGallerySelectionStore(): RuntimeGallerySelectionStore {
  return useContext(GallerySelectionStoreContext);
}

export function useFormUpdatesStore(): RuntimeFormUpdatesStore {
  return useContext(FormUpdatesStoreContext);
}

export function useRecordStore(): RuntimeRecordStore {
  return useContext(RecordStoreContext);
}

export function useControlValueStore(): RuntimeControlValueStore {
  return useContext(ControlValueStoreContext);
}

/**
 * Returns a stable callback that executes a Set(varName, value) formula
 * and updates the RuntimeVariableStore, triggering reactive re-evaluation.
 */
export function useSet(): (formula: string) => Promise<void> {
  const engine = useFormulaEngine();
  const context = useFormulaEvaluationContext();
  const store = useVariableStore();

  return useCallback(
    async (formula: string) => {
      await executeSet(formula, store, engine, context);
    },
    [engine, context, store],
  );
}

export { HARDCODED_USER, buildFormulaRuntimeContext };
export type {
  RuntimeVariableStore,
  RuntimeScreenContextStore,
  RuntimeCollectionStore,
  RuntimeGallerySelectionStore,
  RuntimeFormUpdatesStore,
  RuntimeRecordStore,
  RuntimeControlValueStore,
};
