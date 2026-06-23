import { useCallback, useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Transformer } from "react-konva";
import Konva from "konva";
import { CanvasGrid } from "./CanvasGrid";
import { StudioControlRenderer } from "./StudioControlRenderer";
import { FormulaProvider } from "../../../../runtime/src/formula/formula-context";
import { useStudioStore } from "../../store/studioStore";
import { useApplicationStore } from "../../store/applicationStore";
import { supportsStudioRegistryRendering } from "../../utils/registry-type";
import styles from "./CanvasPanel.module.css";

// Default artboard dimensions (1366×768 — standard canvas size)
const ARTBOARD_W = 1366;
const ARTBOARD_H = 768;

// Padding around the artboard inside the stage
const PADDING = 48;

export function CanvasPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const controlNodeRefs = useRef(new Map<string, Konva.Rect>());
  const screenName = useStudioStore((s) => s.screenName);
  const appName = useStudioStore((s) => s.appName);
  const selectedControlId = useStudioStore((s) => s.selectedControlId);
  const selectControl = useStudioStore((s) => s.selectControl);

  const selectedScreenId = useApplicationStore((s) => s.selectedScreenId);
  const controls = useApplicationStore((s) => s.controls);
  const controlsLoading = useApplicationStore((s) => s.controlsLoading);
  const controlsError = useApplicationStore((s) => s.controlsError);
  const loadControls = useApplicationStore((s) => s.loadControls);
  const updateControl = useApplicationStore((s) => s.updateControl);

  const [size, setSize] = useState({ width: 800, height: 600 });

  // Track container size and keep stage filling it
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

  // Load controls whenever the selected screen changes
  useEffect(() => {
    if (!selectedScreenId) return;
    loadControls(selectedScreenId);
  }, [selectedScreenId, loadControls]);

  // Centre the artboard inside the stage
  const offsetX = (size.width - ARTBOARD_W) / 2;
  const offsetY = (size.height - ARTBOARD_H) / 2;
  const stageX = Math.max(offsetX, PADDING);
  const stageY = Math.max(offsetY, PADDING);
  const sortedControls = [...controls].sort((a, b) => a.z_index - b.z_index);
  const updateControlPosition = useCallback(
    (controlId: string, nextX: number, nextY: number) => {
      updateControl(controlId, {
        x: Math.round(nextX),
        y: Math.round(nextY),
      });
    },
    [updateControl],
  );

  const updateControlBounds = useCallback(
    (controlId: string, nextX: number, nextY: number, nextWidth: number, nextHeight: number) => {
      updateControl(controlId, {
        x: Math.round(nextX),
        y: Math.round(nextY),
        width: Math.max(1, Math.round(nextWidth)),
        height: Math.max(1, Math.round(nextHeight)),
      });
    },
    [updateControl],
  );

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;

    if (!transformer || !stage) {
      return;
    }

    if (!selectedControlId) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }

    const node = controlNodeRefs.current.get(selectedControlId);
    if (!node) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }

    transformer.nodes([node]);
    transformer.getLayer()?.batchDraw();
  }, [selectedControlId, controls]);

  return (
    <div className={styles.wrapper}>
      {/* Top toolbar strip */}
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

      {/* Konva stage container */}
      <div ref={containerRef} className={styles.stageContainer}>
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          draggable={false}
          onMouseDown={(event) => {
            if (event.target === event.target.getStage()) {
              selectControl(null);
            }
          }}
        >
          {/* Full-stage background fill */}
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

          {/* Grid drawn across the full stage */}
          <CanvasGrid width={size.width} height={size.height} />

          {/* Artboard */}
          <Layer>
            <Rect
              x={stageX}
              y={stageY}
              width={ARTBOARD_W}
              height={ARTBOARD_H}
              fill="#1e1e2e"
              stroke="#45475a"
              strokeWidth={1}
              shadowColor="rgba(0,0,0,0.5)"
              shadowBlur={24}
              shadowOffsetY={4}
              listening={false}
            />
          </Layer>

          <Layer>
            {sortedControls.map((control) => {
              const controlX = stageX + control.x;
              const controlY = stageY + control.y;
              const controlWidth = Math.max(control.width, 1);
              const controlHeight = Math.max(control.height, 1);
              const isSelected = selectedControlId === control.id;
              const usesRegistryRendering = supportsStudioRegistryRendering(
                control.control_type,
              );

              return (
                <Rect
                  key={control.id}
                  ref={(node) => {
                    if (node) {
                      controlNodeRefs.current.set(control.id, node);
                    } else {
                      controlNodeRefs.current.delete(control.id);
                    }
                  }}
                  id={control.id}
                  x={controlX}
                  y={controlY}
                  width={controlWidth}
                  height={controlHeight}
                  fill={
                    usesRegistryRendering
                      ? "transparent"
                      : "rgba(137, 180, 250, 0.10)"
                  }
                  stroke={isSelected ? "#89b4fa" : "#6c7086"}
                  strokeWidth={isSelected ? 2 : 1}
                  draggable
                  listening
                  onMouseDown={(event) => {
                    event.cancelBubble = true;
                    selectControl(control.id);
                  }}
                  onDragStart={(event) => {
                    event.cancelBubble = true;
                    selectControl(control.id);
                  }}
                  onDragMove={(event) => {
                    const node = event.target;
                    updateControlPosition(
                      control.id,
                      node.x() - stageX,
                      node.y() - stageY,
                    );
                  }}
                  onDragEnd={(event) => {
                    const node = event.target;
                    updateControlPosition(
                      control.id,
                      node.x() - stageX,
                      node.y() - stageY,
                    );
                  }}
                  onTransformEnd={(event) => {
                    const node = event.target;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();
                    node.scaleX(1);
                    node.scaleY(1);
                    updateControlBounds(
                      control.id,
                      node.x() - stageX,
                      node.y() - stageY,
                      node.width() * scaleX,
                      node.height() * scaleY,
                    );
                  }}
                />
              );
            })}
            <Transformer
              ref={transformerRef}
              rotateEnabled={false}
              enabledAnchors={[
                "top-left",
                "top-center",
                "top-right",
                "middle-right",
                "bottom-right",
                "bottom-center",
                "bottom-left",
                "middle-left",
              ]}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 10 || newBox.height < 10) {
                  return oldBox;
                }
                return newBox;
              }}
            />
          </Layer>
        </Stage>

        <FormulaProvider appName={appName} controls={controls}>
          <div className={styles.controlOverlay}>
            {sortedControls.map((control) => {
              if (!supportsStudioRegistryRendering(control.control_type)) {
                return null;
              }

              return (
                <div
                  key={control.id}
                  className={styles.controlPreview}
                  style={{
                    left: stageX + control.x,
                    top: stageY + control.y,
                    width: Math.max(control.width, 1),
                    height: Math.max(control.height, 1),
                  }}
                >
                  <StudioControlRenderer control={control} />
                </div>
              );
            })}
          </div>
        </FormulaProvider>
      </div>
    </div>
  );
}
