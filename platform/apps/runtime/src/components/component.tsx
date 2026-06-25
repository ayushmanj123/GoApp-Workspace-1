import React from "react";
import ControlRenderer from "../control-renderer";
import { relativeContainerStyle } from "../utils/control-layout";
import type { ControlPackage } from "../runtime-types";

export const Component: React.FC<{
  children?: React.ReactNode;
  templateControls?: ControlPackage[];
}> = ({ children, templateControls = [] }) => {
  if (templateControls.length > 0) {
    return (
      <div
        data-testid="runtime-component-instance"
        style={relativeContainerStyle()}
      >
        {templateControls.map((control) => (
          <ControlRenderer key={control.id} control={control} nested />
        ))}
      </div>
    );
  }

  return (
    <div data-testid="runtime-component-instance" style={relativeContainerStyle()}>
      {children}
    </div>
  );
};

export default Component;
