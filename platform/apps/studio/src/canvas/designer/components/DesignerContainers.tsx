import type { ReactNode } from "react";
import type { ControlPackage } from "../../../../../runtime/src/runtime-types";
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
  background: "#ffffff",
};

export function DesignerGallery({
  templateControls = [],
  renderChild,
}: {
  items?: unknown;
  templateControls?: ControlPackage[] | Control[];
  selected?: boolean;
  renderChild?: (control: Control) => ReactNode;
}) {
  const rows = ["Item 1", "Item 2"];

  return (
    <div style={boxStyle}>
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
            <span style={{ fontSize: 12, color: "#333" }}>{row}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function DesignerDataTable({
  items: _items,
  pageSize: _pageSize,
}: {
  items?: unknown;
  pageSize?: unknown;
  selected?: boolean;
}) {
  const rows = [
    { Name: "Alice", Status: "Active" },
    { Name: "Bob", Status: "Pending" },
  ];
  const columns = ["Name", "Status"];

  return (
    <div style={boxStyle}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 11,
        }}
      >
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                style={{
                  textAlign: "left",
                  padding: "4px 6px",
                  borderBottom: "1px solid #ddd",
                  background: "#f5f5f5",
                }}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.Name}>
              {columns.map((column) => (
                <td
                  key={column}
                  style={{
                    padding: "4px 6px",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  {String(row[column as keyof typeof row] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DesignerForm({
  templateControls = [],
  renderChild,
}: {
  item?: unknown;
  mode?: unknown;
  templateControls?: ControlPackage[] | Control[];
  selected?: boolean;
  renderChild?: (control: Control) => ReactNode;
}) {
  return (
    <div style={boxStyle}>
      <div style={{ position: "relative", minHeight: 48 }}>
        {templateControls.length === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 48,
              padding: 8,
              fontSize: 11,
              color: "#888",
              textAlign: "center",
            }}
          >
            Drop fields or Generate fields
          </div>
        ) : (
          templateControls.map((control) => (
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
          ))
        )}
      </div>
    </div>
  );
}

export function DesignerComponent({
  templateControls = [],
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

export function DesignerContainer({
  templateControls = [],
  renderChild,
  direction,
}: {
  direction?: unknown;
  templateControls?: ControlPackage[] | Control[];
  selected?: boolean;
  renderChild?: (control: Control) => ReactNode;
}) {
  const dir = typeof direction === "string" ? direction : "vertical";
  return (
    <div
      style={{
        ...boxStyle,
        display: "flex",
        flexDirection: dir === "horizontal" ? "row" : "column",
        gap: 4,
        position: "relative",
      }}
    >
      {templateControls.length > 0 ? (
        templateControls.map((control) => (
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
        ))
      ) : (
        <span style={{ fontSize: 11, color: "#888" }}>Container</span>
      )}
    </div>
  );
}
