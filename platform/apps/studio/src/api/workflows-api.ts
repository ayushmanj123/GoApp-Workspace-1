import { apiClient, PagedData } from "./metadata-client";

export type WorkflowTriggerType = "manual" | "schedule" | "webhook";

export interface WorkflowTrigger {
  type: WorkflowTriggerType;
  cron?: string;
  timezone?: string;
  enabled?: boolean;
}

export interface WorkflowStep {
  id: string;
  type: "connector_action";
  connector_id: string;
  action_name: string;
  body?: unknown;
}

export interface WorkflowDefinition {
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
}

export interface WorkflowRecord {
  id: string;
  tenant_id: string;
  application_id: string;
  name: string;
  definition: WorkflowDefinition;
  trigger_type?: WorkflowTriggerType;
  schedule_cron?: string | null;
  schedule_timezone?: string | null;
  schedule_enabled?: boolean;
  schedule_next_run_at?: string | null;
  webhook_enabled?: boolean;
  webhook_secret_id?: string | null;
  created_on?: string;
  modified_on?: string;
}

export interface WorkflowStepResult {
  step_id: string;
  status: string;
  http_status?: number;
  error?: string;
  body_preview?: string;
}

export interface WorkflowRunResult {
  steps: WorkflowStepResult[];
  error?: string;
}

export type WorkflowTriggerSource = "manual" | "schedule" | "webhook";

export interface WorkflowRunRecord {
  id: string;
  tenant_id: string;
  workflow_id: string;
  status: string;
  trigger_source?: WorkflowTriggerSource;
  triggered_by?: string;
  started_on: string;
  finished_on?: string;
  result: WorkflowRunResult;
}

export interface CreateWorkflowPayload {
  name: string;
  definition: WorkflowDefinition;
}

export interface UpdateWorkflowPayload {
  name?: string;
  definition?: WorkflowDefinition;
}

export interface RotateWebhookSecretResult {
  secret: string;
  hook_path: string;
  auth_header: string;
}

export function workflowHookUrl(workflowId: string): string {
  const base =
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api/v1";
  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
  if (base.startsWith("http")) {
    return `${base.replace(/\/$/, "")}/public/workflows/${workflowId}/hook`;
  }
  return `${origin}${base.replace(/\/$/, "")}/public/workflows/${workflowId}/hook`;
}

export const workflowsApi = {
  list: (applicationId: string, limit = 100, offset = 0) =>
    apiClient.get<PagedData<WorkflowRecord>>(
      `/applications/${applicationId}/workflows?limit=${limit}&offset=${offset}`,
    ),

  get: (id: string) => apiClient.get<WorkflowRecord>(`/workflows/${id}`),

  create: (applicationId: string, payload: CreateWorkflowPayload) =>
    apiClient.post<WorkflowRecord>(
      `/applications/${applicationId}/workflows`,
      payload,
    ),

  update: (id: string, payload: UpdateWorkflowPayload) =>
    apiClient.put<WorkflowRecord>(`/workflows/${id}`, payload),

  remove: (id: string) => apiClient.delete(`/workflows/${id}`),

  run: (id: string) =>
    apiClient.post<WorkflowRunRecord>(`/workflows/${id}/run`, {}),

  listRuns: (id: string, limit = 50, offset = 0) =>
    apiClient.get<PagedData<WorkflowRunRecord>>(
      `/workflows/${id}/runs?limit=${limit}&offset=${offset}`,
    ),

  rotateWebhookSecret: (id: string) =>
    apiClient.post<RotateWebhookSecretResult>(
      `/workflows/${id}/webhook-secret`,
      {},
    ),
};
