export interface FormulaEngine {
  initialize(): Promise<void>;
  evaluate(
    formula: string,
    context?: Record<string, unknown>,
  ): Promise<unknown>;
}
