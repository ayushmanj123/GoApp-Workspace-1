import { readDesignerDisplay } from "../designer-display";

const baseStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  boxSizing: "border-box",
  pointerEvents: "none",
};

export function DesignerButton({
  text = "Button",
  disabled = false,
  selected,
}: {
  text?: unknown;
  disabled?: boolean;
  selected?: boolean;
}) {
  const label = readDesignerDisplay(text, "Button");
  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        ...baseStyle,
        cursor: "default",
        background: "#313244",
        border: "1px solid #585b70",
        borderRadius: 4,
        color: "#cdd6f4",
        outline: selected ? "2px solid #89b4fa" : undefined,
      }}
    >
      {label}
    </button>
  );
}

export function DesignerLabel({
  text = "Label",
  color,
  selected,
}: {
  text?: unknown;
  color?: unknown;
  selected?: boolean;
}) {
  const label = readDesignerDisplay(text, "Label");
  const colorValue = readDesignerDisplay(color, "");
  return (
    <span
      style={{
        ...baseStyle,
        display: "flex",
        alignItems: "center",
        color: colorValue.startsWith("[") ? undefined : colorValue || undefined,
        outline: selected ? "2px solid #89b4fa" : undefined,
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
  selected,
}: {
  value?: unknown;
  placeholder?: unknown;
  disabled?: boolean;
  selected?: boolean;
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
        outline: selected ? "2px solid #89b4fa" : undefined,
      }}
    />
  );
}

export function DesignerTimer({
  duration,
  selected,
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
        color: "#6c7086",
        border: "1px dashed #6c7086",
        borderRadius: 4,
        outline: selected ? "2px solid #89b4fa" : undefined,
      }}
    >
      Timer ({ms}ms)
    </div>
  );
}
