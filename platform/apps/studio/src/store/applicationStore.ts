import { create } from "zustand";
import { applicationsApi, type Application } from "../api/applications-api";
import { screensApi, type Screen } from "../api/screens-api";
import { controlsApi, type Control } from "../api/controls-api";
import { propertiesApi } from "../api/properties-api";
import {
  componentDefinitionsApi,
  type ComponentDefinitionRecord,
} from "../api/component-definitions-api";
import {
  entitiesApi,
  type EntityFieldRecord,
  type EntityFieldType,
  type EntityRecord,
} from "../api/entities-api";
import {
  connectorsApi,
  type ConnectorRecord,
} from "../api/connectors-api";
import { TENANT_ID, ApiError } from "../api/metadata-client";
import {
  buildControlName,
  getControlDefaults,
  type ToolboxControlType,
} from "../control-defaults";
import { buildPropertiesPayload } from "../utils/control-properties";
import { resolveFormEntity, buildFormFieldControls } from "../utils/generate-form-fields";
import { computeLayerUpdates, type LayerAction } from "../utils/layer-actions";
import {
  computeComponentBounds,
  snapshotControlSubtree,
} from "../utils/component-definition";
import { createLocalControlId, isLocalControlId } from "../utils/control-ids";
import { withLockedProperty } from "../utils/control-lock";
import { buildUniqueScreenName, buildFallbackScreenName } from "../utils/screen-names";
import { useStudioStore } from "./studioStore";
import { useHistoryStore } from "./historyStore";

function pushControlHistory(controls: Control[]) {
  useHistoryStore.getState().pushSnapshot(controls);
}

export interface SaveScreenResult {
  success: boolean;
  errors: string[];
}

export interface ApplicationState {
  // Data
  applications: Application[];
  screens: Screen[];
  controls: Control[];
  componentDefinitions: ComponentDefinitionRecord[];
  entities: EntityRecord[];
  entityFieldsByEntityId: Record<string, EntityFieldRecord[]>;
  connectors: ConnectorRecord[];

  // Selection
  selectedApplicationId: string | null;
  selectedScreenId: string | null;
  selectedEntityId: string | null;

  // Loading / error
  appsLoading: boolean;
  screensLoading: boolean;
  createScreenLoading: boolean;
  controlsLoading: boolean;
  componentDefinitionsLoading: boolean;
  entitiesLoading: boolean;
  connectorsLoading: boolean;
  appsError: string | null;
  screensError: string | null;
  controlsError: string | null;

  // Actions
  loadApplications: () => Promise<void>;
  loadScreens: (applicationId: string) => Promise<void>;
  loadControls: (screenId: string) => Promise<void>;
  loadComponentDefinitions: (applicationId: string) => Promise<void>;
  loadEntities: (applicationId: string) => Promise<void>;
  loadConnectors: (applicationId: string) => Promise<void>;
  createEntity: (name: string, displayName: string) => Promise<void>;
  addEntityField: (
    entityId: string,
    name: string,
    displayName: string,
    fieldType: EntityFieldType,
  ) => Promise<void>;
  selectEntity: (entityId: string | null) => void;
  createComponentFromSelection: (controlId: string, name: string) => Promise<void>;
  insertComponentInstance: (definitionId: string) => void;
  saveScreen: () => Promise<SaveScreenResult>;
  selectApplication: (id: string) => void;
  selectScreen: (id: string) => void;
  updateControl: (
    controlId: string,
    updates: Partial<
      Pick<
        Control,
        "name" | "x" | "y" | "width" | "height" | "properties" | "parent_control_id"
      >
    >,
  ) => void;
  applyLayerAction: (controlId: string, action: LayerAction) => void;
  setControlLocked: (controlId: string, locked: boolean) => void;
  duplicateControl: (controlId: string) => string | null;
  updateScreenOnVisible: (screenId: string, onVisible: string) => void;
  createControl: (
    controlType: ToolboxControlType,
    options?: {
      parent_control_id?: string | null;
      x?: number;
      y?: number;
    },
  ) => void;
  generateFormFields: (formControlId: string) => void;
  deleteControl: (controlId: string) => Promise<void>;
  setControlsFromHistory: (controls: Control[]) => void;

  // CRUD
  createScreen: (applicationId: string, name?: string) => Promise<Screen>;
  renameScreen: (screenId: string, name: string) => Promise<void>;
  deleteScreen: (screenId: string) => Promise<void>;
}

