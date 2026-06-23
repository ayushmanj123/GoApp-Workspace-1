import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PowerFxEngine } from "../src/power-fx-engine.js";

describe("PowerFxEngine", () => {
  it('evaluates string literal "Hello"', async () => {
    const engine = new PowerFxEngine();
    const result = await engine.evaluate('"Hello"');
    assert.equal(result, "Hello");
  });

  it("evaluates number literal 123", async () => {
    const engine = new PowerFxEngine();
    const result = await engine.evaluate("123");
    assert.equal(result, 123);
  });

  it("evaluates boolean literal true", async () => {
    const engine = new PowerFxEngine();
    const result = await engine.evaluate("true");
    assert.equal(result, true);
  });
});
