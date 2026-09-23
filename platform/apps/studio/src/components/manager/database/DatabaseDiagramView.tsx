import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { entitiesApi } from "../../../api/entities-api";
import { recordsApi } from "../../../api/records-api";
import { useTenantTablesContext } from "./TenantTablesContext";
import { CreateTableModal } from "./CreateTableModal";
import { confirmDeleteTable } from "./confirmDeleteTable";
import { DiagramTopbar } from "./diagram/DiagramTopbar";
import { DiagramCanvas } from "./diagram/DiagramCanvas";
import { DiagramMinimap } from "./diagram/DiagramMinimap";
import { DiagramInspector, type EdgeStats, type NodeStats } from "./diagram/DiagramInspector";
import { colorForApp, type AppDomain, type DiagramEdge, type DiagramSelection, type NodePos } from "./diagram/types";
import styles from "./database-manager.module.css";

const NODE_W = 220;
const NODE_H = 168;
const GRID = 24;
const DIAGRAM_LAYOUT_KEY = "goapps:diagram-layout";

function computeLayout(tableIds: string[]): Record<string, NodePos> {
  const cols = Math.max(1, Math.ceil(Math.sqrt(tableIds.length || 1)));
  const map: Record<string, NodePos> = {};
  tableIds.forEach((id, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    map[id] = { x: 60 + col * 280, y: 60 + row * 220, w: NODE_W, h: NODE_H };
  });
  return map;
}

