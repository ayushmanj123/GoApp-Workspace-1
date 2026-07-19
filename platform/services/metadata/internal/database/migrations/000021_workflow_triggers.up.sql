-- Phase 7.24: schedule + webhook trigger columns (denormalized for poller/index).

ALTER TABLE workflows
    ADD COLUMN IF NOT EXISTS trigger_type text NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS schedule_cron text NULL,
    ADD COLUMN IF NOT EXISTS schedule_timezone text NULL,
    ADD COLUMN IF NOT EXISTS schedule_enabled boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS schedule_next_run_at timestamptz NULL,
    ADD COLUMN IF NOT EXISTS webhook_enabled boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS webhook_secret_id uuid NULL;

ALTER TABLE workflow_runs
    ADD COLUMN IF NOT EXISTS trigger_source text NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS trigger_payload jsonb NULL;

CREATE INDEX IF NOT EXISTS idx_workflows_schedule_due
    ON workflows (schedule_enabled, schedule_next_run_at)
    WHERE deleted_at IS NULL AND schedule_enabled = true;
