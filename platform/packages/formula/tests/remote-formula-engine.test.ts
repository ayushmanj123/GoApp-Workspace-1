import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDefaultFormulaEngine } from "../src/create-formula-engine.js";
import { LiteralFormulaEngine } from "../src/literal-formula-engine.js";
import { RemoteFormulaEngine } from "../src/remote-formula-engine.js";
import { resolvePropertyValue } from "../src/resolve-property-value.js";

const API_URL = process.env.FORMULA_API_URL ?? "http://localhost:8085";

describe("RemoteFormulaEngine", () => {
  it('evaluates string literal "Hello"', async () => {
    const engine = new RemoteFormulaEngine(API_URL);
    const result = await engine.evaluate('"Hello"');
    assert.equal(result, "Hello");
  });

  it("evaluates number literal 123", async () => {
    const engine = new RemoteFormulaEngine(API_URL);
    const result = await engine.evaluate("123");
    assert.equal(result, 123);
  });

  it("evaluates boolean literal true", async () => {
    const engine = new RemoteFormulaEngine(API_URL);
    const result = await engine.evaluate("true");
    assert.equal(result, true);
  });

  it("evaluates boolean literal false", async () => {
    const engine = new RemoteFormulaEngine(API_URL);
    const result = await engine.evaluate("false");
    assert.equal(result, false);
  });
});

describe("createDefaultFormulaEngine fallback", () => {
  it("uses LiteralFormulaEngine when API URL is unset", () => {
    const previous = process.env.FORMULA_API_URL;
    delete process.env.FORMULA_API_URL;
    const engine = createDefaultFormulaEngine();
    assert.equal(engine instanceof LiteralFormulaEngine, true);
    if (previous) {
      process.env.FORMULA_API_URL = previous;
    }
  });
});

describe("resolvePropertyValue with RemoteFormulaEngine", () => {
  it("returns [Formula Error] for invalid formula", async () => {
    const engine = new RemoteFormulaEngine(API_URL);
    const result = await resolvePropertyValue({ formula: "abc(" }, engine, "");
    assert.equal(result, "[Formula Error]");
  });
});