export const useApplicationStore = create<ApplicationState>((set, get) => ({
  applications: [],
  screens: [],
  controls: [],
  componentDefinitions: [],
  entities: [],
  entityFieldsByEntityId: {},
  connectors: [],
  selectedApplicationId: null,
  selectedScreenId: null,
  selectedEntityId: null,
  appsLoading: false,
  screensLoading: false,
  createScreenLoading: false,
  controlsLoading: false,
  componentDefinitionsLoading: false,
  entitiesLoading: false,
  connectorsLoading: false,
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
      componentDefinitions: [],
      entities: [],
      entityFieldsByEntityId: {},
      connectors: [],
      selectedEntityId: null,
    });
    useStudioStore.getState().selectControl(null);
    useStudioStore.getState().setDirty(false);
    useStudioStore.getState().setSaveMessage(null);
    void get().loadComponentDefinitions(id);
    void get().loadEntities(id);
    void get().loadConnectors(id);
  },

  selectScreen: (id: string) => {
    set({ selectedScreenId: id, controls: [] });
    useStudioStore.getState().selectControl(null);
    useStudioStore.getState().setDirty(false);
    useStudioStore.getState().setSaveMessage(null);
  },

  loadControls: async (screenId: string) => {
    set({ controlsLoading: true, controlsError: null });
    try {
      const data = await controlsApi.list(screenId);
      const controlsWithProperties = await Promise.all(
        data.items.map(async (control) => {
          try {
            const properties = await propertiesApi.get(control.id);
            return { ...control, properties };
          } catch {
            return { ...control, properties: control.properties ?? null };
          }
        }),
      );
      set({ controls: controlsWithProperties, controlsLoading: false });
      useStudioStore.getState().setDirty(false);
      useStudioStore.getState().setSaveMessage(null);
    } catch (err) {
      set({
        controlsLoading: false,
        controlsError:
          err instanceof Error ? err.message : "Failed to load controls",
      });
    }
  },

  loadComponentDefinitions: async (applicationId) => {
    set({ componentDefinitionsLoading: true });
    try {
      const data = await componentDefinitionsApi.list(applicationId);
      set({
        componentDefinitions: data.items,
        componentDefinitionsLoading: false,
      });
    } catch {
      set({ componentDefinitionsLoading: false, componentDefinitions: [] });
    }
  },

  loadEntities: async (applicationId) => {
    set({ entitiesLoading: true });
    try {
      const data = await entitiesApi.list(applicationId);
      const fieldsByEntity: Record<string, EntityFieldRecord[]> = {};
      await Promise.all(
        data.items.map(async (entity) => {
          const fields = await entitiesApi.listFields(entity.id);
          fieldsByEntity[entity.id] = fields.items;
        }),
      );
      set({
        entities: data.items,
        entityFieldsByEntityId: fieldsByEntity,
        entitiesLoading: false,
      });
    } catch {
      set({ entitiesLoading: false, entities: [], entityFieldsByEntityId: {} });
    }
  },

  loadConnectors: async (applicationId) => {
    set({ connectorsLoading: true });
    try {
      const data = await connectorsApi.list(applicationId);
      set({
        connectors: data.items ?? [],
        connectorsLoading: false,
      });
    } catch {
      set({ connectorsLoading: false, connectors: [] });
    }
  },

  createEntity: async (name, displayName) => {
    const { selectedApplicationId } = get();
    if (!selectedApplicationId) {
      throw new Error("No application selected");
    }
    await entitiesApi.create(selectedApplicationId, { name, display_name: displayName });
    await get().loadEntities(selectedApplicationId);
  },

  addEntityField: async (entityId, name, displayName, fieldType) => {
    const { selectedApplicationId } = get();
    if (!selectedApplicationId) {
      throw new Error("No application selected");
    }
    await entitiesApi.createField(entityId, {
      name,
      display_name: displayName,
      field_type: fieldType,
    });
    await get().loadEntities(selectedApplicationId);
  },

  selectEntity: (entityId) => {
    set({ selectedEntityId: entityId });
  },

  createComponentFromSelection: async (controlId, name) => {
    const { controls, selectedApplicationId } = get();
    if (!selectedApplicationId) {
      return;
    }
    const snapshots = snapshotControlSubtree(controls, controlId);
    if (snapshots.length === 0) {
      return;
    }
    await componentDefinitionsApi.create(selectedApplicationId, {
      name,
      definition: { controls: snapshots },
    });
    await get().loadComponentDefinitions(selectedApplicationId);
  },

  insertComponentInstance: (definitionId) => {
    const { controls, selectedScreenId, componentDefinitions, selectedApplicationId } = get();
    if (!selectedScreenId) {
      return;
    }
    const definition = componentDefinitions.find((item) => item.id === definitionId);
    if (!definition) {
      return;
    }
    const bounds = computeComponentBounds(definition.definition_json?.controls ?? []);
    const nextZIndex =
      controls.length > 0
        ? Math.max(...controls.map((control) => control.z_index)) + 1
        : 1;
    const existingNames = controls.map((item) => item.name);
    let instanceName = definition.name;
    if (existingNames.includes(instanceName)) {
      let index = 2;
      while (existingNames.includes(`${definition.name}${index}`)) {
        index += 1;
      }
      instanceName = `${definition.name}${index}`;
    }
    const now = new Date().toISOString();
    const control: Control = {
      id: createLocalControlId(),
      tenant_id: TENANT_ID,
      screen_id: selectedScreenId,
      parent_control_id: null,
      control_type: "component",
      name: instanceName,
      x: 120,
      y: 120,
      width: bounds.width,
      height: bounds.height,
      z_index: nextZIndex,
      properties: {
        definition_id: { value: definition.id },
        definition_name: { value: definition.name },
      },
      deleted_at: null,
      CreatedOn: now,
      ModifiedOn: now,
    };
    set((state) => ({ controls: [...state.controls, control] }));
    useStudioStore.getState().selectControl(control.id);
    useStudioStore.getState().setDirty(true);
    useStudioStore.getState().setSaveMessage(null);
    if (selectedApplicationId) {
      void get().loadComponentDefinitions(selectedApplicationId);
    }
  },

  saveScreen: async () => {
    const { controls, selectedScreenId, screens } = get();
    if (!selectedScreenId) {
      return { success: false, errors: ["No screen selected"] };
    }

    const errors: string[] = [];
    const idReplacements = new Map<string, string>();
    const selectedControlId = useStudioStore.getState().selectedControlId;
    const currentScreen = screens.find((screen) => screen.id === selectedScreenId);
    const needsParentRemap: Array<{ controlId: string; parentLocalId: string }> = [];

    const orderedControls = [...controls].sort((a, b) => {
      const aHasParent = a.parent_control_id ? 1 : 0;
      const bHasParent = b.parent_control_id ? 1 : 0;
      return aHasParent - bHasParent;
    });

    for (const control of orderedControls) {
      let parentControlId: string | null = null;
      if (control.parent_control_id) {
        const remapped =
          idReplacements.get(control.parent_control_id) ?? control.parent_control_id;
        if (isLocalControlId(remapped)) {
          needsParentRemap.push({
            controlId: control.id,
            parentLocalId: control.parent_control_id,
          });
        } else {
          parentControlId = remapped;
        }
      }

      const payload = {
        name: control.name,
        control_type: control.control_type,
        x: control.x,
        y: control.y,
        width: control.width,
        height: control.height,
        z_index: control.z_index,
        parent_control_id: parentControlId,
      };

      try {
        if (isLocalControlId(control.id)) {
          const created = await controlsApi.create(selectedScreenId, payload);
          idReplacements.set(control.id, created.id);
        } else {
          await controlsApi.update(control.id, payload);
        }
      } catch (err) {
        errors.push(
          `${control.name}: ${err instanceof Error ? err.message : "control save failed"}`,
        );
        continue;
      }

      const propertiesPayload = buildPropertiesPayload(
        control.properties,
        control.control_type,
      );
      if (!propertiesPayload) {
        continue;
      }

      const targetId = idReplacements.get(control.id) ?? control.id;

      try {
        await propertiesApi.update(targetId, {
          properties: propertiesPayload,
        });
      } catch (err) {
        errors.push(
          `${control.name} properties: ${err instanceof Error ? err.message : "property update failed"}`,
        );
      }
    }

    for (const { controlId, parentLocalId } of needsParentRemap) {
      const targetId = idReplacements.get(controlId) ?? controlId;
      const parentId = idReplacements.get(parentLocalId);
      const control = controls.find((item) => item.id === controlId);
      if (!control || !parentId) {
        errors.push(`${control?.name ?? controlId}: parent control mapping failed`);
        continue;
      }

      try {
        await controlsApi.update(targetId, {
          name: control.name,
          control_type: control.control_type,
          x: control.x,
          y: control.y,
          width: control.width,
          height: control.height,
          z_index: control.z_index,
          parent_control_id: parentId,
        });
      } catch (err) {
        errors.push(
          `${control.name} parent: ${err instanceof Error ? err.message : "parent update failed"}`,
        );
      }
    }

    if (currentScreen && currentScreen.on_visible !== undefined) {
      try {
        await screensApi.update(selectedScreenId, {
          on_visible: currentScreen.on_visible ?? "",
        });
      } catch (err) {
        errors.push(
          `Screen OnVisible: ${err instanceof Error ? err.message : "screen save failed"}`,
        );
      }
    }

    if (errors.length === 0) {
      await get().loadControls(selectedScreenId);
      if (selectedControlId) {
        const nextSelectedId =
          idReplacements.get(selectedControlId) ?? selectedControlId;
        useStudioStore.getState().selectControl(nextSelectedId);
      }
      useStudioStore.getState().setDirty(false);
    }

    return { success: errors.length === 0, errors };
  },

  updateControl: (controlId, updates) => {
    pushControlHistory(get().controls);
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
    useStudioStore.getState().setDirty(true);
    useStudioStore.getState().setSaveMessage(null);
  },

  applyLayerAction: (controlId, action) => {
    const { controls } = get();
    const updates = computeLayerUpdates(controls, controlId, action);
    if (updates.size === 0) {
      return;
    }

    pushControlHistory(controls);

    set((state) => ({
      controls: state.controls.map((control) => {
        const nextZ = updates.get(control.id);
        if (nextZ === undefined) {
          return control;
        }
        return { ...control, z_index: nextZ };
      }),
    }));
    useStudioStore.getState().setDirty(true);
    useStudioStore.getState().setSaveMessage(null);
  },

  setControlLocked: (controlId, locked) => {
    const control = get().controls.find((item) => item.id === controlId);
    if (!control) {
      return;
    }
    pushControlHistory(get().controls);
    set((state) => ({
      controls: state.controls.map((item) =>
        item.id === controlId
          ? {
              ...item,
              properties: withLockedProperty(item.properties, locked),
            }
          : item,
      ),
    }));
    useStudioStore.getState().setDirty(true);
    useStudioStore.getState().setSaveMessage(null);
  },

  duplicateControl: (controlId) => {
    const { controls, selectedScreenId } = get();
    if (!selectedScreenId) {
      return null;
    }
    const source = controls.find((item) => item.id === controlId);
    if (!source) {
      return null;
    }

    pushControlHistory(controls);

    const siblings = controls.filter(
      (item) => item.parent_control_id === source.parent_control_id,
    );
    const nextZ =
      siblings.length > 0
        ? Math.max(...siblings.map((item) => item.z_index)) + 1
        : source.z_index + 1;
    const now = new Date().toISOString();
    const clone: Control = {
      ...source,
      id: createLocalControlId(),
      name: (() => {
        const existing = controls.map((item) => item.name);
        const base = `${source.name}_Copy`;
        if (!existing.includes(base)) {
          return base;
        }
        let index = 2;
        while (existing.includes(`${source.name}_Copy${index}`)) {
          index += 1;
        }
        return `${source.name}_Copy${index}`;
      })(),
      x: source.x + 16,
      y: source.y + 16,
      z_index: nextZ,
      properties: source.properties ? { ...source.properties } : null,
      deleted_at: null,
      CreatedOn: now,
      ModifiedOn: now,
    };

    set((state) => ({ controls: [...state.controls, clone] }));
    useStudioStore.getState().selectControl(clone.id);
    useStudioStore.getState().setDirty(true);
    useStudioStore.getState().setSaveMessage(null);
    return clone.id;
  },

  updateScreenOnVisible: (screenId, onVisible) => {
    set((state) => ({
      screens: state.screens.map((screen) =>
        screen.id === screenId ? { ...screen, on_visible: onVisible } : screen,
      ),
    }));
    useStudioStore.getState().setDirty(true);
    useStudioStore.getState().setSaveMessage(null);
  },

  createControl: (controlType, options) => {
    const { controls, selectedScreenId } = get();
    if (!selectedScreenId) {
      return;
    }

    pushControlHistory(controls);

    const defaults = getControlDefaults(controlType);
    const parentId = options?.parent_control_id ?? null;
    const siblingCount = parentId
      ? controls.filter((item) => item.parent_control_id === parentId).length
      : 0;
    const positionOffset = siblingCount * 24;
    const nextZIndex =
      controls.length > 0
        ? Math.max(...controls.map((control) => control.z_index)) + 1
        : 1;
    const now = new Date().toISOString();
    const control: Control = {
      id: createLocalControlId(),
      tenant_id: TENANT_ID,
      screen_id: selectedScreenId,
      parent_control_id: parentId,
      control_type: defaults.control_type,
      name: buildControlName(
        controlType,
        controls.map((item) => item.name),
      ),
      x:
        options?.x ??
        (parentId ? 12 + positionOffset : defaults.x + (controls.length % 5) * 24),
      y:
        options?.y ??
        (parentId ? 12 + positionOffset : defaults.y + (controls.length % 5) * 24),
      width: defaults.width,
      height: defaults.height,
      z_index: nextZIndex,
      properties: { ...defaults.properties },
      deleted_at: null,
      CreatedOn: now,
      ModifiedOn: now,
    };

    set((state) => ({ controls: [...state.controls, control] }));
    useStudioStore.getState().selectControl(control.id);
    useStudioStore.getState().setDirty(true);
    useStudioStore.getState().setSaveMessage(null);
  },

  generateFormFields: (formControlId) => {
    const { controls, entities, entityFieldsByEntityId } = get();
    const form = controls.find((item) => item.id === formControlId);
    if (!form) {
      return;
    }

    const entity = resolveFormEntity(form, entities);
    if (!entity) {
      return;
    }

    const fields = entityFieldsByEntityId[entity.id] ?? [];
    if (fields.length === 0) {
      return;
    }

    pushControlHistory(controls);

    const existingNames = controls.map((item) => item.name);
    let nextZIndex =
      controls.length > 0
        ? Math.max(...controls.map((control) => control.z_index)) + 1
        : 1;
    const now = new Date().toISOString();
    const generated = buildFormFieldControls({
      form,
      fields,
      entities,
      existingNames,
      nextZIndex,
      now,
    });

    const formUpdates: Partial<Control> = {};
    if (generated.requiredFormHeight > form.height) {
      formUpdates.height = generated.requiredFormHeight;
    }

    set((state) => ({
      controls: [
        ...state.controls.map((item) =>
          item.id === formControlId ? { ...item, ...formUpdates } : item,
        ),
        ...generated.controls,
      ],
    }));
    useStudioStore.getState().setDirty(true);
    useStudioStore.getState().setSaveMessage(null);
  },

  deleteControl: async (controlId) => {
    pushControlHistory(get().controls);

    if (!isLocalControlId(controlId)) {
      await controlsApi.delete(controlId);
    }

    set((state) => ({
      controls: state.controls.filter((control) => control.id !== controlId),
    }));

    if (useStudioStore.getState().selectedControlId === controlId) {
      useStudioStore.getState().selectControl(null);
    }
    useStudioStore.getState().setDirty(true);
    useStudioStore.getState().setSaveMessage(null);
  },

  setControlsFromHistory: (controls) => {
    set({ controls });
    useStudioStore.getState().setDirty(true);
  },

  createScreen: async (applicationId: string, name?: string) => {
    const existing = get().screens;
    const screenName = name ?? buildUniqueScreenName(existing);
    const nextOrder =
      existing.length > 0
        ? Math.max(...existing.map((s) => s.display_order)) + 1
        : 1;

    set({ createScreenLoading: true, screensError: null });

    const attemptCreate = async (candidateName: string) =>
      screensApi.create(applicationId, {
        name: candidateName,
        display_order: nextOrder,
        layout_type: "responsive",
      });

    const isDuplicateNameError = (err: unknown): boolean => {
      if (!(err instanceof ApiError)) return false;
      const msg = err.message.toLowerCase();
      return (
        err.status === 409 ||
        msg.includes("already exists") ||
        msg.includes("duplicate key") ||
        msg.includes("unique constraint")
      );
    };

    try {
      let screen;
      let candidateName = screenName;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          screen = await attemptCreate(candidateName);
          break;
        } catch (firstError) {
          if (isDuplicateNameError(firstError) && attempt < 2) {
            candidateName = buildFallbackScreenName();
            continue;
          }
          throw firstError;
        }
      }
      if (!screen) {
        throw new Error("Failed to create screen");
      }

      set((s) => ({
        screens: [...s.screens, screen],
        createScreenLoading: false,
      }));
      return screen;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create screen";
      set({ createScreenLoading: false, screensError: message });
      throw err;
    }
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
