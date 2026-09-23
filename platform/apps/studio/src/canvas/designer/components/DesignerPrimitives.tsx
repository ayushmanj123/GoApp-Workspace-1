import { readDesignerDisplay } from "../designer-display";
import { designerChromeStyle } from "../designer-chrome";

const baseStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  boxSizing: "border-box",
  pointerEvents: "none",
};

export function DesignerButton({
  text = "Button",
  disabled = false,
  appearance,
}: {
  text?: unknown;
  disabled?: boolean;
  selected?: boolean;
  appearance?: Record<string, unknown>;
}) {
  const label = readDesignerDisplay(text, "Button");
  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        ...baseStyle,
        cursor: "default",
        background: "#f5f5f5",
        border: "1px solid #c8c8c8",
        borderRadius: 4,
        color: "#222",
        fontSize: 13,
        ...designerChromeStyle(appearance),
      }}
    >
      {label}
    </button>
  );
}

export function DesignerLabel({
  text = "Label",
  color,
  size,
  weight,
  align,
  appearance,
}: {
  text?: unknown;
  color?: unknown;
  size?: unknown;
  weight?: unknown;
  align?: unknown;
  selected?: boolean;
  appearance?: Record<string, unknown>;
}) {
  const label = readDesignerDisplay(text, "Label");
  const colorValue = readDesignerDisplay(color, "");
  const sizeText = readDesignerDisplay(size, "13");
  const sizeNum = Number(sizeText);
  const weightText = readDesignerDisplay(weight, "600");
  const alignText = readDesignerDisplay(align, "left").toLowerCase();
  const textAlign =
    alignText === "center" || alignText === "right" || alignText === "justify"
      ? alignText
      : "left";
  return (
    <span
      className="fillControl"
      style={{
        ...baseStyle,
        display: "flex",
        alignItems: "center",
        justifyContent:
          textAlign === "center" ? "center" : textAlign === "right" ? "flex-end" : "flex-start",
        color: colorValue.startsWith("[") ? undefined : colorValue || "#222",
        fontSize: Number.isFinite(sizeNum) && sizeNum > 0 ? sizeNum : 13,
        fontWeight: weightText || 600,
        textAlign,
        ...designerChromeStyle(appearance),
      }}
    >
      {label}
    </span>
  );
}

export function DesignerTextInput({
  value,
  placeholder,
  disabled,
  appearance,
}: {
  value?: unknown;
  placeholder?: unknown;
  disabled?: boolean;
  selected?: boolean;
  appearance?: Record<string, unknown>;
}) {
  const displayValue = readDesignerDisplay(value, "");
  const placeholderText = readDesignerDisplay(placeholder, "");
  return (
    <input
      readOnly
      disabled={disabled}
      value={displayValue.startsWith("[") ? "" : displayValue}
      placeholder={placeholderText.startsWith("[") ? undefined : placeholderText}
      style={{
        ...baseStyle,
        border: "1px solid #c8c8c8",
        borderRadius: 4,
        padding: "4px 8px",
        background: "#ffffff",
        color: "#222",
        fontSize: 13,
        ...designerChromeStyle(appearance),
      }}
    />
  );
}

export function DesignerTimer({
  duration,
}: {
  duration?: unknown;
  selected?: boolean;
}) {
  const ms = readDesignerDisplay(duration, "1000");
  return (
    <div
      style={{
        ...baseStyle,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        color: "#555",
        background: "#f0f0f0",
        border: "1px solid #c8c8c8",
        borderRadius: 4,
      }}
    >
      Timer ({ms}ms)
    </div>
  );
}

export function DesignerDropdown({
  items,
  value,
  appearance,
}: {
  items?: unknown;
  value?: unknown;
  disabled?: boolean;
  selected?: boolean;
  appearance?: Record<string, unknown>;
}) {
  const itemsLabel = readDesignerDisplay(items, "Items");
  const valueLabel = readDesignerDisplay(value, "");
  return (
    <select
      disabled
      value=""
      style={{
        ...baseStyle,
        border: "1px solid #c8c8c8",
        borderRadius: 4,
        padding: "4px 8px",
        background: "#ffffff",
        fontSize: 13,
        ...designerChromeStyle(appearance),
      }}
    >
      <option>{itemsLabel || valueLabel || "Dropdown"}</option>
    </select>
  );
}

export function DesignerCheckbox({
  text = "Checkbox",
  checked = false,
}: {
  text?: unknown;
  checked?: unknown;
  selected?: boolean;
}) {
  const label = readDesignerDisplay(text, "Checkbox");
  const isChecked =
    typeof checked === "boolean"
      ? checked
      : readDesignerDisplay(checked, "false") === "true";
  return (
    <label
      style={{
        ...baseStyle,
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 13,
        color: "#222",
      }}
    >
      <input
        type="checkbox"
        readOnly
        checked={isChecked}
        style={{ width: 14, height: 14, flexShrink: 0, margin: 0 }}
      />
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
    </label>
  );
}

