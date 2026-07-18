import { create } from "zustand";
import type { Control } from "../api/controls-api";

interface HistorySnapshot {
  controls: Control[];
}

interface HistoryState {
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  canUndo: boolean;
  canRedo: boolean;
  pushSnapshot: (controls: Control[]) => void;
  undo: (currentControls: Control[]) => Control[] | null;
  redo: (currentControls: Control[]) => Control[] | null;
  clear: () => void;
}

const MAX_HISTORY = 50;

function cloneControls(controls: Control[]): Control[] {
  return JSON.parse(JSON.stringify(controls)) as Control[];
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,

  pushSnapshot: (controls) => {
    set((state) => {
      const snapshot = { controls: cloneControls(controls) };
      const past = [...state.past, snapshot].slice(-MAX_HISTORY);
      return { past, future: [], canUndo: past.length > 0, canRedo: false };
    });
  },

  undo: (currentControls) => {
    const { past, future } = get();
    if (past.length === 0) {
      return null;
    }
    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);
    const currentSnapshot = { controls: cloneControls(currentControls) };
    set({
      past: newPast,
      future: [currentSnapshot, ...future],
      canUndo: newPast.length > 0,
      canRedo: true,
    });
    return previous.controls;
  },

  redo: (currentControls) => {
    const { past, future } = get();
    if (future.length === 0) {
      return null;
    }
    const next = future[0];
    const newFuture = future.slice(1);
    const currentSnapshot = { controls: cloneControls(currentControls) };
    set({
      past: [...past, currentSnapshot],
      future: newFuture,
      canUndo: true,
      canRedo: newFuture.length > 0,
    });
    return next.controls;
  },

  clear: () => set({ past: [], future: [], canUndo: false, canRedo: false }),
}));
