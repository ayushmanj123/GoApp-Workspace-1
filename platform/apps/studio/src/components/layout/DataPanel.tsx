import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useStudioStore } from "../../store/studioStore";
import { useApplicationStore } from "../../store/applicationStore";
import {
  googleSheetsConnectorReady,
  isGoogleSheetsConnector,
} from "../../utils/google-sheets-columns";
import { CreateEntityModal } from "./CreateEntityModal";
import { AddFieldModal } from "./AddFieldModal";
import styles from "./DataPanel.module.css";

const ChevronLeftIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export function DataPanel() {
  const { applicationId: routeAppId } = useParams<{ applicationId?: string }>();
  const collapsed = useStudioStore((s) => s.explorerCollapsed);
  const toggleExplorer = useStudioStore((s) => s.toggleExplorer);

  const {
    entities,
    entitiesLoading,
    entitiesError,
    entityFieldsByEntityId,
    connectors,
    connectorsLoading,
    connectorsError,
    sheetColumnsByConnectorId,
    sheetColumnsErrorByConnectorId,
    sheetColumnsLoadingByConnectorId,
    selectedEntityId,
    selectedApplicationId,
    selectEntity,
    loadEntities,
    loadConnectors,
    loadSheetColumns,
  } = useApplicationStore();

  const [createEntityOpen, setCreateEntityOpen] = useState(false);
  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const [expandedConnectorId, setExpandedConnectorId] = useState<string | null>(null);

  const applicationId = routeAppId ?? selectedApplicationId;

  useEffect(() => {
    if (!applicationId) return;
    void loadEntities(applicationId);
    void loadConnectors(applicationId);
  }, [applicationId, loadEntities, loadConnectors]);

  useEffect(() => {
    if (!expandedConnectorId) return;
    const connector = connectors.find((item) => item.id === expandedConnectorId);
    if (!connector || !isGoogleSheetsConnector(connector)) return;
    if (!googleSheetsConnectorReady(connector).ready) return;
    void loadSheetColumns(expandedConnectorId);
  }, [expandedConnectorId, connectors, loadSheetColumns]);

  return (
    <aside className={`${styles.panel} ${collapsed ? styles.collapsed : ""}`}>
      <div className={styles.header}>
        {!collapsed && <span className={styles.title}>Data</span>}
        <button
          type="button"
          className={styles.collapseBtn}
          onClick={toggleExplorer}
          title={collapsed ? "Expand Data" : "Collapse Data"}
          aria-label={collapsed ? "Expand Data" : "Collapse Data"}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </button>
      </div>

      {!collapsed && (
        <div className={styles.content}>
          <div className={styles.sectionHeader}>
            <span>Entities</span>
            <button
              type="button"
              className={styles.createBtn}
              data-testid="data-create-entity"
              onClick={() => setCreateEntityOpen(true)}
            >
              + Create
            </button>
          </div>

          {entitiesLoading ? (
            <div className={styles.loadingMsg}>Loading entities…</div>
          ) : entitiesError ? (
            <div className={styles.emptyMsg} role="alert">
              Failed to load entities: {entitiesError}
            </div>
          ) : entities.length === 0 ? (
            <div className={styles.emptyMsg}>No entities yet. Create one to define your data model.</div>
          ) : (
            <ul className={styles.entityList}>
              {entities.map((entity) => {
                const fields = entityFieldsByEntityId[entity.id] ?? [];
                const isSelected = selectedEntityId === entity.id;
                return (
                  <li key={entity.id} className={styles.entityNode}>
                    <div className={styles.entityRow}>
                      <button
                        type="button"
                        className={[styles.entityBtn, isSelected ? styles.entityBtnSelected : ""]
                          .filter(Boolean)
                          .join(" ")}
                        data-testid={`data-entity-${entity.name}`}
                        onClick={() => selectEntity(isSelected ? null : entity.id)}
                      >
                        {entity.display_name || entity.name}
                      </button>
                      {isSelected ? (
                        <button
                          type="button"
                          className={styles.fieldBtn}
                          title="Add Field"
                          data-testid={`data-add-field-${entity.name}`}
                          onClick={() => setAddFieldOpen(true)}
                        >
                          + Field
                        </button>
                      ) : null}
                    </div>
                    {fields.length > 0 ? (
                      <ul className={styles.fieldList}>
                        {fields.map((field) => (
                          <li
                            key={field.id}
                            className={styles.fieldItem}
                            data-testid={`data-entity-field-${entity.name}-${field.name}`}
                          >
                            {field.name}
                            <span className={styles.fieldType}>{field.field_type}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          <div className={styles.sectionHeader} style={{ marginTop: 16 }}>
            <span>Connectors</span>
          </div>
          {connectorsLoading ? (
            <div className={styles.loadingMsg}>Loading connectors…</div>
          ) : connectorsError ? (
            <div className={styles.emptyMsg} role="alert">
              Failed to load connectors: {connectorsError}
            </div>
          ) : connectors.length === 0 ? (
            <div className={styles.emptyMsg}>
              No connectors yet. Add one under Connectors in the manager.
            </div>
          ) : (
            <ul className={styles.entityList}>
              {connectors.map((connector) => {
                const isSheets = isGoogleSheetsConnector(connector);
                const isExpanded = expandedConnectorId === connector.id;
                const columns = sheetColumnsByConnectorId[connector.id] ?? [];
                const columnsError = sheetColumnsErrorByConnectorId[connector.id];
                const columnsLoading = Boolean(
                  sheetColumnsLoadingByConnectorId[connector.id],
                );
                const ready = googleSheetsConnectorReady(connector);

                return (
                  <li key={connector.id} className={styles.entityNode}>
                    <div className={styles.entityRow}>
                      <button
                        type="button"
                        className={[
                          styles.entityBtn,
                          isExpanded ? styles.entityBtnSelected : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        data-testid={`data-connector-${connector.name}`}
                        title={
                          isSheets
                            ? "Click to show sheet columns; name is also copied"
                            : "Use this name as Gallery Items formula"
                        }
                        onClick={() => {
                          void navigator.clipboard?.writeText(connector.name);
                          if (!isSheets) return;
                          setExpandedConnectorId((prev) =>
                            prev === connector.id ? null : connector.id,
                          );
                        }}
                      >
                        {connector.name}
                        <span className={styles.fieldType}>{connector.connector_type}</span>
                      </button>
                      {isSheets ? (
                        <button
                          type="button"
                          className={styles.fieldBtn}
                          title="Refresh columns"
                          data-testid={`data-refresh-columns-${connector.name}`}
                          onClick={() => {
                            setExpandedConnectorId(connector.id);
                            void loadSheetColumns(connector.id, true);
                          }}
                        >
                          Columns
                        </button>
                      ) : null}
                    </div>
                    {isSheets && isExpanded ? (
                      columnsLoading ? (
                        <div className={styles.loadingMsg}>Loading columns…</div>
                      ) : columnsError ? (
                        <div className={styles.emptyMsg} role="alert">
                          {columnsError}
                        </div>
                      ) : !ready.ready ? (
                        <div className={styles.emptyMsg}>{ready.reason}</div>
                      ) : columns.length === 0 ? (
                        <div className={styles.emptyMsg}>
                          No header columns found. Check sheet name and header row.
                        </div>
                      ) : (
                        <ul className={styles.fieldList}>
                          {columns.map((column) => (
                            <li
                              key={column}
                              className={styles.fieldItem}
                              data-testid={`data-sheet-column-${connector.name}-${column}`}
                            >
                              {column}
                              <span className={styles.fieldType}>column</span>
                            </li>
                          ))}
                        </ul>
                      )
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <CreateEntityModal
        open={createEntityOpen}
        onClose={() => setCreateEntityOpen(false)}
      />
      <AddFieldModal
        open={addFieldOpen}
        entityId={selectedEntityId}
        entityName={entities.find((e) => e.id === selectedEntityId)?.name ?? ""}
        onClose={() => setAddFieldOpen(false)}
      />
    </aside>
  );
}
