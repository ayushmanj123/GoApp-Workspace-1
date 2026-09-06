import { Button, IconClose, IconEdit, IconHub, IconLinkOff } from "../../../ui";
import type { EntityFieldRecord } from "../../../../api/entities-api";
import type { TenantTable } from "../../../../hooks/useTenantTables";
import type { DiagramEdge, DiagramSelection } from "./types";
import styles from "../database-manager.module.css";

export interface NodeStats {
  fieldCount: number;
  keyCount: number;
  dependentsCount: number;
  recordTotal: number;
  loading: boolean;
}

export interface EdgeStats {
  sourceRows: number;
  loading: boolean;
}

interface DiagramInspectorProps {
  selection: DiagramSelection;
  selectedTable: TenantTable | null;
  selectedEdge: DiagramEdge | null;
  nodeStats: NodeStats | null;
  edgeStats: EdgeStats | null;
  tablesById: Record<string, TenantTable>;
  fieldsByEntityId: Record<string, EntityFieldRecord[]>;
  onClose: () => void;
  onOpenTable: (id: string) => void;
  onDeleteTable: (id: string) => void;
  onEditMapping: (edge: DiagramEdge) => void;
  onSever: (edge: DiagramEdge) => void;
}

export function DiagramInspector(props: DiagramInspectorProps) {
  const {
    selection,
    selectedTable,
    selectedEdge,
    nodeStats,
    edgeStats,
    tablesById,
    fieldsByEntityId,
    onClose,
    onOpenTable,
    onDeleteTable,
    onEditMapping,
    onSever,
  } = props;

  return (
    <aside className={styles.diagramInspector}>
      <div className={styles.diagramInspectorHead}>
        <div className={styles.diagramInspectorHeadLeft}>
          <IconHub size={16} />
          <span className={styles.diagramInspectorTitle}>Inspector</span>
        </div>
        <button
          className={styles.diagramInspectorClose}
          onClick={onClose}
          title="Close"
        >
          <IconClose size={16} />
        </button>
      </div>

      <div className={styles.diagramInspectorBody}>
        {!selection ? (
          <div className={styles.diagramInspectorEmpty}>
            Select a table or relationship to inspect its details.
          </div>
        ) : selection.kind === "node" && selectedTable ? (
          <NodeInspector
            table={selectedTable}
            stats={nodeStats}
            fields={fieldsByEntityId[selectedTable.id] ?? []}
            onOpen={() => onOpenTable(selectedTable.id)}
            onDelete={() => onDeleteTable(selectedTable.id)}
          />
        ) : selection.kind === "edge" && selectedEdge ? (
          <RelationInspector
            edge={selectedEdge}
            tablesById={tablesById}
            fieldsByEntityId={fieldsByEntityId}
            stats={edgeStats}
            onEdit={() => onEditMapping(selectedEdge)}
            onSever={() => onSever(selectedEdge)}
          />
        ) : (
          <div className={styles.diagramInspectorEmpty}>
            Selection not found.
          </div>
        )}
      </div>
    </aside>
  );
}

function NodeInspector({
  table,
  stats,
  fields,
  onOpen,
  onDelete,
}: {
  table: TenantTable;
  stats: NodeStats | null;
  fields: EntityFieldRecord[];
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <div className={styles.diagramInspectorBanner}>
        <div className={styles.diagramInspectorBannerHead}>
          <span>Table Model</span>
          <span className={styles.diagramInspectorLiveDot} />
        </div>
        <div className={styles.diagramInspectorBannerTitle}>
          {table.display_name || table.name}
        </div>
        <div className={styles.diagramInspectorBannerDesc}>
          {table.description || `Schema entity in ${table.application_name}.`}
        </div>
      </div>

      <span className={styles.diagramInspectorSectionLabel}>Configuration</span>
      <StatRow label="Domain" value={table.application_name} />
      <StatRow label="Plural name" value={table.plural_display_name || table.name} />
      <StatRow
        label="Fields"
        value={stats ? `${stats.fieldCount}` : `${fields.length}`}
        tag="count"
      />
      <StatRow
        label="Alternate keys"
        value={stats ? `${stats.keyCount}` : "—"}
        tag="keys"
      />
      <StatRow
        label="Incoming lookups"
        value={stats ? `${stats.dependentsCount}` : "—"}
        tag="refs"
      />
      <StatRow
        label="Records"
        value={
          stats?.loading
            ? "…"
            : stats
              ? stats.recordTotal.toLocaleString()
              : "—"
        }
        tag="rows"
      />

      <div className={styles.diagramInspectorFooter}>
        <Button
          variant="primary"
          size="sm"
          className={styles.diagramInspectorFooterBtn}
          onClick={onOpen}
        >
          <IconEdit size={14} /> Open table
        </Button>
        <Button variant="outlined" size="sm" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </>
  );
}

