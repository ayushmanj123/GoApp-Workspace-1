import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect } from "react-konva";
import { CanvasGrid } from "../components/canvas/CanvasGrid";
import { useStudioStore } from "../store/studioStore";
import { useApplicationStore } from "../store/applicationStore";
import { ARTBOARD_H, ARTBOARD_W } from "./constants";
import { computeArtboardOffset, toScreenBounds } from "./CoordinateSystem";
import { DesignerProvider } from "./designer/DesignerProvider";
import { DesignerNodeRenderer } from "./designer/DesignerNodeRenderer";
import { buildDesignerNodeRegistry } from "./designer/DesignerNodeRegistry";
import { useInteractionStore } from "./interaction/interactionStore";
import { useCanvasEventRouter } from "./interaction/useCanvasEventRouter";
import { OverlaySystem } from "./overlay/OverlaySystem";
import styles from "../components/canvas/CanvasPanel.module.css";

export function CanvasSurface() {
  const containerRef = useRef<HTMLDivElement>(null);
  const screenName = useStudioStore((s) => s.screenName);
  const zoom = useStudioStore((s) => s.zoom);
  const selectedScreenId = useApplicationStore((s) => s.selectedScreenId);
  const controls = useApplicationStore((s) => s.controls);
  const controlsLoading = useApplicationStore((s) => s.controlsLoading);
  const controlsError = useApplicationStore((s) => s.controlsError);
  const loadControls = useApplicationStore((s) => s.loadControls);
  const primaryControlId = useInteractionStore((s) => s.primaryControlId);

  const [size, setSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width: Math.max(width, 1), height: Math.max(height, 1) });
    });
    ro.observe(el);
    setSize({
      width: Math.max(el.clientWidth, 1),
      height: Math.max(el.clientHeight, 1),
    });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!selectedScreenId) {
      return;
    }
    loadControls(selectedScreenId);
    useInteractionStore.getState().setActiveScreen(selectedScreenId);
  }, [selectedScreenId, loadControls]);

  const offset = useMemo(
    () => computeArtboardOffset(size.width, size.height, zoom),
    [size.width, size.height, zoom],
  );

  const designerNodes = useMemo(
    () => buildDesignerNodeRegistry(controls),
    [controls],
  );

  const rootNodes = designerNodes;

  const scale = zoom / 100;
  const scaledW = ARTBOARD_W * scale;
  const scaledH = ARTBOARD_H * scale;

  const { onPointerDown, onPointerMove, onPointerLeave } = useCanvasEventRouter(
    containerRef,
    designerNodes,
    offset,
    zoom,
  );

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <span className={styles.screenLabel}>{screenName}</span>
        <div className={styles.toolbarRight}>
          {controlsError && (
            <span className={styles.errorBadge}>controls error</span>
          )}
          {controlsLoading && (
            <span className={styles.loadingBadge}>loading controls…</span>
          )}
          {!controlsLoading && controls.length > 0 && (
            <span className={styles.controlsBadge}>
              {controls.length} control{controls.length !== 1 ? "s" : ""}
            </span>
          )}
          <span className={styles.artboardSize}>
            {ARTBOARD_W} × {ARTBOARD_H}
          </span>
        </div>
      </div>

      <div
        ref={containerRef}
        className={styles.stageContainer}
        data-testid="studio-canvas-stage"
      >
        <div className={styles.backgroundStage}>
          <Stage width={size.width} height={size.height} listening={false}>
            <Layer listening={false}>
              <Rect
                x={0}
                y={0}
                width={size.width}
                height={size.height}
                fill="#11111b"
                listening={false}
              />
            </Layer>
            <CanvasGrid width={size.width} height={size.height} />
            <Layer listening={false}>
              <Rect
                x={offset.stageX}
                y={offset.stageY}
                width={scaledW}
                height={scaledH}
                fill="#1e1e2e"
                stroke="#45475a"
                strokeWidth={1}
                shadowColor="rgba(0,0,0,0.5)"
                shadowBlur={24}
                shadowOffsetY={4}
                listening={false}
              />
            </Layer>
          </Stage>
        </div>

        <DesignerProvider>
          <div className={styles.controlOverlay}>
            {rootNodes.map((node) => {
              const screen = toScreenBounds(node.absoluteBounds, offset, zoom);
              return (
                <div
                  key={node.controlId}
                  className={styles.controlPreview}
                  style={{
                    left: screen.left,
                    top: screen.top,
                    width: screen.width,
                    height: screen.height,
                  }}
                >
                  <DesignerNodeRenderer
                    control={node.control}
                    selected={primaryControlId === node.controlId}
                  />
                </div>
              );
            })}
          </div>
        </DesignerProvider>

        <div
          className={styles.interactionStage}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
        />

        <OverlaySystem
          nodes={designerNodes}
          offset={offset}
          zoom={zoom}
          viewportWidth={size.width}
          viewportHeight={size.height}
        />
      </div>
    </div>
  );
}
