import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildControlFormulaSymbols } from "../src/control-formula-context.js";
import { LiteralFormulaEngine } from "../src/literal-formula-engine.js";
import { RemoteFormulaEngine } from "../src/remote-formula-engine.js";
import { resolvePropertyValue } from "../src/resolve-property-value.js";

const API_URL = process.env.FORMULA_API_URL ?? "http://localhost:8085";

const VARIABLES = {
  varTitle: "Hello World",
  varCount: 10,
  varStatus: "Approved",
};

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
    ...VARIABLES,
  };
}

describe("variable evaluation", () => {
  it("evaluates varTitle via API", async () => {
    const engine = new RemoteFormulaEngine(API_URL);
    assert.equal(await engine.evaluate("varTitle", buildContext()), "Hello World");
  });

  it("evaluates varCount via API", async () => {
    const engine = new RemoteFormulaEngine(API_URL);
    assert.equal(await engine.evaluate("varCount", buildContext()), 10);
  });

  it("evaluates varStatus via API", async () => {
    const engine = new RemoteFormulaEngine(API_URL);
    assert.equal(await engine.evaluate("varStatus", buildContext()), "Approved");
  });

  it("returns [Formula Error] for unknown variable", async () => {
    const engine = new RemoteFormulaEngine(API_URL);
    const result = await resolvePropertyValue(
      { formula: "varUnknown" },
      engine,
      "",
      buildContext(),
    );
    assert.equal(result, "[Formula Error]");
  });

  it("keeps User, App, and control references working", async () => {
    const engine = new RemoteFormulaEngine(API_URL);
    const context = buildContext();
    assert.equal(await engine.evaluate("User.FullName", context), "Test User");
    assert.equal(await engine.evaluate("App.Name", context), "Demo Application");
    assert.equal(await engine.evaluate("TextInput1.Value", context), "Hello");
    assert.equal(await engine.evaluate("Label1.Text", context), "Approved");
  });
});

describe("LiteralFormulaEngine variable fallback", () => {
  it("evaluates varTitle with context", async () => {
    const engine = new LiteralFormulaEngine();
    assert.equal(await engine.evaluate("varTitle", buildContext()), "Hello World");
  });
});
