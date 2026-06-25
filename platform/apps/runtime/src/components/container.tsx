import React from "react";
import ControlRenderer from "../control-renderer";
import { fillParentStyle, relativeContainerStyle } from "../utils/control-layout";
import type { ControlPackage } from "../runtime-types";

export const Container: React.FC<{
  children?: React.ReactNode;
  templateControls?: ControlPackage[];
  style?: React.CSSProperties;
}> = ({ children, templateControls = [], style }) => {
  if (templateControls.length > 0) {
    return (
      <div style={{ ...relativeContainerStyle(), ...(style || {}) }}>
        {templateControls.map((control) => (
          <ControlRenderer key={control.id} control={control} nested />
        ))}
      </div>
    );
  }

  return (
    <div style={{ ...relativeContainerStyle(), ...(style || {}), ...fillParentStyle() }}>
      {children}
    </div>
  );
};

export default Container;