export function DesignerToggle({
  text = "Toggle",
  checked = false,
}: {
  text?: unknown;
  checked?: unknown;
  selected?: boolean;
}) {
  const label = readDesignerDisplay(text, "Toggle");
  const isChecked =
    typeof checked === "boolean"
      ? checked
      : readDesignerDisplay(checked, "false") === "true";
  return (
    <label
      style={{
        ...baseStyle,
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        color: "#222",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 36,
          height: 20,
          flexShrink: 0,
          borderRadius: 10,
          background: isChecked ? "#4A90D9" : "#ccc",
          position: "relative",
          display: "inline-block",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: isChecked ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
          }}
        />
      </span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
    </label>
  );
}

export function DesignerImage({
  src,
  alt,
  appearance,
}: {
  src?: unknown;
  alt?: unknown;
  selected?: boolean;
  appearance?: Record<string, unknown>;
}) {
  const srcValue = readDesignerDisplay(src, "");
  const altValue = readDesignerDisplay(alt, "Image");
  if (srcValue && !srcValue.startsWith("[")) {
    return (
      <img
        src={srcValue}
        alt={altValue.startsWith("[") ? "Image" : altValue}
        style={{ ...baseStyle, objectFit: "contain", background: "#f5f5f5", ...designerChromeStyle(appearance) }}
      />
    );
  }
  return (
    <div
      style={{
        ...baseStyle,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f0f0f0",
        border: "1px dashed #bbb",
        fontSize: 11,
        color: "#666",
      }}
    >
      {srcValue || "Image"}
    </div>
  );
}

export function DesignerIcon({
  icon = "star",
  color,
}: {
  icon?: unknown;
  color?: unknown;
  selected?: boolean;
}) {
  const iconName = readDesignerDisplay(icon, "star");
  const colorValue = readDesignerDisplay(color, "#333");
  const glyph =
    iconName === "star"
      ? "★"
      : iconName === "heart"
        ? "♥"
        : iconName === "check"
          ? "✓"
          : iconName.length <= 2
            ? iconName
            : "●";
  return (
    <div
      style={{
        ...baseStyle,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 24,
        color: colorValue.startsWith("[") ? "#333" : colorValue,
      }}
    >
      {glyph}
    </div>
  );
}

export function DesignerDatePicker({
  value,
  appearance,
}: {
  value?: unknown;
  disabled?: boolean;
  selected?: boolean;
  appearance?: Record<string, unknown>;
}) {
  const displayValue = readDesignerDisplay(value, "");
  return (
    <input
      readOnly
      type="date"
      value={displayValue.startsWith("[") ? "" : displayValue}
      style={{
        ...baseStyle,
        border: "1px solid #c8c8c8",
        borderRadius: 4,
        padding: "4px 8px",
        background: "#ffffff",
        fontSize: 13,
        ...designerChromeStyle(appearance),
      }}
    />
  );
}

export function DesignerRadio({ appearance }: { appearance?: Record<string, unknown>; selected?: boolean }) {
  return (
    <div style={{ ...baseStyle, display: "flex", flexDirection: "column", gap: 4, fontSize: 12, ...designerChromeStyle(appearance) }}>
      <label><input type="radio" readOnly checked /> Option 1</label>
      <label><input type="radio" readOnly /> Option 2</label>
    </div>
  );
}

export function DesignerSlider({ appearance }: { appearance?: Record<string, unknown>; selected?: boolean }) {
  return <input type="range" readOnly defaultValue={40} style={{ ...baseStyle, ...designerChromeStyle(appearance) }} />;
}

export function DesignerLink({ text, appearance }: { text?: unknown; appearance?: Record<string, unknown>; selected?: boolean }) {
  return (
    <span style={{ ...baseStyle, color: "#1a56db", textDecoration: "underline", display: "flex", alignItems: "center", ...designerChromeStyle(appearance) }}>
      {readDesignerDisplay(text, "Link")}
    </span>
  );
}

export function DesignerBadge({ text, appearance }: { text?: unknown; appearance?: Record<string, unknown>; selected?: boolean }) {
  return (
    <span style={{ ...baseStyle, display: "flex", alignItems: "center", justifyContent: "center", background: "#e8f0fe", color: "#1a56db", borderRadius: 999, fontSize: 12, ...designerChromeStyle(appearance) }}>
      {readDesignerDisplay(text, "Badge")}
    </span>
  );
}

export function DesignerProgress({ appearance }: { appearance?: Record<string, unknown>; selected?: boolean }) {
  return (
    <div style={{ ...baseStyle, background: "#e6e6e6", borderRadius: 999, overflow: "hidden" }}>
      <div style={{ width: "40%", height: "100%", background: "#4A90D9", ...designerChromeStyle(appearance) }} />
    </div>
  );
}

export function DesignerSpinner() {
  return (
    <div
      style={{
        ...baseStyle,
        borderRadius: "50%",
        border: "3px solid #4A90D9",
        borderTopColor: "transparent",
      }}
    />
  );
}

export function DesignerRating() {
  return (
    <div style={{ ...baseStyle, display: "flex", alignItems: "center", color: "#f5b301", fontSize: 16 }}>
      ★★★☆☆
    </div>
  );
}
