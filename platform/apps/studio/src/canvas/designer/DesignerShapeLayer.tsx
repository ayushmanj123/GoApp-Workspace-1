import { useEffect, useState } from "react";
import { Ellipse, Arrow, Image as KonvaImage, Layer, Line, Rect, Star } from "react-konva";
import type { DesignerNode } from "./DesignerNode";
import { flattenDesignerNodes } from "./DesignerNodeRegistry";
import { readDesignerDisplay } from "./designer-display";
import { isShapeControlType } from "../../utils/shape-control-types";
import type { ArtboardOffset } from "../CoordinateSystem";

function readColor(property: unknown, fallback: string): string {
  const value = readDesignerDisplay(property, fallback);
  return value.startsWith("[") ? fallback : value || fallback;
}

function readNumber(property: unknown, fallback: number): number {
  const value = readDesignerDisplay(property, String(fallback));
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readPropertyRaw(control: DesignerNode["control"], name: string): unknown {
  return control.properties?.[name];
}

function DesignerShapeImage({
  x,
  y,
  width,
  height,
  src,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!cancelled) {
        setImage(img);
      }
    };
    img.onerror = () => {
      if (!cancelled) {
        setImage(null);
      }
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!image) {
    return (
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="#e8e8e8"
        stroke="#999"
        strokeWidth={1}
        dash={[6, 4]}
        listening={false}
      />
    );
  }
  return (
    <KonvaImage
      x={x}
      y={y}
      width={width}
      height={height}
      image={image}
      listening={false}
    />
  );
}

interface DesignerShapeLayerProps {
  nodes: DesignerNode[];
  offset: ArtboardOffset;
  zoom: number;
}

export function DesignerShapeLayer({ nodes, offset, zoom }: DesignerShapeLayerProps) {
  const scale = zoom / 100;
  // Paint low z first so higher z_index appears on top (Konva last-child wins).
  const shapes = flattenDesignerNodes(nodes)
    .filter((node) => isShapeControlType(node.type))
    .slice()
    .sort((a, b) => a.zIndex - b.zIndex || a.controlId.localeCompare(b.controlId));

  return (
    <Layer listening={false}>
      {shapes.map((node) => {
        const x = offset.stageX + node.absoluteBounds.x * scale;
        const y = offset.stageY + node.absoluteBounds.y * scale;
        const width = node.absoluteBounds.width * scale;
        const height = node.absoluteBounds.height * scale;
        const type = node.type.trim().toLowerCase();
        const fill = readColor(readPropertyRaw(node.control, "fill"), "#4A90D9");
        const stroke = readColor(readPropertyRaw(node.control, "stroke"), "#1a1a1a");
        const strokeWidth = readNumber(readPropertyRaw(node.control, "strokeWidth"), 1);
        const opacity = readNumber(readPropertyRaw(node.control, "opacity"), 1);

        if (type === "shape_rectangle") {
          return (
            <Rect
              key={node.controlId}
              x={x}
              y={y}
              width={width}
              height={height}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              opacity={opacity}
              cornerRadius={readNumber(readPropertyRaw(node.control, "radius"), 0) * scale}
              listening={false}
            />
          );
        }

        if (type === "shape_ellipse") {
          return (
            <Ellipse
              key={node.controlId}
              x={x + width / 2}
              y={y + height / 2}
              radiusX={width / 2}
              radiusY={height / 2}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              opacity={opacity}
              listening={false}
            />
          );
        }

        if (type === "shape_line") {
          return (
            <Line
              key={node.controlId}
              points={[x, y + height / 2, x + width, y + height / 2]}
              stroke={stroke}
              strokeWidth={strokeWidth}
              opacity={opacity}
              listening={false}
            />
          );
        }

        if (type === "shape_arrow") {
          return (
            <Arrow
              key={node.controlId}
              points={[x, y + height / 2, x + width, y + height / 2]}
              stroke={stroke}
              fill={stroke}
              strokeWidth={strokeWidth}
              opacity={opacity}
              listening={false}
            />
          );
        }

        if (type === "shape_star") {
          const numPoints = readNumber(readPropertyRaw(node.control, "numPoints"), 5);
          const innerRadius = readNumber(
            readPropertyRaw(node.control, "innerRadius"),
            Math.min(width, height) / 4,
          );
          return (
            <Star
              key={node.controlId}
              x={x + width / 2}
              y={y + height / 2}
              numPoints={numPoints}
              innerRadius={innerRadius * scale}
              outerRadius={Math.min(width, height) / 2}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              opacity={opacity}
              listening={false}
            />
          );
        }

        if (type === "shape_image") {
          const src = readDesignerDisplay(readPropertyRaw(node.control, "src"), "");
          if (!src || src.startsWith("[")) {
            return (
              <Rect
                key={node.controlId}
                x={x}
                y={y}
                width={width}
                height={height}
                fill="#e8e8e8"
                stroke="#999"
                strokeWidth={1}
                dash={[6, 4]}
                listening={false}
              />
            );
          }
          return (
            <DesignerShapeImage
              key={node.controlId}
              x={x}
              y={y}
              width={width}
              height={height}
              src={src}
            />
          );
        }

        return null;
      })}
    </Layer>
  );
}
