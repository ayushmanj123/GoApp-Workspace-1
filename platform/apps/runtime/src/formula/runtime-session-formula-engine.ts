import type { FormulaEngine } from "@goapps/formula";
import {
  evaluateRuntimeFormula,
  extractFormulaEvaluateOverlay,
  type RuntimeFormulaSession,
} from "../runtime-session-client";

export class RuntimeSessionFormulaEngine implements FormulaEngine {
  private initialized = false;

  constructor(private readonly getSession: () => RuntimeFormulaSession) {}

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    const { sessionId } = this.getSession();
    if (!sessionId) {
      return;
    }
    await evaluateRuntimeFormula({
      ...this.getSession(),
      formula: '"ok"',
    });
    this.initialized = true;
  }

  async evaluate(
    formula: string,
    context?: Record<string, unknown>,
  ): Promise<unknown> {
    const session = this.getSession();
    if (!session.sessionId) {
      throw new Error("Runtime session is not available.");
    }
    const { result } = await evaluateRuntimeFormula({
      ...session,
      formula,
      context: extractFormulaEvaluateOverlay(context),
    });
    return result;
  }
}
