import type { FormulaEngine } from "./formula-engine.js";

interface EvaluateResponse {
  ok: boolean;
  value?: unknown;
  error?: string;
}

export class RemoteFormulaEngine implements FormulaEngine {
  private readonly baseUrl: string;
  private initialized = false;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const health = await fetch(`${this.baseUrl}/health`);
    if (!health.ok) {
      throw new Error(`Formula API health check failed (${health.status}).`);
    }

    await this.evaluate('"Hello"');
    this.initialized = true;
  }

  async evaluate(
    formula: string,
    context?: Record<string, unknown>,
  ): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formula, context }),
    });

    if (!response.ok) {
      throw new Error(`Formula API request failed (${response.status}).`);
    }

    const payload = (await response.json()) as EvaluateResponse;
    if (!payload.ok) {
      throw new Error(payload.error ?? "Formula evaluation failed.");
    }

    return payload.value;
  }
}
