import React from "react";
import type { ControlPackage } from "./runtime-types";
import {
  absoluteLayoutStyle,
  resolveControlLayout,
} from "./utils/control-layout";

interface LayoutControlFrameProps {
  control: ControlPackage;
  children: React.ReactNode;
}

export function LayoutControlFrame({
  control,
  children,
}: LayoutControlFrameProps) {
  const layout = resolveControlLayout(control);
  if (!layout.visible) {
    return null;
  }
  return (
    <div
      data-control-id={control.name ?? control.id}
      data-display-mode={layout.displayMode}
      style={absoluteLayoutStyle(layout)}
    >
      {children}
    </div>
  );
}
