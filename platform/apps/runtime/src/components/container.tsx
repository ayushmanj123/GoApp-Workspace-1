import React from "react";
import ControlRenderer from "../control-renderer";
import {
  fillParentStyle,
  normalizeFlexDirection,
  relativeContainerStyle,
} from "../utils/control-layout";
import type { ControlPackage } from "../runtime-types";
import { useControlChrome } from "../hooks/use-control-chrome";
import { useResolvedPropertyText } from "../hooks/use-resolved-property-text";
import { readBooleanProperty, readOptionalNumber, readPropertyText } from "../utils/appearance-style";

function flexAlign(raw: unknown, fallback: string): string {
  const text = readPropertyText(raw);
  return text || fallback;
}

export const Container: React.FC<{
  children?: React.ReactNode;
  templateControls?: ControlPackage[];
  direction?: unknown;
  style?: React.CSSProperties;
  gap?: unknown;
  alignItems?: unknown;
  justifyContent?: unknown;
  wrap?: unknown;
  overflow?: unknown;
  tooltip?: unknown;
  fill?: unknown;
  color?: unknown;
  borderColor?: unknown;
  borderThickness?: unknown;
  radius?: unknown;
  padding?: unknown;
  opacity?: unknown;
}> = (props) => {
  const {
    children,
    templateControls = [],
    direction,
    style,
    gap,
    alignItems,
    justifyContent,
    wrap,
    overflow,
    tooltip,
  } = props;
  const flexDirection = normalizeFlexDirection(direction);
  const chrome = useControlChrome(props, { includeText: false });
  const resolvedTooltip = useResolvedPropertyText(tooltip);
  const packStyle: React.CSSProperties = {
    gap: readOptionalNumber(gap) ?? 8,
    alignItems: flexAlign(alignItems, "stretch"),
    justifyContent: flexAlign(justifyContent, "flex-start"),
    flexWrap: readBooleanProperty(wrap, false) ? "wrap" : "nowrap",
    overflow: readPropertyText(overflow) || "auto",
    ...chrome.style,
  };

  if (templateControls.length > 0) {
    return (
      <div
        data-testid="container-pack"
        data-direction={flexDirection}
        title={resolvedTooltip || undefined}
        style={{
          ...relativeContainerStyle(),
          display: "flex",
          flexDirection,
          ...packStyle,
          ...(style || {}),
        }}
      >
        {templateControls.map((control) => (
          <div
            key={control.id}
            style={{
              position: "relative",
              width: (control.width ?? 0) > 0 ? control.width : undefined,
              height: (control.height ?? 0) > 0 ? control.height : undefined,
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
      title={resolvedTooltip || undefined}
      style={{
        ...relativeContainerStyle(),
        display: "flex",
        flexDirection,
        ...packStyle,
        ...(style || {}),
        ...fillParentStyle(),
      }}
    >
      {children}
    </div>
  );
};

export default Container;
