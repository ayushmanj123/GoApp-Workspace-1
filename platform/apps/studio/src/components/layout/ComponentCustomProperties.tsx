import type {
  ComponentCustomProperty,
  ComponentPropertyDataType,
  ComponentPropertyDirection,
} from "../../api/component-definitions-api";

const DIRECTIONS: ComponentPropertyDirection[] = ["input", "output", "action"];
const DATA_TYPES: ComponentPropertyDataType[] = [
  "text",
  "number",
  "boolean",
  "color",
  "record",
  "table",
];

interface ComponentCustomPropertiesProps {
  properties: ComponentCustomProperty[];
  onChange: (properties: ComponentCustomProperty[]) => void;
}

export function ComponentCustomProperties({
  properties,
  onChange,
}: ComponentCustomPropertiesProps) {
  const update = (index: number, patch: Partial<ComponentCustomProperty>) => {
    onChange(properties.map((property, itemIndex) => (
      itemIndex === index ? { ...property, ...patch } : property
    )));
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
      <strong>Custom properties</strong>
      <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 12 }}>
        Inside this component, formulas use Component.PropertyName. On a screen, set inputs to an entity, a connector, or any formula.
      </p>
      {properties.map((property, index) => (
        <div key={`${property.name}-${index}`} style={{ display: "grid", gap: 4 }}>
          <input
            aria-label="Property name"
            value={property.name}
            onChange={(event) => update(index, { name: event.target.value.replace(/[^A-Za-z0-9]/g, "") })}
          />
          <select
            aria-label="Property direction"
            value={property.direction}
            onChange={(event) => update(index, { direction: event.target.value as ComponentPropertyDirection })}
          >
            {DIRECTIONS.map((direction) => (
              <option key={direction} value={direction}>{direction}</option>
            ))}
          </select>
          {property.direction !== "action" && (
            <select
              aria-label="Property type"
              value={property.dataType}
              onChange={(event) => update(index, { dataType: event.target.value as ComponentPropertyDataType })}
            >
              {DATA_TYPES.map((dataType) => (
                <option key={dataType} value={dataType}>{dataType}</option>
              ))}
            </select>
          )}
          {property.direction === "output" && (
            <input
              aria-label="Output formula"
              placeholder="Gallery1.Selected"
              value={property.formula ?? ""}
              onChange={(event) => update(index, { formula: event.target.value })}
            />
          )}
          <button
            type="button"
            onClick={() => onChange(properties.filter((_, itemIndex) => itemIndex !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([
          ...properties,
          { name: "Property", direction: "input", dataType: "text" },
        ])}
      >
        Add property
      </button>
    </section>
  );
}
