import React from "react";
import ControlRenderer from "../control-renderer";
import {
  fillParentStyle,
  normalizeFlexDirection,
  relativeContainerStyle,
} from "../utils/control-layout";
import type { ControlPackage } from "../runtime-types";

export const Container: React.FC<{
  children?: React.ReactNode;
  templateControls?: ControlPackage[];
  direction?: unknown;
  style?: React.CSSProperties;
}> = ({ children, templateControls = [], direction, style }) => {
  const flexDirection = normalizeFlexDirection(direction);

  if (templateControls.length > 0) {
    return (
      <div
        data-testid="container-pack"
        data-direction={flexDirection}
        style={{
          ...relativeContainerStyle(),
          display: "flex",
          flexDirection,
          flexWrap: "nowrap",
          gap: 8,
          alignItems: flexDirection === "row" ? "stretch" : "stretch",
          overflow: "auto",
          ...(style || {}),
        }}
      >
        {templateControls.map((control) => (
          <div
            key={control.id}
            style={{
              position: "relative",
              width: control.width > 0 ? control.width : undefined,
              height: control.height > 0 ? control.height : undefined,
              flexShrink: 0,
              boxSizing: "border-box",
            }}
          >
            <ControlRenderer control={control} nested />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        ...relativeContainerStyle(),
        display: "flex",
        flexDirection,
        ...(style || {}),
        ...fillParentStyle(),
      }}
    >
      {children}
    </div>
  );
};

export default Container;
