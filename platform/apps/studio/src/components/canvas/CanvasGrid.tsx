import { Layer, Circle } from "react-konva";

const GRID_SIZE = 20;
const DOT_COLOR = "rgba(0, 0, 0, 0.06)";

interface CanvasGridProps {
  width: number;
  height: number;
}

export function CanvasGrid({ width, height }: CanvasGridProps) {
  const dots: JSX.Element[] = [];

  for (let x = 0; x <= width; x += GRID_SIZE) {
    for (let y = 0; y <= height; y += GRID_SIZE) {
      dots.push(
        <Circle
          key={`${x}-${y}`}
          x={x}
          y={y}
          radius={1}
          fill={DOT_COLOR}
          listening={false}
          perfectDrawEnabled={false}
        />,
      );
    }
  }

  return <Layer listening={false}>{dots}</Layer>;
}
