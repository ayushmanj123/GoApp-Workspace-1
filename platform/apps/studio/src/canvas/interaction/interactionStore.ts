import { create } from "zustand";

export type InteractionTool = "select" | "pan" | "marquee";

export type ResizeHandle =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-right"
  | "bottom-right"
  | "bottom-center"
  | "bottom-left"
  | "middle-left";

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface InteractionState {
  activeScreenId: string | null;

  selectedControlIds: string[];
  primaryControlId: string | null;
  hoveredControlId: string | null;

  draggingControlId: string | null;
  dragOrigin: Point | null;
  dragStartPointer: Point | null;

  resizingControlId: string | null;
  resizeHandle: ResizeHandle | null;

  activeTool: InteractionTool;
  marqueeRect: Rect | null;

  /** Container being edited (gallery/form/component) — children selectable on canvas */
  containerEditId: string | null;

  /** Container under pointer during toolbox HTML5 drag or control reparent drag */
  dropTargetControlId: string | null;

  alignmentGuides: { orientation: "h" | "v"; position: number }[];

  setActiveScreen: (screenId: string | null) => void;
  select: (controlId: string, opts?: { additive?: boolean }) => void;
  selectMany: (controlIds: string[]) => void;
  clearSelection: () => void;
  setHovered: (controlId: string | null) => void;
  setDropTarget: (controlId: string | null) => void;
  beginDrag: (controlId: string, pointer: Point, origin: Point) => void;
  updateDrag: (pointer: Point) => void;
  endDrag: () => void;
  beginResize: (controlId: string, handle: ResizeHandle) => void;
  endResize: () => void;
  setMarquee: (rect: Rect | null) => void;
  enterContainerEdit: (containerId: string) => void;
  exitContainerEdit: () => void;
  setAlignmentGuides: (guides: { orientation: "h" | "v"; position: number }[]) => void;
}

export const useInteractionStore = create<InteractionState>((set, get) => ({
  activeScreenId: null,
  selectedControlIds: [],
  primaryControlId: null,
  hoveredControlId: null,
  draggingControlId: null,
  dragOrigin: null,
  dragStartPointer: null,
  resizingControlId: null,
  resizeHandle: null,
  activeTool: "select",
  marqueeRect: null,
  containerEditId: null,
  dropTargetControlId: null,
  alignmentGuides: [],

  setActiveScreen: (screenId) => set({ activeScreenId: screenId }),

  select: (controlId, opts) => {
    const additive = opts?.additive ?? false;
    if (additive) {
      const current = get().selectedControlIds;
      const next = current.includes(controlId)
        ? current.filter((id) => id !== controlId)
        : [...current, controlId];
      set({
        selectedControlIds: next,
        primaryControlId: controlId,
      });
    } else {
      set({
        selectedControlIds: [controlId],
        primaryControlId: controlId,
      });
    }
  },

  selectMany: (controlIds) => {
    set({
      selectedControlIds: controlIds,
      primaryControlId: controlIds[0] ?? null,
    });
  },

  clearSelection: () =>
    set({
      selectedControlIds: [],
      primaryControlId: null,
    }),

  setHovered: (controlId) => set({ hoveredControlId: controlId }),

  setDropTarget: (controlId) => set({ dropTargetControlId: controlId }),

  beginDrag: (controlId, pointer, origin) =>
    set({
      draggingControlId: controlId,
      dragStartPointer: pointer,
      dragOrigin: origin,
    }),

  updateDrag: () => {
    /* delta computed by InteractionManager from pointer */
  },

  endDrag: () =>
    set({
      draggingControlId: null,
      dragOrigin: null,
      dragStartPointer: null,
      dropTargetControlId: null,
      alignmentGuides: [],
    }),

  beginResize: (controlId, handle) =>
    set({ resizingControlId: controlId, resizeHandle: handle }),

  endResize: () =>
    set({
      resizingControlId: null,
      resizeHandle: null,
      alignmentGuides: [],
    }),

  setMarquee: (rect) => set({ marqueeRect: rect }),

  enterContainerEdit: (containerId) =>
    set({
      containerEditId: containerId,
      selectedControlIds: [containerId],
      primaryControlId: containerId,
    }),

  exitContainerEdit: () => set({ containerEditId: null }),

  setAlignmentGuides: (guides) => set({ alignmentGuides: guides }),
}));

/** Primary selected control id (backward compatible with studioStore.selectedControlId). */
export function getPrimarySelectedId(): string | null {
  return useInteractionStore.getState().primaryControlId;
}
