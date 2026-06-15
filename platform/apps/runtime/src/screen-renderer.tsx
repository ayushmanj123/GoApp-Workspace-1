import React from "react";
import { ScreenPackage } from "./runtime-types";
import ControlRenderer from "./control-renderer";

export const ScreenRenderer: React.FC<{ screen?: ScreenPackage }> = ({
  screen,
}) => {
  if (!screen) return null;
  return (
    <div data-testid={`screen-${screen.id}`} style={{ padding: 8 }}>
      <h3>{screen.name}</h3>
      <div>
        {screen.controls.map((c) => (
          <div key={c.id.toString()} style={{ margin: 4 }}>
            <ControlRenderer control={c} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScreenRenderer;
