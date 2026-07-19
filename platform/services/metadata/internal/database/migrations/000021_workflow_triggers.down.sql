DROP INDEX IF EXISTS idx_workflows_schedule_due;

ALTER TABLE workflow_runs
    DROP COLUMN IF EXISTS trigger_payload,
    DROP COLUMN IF EXISTS trigger_source;

ALTER TABLE workflows
    DROP COLUMN IF EXISTS webhook_secret_id,
    DROP COLUMN IF EXISTS webhook_enabled,
    DROP COLUMN IF EXISTS schedule_next_run_at,
    DROP COLUMN IF EXISTS schedule_enabled,
    DROP COLUMN IF EXISTS schedule_timezone,
    DROP COLUMN IF EXISTS schedule_cron,
    DROP COLUMN IF EXISTS trigger_type;
