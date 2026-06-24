import React from "react";
import ControlRenderer from "../control-renderer";
import type { ControlPackage } from "../runtime-types";

export const Component: React.FC<{
  templateControls?: ControlPackage[];
  children?: React.ReactNode;
}> = ({ templateControls = [], children }) => {
  if (templateControls.length > 0) {
    return (
      <div
        data-testid="component-instance"
        style={{ position: "relative", width: "100%", height: "100%", minHeight: 24 }}
      >
        {templateControls.map((control) => (
          <div
            key={control.id}
            style={{
              position: "absolute",
              left: control.x,
              top: control.y,
              width: control.width,
              height: control.height,
            }}
          >
            <ControlRenderer control={control} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      data-testid="component-instance"
      style={{ position: "relative", width: "100%", height: "100%", minHeight: 24 }}
    >
      {children}
    </div>
  );
};

export default Component;
