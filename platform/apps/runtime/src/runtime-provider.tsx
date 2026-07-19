import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AppPackage } from "./runtime-types";
import { createDefaultFormulaEngine } from "@goapps/formula";
import {
  FormulaProvider,
  useFormulaEngine,
  useFormulaEvaluationContext,
  useVariableStore,
  useScreenContextStore,
  useCollectionStore,
  useGallerySelectionStore,
  useFormUpdatesStore,
  useRecordStore,
} from "./formula/formula-context";
import { InMemoryVariableStore } from "./formula/runtime-variable-store";
import { InMemoryScreenContextStore } from "./formula/runtime-screen-context-store";
import { InMemoryCollectionStore } from "./formula/runtime-collection-store";
import { InMemoryGallerySelectionStore } from "./formula/runtime-gallery-selection-store";
import { InMemoryFormUpdatesStore } from "./formula/runtime-form-updates-store";
import { InMemoryRecordStore } from "./formula/runtime-record-store";
import { InMemoryControlValueStore } from "./formula/runtime-control-value-store";
import { hydrateSessionContext } from "./formula/hydrate-session-context";
import { RuntimeSessionFormulaEngine } from "./formula/runtime-session-formula-engine";
import {
  InMemoryNavigationStore,
  type RuntimeNavigationStore,
} from "./formula/runtime-navigation-store";
import { executeAction } from "./formula/execute-action";
import { syncServerScreenVisible } from "./formula/execute-runtime-action";
import {
  fetchRenderedScreen,
  startRuntimeSession,
} from "./runtime-session-client";
import { authHeaders } from "./auth/session";
import { mergeRenderIntoPackage } from "./utils/merge-render-package";

const NavigationStoreContext = createContext<RuntimeNavigationStore | null>(
  null,
);
const ScreenResolverContext = createContext<
  ((name: string) => string | undefined) | null
>(null);

export interface RuntimeContextValue {
  pkg?: AppPackage;
  loading: boolean;
  currentScreen?: string;
  navigate: (screenId: string, options?: { preserveState?: boolean }) => void;
  variables: Record<string, any>;
  collections: Record<string, any[]>;
  renderLoading: boolean;
  runtimeUnavailable: boolean;
  appId?: string;
  sessionId?: string;
  currentScreenName?: string;
  navigateFromServer?: (screenName: string) => void;
}

export const RuntimeContext = createContext<RuntimeContextValue>({
  loading: true,
  navigate: () => {},
  variables: {},
  collections: {},
  renderLoading: false,
  runtimeUnavailable: false,
});

