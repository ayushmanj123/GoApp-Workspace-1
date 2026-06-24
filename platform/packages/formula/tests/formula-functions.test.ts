import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildControlFormulaSymbols } from "../src/control-formula-context.js";
import { RemoteFormulaEngine } from "../src/remote-formula-engine.js";
import { resolvePropertyValue } from "../src/resolve-property-value.js";

const API_URL = process.env.FORMULA_API_URL ?? "http://localhost:8085";

const CONTROLS = [
  {
    name: "TextInput1",
    control_type: "textinput",
    properties: { value: { value: "Hello" } },
  },
  {
    name: "Label1",
    control_type: "label",
    properties: { text: { value: "Approved" } },
  },
];

function buildContext() {
  return {
    User: { FullName: "Test User", Email: "test@example.com" },
    App: { Name: "Demo Application" },
    ...buildControlFormulaSymbols(CONTROLS),
    varTitle: "Hello World",
    varCount: 10,
    varStatus: "Approved",
  };
}

describe("Power Fx built-in functions", () => {
  it("evaluates Upper(User.FullName)", async () => {
    const engine = new RemoteFormulaEngine(API_URL);
    assert.equal(
      await engine.evaluate("Upper(User.FullName)", buildContext()),
      "TEST USER",
    );
  });

  it("evaluates Lower(User.Email)", async () => {
    const engine = new RemoteFormulaEngine(API_URL);
    assert.equal(
      await engine.evaluate("Lower(User.Email)", buildContext()),
      "test@example.com",
    );
  });

  it('evaluates Concatenate("Hello ", User.FullName)', async () => {
    const engine = new RemoteFormulaEngine(API_URL);
    assert.equal(
      await engine.evaluate('Concatenate("Hello ", User.FullName)', buildContext()),
      "Hello Test User",
    );
  });

  it("evaluates Len(varTitle)", async () => {
    const engine = new RemoteFormulaEngine(API_URL);
    assert.equal(await engine.evaluate("Len(varTitle)", buildContext()), 11);
  });

  it('evaluates If(true, "Approved", "Rejected")', async () => {
    const engine = new RemoteFormulaEngine(API_URL);
    assert.equal(
      await engine.evaluate('If(true, "Approved", "Rejected")', buildContext()),
      "Approved",
    );
  });

  it('evaluates If(false, "Approved", "Rejected")', async () => {
    const engine = new RemoteFormulaEngine(API_URL);
    assert.equal(
      await engine.evaluate('If(false, "Approved", "Rejected")', buildContext()),
      "Rejected",
    );
  });

  it("returns [Formula Error] for unknown function", async () => {
    const engine = new RemoteFormulaEngine(API_URL);
    const result = await resolvePropertyValue(
      { formula: "SomeUnknownFunction()" },
      engine,
      "",
      buildContext(),
    );
    assert.equal(result, "[Formula Error]");
  });

  it("keeps bare references working", async () => {
    const engine = new RemoteFormulaEngine(API_URL);
    const context = buildContext();
    assert.equal(await engine.evaluate("User.FullName", context), "Test User");
    assert.equal(await engine.evaluate("App.Name", context), "Demo Application");
    assert.equal(await engine.evaluate("TextInput1.Value", context), "Hello");
    assert.equal(await engine.evaluate("varTitle", context), "Hello World");
  });
});
