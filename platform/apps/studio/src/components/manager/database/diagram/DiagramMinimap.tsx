import type { NodePos } from "./types";
import { colorForApp } from "./types";
import type { TenantTable } from "../../../../hooks/useTenantTables";
import styles from "../database-manager.module.css";

interface DiagramMinimapProps {
  tables: TenantTable[];
  positions: Record<string, NodePos>;
  planeSize: { width: number; height: number };
  view: { scale: number; tx: number; ty: number };
  stageSize: { width: number; height: number };
  onReset: () => void;
}

export function DiagramMinimap(props: DiagramMinimapProps) {
  const { tables, positions, planeSize, view, stageSize, onReset } = props;
  const boxW = 148;
  const boxH = 80;
  const sx = planeSize.width > 0 ? boxW / planeSize.width : 0;
  const sy = planeSize.height > 0 ? boxH / planeSize.height : 0;

  // viewport rect in minimap coords: visible stage area mapped into plane space
  const visW = stageSize.width / view.scale;
  const visH = stageSize.height / view.scale;
  const visX = -view.tx / view.scale;
  const visY = -view.ty / view.scale;

  return (
    <div className={styles.diagramMinimap}>
      <div className={styles.diagramMinimapHead}>
        <span>Navigator</span>
        <span className={styles.diagramMinimapAuto}>Auto</span>
      </div>
      <div className={styles.diagramMinimapBox}>
        {tables.map((t) => {
          const pos = positions[t.id];
          if (!pos) return null;
          const color = colorForApp(t.application_name || t.name);
          return (
            <div
              key={t.id}
              className={styles.diagramMinimapBlock}
              style={{
                left: pos.x * sx,
                top: pos.y * sy,
                width: Math.max(pos.w * sx, 5),
                height: Math.max(pos.h * sy, 4),
                background: color,
              }}
            />
          );
        })}
        {planeSize.width > 0 && (
          <div
            className={styles.diagramMinimapViewport}
            style={{
              left: Math.max(visX * sx, 0),
              top: Math.max(visY * sy, 0),
              width: Math.min(visW * sx, boxW),
              height: Math.min(visH * sy, boxH),
            }}
          />
        )}
      </div>
      <div className={styles.diagramMinimapFoot}>
        <span>
          X: {Math.round(-view.tx)}px • Y: {Math.round(-view.ty)}px
        </span>
        <button className={styles.diagramMinimapReset} onClick={onReset}>
          Reset
        </button>
      </div>
    </div>
  );
}
