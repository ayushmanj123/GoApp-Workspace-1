import React from "react";
import { ScreenPackage } from "./runtime-types";
import ControlRenderer from "./control-renderer";

export const ARTBOARD_WIDTH = 1366;
export const ARTBOARD_HEIGHT = 768;

export const ScreenRenderer: React.FC<{ screen?: ScreenPackage }> = ({
  screen,
}) => {
  if (!screen) return null;
  return (
    <div
      data-testid={`screen-${screen.id}`}
      style={{
        position: "relative",
        width: ARTBOARD_WIDTH,
        height: ARTBOARD_HEIGHT,
        overflow: "hidden",
        boxSizing: "border-box",
        background: "var(--color-bg-artboard, #ffffff)",
      }}
    >
      {screen.controls.map((control) => (
        <ControlRenderer key={control.id.toString()} control={control} />
      ))}
    </div>
  );
};

export default ScreenRenderer;
