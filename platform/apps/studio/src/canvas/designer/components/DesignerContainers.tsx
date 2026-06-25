import type { ReactNode } from "react";
import type { ControlPackage } from "../../../../../runtime/src/runtime-types";
import { readDesignerDisplay } from "../designer-display";
import type { Control } from "../../../api/controls-api";

const boxStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  boxSizing: "border-box",
  pointerEvents: "none",
  overflow: "auto",
  border: "1px solid #d0d0d0",
  borderRadius: 4,
  padding: 4,
};

export function DesignerGallery({
  items,
  templateControls = [],
  selected,
  renderChild,
}: {
  items?: unknown;
  templateControls?: ControlPackage[] | Control[];
  selected?: boolean;
  renderChild?: (control: Control) => ReactNode;
}) {
  const itemsLabel = readDesignerDisplay(items, "Items");
  const rows = ["Item 1", "Item 2"];

  return (
    <div
      style={{
        ...boxStyle,
        outline: selected ? "2px solid #89b4fa" : undefined,
      }}
    >
      <div style={{ fontSize: 10, color: "#6c7086", marginBottom: 4 }}>
        Gallery — {itemsLabel}
      </div>
      {rows.map((row, index) => (
        <div
          key={row}
          style={{
            position: "relative",
            minHeight: 32,
            padding: "4px 6px",
            borderBottom: "1px solid #eee",
            marginBottom: 2,
          }}
        >
          {templateControls.length > 0 ? (
            templateControls.map((control) => (
              <div
                key={`${index}-${control.id}`}
                style={{
                  position: "absolute",
                  left: control.x,
                  top: control.y,
                  width: control.width,
                  height: control.height,
                }}
              >
                {renderChild ? renderChild(control as Control) : null}
              </div>
            ))
          ) : (
            <span style={{ fontSize: 12 }}>{row}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function DesignerForm({
  item,
  mode,
  templateControls = [],
  selected,
  renderChild,
}: {
  item?: unknown;
  mode?: unknown;
  templateControls?: ControlPackage[] | Control[];
  selected?: boolean;
  renderChild?: (control: Control) => ReactNode;
}) {
  const itemLabel = readDesignerDisplay(item, "Item");
  const modeLabel = readDesignerDisplay(mode, "View");

  return (
    <div
      style={{
        ...boxStyle,
        outline: selected ? "2px solid #89b4fa" : undefined,
      }}
    >
      <div style={{ fontSize: 10, color: "#6c7086", marginBottom: 4 }}>
        Form — {itemLabel} ({modeLabel})
      </div>
      <div style={{ position: "relative", minHeight: 48 }}>
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
            {renderChild ? renderChild(control as Control) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DesignerComponent({
  templateControls = [],
  selected,
  renderChild,
}: {
  templateControls?: ControlPackage[] | Control[];
  selected?: boolean;
  renderChild?: (control: Control) => ReactNode;
}) {
  return (
    <div
      data-testid="designer-component-instance"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 24,
        outline: selected ? "2px solid #89b4fa" : undefined,
      }}
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
          {renderChild ? renderChild(control as Control) : null}
        </div>
      ))}
    </div>
  );
}
