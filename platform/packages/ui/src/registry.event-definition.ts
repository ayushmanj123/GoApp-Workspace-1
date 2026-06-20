export interface EventDefinition {
  name: string;
  title?: string;
  description?: string;
  /** payload shape metadata (informational) */
  payload?: Record<string, any>;
}
