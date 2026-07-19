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
import { hitTestContainerAtPoint } from "./interaction/HitTestService";
import { DesignerShapeLayer } from "./designer/DesignerShapeLayer";
import { isShapeControlType } from "../utils/shape-control-types";
import { OverlaySystem } from "./overlay/OverlaySystem";
import { IconFit, IconZoomIn, IconZoomOut } from "../components/ui/icons";
import styles from "../components/canvas/CanvasPanel.module.css";

export function CanvasSurface() {
  const containerRef = useRef<HTMLDivElement>(null);
  const zoom = useStudioStore((s) => s.zoom);
  const setZoom = useStudioStore((s) => s.setZoom);
  const selectedScreenId = useApplicationStore((s) => s.selectedScreenId);
  const controls = useApplicationStore((s) => s.controls);
  const controlsLoading = useApplicationStore((s) => s.controlsLoading);
  const controlsError = useApplicationStore((s) => s.controlsError);
  const loadControls = useApplicationStore((s) => s.loadControls);
  const primaryControlId = useInteractionStore((s) => s.primaryControlId);

  const [size, setSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
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
    if (!selectedScreenId) return;
    loadControls(selectedScreenId);
    useInteractionStore.getState().setActiveScreen(selectedScreenId);
  }, [selectedScreenId, loadControls]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -10 : 10;
        setZoom(useStudioStore.getState().zoom + delta);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setZoom]);

  const createControl = useApplicationStore((s) => s.createControl);

  const offset = useMemo(
    () => computeArtboardOffset(size.width, size.height, zoom),
    [size.width, size.height, zoom],
  );

  const designerNodes = useMemo(
    () => buildDesignerNodeRegistry(controls),
    [controls],
  );

  const artboardPointFromClient = (clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) {
      return null;
    }
    const rect = el.getBoundingClientRect();
    const scale = zoom / 100;
    return {
      x: (clientX - rect.left - offset.stageX) / scale,
      y: (clientY - rect.top - offset.stageY) / scale,
    };
  };

  const isToolboxDrag = (e: React.DragEvent) =>
    Array.from(e.dataTransfer.types).includes("application/goapps-control");

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isToolboxDrag(e)) {
      return;
    }
    const point = artboardPointFromClient(e.clientX, e.clientY);
    if (!point) {
      return;
    }
    const containerEditId = useInteractionStore.getState().containerEditId;
    const container = hitTestContainerAtPoint(designerNodes, point.x, point.y, {
      containerEditId,
    });
    useInteractionStore.getState().setDropTarget(container?.controlId ?? null);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) {
      return;
    }
    useInteractionStore.getState().setDropTarget(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    useInteractionStore.getState().setDropTarget(null);
    const type = e.dataTransfer.getData("application/goapps-control");
    if (!type) {
      return;
    }

    const point = artboardPointFromClient(e.clientX, e.clientY);
    if (!point) {
      createControl(type as import("../control-defaults").ToolboxControlType);
      return;
    }

    const containerEditId = useInteractionStore.getState().containerEditId;
    const container = hitTestContainerAtPoint(designerNodes, point.x, point.y, {
      containerEditId,
    });

    if (container) {
      const localX = Math.round(point.x - container.absoluteBounds.x);
      const localY = Math.round(point.y - container.absoluteBounds.y);
      createControl(type as import("../control-defaults").ToolboxControlType, {
        parent_control_id: container.controlId,
        x: Math.max(0, localX),
        y: Math.max(0, localY),
      });
      return;
    }

    createControl(type as import("../control-defaults").ToolboxControlType);
  };

  const scale = zoom / 100;
  const scaledW = ARTBOARD_W * scale;
  const scaledH = ARTBOARD_H * scale;

  const { onPointerDown, onPointerMove, onPointerLeave } = useCanvasEventRouter(
    containerRef,
    designerNodes,
    offset,
    zoom,
  );

  const handleFit = () => {
    const padding = 80;
    const scaleX = (size.width - padding) / ARTBOARD_W;
    const scaleY = (size.height - padding) / ARTBOARD_H;
    const fitZoom = Math.floor(Math.min(scaleX, scaleY) * 100);
    setZoom(Math.min(200, Math.max(25, fitZoom)));
  };

  return (
    <div className={styles.wrapper}>
      <div
        ref={containerRef}
        className={styles.stageContainer}
        data-testid="studio-canvas-stage"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className={styles.backgroundStage}>
          <Stage width={size.width} height={size.height} listening={false}>
            <Layer listening={false}>
              <Rect
                x={0}
                y={0}
                width={size.width}
                height={size.height}
                fill="#F1F3F7"
                listening={false}
              />
            </Layer>
            <CanvasGrid width={size.width} height={size.height} />
            <Layer listening={false}>
              <Rect
                x={offset.stageX - 12}
                y={offset.stageY - 12}
                width={scaledW + 24}
                height={scaledH + 24}
                fill="#FFFFFF"
                cornerRadius={12}
                shadowColor="rgba(0,0,0,0.08)"
                shadowBlur={24}
                shadowOffsetY={4}
                listening={false}
              />
              <Rect
                x={offset.stageX}
                y={offset.stageY}
                width={scaledW}
                height={scaledH}
                fill="#FFFFFF"
                stroke="#E5E5EA"
                strokeWidth={1}
                listening={false}
              />
            </Layer>
            <DesignerShapeLayer nodes={designerNodes} offset={offset} zoom={zoom} />
          </Stage>
        </div>

        <DesignerProvider>
          <div className={styles.controlOverlay}>
            {designerNodes
              .filter((node) => !isShapeControlType(node.type))
              .map((node) => {
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

        <div className={styles.statusOverlay}>
          {controlsError && (
            <span className={styles.errorBadge}>controls error</span>
          )}
          {controlsLoading && (
            <span className={styles.loadingBadge}>loading…</span>
          )}
          {!controlsLoading && controls.length > 0 && (
            <span className={styles.badge}>
              {controls.length} control{controls.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className={styles.zoomControls}>
          <button
            type="button"
            className={styles.zoomBtn}
            title="Zoom out"
            onClick={() => setZoom(zoom - 25)}
          >
            <IconZoomOut />
          </button>
          <span className={styles.zoomLabel}>{zoom}%</span>
          <button
            type="button"
            className={styles.zoomBtn}
            title="Zoom in"
            onClick={() => setZoom(zoom + 25)}
          >
            <IconZoomIn />
          </button>
          <button
            type="button"
            className={styles.zoomBtn}
            title="Fit to screen"
            onClick={handleFit}
          >
            <IconFit />
          </button>
        </div>
      </div>
    </div>
  );
}