function RelationInspector({
  edge,
  tablesById,
  fieldsByEntityId,
  stats,
  onEdit,
  onSever,
}: {
  edge: DiagramEdge;
  tablesById: Record<string, TenantTable>;
  fieldsByEntityId: Record<string, EntityFieldRecord[]>;
  stats: EdgeStats | null;
  onEdit: () => void;
  onSever: () => void;
}) {
  const sourceTable = tablesById[edge.from];
  const targetTable = tablesById[edge.to];
  const isLookup = edge.kind === "lookup";
  const field = edge.field;
  const rule = field?.delete_behavior ?? (isLookup ? "restrict" : null);

  const targetField =
    targetTable && targetTable.primary_field_id
      ? (fieldsByEntityId[targetTable.id] ?? []).find(
          (f) => f.id === targetTable.primary_field_id,
        )
      : undefined;

  const title = isLookup
    ? `${sourceTable?.display_name ?? edge.from}.${field?.name ?? ""} → ${targetTable?.display_name ?? edge.to}`
    : `${edge.label || "Relationship"} (${sourceTable?.display_name ?? ""} ⇄ ${targetTable?.display_name ?? ""})`;

  return (
    <>
      <div className={styles.diagramInspectorBanner}>
        <div className={styles.diagramInspectorBannerHead}>
          <span>{isLookup ? "Lookup Edge" : "Many-to-Many Edge"}</span>
          <span className={styles.diagramInspectorLiveDot} />
        </div>
        <div className={styles.diagramInspectorBannerTitle}>{title}</div>
        <div className={styles.diagramInspectorBannerDesc}>
          {isLookup
            ? "Foreign reference connecting this field to a parent record."
            : "Associative link joining records across two entities."}
        </div>
      </div>

      <span className={styles.diagramInspectorSectionLabel}>
        Configuration & Constraints
      </span>
      <StatRow
        label="Relationship type"
        value={isLookup ? "Many-to-One (Lookup)" : "Many-to-Many"}
      />
      <StatRow
        label="Source field"
        value={
          isLookup
            ? `${sourceTable?.name ?? ""}.${field?.name ?? ""}`
            : `${sourceTable?.name ?? ""}`
        }
        tag="UUID"
      />
      <StatRow
        label="Target key"
        value={
          isLookup
            ? `${targetTable?.name ?? ""}.${targetField?.name ?? "id"}`
            : `${targetTable?.name ?? ""}`
        }
        tag="PRIMARY"
      />

      <div className={styles.diagramRuleBlock}>
        <div className={styles.diagramRuleRow}>
          <span className={styles.diagramStatLabel}>On-delete rule</span>
          <span
            className={`${styles.diagramStatTag} ${
              rule === "cascade"
                ? styles.tagAmber
                : rule === "restrict"
                  ? styles.tagDanger
                  : styles.tagPrimary
            }`}
          >
            {rule ? rule.toUpperCase() : "—"}
          </span>
        </div>
        <span className={styles.diagramRuleDesc}>
          {rule === "cascade"
            ? "Deleting the parent removes the reference on this record."
            : rule === "clear"
              ? "Deleting the parent clears this reference (sets to null)."
              : rule === "restrict"
                ? "Prevents deleting the parent while this reference exists."
                : "No referential action configured."}
        </span>
      </div>

      <StatRow
        label="Source rows"
        value={stats?.loading ? "…" : stats ? stats.sourceRows.toLocaleString() : "—"}
        tag="rows"
      />

      <div className={styles.diagramInspectorFooter}>
        <Button
          variant="primary"
          size="sm"
          className={styles.diagramInspectorFooterBtn}
          onClick={onEdit}
        >
          <IconEdit size={14} /> Edit mapping
        </Button>
        <Button variant="outlined" size="sm" onClick={onSever}>
          <IconLinkOff size={14} /> Sever
        </Button>
      </div>
    </>
  );
}

function StatRow({
  label,
  value,
  tag,
}: {
  label: string;
  value: string;
  tag?: string;
}) {
  return (
    <div className={styles.diagramStatRow}>
      <div className={styles.diagramStatRowLeft}>
        <span className={styles.diagramStatLabel}>{label}</span>
        <span className={styles.diagramStatValue}>{value}</span>
      </div>
      {tag ? (
        <span className={`${styles.diagramStatTag} ${styles.tagMuted}`}>{tag}</span>
      ) : null}
    </div>
  );
}
