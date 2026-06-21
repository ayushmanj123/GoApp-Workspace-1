import { Layer, Line } from 'react-konva';

const GRID_SIZE = 20;
const GRID_COLOR = 'rgba(255,255,255,0.04)';
const ORIGIN_COLOR = 'rgba(255,255,255,0.10)';

interface CanvasGridProps {
  width: number;
  height: number;
}

/**
 * Renders a static dot/line grid as a Konva Layer.
 * Draws minor lines every GRID_SIZE px and slightly brighter axis lines at x=0/y=0.
 */
export function CanvasGrid({ width, height }: CanvasGridProps) {
  const verticals: JSX.Element[] = [];
  const horizontals: JSX.Element[] = [];

  // Vertical lines
  for (let x = 0; x <= width; x += GRID_SIZE) {
    verticals.push(
      <Line
        key={`v${x}`}
        points={[x, 0, x, height]}
        stroke={x === 0 ? ORIGIN_COLOR : GRID_COLOR}
        strokeWidth={x === 0 ? 1 : 0.5}
        listening={false}
        perfectDrawEnabled={false}
      />,
    );
  }

  // Horizontal lines
  for (let y = 0; y <= height; y += GRID_SIZE) {
    horizontals.push(
      <Line
        key={`h${y}`}
        points={[0, y, width, y]}
        stroke={y === 0 ? ORIGIN_COLOR : GRID_COLOR}
        strokeWidth={y === 0 ? 1 : 0.5}
        listening={false}
        perfectDrawEnabled={false}
      />,
    );
  }

  return (
    <Layer listening={false}>
      {verticals}
      {horizontals}
    </Layer>
  );
}
