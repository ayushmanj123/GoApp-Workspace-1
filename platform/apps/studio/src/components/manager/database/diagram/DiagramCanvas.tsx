import { useRef, type MouseEvent, type WheelEvent } from "react";
import type { EntityFieldRecord, EntityFieldType } from "../../../../api/entities-api";
import type { TenantTable } from "../../../../hooks/useTenantTables";
import { IconKey, IconMoreVert } from "../../../ui";
import type { DiagramEdge, DiagramSelection, NodePos } from "./types";
import { colorForApp } from "./types";
import styles from "../database-manager.module.css";

interface DiagramCanvasProps {
  tables: TenantTable[];
  fieldsByEntityId: Record<string, EntityFieldRecord[]>;
  edges: DiagramEdge[];
  positions: Record<string, NodePos>;
  view: { scale: number; tx: number; ty: number };
  selection: DiagramSelection;
  multiSelect: string[];
  fkVisible: boolean;
  planeSize: { width: number; height: number };
  onSelectNode: (id: string, additive: boolean) => void;
  onSelectEdge: (id: string) => void;
  onClearSelection: () => void;
  onPanStart: (e: MouseEvent) => void;
  onZoom: (delta: number, cx?: number, cy?: number) => void;
  onDragNodeStart: (id: string, e: MouseEvent) => void;
}

const TYPE_BADGE: Partial<Record<EntityFieldType, { cls: string; label: string }>> = {
  text: { cls: styles.badgeText, label: "T" },
  multiline: { cls: styles.badgeText, label: "T" },
  email: { cls: styles.badgeText, label: "@" },
  phone: { cls: styles.badgeText, label: "T" },
  url: { cls: styles.badgeText, label: "↗" },
  number: { cls: styles.badgeNum, label: "#" },
  integer: { cls: styles.badgeNum, label: "#" },
  decimal: { cls: styles.badgeNum, label: "#" },
  currency: { cls: styles.badgeNum, label: "$" },
  boolean: { cls: styles.badgeBool, label: "✓" },
  date: { cls: styles.badgeDate, label: "D" },
  datetime: { cls: styles.badgeDate, label: "D" },
  choice: { cls: styles.badgeChoice, label: "•" },
  choices: { cls: styles.badgeChoice, label: "•" },
  lookup: { cls: styles.badgeLookup, label: "⇄" },
};

function anchorPoint(pos: NodePos, side: "right" | "left") {
  return side === "right"
    ? { x: pos.x + pos.w, y: pos.y + pos.h / 2 }
    : { x: pos.x, y: pos.y + pos.h / 2 };
}

function edgePath(from: NodePos, to: NodePos): { d: string; mx: number; my: number; p1: { x: number; y: number }; p2: { x: number; y: number } } {
  // pick sides by horizontal direction; fallback to right side if stacked
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let p1: { x: number; y: number };
  let p2: { x: number; y: number };
  if (Math.abs(dx) >= Math.abs(dy)) {
    const srcRight = dx >= 0;
    p1 = anchorPoint(from, srcRight ? "right" : "left");
    p2 = anchorPoint(to, srcRight ? "left" : "right");
  } else {
    // stacked vertically: route on the right side of both
    p1 = anchorPoint(from, "right");
    p2 = anchorPoint(to, "right");
  }
  const ctrl = Math.min(Math.max(Math.abs(p2.x - p1.x) / 2, 40), 120);
  const c1x = p1.x + (p2.x >= p1.x ? ctrl : -ctrl);
  const c2x = p2.x - (p2.x >= p1.x ? ctrl : -ctrl);
  const d = `M ${p1.x} ${p1.y} C ${c1x} ${p1.y}, ${c2x} ${p2.y}, ${p2.x} ${p2.y}`;
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  return { d, mx, my, p1, p2 };
}

