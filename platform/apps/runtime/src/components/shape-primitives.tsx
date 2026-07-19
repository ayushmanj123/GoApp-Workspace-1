import React from "react";
import { useResolvedPropertyText } from "../hooks/use-resolved-property-text";

function readNumber(property: unknown, fallback: number): number {
  if (typeof property === "number" && Number.isFinite(property)) {
    return property;
  }
  if (property && typeof property === "object" && "value" in property) {
    const parsed = Number((property as { value?: unknown }).value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

interface ShapeProps {
  fill?: unknown;
  stroke?: unknown;
  strokeWidth?: unknown;
  opacity?: unknown;
  src?: unknown;
  numPoints?: unknown;
  innerRadius?: unknown;
  style?: React.CSSProperties;
}

function ShapeSvgFrame({
  children,
  opacity,
  style,
}: {
  children: React.ReactNode;
  opacity?: unknown;
  style?: React.CSSProperties;
}) {
  const resolvedOpacity = readNumber(opacity, 1);
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ ...style, opacity: resolvedOpacity, display: "block" }}
    >
      {children}
    </svg>
  );
}

export function ShapeRectangle(props: ShapeProps) {
  const fill = useResolvedPropertyText(props.fill, "#4A90D9");
  const stroke = useResolvedPropertyText(props.stroke, "#1a1a1a");
  const strokeWidth = readNumber(props.strokeWidth, 1);
  return (
    <ShapeSvgFrame opacity={props.opacity} style={props.style}>
      <rect
        x={strokeWidth / 2}
        y={strokeWidth / 2}
        width={100 - strokeWidth}
        height={100 - strokeWidth}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke"
      />
    </ShapeSvgFrame>
  );
}

export function ShapeEllipse(props: ShapeProps) {
  const fill = useResolvedPropertyText(props.fill, "#7CB342");
  const stroke = useResolvedPropertyText(props.stroke, "#33691E");
  const strokeWidth = readNumber(props.strokeWidth, 1);
  return (
    <ShapeSvgFrame opacity={props.opacity} style={props.style}>
      <ellipse
        cx="50"
        cy="50"
        rx={50 - strokeWidth / 2}
        ry={50 - strokeWidth / 2}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke"
      />
    </ShapeSvgFrame>
  );
}

export function ShapeLine(props: ShapeProps) {
  const stroke = useResolvedPropertyText(props.stroke, "#333333");
  const strokeWidth = readNumber(props.strokeWidth, 2);
  return (
    <ShapeSvgFrame opacity={props.opacity} style={props.style}>
      <line
        x1="0"
        y1="50"
        x2="100"
        y2="50"
        stroke={stroke}
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke"
      />
    </ShapeSvgFrame>
  );
}

export function ShapeArrow(props: ShapeProps) {
  const stroke = useResolvedPropertyText(props.stroke, "#333333");
  const strokeWidth = readNumber(props.strokeWidth, 2);
  return (
    <ShapeSvgFrame opacity={props.opacity} style={props.style}>
      <defs>
        <marker
          id="arrowhead"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 6 3, 0 6" fill={stroke} />
        </marker>
      </defs>
      <line
        x1="0"
        y1="50"
        x2="92"
        y2="50"
        stroke={stroke}
        strokeWidth={strokeWidth}
        markerEnd="url(#arrowhead)"
        vectorEffect="non-scaling-stroke"
      />
    </ShapeSvgFrame>
  );
}

export function ShapeImage(props: ShapeProps) {
  const src = useResolvedPropertyText(props.src, "");
  const resolvedOpacity = readNumber(props.opacity, 1);
  if (!src) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#f0f0f0",
          border: "1px dashed #bbb",
          opacity: resolvedOpacity,
        }}
      />
    );
  }
  return (
    <img
      src={src}
      alt=""
      style={{
        width: "100%",
        height: "100%",
        objectFit: "fill",
        opacity: resolvedOpacity,
        boxSizing: "border-box",
      }}
    />
  );
}

export function ShapeStar(props: ShapeProps) {
  const fill = useResolvedPropertyText(props.fill, "#FFB300");
  const stroke = useResolvedPropertyText(props.stroke, "#F57C00");
  const strokeWidth = readNumber(props.strokeWidth, 1);
  const numPoints = readNumber(props.numPoints, 5);
  const innerRadius = readNumber(props.innerRadius, 20);
  const outerRadius = 45;
  const points: string[] = [];
  for (let i = 0; i < numPoints * 2; i += 1) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (Math.PI / numPoints) * i - Math.PI / 2;
    const x = 50 + radius * Math.cos(angle);
    const y = 50 + radius * Math.sin(angle);
    points.push(`${x},${y}`);
  }
  return (
    <ShapeSvgFrame opacity={props.opacity} style={props.style}>
      <polygon
        points={points.join(" ")}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke"
      />
    </ShapeSvgFrame>
  );
}
