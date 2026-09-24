import type { ComponentCustomProperty } from "../../api/component-definitions-api";
import type { Control } from "../../api/controls-api";

function readEntry(value: unknown): { formula: string; staticText: string; isFormula: boolean } {
  if (value && typeof value === "object" && "formula" in value) {
    return {
      formula: String((value as { formula?: unknown }).formula ?? ""),
      staticText: "",
      isFormula: true,
    };
  }
  if (value && typeof value === "object" && "value" in value) {
    return {
      formula: "",
      staticText: String((value as { value?: unknown }).value ?? ""),
      isFormula: false,
    };
  }
  return { formula: "", staticText: "", isFormula: false };
}

interface ComponentInstanceFieldsProps {
  control: Control;
  contract: ComponentCustomProperty[];
  onChange: (name: string, entry: { value?: unknown; formula?: string }) => void;
}

export function ComponentInstanceFields({
  control,
  contract,
  onChange,
}: ComponentInstanceFieldsProps) {
  const inputs = contract.filter((property) => property.direction !== "output");
  const outputs = contract.filter((property) => property.direction === "output");

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <strong>Component</strong>
      <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 12 }}>
        Point a table or record at an entity, a connector, Filter(...), LookUp(...), or a collection.
      </p>
      {inputs.map((property) => {
        const current = readEntry(control.properties?.[property.name]);
        const formulaMode = property.direction === "action"
          || property.dataType === "table"
          || property.dataType === "record"
          || current.isFormula;
        return (
          <label key={property.name} style={{ display: "grid", gap: 4 }}>
            <span>
              {property.name}
              {property.dataType ? ` (${property.dataType})` : ""}
            </span>
            <input
              aria-label={property.name}
              value={formulaMode ? current.formula : current.staticText}
              placeholder={formulaMode ? "Customers" : ""}
              onChange={(event) => {
                const text = event.target.value;
                if (formulaMode) onChange(property.name, { formula: text });
                else if (property.dataType === "number") onChange(property.name, { value: Number(text) });
                else if (property.dataType === "boolean") onChange(property.name, { value: text === "true" });
                else onChange(property.name, { value: text });
              }}
            />
          </label>
        );
      })}
      {outputs.map((property) => (
        <p key={property.name} style={{ margin: 0, fontSize: 12 }}>
          {property.name} = {property.formula || "(output)"}
        </p>
      ))}
    </section>
  );
}
