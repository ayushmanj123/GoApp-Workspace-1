import type { EntityFieldRecord, EntityRelationshipRecord } from "../../../../api/entities-api";
import type { TenantTable } from "../../../../hooks/useTenantTables";

export interface NodePos {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type EdgeKind = "lookup" | "nn";

export interface DiagramEdge {
  id: string;
  kind: EdgeKind;
  from: string; // entity id (source)
  to: string; // entity id (target)
  label: string;
  /** For lookup edges: the source field record. */
  field?: EntityFieldRecord;
  /** For N:N edges: the relationship record. */
  relationship?: EntityRelationshipRecord;
}

export type DiagramSelection =
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string }
  | null;

export interface DiagramView {
  scale: number;
  tx: number;
  ty: number;
}

export interface AppDomain {
  name: string;
  count: number;
  color: string;
}

export interface DiagramData {
  tables: TenantTable[];
  fieldsByEntityId: Record<string, EntityFieldRecord[]>;
  edges: DiagramEdge[];
  positions: Record<string, NodePos>;
  domains: AppDomain[];
}

/** Palette hashed from a string for per-app node header colors. */
export const APP_COLORS = [
  "#5856d6", // primary purple
  "#0058be", // blue
  "#00628d", // tertiary
  "#b45309", // amber
  "#be123c", // rose
  "#15803d", // emerald
  "#7c3aed", // violet
  "#0e7490", // cyan
];

export function colorForApp(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return APP_COLORS[h % APP_COLORS.length];
}
