import { Button, IconAdd, IconCheckCircle, IconFit, IconGrid, IconHub, IconLink, IconMap, IconAccountTree, IconZoomIn, IconZoomOut } from "../../../ui";
import type { AppDomain } from "./types";
import styles from "../database-manager.module.css";

interface DiagramTopbarProps {
  tableCount: number;
  edgeCount: number;
  zoomPct: number;
  snap: boolean;
  minimap: boolean;
  fkVisible: boolean;
  activeApp: string | null;
  domains: AppDomain[];
  canConnect: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onAutoLayout: () => void;
  onToggleSnap: () => void;
  onToggleMinimap: () => void;
  onToggleFk: () => void;
  onConnect: () => void;
  onAddTable: () => void;
  onFilter: (app: string | null) => void;
}

export function DiagramTopbar(props: DiagramTopbarProps) {
  const {
    tableCount,
    edgeCount,
    zoomPct,
    snap,
    minimap,
    fkVisible,
    activeApp,
    domains,
    canConnect,
    onZoomIn,
    onZoomOut,
    onFit,
    onAutoLayout,
    onToggleSnap,
    onToggleMinimap,
    onToggleFk,
    onConnect,
    onAddTable,
    onFilter,
  } = props;

  return (
    <div className={styles.diagramToolbar}>
      <div className={styles.diagramToolbarRow}>
        <div className={styles.diagramBreadcrumb}>
          <div className={styles.diagramBreadcrumbIcon}>
            <IconHub size={18} />
          </div>
          <div>
            <div className={styles.diagramCrumbText}>
              <span>Data Workspace</span>
              <span className={styles.diagramCrumbSep}>/</span>
              <span className={styles.diagramCrumbActive}>All Tables</span>
            </div>
            <div className={styles.diagramTitleRow}>
              <h1 className={styles.diagramTitle}>Schema Topology</h1>
              <span className={styles.diagramVersionBadge}>{tableCount} tables</span>
            </div>
          </div>
        </div>

        <div className={styles.diagramControls}>
          <div className={styles.diagramCluster}>
            <button className={styles.diagramClusterBtn} title="Zoom out" onClick={onZoomOut}>
              <IconZoomOut size={16} />
            </button>
            <span className={styles.diagramZoomLabel}>{zoomPct}%</span>
            <button className={styles.diagramClusterBtn} title="Zoom in" onClick={onZoomIn}>
              <IconZoomIn size={16} />
            </button>
            <span className={styles.diagramClusterDivider} />
            <button className={styles.diagramClusterBtn} title="Fit to screen" onClick={onFit}>
              <IconFit size={16} />
            </button>
          </div>

          <div className={styles.diagramCluster}>
            <button
              className={[styles.diagramClusterBtn, snap ? styles.diagramClusterBtnActive : ""]
                .filter(Boolean)
                .join(" ")}
              title="Auto-layout"
              onClick={onAutoLayout}
            >
              <IconAccountTree size={16} />
            </button>
            <button
              className={[styles.diagramClusterBtn, snap ? styles.diagramClusterBtnActive : ""]
                .filter(Boolean)
                .join(" ")}
              title="Snap to grid"
              onClick={onToggleSnap}
            >
              <IconGrid size={16} />
            </button>
            <button
              className={[
                styles.diagramClusterBtn,
                minimap ? styles.diagramClusterBtnActive : "",
              ]
                .filter(Boolean)
                .join(" ")}
              title="Toggle minimap"
              onClick={onToggleMinimap}
            >
              <IconMap size={16} />
            </button>
          </div>

          <div className={styles.diagramPrimaryActions}>
            <Button
              variant="outlined"
              size="sm"
              disabled={!canConnect}
              onClick={onConnect}
            >
              <IconLink size={14} /> Connect
            </Button>
            <Button variant="primary" size="sm" onClick={onAddTable}>
              <IconAdd size={14} /> Add Table
            </Button>
          </div>
        </div>
      </div>

      <div className={styles.diagramFilters}>
        <button
          className={[
            styles.diagramFilterPill,
            activeApp === null ? styles.diagramFilterPillActive : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onFilter(null)}
        >
          <span>Show All</span>
          <span
            className={[
              styles.diagramFilterCount,
              activeApp === null ? styles.diagramFilterCountActive : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {tableCount}
          </span>
        </button>
        {domains.map((d) => {
          const active = activeApp === d.name;
          return (
            <button
              key={d.name}
              className={[
                styles.diagramFilterPill,
                active ? styles.diagramFilterPillActive : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onFilter(d.name)}
            >
              <span
                className={styles.diagramFilterDot}
                style={{ background: d.color }}
              />
              <span>{d.name}</span>
              <span
                className={[
                  styles.diagramFilterCount,
                  active ? styles.diagramFilterCountActive : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {d.count}
              </span>
            </button>
          );
        })}
        <span className={styles.diagramFilterDivider} />
        <button
          className={[
            styles.diagramFilterPill,
            fkVisible ? styles.diagramFilterPillActive : "",
          ]
            .filter(Boolean)
          .join(" ")}
          onClick={onToggleFk}
          title="Toggle relationship lines"
        >
          FK Lines Visible
        </button>
        <div className={styles.diagramStatus}>
          <span className={styles.diagramStatusOk}>
            <IconCheckCircle size={13} /> Synced
          </span>
          <span>•</span>
          <span>
            {tableCount} Tables • {edgeCount} Cardinalities
          </span>
        </div>
      </div>
    </div>
  );
}