function ActionRunner({
  navigationStore,
  resolveScreenId,
  pkg,
  sessionId,
  runtimeUnavailable,
  sessionInitComplete,
}: {
  navigationStore: RuntimeNavigationStore;
  resolveScreenId: (name: string) => string | undefined;
  pkg: AppPackage | undefined;
  sessionId?: string;
  runtimeUnavailable: boolean;
  sessionInitComplete: boolean;
}) {
  const engine = useFormulaEngine();
  const context = useFormulaEvaluationContext();
  const store = useVariableStore();
  const screenContextStore = useScreenContextStore();
  const collectionStore = useCollectionStore();
  const gallerySelectionStore = useGallerySelectionStore();
  const formUpdatesStore = useFormUpdatesStore();
  const recordStore = useRecordStore();

  // Keep mutable refs so nav-store subscription always sees the latest values.
  const pkgRef = useRef(pkg);
  pkgRef.current = pkg;
  const currentScreenId = navigationStore.getCurrentScreenId();
  const currentControls =
    pkg?.screens?.find((screen) => screen.id === currentScreenId)?.controls ??
    [];
  const servicesRef = useRef({
    store,
    screenContextStore,
    collectionStore,
    formUpdatesStore,
    recordStore,
    controls: currentControls,
    gallerySelectionStore,
    navigationStore,
    resolveScreenId,
    engine,
    context,
  });
  servicesRef.current = {
    store,
    screenContextStore,
    collectionStore,
    formUpdatesStore,
    recordStore,
    controls: currentControls,
    gallerySelectionStore,
    navigationStore,
    resolveScreenId,
    engine,
    context,
  };

  // Tracks the last screenId for which OnVisible was attempted (pkg was available).
  const lastOnVisibleScreenRef = useRef<string | undefined>(undefined);
  const onStartExecutedRef = useRef(false);
  const onStartCompletedRef = useRef(false);
  const sessionIdRef = useRef(sessionId);
  const runtimeUnavailableRef = useRef(runtimeUnavailable);
  sessionIdRef.current = sessionId;
  runtimeUnavailableRef.current = runtimeUnavailable;

  function runOnVisible(screenId: string, screens: AppPackage["screens"]) {
    if (sessionIdRef.current && !runtimeUnavailableRef.current) {
      return;
    }
    const screen = screens?.find((s) => s.id === screenId);
    const formula = screen?.on_visible?.trim();
    if (formula) {
      executeAction({ formula }, servicesRef.current).catch((err) => {
        console.error("[OnVisible Error]", err);
      });
    }
  }

  function runInitialOnVisible(screens: AppPackage["screens"]) {
    const screenId = navigationStore.getCurrentScreenId();
    if (!screenId) return;
    lastOnVisibleScreenRef.current = screenId;
    runOnVisible(screenId, screens);
  }

  // App.OnStart runs once per package load, before the initial Screen.OnVisible.
  useEffect(() => {
    if (!pkg || !sessionInitComplete || onStartExecutedRef.current) return;
    onStartExecutedRef.current = true;

    if (sessionId && !runtimeUnavailable) {
      onStartCompletedRef.current = true;
      return;
    }

    const formula = pkg.on_start?.trim();
    if (formula) {
      void executeAction({ formula }, servicesRef.current)
        .catch((err) => {
          console.error("[OnStart Error]", err);
        })
        .finally(() => {
          onStartCompletedRef.current = true;
          runInitialOnVisible(pkg.screens);
        });
      return;
    }

    onStartCompletedRef.current = true;
    runInitialOnVisible(pkg.screens);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkg, sessionInitComplete, sessionId, runtimeUnavailable]);

  // Subscribe to every navigate() call after OnStart has completed.
  useEffect(() => {
    return navigationStore.subscribe(() => {
      const screenId = navigationStore.getCurrentScreenId();
      if (!screenId || !pkgRef.current || !onStartCompletedRef.current) return;
      lastOnVisibleScreenRef.current = screenId;
      runOnVisible(screenId, pkgRef.current.screens);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationStore]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__executeAction = async (
      formula: string,
    ) => {
      try {
        await executeAction({ formula }, servicesRef.current);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    };
    (window as unknown as Record<string, unknown>).__getCurrentScreenId = () =>
      navigationStore.getCurrentScreenId();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationStore]);

  return null;
}

export const RuntimeProvider: React.FC<{
  appId: string;
  children: React.ReactNode;
  baseUrl?: string;
  channel?: "draft" | "published";
  environmentId?: string;
}> = ({ appId, children, baseUrl, channel = "published", environmentId }) => {
  const [pkg, setPkg] = useState<AppPackage | undefined>();
  const [renderedPkg, setRenderedPkg] = useState<AppPackage | undefined>();
  const [loading, setLoading] = useState(true);
  const [renderLoading, setRenderLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [sessionInitComplete, setSessionInitComplete] = useState(false);
  const [runtimeUnavailable, setRuntimeUnavailable] = useState(false);
  const [navTick, setNavTick] = useState(0);
  const [variables] = useState<Record<string, any>>({});

  const variableStoreRef = useRef(new InMemoryVariableStore({}));
  const screenContextStoreRef = useRef(new InMemoryScreenContextStore());
  const collectionStoreRef = useRef(new InMemoryCollectionStore());
  const gallerySelectionStoreRef = useRef(new InMemoryGallerySelectionStore());
  const formUpdatesStoreRef = useRef(new InMemoryFormUpdatesStore());
  const recordStoreRef = useRef(new InMemoryRecordStore());
  const controlValueStoreRef = useRef(new InMemoryControlValueStore());
  const navigationStoreRef = useRef(new InMemoryNavigationStore());
  const sessionBindingRef = useRef({
    appId,
    sessionId: undefined as string | undefined,
    screenName: "",
  });
  const fallbackFormulaEngine = useMemo(() => createDefaultFormulaEngine(), []);
  const sessionFormulaEngineRef = useRef(
    new RuntimeSessionFormulaEngine(() => ({
      appId: sessionBindingRef.current.appId,
      sessionId: sessionBindingRef.current.sessionId ?? "",
      screen: sessionBindingRef.current.screenName,
    })),
  );

  useEffect(() => {
    return navigationStoreRef.current.subscribe(() => setNavTick((v) => v + 1));
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__variableStore =
        variableStoreRef.current;
      (window as unknown as Record<string, unknown>).__screenContextStore =
        screenContextStoreRef.current;
      (window as unknown as Record<string, unknown>).__navigationStore =
        navigationStoreRef.current;
      (window as unknown as Record<string, unknown>).__collectionStore =
        collectionStoreRef.current;
      (window as unknown as Record<string, unknown>).__gallerySelectionStore =
        gallerySelectionStoreRef.current;
      (window as unknown as Record<string, unknown>).__formUpdatesStore =
        formUpdatesStoreRef.current;
      (window as unknown as Record<string, unknown>).__recordStore =
        recordStoreRef.current;
      (window as unknown as Record<string, unknown>).__controlValueStore =
        controlValueStoreRef.current;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const query = new URLSearchParams();
    if (environmentId) {
      query.set("environmentId", environmentId);
    } else if (channel === "draft") {
      query.set("channel", "draft");
    }
    const qs = query.toString();
    const url = `${baseUrl || ""}/api/v1/runtime/applications/${appId}${qs ? `?${qs}` : ""}`;
    setLoading(true);
    setRuntimeUnavailable(false);
    setSessionId(undefined);
    setSessionInitComplete(false);
    fetch(url, {
      headers: authHeaders(),
      cache: "no-store",
    })
      .then((res) => res.json())
      .then(async (body) => {
        if (!mounted) return;
        const data = body?.success ? body.data : body?.data;
        if (data) {
          setPkg(data);
          if (data.screens?.length > 0) {
            navigationStoreRef.current.navigate(data.screens[0].id);
          }
          const firstScreen = data.screens?.[0];
          const sessionChannel = environmentId ? "published" : channel;
          const session = await startRuntimeSession(
            appId,
            firstScreen?.name ?? firstScreen?.id ?? "",
            sessionChannel,
            environmentId,
          );
          if (mounted) {
            setSessionId(session);
            if (!session) {
              setRuntimeUnavailable(true);
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) {
          setLoading(false);
          setSessionInitComplete(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, [appId, baseUrl, channel, environmentId]);

  const resolveScreenId = useCallback(
    (name: string) => pkg?.screens?.find((screen) => screen.name === name)?.id,
    [pkg],
  );

  const navigate = useCallback((screenId: string, options?: { preserveState?: boolean }) => {
    if (!options?.preserveState) {
      screenContextStoreRef.current.clear();
      gallerySelectionStoreRef.current.clear();
      formUpdatesStoreRef.current.clear();
      controlValueStoreRef.current.clear();
    }
    navigationStoreRef.current.navigate(screenId);
  }, []);

  const navigateFromServer = useCallback(
    (screenName: string) => {
      const screenId = pkg?.screens?.find((screen) => screen.name === screenName)?.id;
      if (screenId) {
        navigate(screenId, { preserveState: true });
      }
    },
    [pkg, navigate],
  );

  const currentScreen = navigationStoreRef.current.getCurrentScreenId();
  const currentScreenName = pkg?.screens?.find((item) => item.id === currentScreen)?.name;
  void navTick;

  useEffect(() => {
    if (!sessionId || !pkg || runtimeUnavailable || !currentScreenName) {
      return;
    }
    void syncServerScreenVisible(
      { appId, sessionId, screen: sessionBindingRef.current.screenName },
      currentScreenName,
    )
      .then((serverScreen) => {
        if (serverScreen) {
          sessionBindingRef.current.screenName = serverScreen;
        }
        void hydrateSessionContext({
          appId,
          sessionId,
          screen: serverScreen ?? currentScreenName,
          entityNames: pkg.entities?.map((entity) => entity.name) ?? [],
          variableStore: variableStoreRef.current,
          collectionStore: collectionStoreRef.current,
        });
      })
      .catch(() => {});
  }, [sessionId, pkg, appId, currentScreen, currentScreenName, runtimeUnavailable]);

  useEffect(() => {
    const screen = pkg?.screens?.find((item) => item.id === currentScreen);
    sessionBindingRef.current = {
      appId,
      sessionId,
      screenName: screen?.name ?? screen?.id ?? "",
    };
  }, [appId, sessionId, pkg, currentScreen, navTick]);

  const formulaEngine =
    sessionId && !runtimeUnavailable
      ? sessionFormulaEngineRef.current
      : fallbackFormulaEngine;

  useEffect(() => {
    if (!pkg || !currentScreen) {
      setRenderedPkg(pkg);
      return;
    }
    let cancelled = false;
    setRenderLoading(true);
    const screen = pkg.screens?.find((item) => item.id === currentScreen);
    const loadRender = async () => {
      let activeSession = sessionId;
      if (!activeSession) {
        activeSession = await startRuntimeSession(
          appId,
          screen?.name ?? currentScreen,
          channel,
          environmentId,
        );
        if (!cancelled && activeSession) {
          setSessionId(activeSession);
        }
      }
      if (!activeSession) {
        if (!cancelled) {
          setRenderedPkg(pkg);
          setRenderLoading(false);
          setRuntimeUnavailable(true);
        }
        return;
      }
      setRuntimeUnavailable(false);
      const render = await fetchRenderedScreen(activeSession, currentScreen);
      if (!cancelled) {
        setRenderedPkg(mergeRenderIntoPackage(pkg, currentScreen, render));
        setRenderLoading(false);
      }
    };
    void loadRender();
    return () => {
      cancelled = true;
    };
  }, [pkg, currentScreen, sessionId, appId, channel, environmentId]);

  const activePackage = renderedPkg ?? pkg;

  const screenControls = useMemo(() => {
    const screen = activePackage?.screens?.find((item) => item.id === currentScreen);
    return screen?.controls ?? [];
  }, [activePackage, currentScreen]);

  return (
    <FormulaProvider
      engine={formulaEngine}
      appName={pkg?.name}
      controls={screenControls}
      variableStore={variableStoreRef.current}
      screenContextStore={screenContextStoreRef.current}
      collectionStore={collectionStoreRef.current}
      gallerySelectionStore={gallerySelectionStoreRef.current}
      formUpdatesStore={formUpdatesStoreRef.current}
      recordStore={recordStoreRef.current}
      controlValueStore={controlValueStoreRef.current}
    >
      <NavigationStoreContext.Provider value={navigationStoreRef.current}>
        <ScreenResolverContext.Provider value={resolveScreenId}>
          <ActionRunner
            key={appId}
            navigationStore={navigationStoreRef.current}
            resolveScreenId={resolveScreenId}
            pkg={activePackage}
            sessionId={sessionId}
            runtimeUnavailable={runtimeUnavailable}
            sessionInitComplete={sessionInitComplete}
          />
          <RuntimeContext.Provider
            value={{
              pkg: activePackage,
              loading: loading || renderLoading,
              currentScreen,
              navigate,
              variables,
              collections: collectionStoreRef.current.getAll(),
              renderLoading,
              runtimeUnavailable,
              appId,
              sessionId,
              currentScreenName,
              navigateFromServer,
            }}
          >
            {children}
          </RuntimeContext.Provider>
        </ScreenResolverContext.Provider>
      </NavigationStoreContext.Provider>
    </FormulaProvider>
  );
};

export function useNavigationStore(): RuntimeNavigationStore | null {
  return useContext(NavigationStoreContext);
}

export function useScreenResolver():
  | ((name: string) => string | undefined)
  | null {
  return useContext(ScreenResolverContext);
}
