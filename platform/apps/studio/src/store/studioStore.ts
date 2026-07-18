import { create } from "zustand";
import { useInteractionStore } from "../canvas/interaction/interactionStore";

export type NavRailItem =
  | "explorer"
  | "insert"
  | "assets"
  | "variables"
  | "data"
  | "themes"
  | "plugins"
  | "ai";

export type PropertyTab = "style" | "data" | "actions";
export type ExplorerTab = "pages" | "components";
export type ConsoleTab = "logs" | "console" | "network" | "ai";

export interface FormulaBarContext {
  propertyLabel: string;
  propertyKey: string;
  formula: string;
  validationMode: "expression" | "action";
  onSave: (formula: string) => void;
}

export interface StudioState {
  explorerCollapsed: boolean;
  propertiesCollapsed: boolean;
  sidePanelOpen: boolean;
  activeNavItem: NavRailItem;
  explorerTab: ExplorerTab;
  propertyTab: PropertyTab;
  consoleTab: ConsoleTab;

  activeAppId: string | null;
  activeScreenId: string | null;
  selectedControlId: string | null;

  appName: string;
  screenName: string;

  zoom: number;
  dirty: boolean;
  saving: boolean;
  saveMessage: string | null;

  commandPaletteOpen: boolean;
  formulaBarContext: FormulaBarContext | null;
  formulaBarExpanded: boolean;
  formulaCursor: { line: number; column: number };

  toggleExplorer: () => void;
  toggleProperties: () => void;
  setSidePanelOpen: (open: boolean) => void;
  setActiveNavItem: (item: NavRailItem) => void;
  setExplorerTab: (tab: ExplorerTab) => void;
  setPropertyTab: (tab: PropertyTab) => void;
  setConsoleTab: (tab: ConsoleTab) => void;
  setActiveApp: (appId: string, appName: string) => void;
  setActiveScreen: (screenId: string, screenName: string) => void;
  selectControl: (controlId: string | null) => void;
  setZoom: (zoom: number) => void;
  setDirty: (dirty: boolean) => void;
  setSaving: (saving: boolean) => void;
  setSaveMessage: (message: string | null) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setFormulaBarContext: (context: FormulaBarContext | null) => void;
  setFormulaBarExpanded: (expanded: boolean) => void;
  setFormulaCursor: (cursor: { line: number; column: number }) => void;
}

export const useStudioStore = create<StudioState>((set) => ({
  explorerCollapsed: false,
  propertiesCollapsed: false,
  sidePanelOpen: true,
  activeNavItem: "explorer",
  explorerTab: "pages",
  propertyTab: "style",
  consoleTab: "console",

  activeAppId: null,
  activeScreenId: null,
  selectedControlId: null,
  appName: "Untitled Application",
  screenName: "Screen1",
  zoom: 100,
  dirty: false,
  saving: false,
  saveMessage: null,

  commandPaletteOpen: false,
  formulaBarContext: null,
  formulaBarExpanded: false,
  formulaCursor: { line: 1, column: 1 },

  toggleExplorer: () =>
    set((s) => ({ explorerCollapsed: !s.explorerCollapsed })),

  toggleProperties: () =>
    set((s) => ({ propertiesCollapsed: !s.propertiesCollapsed })),

  setSidePanelOpen: (open) => set({ sidePanelOpen: open }),

  setActiveNavItem: (item) =>
    set({ activeNavItem: item, sidePanelOpen: true }),

  setExplorerTab: (tab) => set({ explorerTab: tab }),

  setPropertyTab: (tab) => set({ propertyTab: tab }),

  setConsoleTab: (tab) => set({ consoleTab: tab }),

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

  setZoom: (zoom) => set({ zoom: Math.min(200, Math.max(25, zoom)) }),

  setDirty: (dirty) => set({ dirty }),

  setSaving: (saving) => set({ saving }),

  setSaveMessage: (saveMessage) => set({ saveMessage }),

  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  setFormulaBarContext: (context) => set({ formulaBarContext: context }),

  setFormulaBarExpanded: (expanded) => set({ formulaBarExpanded: expanded }),

  setFormulaCursor: (cursor) => set({ formulaCursor: cursor }),
}));
