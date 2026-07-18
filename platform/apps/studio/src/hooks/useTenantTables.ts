import { useCallback, useEffect, useMemo, useState } from "react";
import { applicationsApi } from "../api/applications-api";
import {
  entitiesApi,
  type EntityFieldRecord,
  type EntityRecord,
} from "../api/entities-api";

export interface TenantTable extends EntityRecord {
  application_name: string;
}

export function useTenantTables() {
  const [tables, setTables] = useState<TenantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldsByEntityId, setFieldsByEntityId] = useState<
    Record<string, EntityFieldRecord[]>
  >({});
  const [fieldsLoading, setFieldsLoading] = useState<Record<string, boolean>>({});

  const loadTables = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apps = await applicationsApi.list();
      const results = await Promise.all(
        apps.items.map(async (app) => {
          const data = await entitiesApi.list(app.id);
          return data.items.map((entity) => ({
            ...entity,
            application_name: app.name,
          }));
        }),
      );
      setTables(results.flat());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tables");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFields = useCallback(async (entityId: string) => {
    setFieldsLoading((prev) => ({ ...prev, [entityId]: true }));
    try {
      const data = await entitiesApi.listFields(entityId);
      setFieldsByEntityId((prev) => ({ ...prev, [entityId]: data.items }));
    } catch {
      setFieldsByEntityId((prev) => ({ ...prev, [entityId]: [] }));
    } finally {
      setFieldsLoading((prev) => ({ ...prev, [entityId]: false }));
    }
  }, []);

  const refreshFields = useCallback(async (entityId: string) => {
    setFieldsLoading((prev) => ({ ...prev, [entityId]: true }));
    try {
      const data = await entitiesApi.listFields(entityId);
      setFieldsByEntityId((prev) => ({ ...prev, [entityId]: data.items }));
    } finally {
      setFieldsLoading((prev) => ({ ...prev, [entityId]: false }));
    }
  }, []);

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

  const getTable = useCallback(
    (entityId: string) => tables.find((t) => t.id === entityId),
    [tables],
  );

  return useMemo(
    () => ({
      tables,
      loading,
      error,
      fieldsByEntityId,
      fieldsLoading,
      loadTables,
      loadFields,
      refreshFields,
      getTable,
    }),
    [
      tables,
      loading,
      error,
      fieldsByEntityId,
      fieldsLoading,
      loadTables,
      loadFields,
      refreshFields,
      getTable,
    ],
  );
}
