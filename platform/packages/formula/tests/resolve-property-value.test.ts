import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDefaultFormulaEngine } from "../src/create-formula-engine.js";
import { resolvePropertyValue } from "../src/resolve-property-value.js";

describe("resolvePropertyValue", () => {
  const engine = createDefaultFormulaEngine();

  it("returns static value property", async () => {
    const result = await resolvePropertyValue(
      { value: "Hello" },
      engine,
      "",
    );
    assert.equal(result, "Hello");
  });

  it("evaluates string literal formula", async () => {
    const result = await resolvePropertyValue(
      { formula: '"Hello"' },
      engine,
      "",
    );
    assert.equal(result, "Hello");
  });

  it("evaluates number literal formula", async () => {
    const result = await resolvePropertyValue(
      { formula: "123" },
      engine,
      "",
    );
    assert.equal(result, "123");
  });

  it("evaluates boolean literal formula", async () => {
    const result = await resolvePropertyValue(
      { formula: "true" },
      engine,
      "",
    );
    assert.equal(result, "true");
  });

  it("returns formula error for invalid formula", async () => {
    const result = await resolvePropertyValue(
      { formula: "abc(" },
      engine,
      "",
    );
    assert.equal(result, "[Formula Error]");
  });
});
