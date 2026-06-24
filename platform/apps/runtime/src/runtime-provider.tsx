import React, { createContext, useEffect, useMemo, useRef, useState } from "react";
import type { AppPackage } from "./runtime-types";
import {
  FormulaProvider,
  useFormulaEngine,
  useFormulaEvaluationContext,
  useVariableStore,
} from "./formula/formula-context";
import { InMemoryVariableStore } from "./formula/runtime-variable-store";
import { executeAction } from "./formula/execute-action";
const TENANT_ID =
  (import.meta.env.VITE_TENANT_ID as string | undefined) ??
  "00000000-0000-4000-8000-000000000001";

export interface RuntimeContextValue {
  pkg?: AppPackage;
  loading: boolean;
  currentScreen?: string;
  navigate: (screenId: string) => void;
  variables: Record<string, any>;
  collections: Record<string, any[]>;
}

export const RuntimeContext = createContext<RuntimeContextValue>({
  loading: true,
  navigate: () => {},
  variables: {},
  collections: {},
});

/**
 * Dev-only test helper. Exposes window.__executeAction so that headless
 * acceptance tests can drive action execution without a click event system.
 * Has no effect in production builds.
 */
function DevActionRunner() {
  const engine = useFormulaEngine();
  const context = useFormulaEvaluationContext();
  const store = useVariableStore();

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__executeAction = async (
      formula: string,
    ) => {
      try {
        await executeAction({ formula }, { store, engine, context });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    };
  }, [store, engine, context]);

  return null;
}

export const RuntimeProvider: React.FC<{
  appId: string;
  children: React.ReactNode;
  baseUrl?: string;
}> = ({ appId, children, baseUrl }) => {
  const [pkg, setPkg] = useState<AppPackage | undefined>();
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<string | undefined>(
    undefined,
  );
  const [variables] = useState<Record<string, any>>({});
  const [collections] = useState<Record<string, any[]>>({});

  const variableStoreRef = useRef(new InMemoryVariableStore());

  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__variableStore =
        variableStoreRef.current;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const url = `${baseUrl || ""}/api/v1/runtime/applications/${appId}`;
    setLoading(true);
    fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-Id": TENANT_ID,
      },
    })
      .then((res) => res.json())
      .then((body) => {
        if (!mounted) return;
        if (body && body.success && body.data) {
          setPkg(body.data);
          if (body.data.screens && body.data.screens.length > 0) {
            setCurrentScreen(body.data.screens[0].id);
          }
        } else if (body && body.data) {
          setPkg(body.data);
          if (body.data.screens && body.data.screens.length > 0) {
            setCurrentScreen(body.data.screens[0].id);
          }
        }
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [appId, baseUrl]);

  const navigate = (screenId: string) => {
    setCurrentScreen(screenId);
  };

  const screenControls = useMemo(() => {
    const screen = pkg?.screens?.find((item) => item.id === currentScreen);
    return screen?.controls ?? [];
  }, [pkg, currentScreen]);

  return (
    <FormulaProvider appName={pkg?.name} controls={screenControls} variableStore={variableStoreRef.current}>
      <DevActionRunner />
      <RuntimeContext.Provider
        value={{ pkg, loading, currentScreen, navigate, variables, collections }}
      >
        {children}
      </RuntimeContext.Provider>
    </FormulaProvider>
  );};