export function DiagramCanvas(props: DiagramCanvasProps) {
  const {
    tables,
    fieldsByEntityId,
    edges,
    positions,
    view,
    selection,
    multiSelect,
    fkVisible,
    planeSize,
    onSelectNode,
    onSelectEdge,
    onClearSelection,
    onPanStart,
    onZoom,
    onDragNodeStart,
  } = props;

  const stageRef = useRef<HTMLDivElement>(null);

  const handleWheel = (e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const rect = stageRef.current?.getBoundingClientRect();
    const cx = rect ? e.clientX - rect.left : undefined;
    const cy = rect ? e.clientY - rect.top : undefined;
    onZoom(e.deltaY > 0 ? -0.1 : 0.1, cx, cy);
  };

  return (
    <div
      ref={stageRef}
      className={styles.diagramStage}
      onMouseDown={onPanStart}
      onWheel={handleWheel}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClearSelection();
      }}
    >
      {tables.length === 0 ? (
        <div className={styles.diagramEmptyState}>No tables yet. Add a table to begin.</div>
      ) : null}
      <div
        className={styles.diagramPlane}
        style={{
          width: planeSize.width,
          height: planeSize.height,
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
        }}
      >
        {fkVisible && (
          <svg
            className={styles.diagramEdgeLayer}
            width={planeSize.width}
            height={planeSize.height}
          >
            <defs>
              <linearGradient id="diagEdgeActive" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#5856d6" />
                <stop offset="100%" stopColor="#0058be" />
              </linearGradient>
            </defs>
            {edges.map((edge) => {
              const from = positions[edge.from];
              const to = positions[edge.to];
              if (!from || !to) return null;
              const { d, mx, my, p1, p2 } = edgePath(from, to);
              const active = selection?.kind === "edge" && selection.id === edge.id;
              const stroke = active ? "url(#diagEdgeActive)" : "#94a3b8";
              const sw = active ? 2.5 : 1.75;
              const cardinality = edge.kind === "nn" ? "N : N" : "N : 1";
              return (
                <g
                  key={edge.id}
                  className={styles.diagramEdgeGroup}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEdge(edge.id);
                  }}
                >
                  <path
                    d={d}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={sw}
                    strokeDasharray={edge.kind === "nn" ? "4 3" : undefined}
                  />
                  <circle cx={p1.x} cy={p1.y} r={active ? 4 : 3.5} fill={active ? "#5856d6" : "#94a3b8"} />
                  <circle cx={p2.x} cy={p2.y} r={active ? 4.5 : 3.5} fill={active ? "#0058be" : "#94a3b8"} />
                  <rect
                    x={mx - 20}
                    y={my - 9}
                    width={40}
                    height={18}
                    rx={9}
                    fill="#fff"
                    stroke={active ? "#5856d6" : "#cbd5e1"}
                    strokeWidth={active ? 1.5 : 1}
                  />
                  <text
                    x={mx}
                    y={my + 3}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={600}
                    fontFamily="Inter, sans-serif"
                    fill={active ? "#5856d6" : "#475569"}
                  >
                    {cardinality}
                  </text>
                </g>
              );
            })}
          </svg>
        )}

        {tables.map((table) => {
          const pos = positions[table.id];
          if (!pos) return null;
          const fields = fieldsByEntityId[table.id] ?? [];
          const isSel = selection?.kind === "node" && selection.id === table.id;
          const isMulti = multiSelect.includes(table.id);
          const color = colorForApp(table.application_name || table.name);
          const selected = isSel || isMulti;
          return (
            <div
              key={table.id}
              className={[
                styles.diagramNode,
                selected ? styles.diagramNodeSelected : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ left: pos.x, top: pos.y, width: pos.w }}
              onMouseDown={(e) => {
                e.stopPropagation();
                onDragNodeStart(table.id, e);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectNode(table.id, e.ctrlKey || e.metaKey);
              }}
            >
              <div
                className={styles.diagramNodeHeader}
                style={{ background: `${color}1a` }}
              >
                <div className={styles.diagramNodeHeadLeft}>
                  <div
                    className={styles.diagramNodeIcon}
                    style={{ background: color }}
                  >
                    <IconKey size={13} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className={styles.diagramNodeName}>
                      {table.display_name || table.name}
                    </div>
                    <div className={styles.diagramNodeDomain}>
                      {table.application_name}
                    </div>
                  </div>
                </div>
                <div className={styles.diagramNodeHeadRight}>
                  <span className={styles.diagramFieldCount}>
                    {fields.length} flds
                  </span>
                  <button
                    className={styles.diagramMoreBtn}
                    onClick={(e) => e.stopPropagation()}
                    title="More"
                  >
                    <IconMoreVert size={14} />
                  </button>
                </div>
              </div>
              <div className={styles.diagramFieldList}>
                {fields.slice(0, 6).map((f) => {
                  const isPk = table.primary_field_id === f.id;
                  const isFk = f.field_type === "lookup";
                  const badge = isPk
                    ? { cls: styles.badgePk, label: "🔑" }
                    : TYPE_BADGE[f.field_type] ?? { cls: styles.badgeText, label: "T" };
                  return (
                    <div
                      key={f.id}
                      className={[
                        styles.diagramFieldRow,
                        isFk ? styles.diagramFieldRowFk : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <div className={styles.diagramFieldLeft}>
                        <span className={`${styles.diagramTypeBadge} ${badge.cls}`}>
                          {badge.label}
                        </span>
                        <span
                          className={[
                            styles.diagramFieldName,
                            isPk ? styles.diagramFieldNamePk : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {f.display_name || f.name}
                        </span>
                      </div>
                      <div className={styles.diagramFieldRight}>
                        {isFk ? (
                          <span className={styles.diagramFkBadge}>FK</span>
                        ) : (
                          <span className={styles.diagramFieldTypeLabel}>
                            {f.field_type}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {fields.length > 6 ? (
                  <div className={styles.diagramFieldTypeLabel} style={{ padding: "2px 6px" }}>
                    +{fields.length - 6} more
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
