import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useStudioStore } from "../../store/studioStore";
import { useApplicationStore } from "../../store/applicationStore";
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
    entityFieldsByEntityId,
    connectors,
    connectorsLoading,
    selectedEntityId,
    selectedApplicationId,
    selectEntity,
    loadEntities,
    loadConnectors,
  } = useApplicationStore();

  const [createEntityOpen, setCreateEntityOpen] = useState(false);
  const [addFieldOpen, setAddFieldOpen] = useState(false);

  const applicationId = routeAppId ?? selectedApplicationId;

  useEffect(() => {
    if (!applicationId) return;
    void loadEntities(applicationId);
    void loadConnectors(applicationId);
  }, [applicationId, loadEntities, loadConnectors]);

  return (
    <aside className={`${styles.panel} ${collapsed ? styles.collapsed : ""}`}>
      <div className={styles.header}>
        {!collapsed && <span className={styles.title}>Data</span>}
        <button
          type="button"
          className={styles.collapseBtn}
          onClick={toggleExplorer}
          title={collapsed ? "Expand Data" : "Collapse Data"}
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
          ) : connectors.length === 0 ? (
            <div className={styles.emptyMsg}>
              No connectors yet. Add one under Connectors in the manager.
            </div>
          ) : (
            <ul className={styles.entityList}>
              {connectors.map((connector) => (
                <li key={connector.id} className={styles.entityNode}>
                  <div className={styles.entityRow}>
                    <button
                      type="button"
                      className={styles.entityBtn}
                      data-testid={`data-connector-${connector.name}`}
                      title="Use this name as Gallery Items formula"
                      onClick={() => {
                        void navigator.clipboard?.writeText(connector.name);
                      }}
                    >
                      {connector.name}
                      <span className={styles.fieldType}>{connector.connector_type}</span>
                    </button>
                  </div>
                </li>
              ))}
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
