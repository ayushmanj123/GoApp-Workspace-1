import { create } from "zustand";
import { useInteractionStore } from "../canvas/interaction/interactionStore";

export interface StudioState {
  // Panel visibility
  explorerCollapsed: boolean;
  propertiesCollapsed: boolean;

  // Selection state
  activeAppId: string | null;
  activeScreenId: string | null;
  selectedControlId: string | null;

  // App display meta
  appName: string;
  screenName: string;

  // Zoom
  zoom: number;

  // Persistence UI state
  dirty: boolean;
  saving: boolean;
  saveMessage: string | null;

  // Actions
  toggleExplorer: () => void;
  toggleProperties: () => void;
  setActiveApp: (appId: string, appName: string) => void;
  setActiveScreen: (screenId: string, screenName: string) => void;
  selectControl: (controlId: string | null) => void;
  setZoom: (zoom: number) => void;
  setDirty: (dirty: boolean) => void;
  setSaving: (saving: boolean) => void;
  setSaveMessage: (message: string | null) => void;
}

export const useStudioStore = create<StudioState>((set) => ({
  explorerCollapsed: false,
  propertiesCollapsed: false,
  activeAppId: null,
  activeScreenId: null,
  selectedControlId: null,
  appName: "Untitled Application",
  screenName: "Screen1",
  zoom: 100,
  dirty: false,
  saving: false,
  saveMessage: null,

  toggleExplorer: () =>
    set((s) => ({ explorerCollapsed: !s.explorerCollapsed })),

  toggleProperties: () =>
    set((s) => ({ propertiesCollapsed: !s.propertiesCollapsed })),

  setActiveApp: (appId, appName) => set({ activeAppId: appId, appName }),

  setActiveScreen: (screenId, screenName) => {
    const interaction = useInteractionStore.getState();
    interaction.clearSelection();
    interaction.exitContainerEdit();
    interaction.setActiveScreen(screenId);
    set({ activeScreenId: screenId, screenName, selectedControlId: null });
  },

  selectControl: (controlId) => {
    const interaction = useInteractionStore.getState();
    if (controlId) {
      interaction.select(controlId);
    } else {
      interaction.clearSelection();
    }
    set({ selectedControlId: controlId });
  },

  setZoom: (zoom) => set({ zoom }),

  setDirty: (dirty) => set({ dirty }),

  setSaving: (saving) => set({ saving }),

  setSaveMessage: (saveMessage) => set({ saveMessage }),
}));