function loadStoredLayout(): Record<string, NodePos> {
  try {
    const raw = localStorage.getItem(DIAGRAM_LAYOUT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<NodePos>>;
    const out: Record<string, NodePos> = {};
    for (const [id, p] of Object.entries(parsed)) {
      if (typeof p?.x === "number" && typeof p?.y === "number") {
        out[id] = { x: p.x, y: p.y, w: p.w ?? NODE_W, h: p.h ?? NODE_H };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function saveStoredLayout(positions: Record<string, NodePos>) {
  try {
    localStorage.setItem(DIAGRAM_LAYOUT_KEY, JSON.stringify(positions));
  } catch {
    /* ignore quota */
  }
}

export function DatabaseDiagramView() {
  const navigate = useNavigate();
  const { tables, fieldsByEntityId, loadFields, loadTables, loading } = useTenantTablesContext();

  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const [selection, setSelection] = useState<DiagramSelection>(null);
  const [multiSelect, setMultiSelect] = useState<string[]>([]);
  const [snap, setSnap] = useState(true);
  const [minimap, setMinimap] = useState(true);
  const [fkVisible, setFkVisible] = useState(true);
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, NodePos>>(() => loadStoredLayout());
  const [nnEdges, setNnEdges] = useState<DiagramEdge[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nodeStats, setNodeStats] = useState<NodeStats | null>(null);
  const [edgeStats, setEdgeStats] = useState<EdgeStats | null>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 500 });
  const layoutHydrated = useRef(false);

  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    for (const t of tables) {
      if (!fieldsByEntityId[t.id]) void loadFields(t.id);
    }
  }, [tables, fieldsByEntityId, loadFields]);

  useEffect(() => {
    if (tables.length === 0) {
      setPositions({});
      return;
    }
    setPositions((prev) => {
      const stored = layoutHydrated.current ? prev : { ...loadStoredLayout(), ...prev };
      layoutHydrated.current = true;
      const next: Record<string, NodePos> = {};
      const missing: string[] = [];
      for (const t of tables) {
        if (stored[t.id]) next[t.id] = { ...stored[t.id], w: NODE_W, h: NODE_H };
        else missing.push(t.id);
      }
      if (missing.length > 0) {
        const laid = computeLayout(missing);
        // Offset new nodes so they don't stack on (0,0) when others exist
        const offset = Object.keys(next).length > 0 ? 40 : 0;
        for (const id of missing) {
          next[id] = {
            ...laid[id],
            x: laid[id].x + offset,
            y: laid[id].y + offset,
          };
        }
      }
      // If nothing was stored and everything was laid out fresh, use clean grid
      if (Object.keys(stored).length === 0 && missing.length === tables.length) {
        return computeLayout(tables.map((t) => t.id));
      }
      return next;
    });
  }, [tables]);

  useEffect(() => {
    if (!layoutHydrated.current) return;
    if (Object.keys(positions).length === 0) return;
    saveStoredLayout(positions);
  }, [positions]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const edges: DiagramEdge[] = [];
      const seen = new Set<string>();
      for (const t of tables) {
        try {
          const data = await entitiesApi.listRelationships(t.id);
          for (const rel of data.items ?? []) {
            if (seen.has(rel.id)) continue;
            seen.add(rel.id);
            edges.push({
              id: rel.id,
              kind: "nn",
              from: rel.left_entity_id,
              to: rel.right_entity_id,
              label: rel.name,
              relationship: rel,
            });
          }
        } catch {
          /* ignore */
        }
      }
      if (!cancelled) setNnEdges(edges);
    })();
    return () => {
      cancelled = true;
    };
  }, [tables]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => setStageSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const lookupEdges = useMemo<DiagramEdge[]>(() => {
    const edges: DiagramEdge[] = [];
    for (const t of tables) {
      const fields = fieldsByEntityId[t.id] ?? [];
      for (const f of fields) {
        if (f.field_type === "lookup" && f.related_entity_id) {
          edges.push({
            id: f.id,
            kind: "lookup",
            from: t.id,
            to: f.related_entity_id,
            label: f.display_name || f.name,
            field: f,
          });
        }
      }
    }
    return edges;
  }, [tables, fieldsByEntityId]);

  const edges = useMemo(() => [...lookupEdges, ...nnEdges], [lookupEdges, nnEdges]);

  const domains = useMemo<AppDomain[]>(() => {
    const map = new Map<string, AppDomain>();
    for (const t of tables) {
      const name = t.application_name || "Other";
      const existing = map.get(name);
      if (existing) existing.count += 1;
      else map.set(name, { name, count: 1, color: colorForApp(name) });
    }
    return [...map.values()];
  }, [tables]);

  const tablesById = useMemo(() => {
    const m: Record<string, (typeof tables)[number]> = {};
    for (const t of tables) m[t.id] = t;
    return m;
  }, [tables]);

  const visibleTables = useMemo(
    () => (activeApp ? tables.filter((t) => (t.application_name || "Other") === activeApp) : tables),
    [tables, activeApp],
  );

  const planeSize = useMemo(() => {
    const xs = Object.values(positions).map((p) => p.x + p.w);
    const ys = Object.values(positions).map((p) => p.y + p.h);
    return {
      width: Math.max(800, ...xs, 800) + 80,
      height: Math.max(500, ...ys, 500) + 80,
    };
  }, [positions]);

  useEffect(() => {
    if (selection?.kind !== "node") {
      setNodeStats(null);
      return;
    }
    const table = tablesById[selection.id];
    if (!table) {
      setNodeStats(null);
      return;
    }
    let cancelled = false;
    setNodeStats({
      fieldCount: (fieldsByEntityId[table.id] ?? []).length,
      keyCount: 0,
      dependentsCount: 0,
      recordTotal: 0,
      loading: true,
    });
    void (async () => {
      try {
        const [keysRes, depsRes, recs] = await Promise.all([
          entitiesApi.listKeys(table.id).catch(() => ({ items: [] })),
          entitiesApi.listDependents(table.id).catch(() => ({ items: [] })),
          recordsApi.list(table.id, { limit: 1, offset: 0 }).catch(() => ({ items: [], total: 0 })),
        ]);
        if (cancelled) return;
        setNodeStats({
          fieldCount: (fieldsByEntityId[table.id] ?? []).length,
          keyCount: keysRes.items?.length ?? 0,
          dependentsCount: depsRes.items?.length ?? 0,
          recordTotal: recs.total,
          loading: false,
        });
      } catch {
        if (!cancelled)
          setNodeStats({
            fieldCount: (fieldsByEntityId[table.id] ?? []).length,
            keyCount: 0,
            dependentsCount: 0,
            recordTotal: 0,
            loading: false,
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selection, tablesById, fieldsByEntityId]);

  useEffect(() => {
    if (selection?.kind !== "edge") {
      setEdgeStats(null);
      return;
    }
    const edge = edges.find((e) => e.id === selection.id);
    if (!edge) {
      setEdgeStats(null);
      return;
    }
    let cancelled = false;
    setEdgeStats({ sourceRows: 0, loading: true });
    void (async () => {
      try {
        const recs = await recordsApi.list(edge.from, { limit: 1, offset: 0 });
        if (cancelled) return;
        setEdgeStats({ sourceRows: recs.total, loading: false });
      } catch {
        if (!cancelled) setEdgeStats({ sourceRows: 0, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selection, edges]);

  const panState = useRef({ panning: false, moved: false, startX: 0, startY: 0, origTx: 0, origTy: 0 });
  const dragState = useRef({ id: null as string | null, startX: 0, startY: 0, origX: 0, origY: 0 });

  const onPanStart = useCallback(
    (e: MouseEvent) => {
      panState.current = {
        panning: true,
        moved: false,
        startX: e.clientX,
        startY: e.clientY,
        origTx: view.tx,
        origTy: view.ty,
      };
      const onMove = (ev: globalThis.MouseEvent) => {
        if (!panState.current.panning) return;
        const ddx = ev.clientX - panState.current.startX;
        const ddy = ev.clientY - panState.current.startY;
        if (Math.abs(ddx) > 3 || Math.abs(ddy) > 3) panState.current.moved = true;
        setView((v) => ({ ...v, tx: panState.current.origTx + ddx, ty: panState.current.origTy + ddy }));
      };
      const onUp = () => {
        panState.current.panning = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [view.tx, view.ty],
  );

  const onZoom = useCallback((delta: number, cx?: number, cy?: number) => {
    setView((v) => {
      const next = Math.min(Math.max(0.4, v.scale + delta), 1.8);
      if (cx === undefined || cy === undefined) return { ...v, scale: next };
      const stage = stageRef.current?.getBoundingClientRect();
      if (!stage) return { ...v, scale: next };
      const px = cx - stage.left;
      const py = cy - stage.top;
      const wx = (px - v.tx) / v.scale;
      const wy = (py - v.ty) / v.scale;
      return { scale: next, tx: px - wx * next, ty: py - wy * next };
    });
  }, []);

  const onDragNodeStart = useCallback(
    (id: string, e: MouseEvent) => {
      const pos = positions[id];
      if (!pos) return;
      dragState.current = { id, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
      const onMove = (ev: globalThis.MouseEvent) => {
        if (dragState.current.id !== id) return;
        const dx = (ev.clientX - dragState.current.startX) / view.scale;
        const dy = (ev.clientY - dragState.current.startY) / view.scale;
        let nx = dragState.current.origX + dx;
        let ny = dragState.current.origY + dy;
        if (snap) {
          nx = Math.round(nx / GRID) * GRID;
          ny = Math.round(ny / GRID) * GRID;
        }
        setPositions((prev) => ({ ...prev, [id]: { ...prev[id], x: nx, y: ny } }));
      };
      const onUp = () => {
        dragState.current.id = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [positions, view.scale, snap],
  );

  const fitToScreen = useCallback(() => {
    const el = stageRef.current;
    if (!el || tables.length === 0) {
      setView({ scale: 1, tx: 0, ty: 0 });
      return;
    }
    const ps = Object.values(positions);
    if (ps.length === 0) {
      setView({ scale: 1, tx: 0, ty: 0 });
      return;
    }
    const minX = Math.min(...ps.map((p) => p.x));
    const minY = Math.min(...ps.map((p) => p.y));
    const maxX = Math.max(...ps.map((p) => p.x + p.w));
    const maxY = Math.max(...ps.map((p) => p.y + p.h));
    const contentW = maxX - minX || 1;
    const contentH = maxY - minY || 1;
    const pad = 40;
    const scale = Math.min(
      Math.max(0.4, (el.clientWidth - pad * 2) / contentW),
      Math.max(0.4, (el.clientHeight - pad * 2) / contentH),
      1.4,
    );
    setView({ scale, tx: pad - minX * scale, ty: pad - minY * scale });
  }, [tables.length, positions]);

  const autoLayout = useCallback(() => {
    setPositions(computeLayout(tables.map((t) => t.id)));
    setView({ scale: 1, tx: 0, ty: 0 });
  }, [tables]);

  const onSelectNode = useCallback((id: string, additive: boolean) => {
    if (additive) {
      setMultiSelect((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id);
        if (prev.length >= 2) return [prev[1], id];
        return [...prev, id];
      });
      setSelection({ kind: "node", id });
    } else {
      setMultiSelect([]);
      setSelection({ kind: "node", id });
    }
  }, []);

  const onSelectEdge = useCallback((id: string) => {
    setMultiSelect([]);
    setSelection({ kind: "edge", id });
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setMultiSelect([]);
  }, []);

  const connectTables = useCallback(async () => {
    if (multiSelect.length !== 2) {
      setMessage("Select two tables (Ctrl/Cmd+click) then Connect.");
      return;
    }
    const [fromId, toId] = multiSelect;
    const from = tablesById[fromId];
    const to = tablesById[toId];
    if (!from || !to) return;
    const kindRaw = window.prompt(
      `Connect ${from.display_name || from.name} → ${to.display_name || to.name}\nType "lookup" or "nn"`,
      "lookup",
    );
    if (!kindRaw) return;
    const kind = kindRaw.trim().toLowerCase();
    if (kind !== "lookup" && kind !== "nn" && kind !== "n:n") {
      setMessage('Unknown type. Use "lookup" or "nn".');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (kind === "lookup") {
        await entitiesApi.createField(fromId, {
          name: `${to.name}Id`,
          display_name: to.display_name || to.name,
          field_type: "lookup",
          related_entity_id: toId,
          delete_behavior: "restrict",
        });
        await loadFields(fromId);
        setMessage(`Created lookup ${from.display_name} → ${to.display_name}`);
      } else {
        const defaultName = `${from.name}_${to.name}`;
        const nnName =
          window.prompt("N:N relationship name", defaultName)?.trim() || defaultName;
        const rel = await entitiesApi.createRelationship({
          name: nnName,
          left_entity_id: fromId,
          right_entity_id: toId,
        });
        setNnEdges((prev) => [
          ...prev,
          {
            id: rel.id,
            kind: "nn",
            from: fromId,
            to: toId,
            label: rel.name,
            relationship: rel,
          },
        ]);
        setMessage(`Created N:N ${nnName}`);
      }
      setMultiSelect([]);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to create relationship");
    } finally {
      setBusy(false);
    }
  }, [multiSelect, tablesById, loadFields]);

  const deleteTable = useCallback(
    async (id: string) => {
      const t = tablesById[id];
      if (!t) return;
      if (!(await confirmDeleteTable(id, t.display_name || t.name))) return;
      setBusy(true);
      try {
        await entitiesApi.delete(id);
        await loadTables();
        clearSelection();
        setMessage("Table deleted.");
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Failed to delete table");
      } finally {
        setBusy(false);
      }
    },
    [tablesById, loadTables, clearSelection],
  );

  const editMapping = useCallback(
    (edge: DiagramEdge) => navigate(`/studio/database/tables/${edge.from}`),
    [navigate],
  );

  const severEdge = useCallback(
    async (edge: DiagramEdge) => {
      const label =
        edge.kind === "lookup"
          ? `Remove lookup field "${edge.field?.display_name || edge.field?.name}"?`
          : `Sever N:N relationship "${edge.label}"?`;
      if (!window.confirm(label)) return;
      setBusy(true);
      try {
        if (edge.kind === "lookup" && edge.field) {
          await entitiesApi.deleteField(edge.field.id);
          await loadFields(edge.from);
        } else if (edge.relationship) {
          await entitiesApi.deleteRelationship(edge.relationship.id);
          setNnEdges((prev) => prev.filter((e) => e.id !== edge.id));
        }
        clearSelection();
        setMessage("Relationship severed.");
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Failed to sever relationship");
      } finally {
        setBusy(false);
      }
    },
    [loadFields, clearSelection],
  );

  const selectedTable = selection?.kind === "node" ? tablesById[selection.id] ?? null : null;
  const selectedEdge = selection?.kind === "edge" ? edges.find((e) => e.id === selection.id) ?? null : null;

  const zoomPct = Math.round(view.scale * 100);

  if (loading) {
    return <div className={styles.loading}>Loading diagram…</div>;
  }

  return (
    <div className={styles.diagramShell}>
      <DiagramTopbar
        tableCount={tables.length}
        edgeCount={edges.length}
        zoomPct={zoomPct}
        snap={snap}
        minimap={minimap}
        fkVisible={fkVisible}
        activeApp={activeApp}
        domains={domains}
        canConnect={multiSelect.length === 2 && !busy}
        onZoomIn={() => onZoom(0.1)}
        onZoomOut={() => onZoom(-0.1)}
        onFit={fitToScreen}
        onAutoLayout={autoLayout}
        onToggleSnap={() => setSnap((s) => !s)}
        onToggleMinimap={() => setMinimap((m) => !m)}
        onToggleFk={() => setFkVisible((f) => !f)}
        onConnect={() => void connectTables()}
        onAddTable={() => setCreateOpen(true)}
        onFilter={(app) => setActiveApp(app)}
      />

      {message ? <div className={styles.diagramMsg}>{message}</div> : null}

      <div className={styles.diagramBody}>
        <DiagramCanvas
          tables={visibleTables}
          fieldsByEntityId={fieldsByEntityId}
          edges={edges.filter((e) => visibleEdgeIdsHas(e, visibleTables))}
          positions={positions}
          view={view}
          selection={selection}
          multiSelect={multiSelect}
          fkVisible={fkVisible}
          planeSize={planeSize}
          onSelectNode={onSelectNode}
          onSelectEdge={onSelectEdge}
          onClearSelection={clearSelection}
          onPanStart={onPanStart}
          onZoom={onZoom}
          onDragNodeStart={onDragNodeStart}
        />

        {minimap ? (
          <DiagramMinimap
            tables={visibleTables}
            positions={positions}
            planeSize={planeSize}
            view={view}
            stageSize={stageSize}
            onReset={fitToScreen}
          />
        ) : null}

        <DiagramInspector
          selection={selection}
          selectedTable={selectedTable}
          selectedEdge={selectedEdge}
          nodeStats={nodeStats}
          edgeStats={edgeStats}
          tablesById={tablesById}
          fieldsByEntityId={fieldsByEntityId}
          onClose={clearSelection}
          onOpenTable={(id) => navigate(`/studio/database/tables/${id}`)}
          onDeleteTable={(id) => void deleteTable(id)}
          onEditMapping={editMapping}
          onSever={(e) => void severEdge(e)}
        />
      </div>

      <CreateTableModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          void loadTables();
        }}
      />
    </div>
  );
}

function visibleEdgeIdsHas(edge: DiagramEdge, visibleTables: { id: string }[]): boolean {
  const ids = new Set(visibleTables.map((t) => t.id));
  return ids.has(edge.from) && ids.has(edge.to);
}
