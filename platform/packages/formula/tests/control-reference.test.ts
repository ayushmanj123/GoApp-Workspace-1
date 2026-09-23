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

function buildContext(controls = CONTROLS) {
  return {
    User: { FullName: "Test User", Email: "test@example.com" },
    App: { Name: "Demo Application" },
    ...buildControlFormulaSymbols(controls),
  };
}

describe("buildControlFormulaSymbols", () => {
  it("maps TextInput1.Value and Label1.Text", () => {
    const symbols = buildControlFormulaSymbols(CONTROLS);
    assert.equal(symbols.TextInput1.Value, "Hello");
    assert.equal(symbols.Label1.Text, "Approved");
    assert.equal(symbols.Label1.Visible, "true");
    assert.ok("X" in symbols.Label1);
  });
});

describe("control reference evaluation", () => {
  it("evaluates TextInput1.Value via API", async () => {
    const engine = new RemoteFormulaEngine(API_URL);
    const result = await engine.evaluate("TextInput1.Value", buildContext());
    assert.equal(result, "Hello");
  });

  it("evaluates Label1.Text via API", async () => {
    const engine = new RemoteFormulaEngine(API_URL);
    const result = await engine.evaluate("Label1.Text", buildContext());
    assert.equal(result, "Approved");
  });

  it("returns [Formula Error] for missing control", async () => {
    const engine = new RemoteFormulaEngine(API_URL);
    const result = await resolvePropertyValue(
      { formula: "MissingControl.Text" },
      engine,
      "",
      buildContext(),
    );
    assert.equal(result, "[Formula Error]");
  });

  it("keeps User.FullName and literal formulas working", async () => {
    const engine = new RemoteFormulaEngine(API_URL);
    const context = buildContext();
    assert.equal(await engine.evaluate("User.FullName", context), "Test User");
    assert.equal(await engine.evaluate("App.Name", context), "Demo Application");
    assert.equal(await engine.evaluate('"Hello"', context), "Hello");
    assert.equal(await engine.evaluate("123", context), 123);
  });
});
