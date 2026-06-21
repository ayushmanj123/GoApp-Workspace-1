import { create } from "zustand";
import { applicationsApi, type Application } from "../api/applications-api";
import { screensApi, type Screen } from "../api/screens-api";
import { controlsApi, type Control } from "../api/controls-api";
import { useStudioStore } from "./studioStore";

export interface ApplicationState {
  // Data
  applications: Application[];
  screens: Screen[];
  controls: Control[];

  // Selection
  selectedApplicationId: string | null;
  selectedScreenId: string | null;

  // Loading / error
  appsLoading: boolean;
  screensLoading: boolean;
  controlsLoading: boolean;
  appsError: string | null;
  screensError: string | null;
  controlsError: string | null;

  // Actions
  loadApplications: () => Promise<void>;
  loadScreens: (applicationId: string) => Promise<void>;
  loadControls: (screenId: string) => Promise<void>;
  selectApplication: (id: string) => void;
  selectScreen: (id: string) => void;
  updateControl: (
    controlId: string,
    updates: Partial<Pick<Control, "name" | "x" | "y" | "width" | "height" | "properties">>,
  ) => void;

  // CRUD
  createScreen: (applicationId: string, name: string) => Promise<Screen>;
  renameScreen: (screenId: string, name: string) => Promise<void>;
  deleteScreen: (screenId: string) => Promise<void>;
}

export const useApplicationStore = create<ApplicationState>((set, get) => ({
  applications: [],
  screens: [],
  controls: [],
  selectedApplicationId: null,
  selectedScreenId: null,
  appsLoading: false,
  screensLoading: false,
  controlsLoading: false,
  appsError: null,
  screensError: null,
  controlsError: null,

  loadApplications: async () => {
    set({ appsLoading: true, appsError: null });
    try {
      const data = await applicationsApi.list();
      set({ applications: data.items, appsLoading: false });
    } catch (err) {
      set({
        appsLoading: false,
        appsError:
          err instanceof Error ? err.message : "Failed to load applications",
      });
    }
  },

  loadScreens: async (applicationId: string) => {
    set({ screensLoading: true, screensError: null });
    try {
      const data = await screensApi.list(applicationId);
      set({ screens: data.items, screensLoading: false });
    } catch (err) {
      set({
        screensLoading: false,
        screensError:
          err instanceof Error ? err.message : "Failed to load screens",
      });
    }
  },

  selectApplication: (id: string) => {
    set({
      selectedApplicationId: id,
      selectedScreenId: null,
      screens: [],
      controls: [],
    });
    useStudioStore.getState().selectControl(null);
  },

  selectScreen: (id: string) => {
    set({ selectedScreenId: id, controls: [] });
    useStudioStore.getState().selectControl(null);
  },

  loadControls: async (screenId: string) => {
    set({ controlsLoading: true, controlsError: null });
    try {
      const data = await controlsApi.list(screenId);
      set({ controls: data.items, controlsLoading: false });
    } catch (err) {
      set({
        controlsLoading: false,
        controlsError:
          err instanceof Error ? err.message : "Failed to load controls",
      });
    }
  },

  updateControl: (controlId, updates) => {
    set((state) => ({
      controls: state.controls.map((control) => {
        if (control.id !== controlId) {
          return control;
        }

        const nextProperties =
          updates.properties === undefined
            ? control.properties
            : updates.properties === null
              ? null
              : {
                  ...(control.properties ?? {}),
                  ...updates.properties,
                };

        return {
          ...control,
          ...updates,
          properties: nextProperties,
        };
      }),
    }));
  },

  createScreen: async (applicationId: string, name: string) => {
    const existing = get().screens;
    const nextOrder =
      existing.length > 0
        ? Math.max(...existing.map((s) => s.display_order)) + 1
        : 1;

    const screen = await screensApi.create(applicationId, {
      name,
      display_order: nextOrder,
      layout_type: "responsive",
    });

    set((s) => ({ screens: [...s.screens, screen] }));
    return screen;
  },

  renameScreen: async (screenId: string, name: string) => {
    await screensApi.update(screenId, { name });
    set((s) => ({
      screens: s.screens.map((sc) =>
        sc.id === screenId ? { ...sc, name } : sc,
      ),
    }));
  },

  deleteScreen: async (screenId: string) => {
    await screensApi.delete(screenId);
    set((s) => {
      const screens = s.screens.filter((sc) => sc.id !== screenId);
      // If deleted screen was selected, fall back to first remaining
      const selectedScreenId =
        s.selectedScreenId === screenId
          ? (screens[0]?.id ?? null)
          : s.selectedScreenId;
      return { screens, selectedScreenId };
    });
    useStudioStore.getState().selectControl(null);
  },
}));
