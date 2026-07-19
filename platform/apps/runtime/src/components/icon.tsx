import React from "react";
import { useResolvedPropertyText } from "../hooks/use-resolved-property-text";

const GLYPHS: Record<string, string> = {
  star: "★",
  heart: "♥",
  check: "✓",
  home: "⌂",
  user: "👤",
  settings: "⚙",
};

export const Icon: React.FC<any> = ({ icon = "star", color = "#333333" }) => {
  const iconName = useResolvedPropertyText(icon, "star");
  const resolvedColor = useResolvedPropertyText(color, "#333333");
  const glyph =
    GLYPHS[iconName.toLowerCase()] ??
    (iconName.length <= 2 ? iconName : "●");

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "min(32px, 80%)",
        color: resolvedColor,
        boxSizing: "border-box",
      }}
    >
      {glyph}
    </div>
  );
};
export default Icon;
