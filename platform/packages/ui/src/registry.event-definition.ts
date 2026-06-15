export interface EventDefinition<Payload = any> {
  name: string;
  title?: string;
  description?: string;
  /** payload shape metadata (informational) */
  payload?: Record<string, any>;
}
