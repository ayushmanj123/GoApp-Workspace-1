import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LiteralFormulaEngine } from "../src/literal-formula-engine.js";
import { RemoteFormulaEngine } from "../src/remote-formula-engine.js";
import { resolvePropertyValue } from "../src/resolve-property-value.js";

const API_URL = process.env.FORMULA_API_URL ?? "http://localhost:8085";

const CONTEXT = {
  User: { FullName: "Test User", Email: "test@example.com" },
  App: { Name: "Incident App" },
};

describe("RemoteFormulaEngine context", () => {
  it("evaluates User.FullName", async () => {
    const engine = new RemoteFormulaEngine(API_URL);
    const result = await engine.evaluate("User.FullName", CONTEXT);
    assert.equal(result, "Test User");
  });

  it("evaluates User.Email", async () => {
    const engine = new RemoteFormulaEngine(API_URL);
    const result = await engine.evaluate("User.Email", CONTEXT);
    assert.equal(result, "test@example.com");
  });

  it("evaluates App.Name", async () => {
    const engine = new RemoteFormulaEngine(API_URL);
    const result = await engine.evaluate("App.Name", CONTEXT);
    assert.equal(result, "Incident App");
  });

  it("literal formulas still work with context", async () => {
    const engine = new RemoteFormulaEngine(API_URL);
    assert.equal(await engine.evaluate('"Hello"', CONTEXT), "Hello");
    assert.equal(await engine.evaluate("123", CONTEXT), 123);
    assert.equal(await engine.evaluate("true", CONTEXT), true);
  });

  it("returns error for unknown User property via resolvePropertyValue", async () => {
    const engine = new RemoteFormulaEngine(API_URL);
    const result = await resolvePropertyValue(
      { formula: "User.Phone" },
      engine,
      "",
      CONTEXT,
    );
    assert.equal(result, "[Formula Error]");
  });
});

describe("LiteralFormulaEngine context fallback", () => {
  it("evaluates User.FullName with context", async () => {
    const engine = new LiteralFormulaEngine();
    const result = await engine.evaluate("User.FullName", CONTEXT);
    assert.equal(result, "Test User");
  });
});
