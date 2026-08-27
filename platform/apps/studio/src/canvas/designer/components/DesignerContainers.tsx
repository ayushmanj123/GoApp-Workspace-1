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

function normalizeColumnHints(columnHints?: string[]): string[] {
  if (!Array.isArray(columnHints)) return [];
  return columnHints
    .map((column) => String(column ?? "").trim())
    .filter((column) => column.length > 0);
}

export function DesignerGallery({
  templateControls = [],
  columnHints,
  previewRows,
  renderChild,
}: {
  items?: unknown;
  columnHints?: string[];
  previewRows?: Record<string, unknown>[];
  templateControls?: ControlPackage[] | Control[];
  selected?: boolean;
  renderChild?: (control: Control) => ReactNode;
}) {
  const columns = normalizeColumnHints(columnHints);
  const liveCount = Array.isArray(previewRows) ? previewRows.length : 0;
  const rows =
    liveCount > 0
      ? previewRows!.slice(0, 3).map((row, index) => {
          const record = row as Record<string, unknown>;
          const first = columns
            .map((column) => record[column])
            .find((value) => value !== undefined && value !== null && value !== "");
          return first !== undefined ? String(first) : `Row ${index + 1}`;
        })
      : columns.length > 0
        ? ["Sample row 1", "Sample row 2"]
        : ["Item 1", "Item 2"];

  return (
    <div style={boxStyle}>
      {columns.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            marginBottom: 6,
            padding: "2px 4px",
          }}
          data-testid="designer-gallery-column-hints"
        >
          {columns.map((column) => (
            <span
              key={column}
              style={{
                fontSize: 10,
                padding: "1px 6px",
                borderRadius: 999,
                background: "#eef2ff",
                color: "#3730a3",
              }}
            >
              {column}
            </span>
          ))}
        </div>
      ) : null}
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
            <span style={{ fontSize: 12, color: "#333" }}>
              {columns.length > 0
                ? columns.map((column) => `${column}: …`).join(" · ")
                : row}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function DesignerDataTable({
  items: _items,
  pageSize: _pageSize,
  columnHints,
  previewRows,
}: {
  items?: unknown;
  pageSize?: unknown;
  columnHints?: string[];
  previewRows?: Record<string, unknown>[];
  selected?: boolean;
}) {
  const hinted = normalizeColumnHints(columnHints);
  const liveRows = Array.isArray(previewRows)
    ? previewRows.filter(
        (row) => row && typeof row === "object" && !Array.isArray(row),
      )
    : [];
  const columns =
    hinted.length > 0
      ? hinted
      : liveRows.length > 0
        ? Object.keys(liveRows[0] as Record<string, unknown>).filter(
            (key) => !key.startsWith("_"),
          )
        : ["Name", "Status"];
  const rows =
    liveRows.length > 0
      ? liveRows
      : hinted.length > 0
        ? [
            Object.fromEntries(columns.map((column, index) => [column, `Sample ${index + 1}`])),
            Object.fromEntries(columns.map((column, index) => [column, `Sample ${index + 2}`])),
          ]
        : [
            { Name: "Alice", Status: "Active" },
            { Name: "Bob", Status: "Pending" },
          ];

  return (
    <div style={boxStyle}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 11,
        }}
        data-testid="designer-datatable"
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
          {rows.map((row, rowIndex) => (
            <tr key={`designer-row-${rowIndex}`}>
              {columns.map((column) => (
                <td
                  key={column}
                  style={{
                    padding: "4px 6px",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  {String((row as Record<string, string>)[column] ?? "")}
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

export function DesignerDataCard({
  templateControls = [],
  renderChild,
  dataField,
}: {
  dataField?: unknown;
  templateControls?: ControlPackage[] | Control[];
  selected?: boolean;
  renderChild?: (control: Control) => ReactNode;
}) {
  const fieldLabel =
    typeof dataField === "string"
      ? dataField
      : dataField && typeof dataField === "object" && "value" in dataField
        ? String((dataField as { value?: unknown }).value ?? "")
        : "";

  return (
    <div
      style={{
        ...boxStyle,
        position: "relative",
        minHeight: 40,
        background: "#fafafa",
      }}
      data-testid="designer-datacard"
    >
      {fieldLabel ? (
        <div
          style={{
            position: "absolute",
            top: 2,
            right: 6,
            fontSize: 9,
            color: "#888",
            pointerEvents: "none",
          }}
        >
          {fieldLabel}
        </div>
      ) : null}
      <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 36 }}>
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
