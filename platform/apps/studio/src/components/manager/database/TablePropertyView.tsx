import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import type { EntityFieldRecord } from "../../../api/entities-api";
import { Button } from "../../ui";
import { useTenantTablesContext } from "./TenantTablesContext";
import { AddTableFieldModal } from "./AddTableFieldModal";
import { EditFieldModal } from "./EditFieldModal";
import { TableRecordsPanel } from "./TableRecordsPanel";
import {
  formatAuditDate,
  formatCreatedBy,
  getCreatedBy,
  getCreatedOn,
} from "./database-utils";
import styles from "./database-manager.module.css";

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

export function TablePropertyView() {
  const { entityId } = useParams<{ entityId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get("section");
  const viewParam = searchParams.get("view");
  const view = viewParam === "records" ? "records" : "schema";

  const setView = (next: "schema" | "records") => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === "records") {
          params.set("view", "records");
        } else {
          params.delete("view");
        }
        return params;
      },
      { replace: true },
    );
  };

  const {
    getTable,
    fieldsByEntityId,
    fieldsLoading,
    loadFields,
    refreshFields,
    loading: tablesLoading,
  } = useTenantTablesContext();

  const table = entityId ? getTable(entityId) : undefined;
  const fields = entityId ? (fieldsByEntityId[entityId] ?? []) : [];
  const fieldsAreLoading = entityId ? fieldsLoading[entityId] : false;
  const relationshipFields = fields.filter((field) => field.field_type === "lookup");

  const [fieldsExpanded, setFieldsExpanded] = useState(
    sectionParam !== "relationships",
  );
  const [relationshipsExpanded, setRelationshipsExpanded] = useState(
    sectionParam === "relationships",
  );
  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const [addRelationshipOpen, setAddRelationshipOpen] = useState(false);
  const [editField, setEditField] = useState<EntityFieldRecord | null>(null);

  useEffect(() => {
    if (!entityId) return;
    void loadFields(entityId);
  }, [entityId, loadFields]);

  useEffect(() => {
    if (sectionParam === "fields") setFieldsExpanded(true);
    if (sectionParam === "relationships") setRelationshipsExpanded(true);
  }, [sectionParam]);

  if (tablesLoading) {
    return <div className={styles.loading}>Loading…</div>;
  }

  if (!table) {
    return (
      <div className={styles.error}>
        <p>Table not found.</p>
        <Link to="/studio/database" className={styles.backLink}>
          Back to tables
        </Link>
      </div>
    );
  }

  const title = table.display_name || table.name;

  return (
    <>
      <header className={styles.header}>
        <Link to="/studio/database" className={styles.backLink}>
          ← Back to tables
        </Link>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>{title}</h1>
          <Button
            variant="outlined"
            size="sm"
            className={styles.viewRecordsBtn}
            onClick={() => setView(view === "schema" ? "records" : "schema")}
          >
            {view === "schema" ? "View Records" : "View Schema"}
          </Button>
        </div>
      </header>

      {view === "records" ? (
        <TableRecordsPanel entityId={entityId!} fields={fields} />
      ) : (
        <>
      <section className={styles.section}>
        <div
          className={styles.sectionHeader}
          onClick={() => setFieldsExpanded((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setFieldsExpanded((v) => !v);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <span className={styles.sectionTitle}>Fields</span>
          <div className={styles.sectionActions}>
            <button
              type="button"
              className={styles.newBtn}
              onClick={(e) => {
                e.stopPropagation();
                setAddFieldOpen(true);
              }}
            >
              + New
            </button>
            <span className={styles.chevronBtn}>{fieldsExpanded ? "▴" : "▾"}</span>
          </div>
        </div>

        {fieldsExpanded ? (
          <div className={styles.sectionBody}>
            {fieldsAreLoading ? (
              <div className={styles.gridEmpty}>Loading fields…</div>
            ) : fields.length === 0 ? (
              <div className={styles.gridEmpty}>No fields yet</div>
            ) : (
              <div className={styles.gridWrap}>
                <table className={styles.grid}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>CreatedOn</th>
                      <th>CreatedBy</th>
                      <th>Dependencies</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field) => {
                      const relatedTable =
                        field.field_type === "lookup" && field.related_entity_id
                          ? getTable(field.related_entity_id)
                          : undefined;
                      return (
                      <tr key={field.id}>
                        <td>{field.display_name || field.name}</td>
                        <td>{field.field_type}</td>
                        <td>{formatAuditDate(getCreatedOn(field))}</td>
                        <td>{formatCreatedBy(getCreatedBy(field))}</td>
                        <td>
                          {relatedTable
                            ? `→ ${relatedTable.display_name || relatedTable.name}`
                            : "—"}
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.iconBtn}
                            title="Edit field"
                            aria-label={`Edit ${field.name}`}
                            onClick={() => setEditField(field)}
                          >
                            <EditIcon />
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section className={styles.section}>
        <div
          className={styles.sectionHeader}
          onClick={() => setRelationshipsExpanded((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setRelationshipsExpanded((v) => !v);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <span className={styles.sectionTitle}>Relationships</span>
          <div className={styles.sectionActions}>
            <button
              type="button"
              className={styles.newBtn}
              onClick={(e) => {
                e.stopPropagation();
                setAddRelationshipOpen(true);
              }}
            >
              + New relationship
            </button>
            <span className={styles.chevronBtn}>{relationshipsExpanded ? "▴" : "▾"}</span>
          </div>
        </div>

        {relationshipsExpanded ? (
          <div className={styles.sectionBody}>
            {fieldsAreLoading ? (
              <div className={styles.gridEmpty}>Loading relationships…</div>
            ) : relationshipFields.length === 0 ? (
              <div className={styles.gridEmpty}>
                No relationships yet. A relationship is a lookup field that points at another table.
              </div>
            ) : (
              <div className={styles.gridWrap}>
                <table className={styles.grid}>
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Related Table</th>
                      <th>CreatedOn</th>
                      <th>CreatedBy</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {relationshipFields.map((field) => {
                      const related = field.related_entity_id
                        ? getTable(field.related_entity_id)
                        : undefined;
                      return (
                        <tr key={field.id}>
                          <td>{field.display_name || field.name}</td>
                          <td>
                            {related
                              ? related.display_name || related.name
                              : field.related_entity_id
                                ? "Unknown table"
                                : "—"}
                          </td>
                          <td>{formatAuditDate(getCreatedOn(field))}</td>
                          <td>{formatCreatedBy(getCreatedBy(field))}</td>
                          <td>
                            <button
                              type="button"
                              className={styles.iconBtn}
                              title="Edit relationship"
                              aria-label={`Edit ${field.name}`}
                              onClick={() => setEditField(field)}
                            >
                              <EditIcon />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </section>

      <AddTableFieldModal
        open={addFieldOpen}
        entityId={entityId ?? null}
        entityName={title}
        onClose={() => setAddFieldOpen(false)}
        onCreated={() => {
          if (entityId) void refreshFields(entityId);
        }}
      />

      <AddTableFieldModal
        open={addRelationshipOpen}
        entityId={entityId ?? null}
        entityName={title}
        initialFieldType="lookup"
        title="New Relationship"
        onClose={() => setAddRelationshipOpen(false)}
        onCreated={() => {
          if (entityId) void refreshFields(entityId);
        }}
      />

      <EditFieldModal
        open={editField !== null}
        field={editField}
        onClose={() => setEditField(null)}
        onSaved={() => {
          if (entityId) void refreshFields(entityId);
        }}
      />
        </>
      )}
    </>
  );
}
