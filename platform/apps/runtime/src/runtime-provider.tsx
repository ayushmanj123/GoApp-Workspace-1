import React, { createContext, useEffect, useMemo, useState } from "react";
import type { AppPackage } from "./runtime-types";
import { FormulaProvider } from "./formula/formula-context";
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
    <FormulaProvider appName={pkg?.name} controls={screenControls}>
      <RuntimeContext.Provider
        value={{ pkg, loading, currentScreen, navigate, variables, collections }}
      >
        {children}
      </RuntimeContext.Provider>
    </FormulaProvider>
  );};
