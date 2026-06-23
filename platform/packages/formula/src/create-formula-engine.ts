import { getFormulaApiUrl } from "./formula-api-url.js";
import { LiteralFormulaEngine } from "./literal-formula-engine.js";
import { RemoteFormulaEngine } from "./remote-formula-engine.js";
import type { FormulaEngine } from "./formula-engine.js";

export function createDefaultFormulaEngine(): FormulaEngine {
  const apiUrl = getFormulaApiUrl();
  if (apiUrl) {
    return new RemoteFormulaEngine(apiUrl);
  }
  return new LiteralFormulaEngine();
}
