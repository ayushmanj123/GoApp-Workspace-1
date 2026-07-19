import React from "react";
import { useResolvedPropertyText } from "../hooks/use-resolved-property-text";

export const Image: React.FC<any> = ({ src, alt = "" }) => {
  const resolvedSrc = useResolvedPropertyText(src, "");
  const resolvedAlt = useResolvedPropertyText(alt, "Image");

  if (!resolvedSrc) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#f0f0f0",
          border: "1px dashed #bbb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          color: "#666",
        }}
      >
        Image
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={resolvedAlt}
      style={{ width: "100%", height: "100%", objectFit: "contain", boxSizing: "border-box" }}
    />
  );
};
export default Image;
