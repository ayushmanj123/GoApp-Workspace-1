import React from "react";
import type { ControlPackage } from "./runtime-types";
import {
  absoluteLayoutStyle,
  resolveControlLayout,
  type ResolvedLayout,
} from "./utils/control-layout";

interface LayoutControlFrameProps {
  control: ControlPackage;
  layout?: ResolvedLayout;
  children: React.ReactNode;
}

export function LayoutControlFrame({
  control,
  layout: layoutOverride,
  children,
}: LayoutControlFrameProps) {
  const layout = layoutOverride ?? resolveControlLayout(control);
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
