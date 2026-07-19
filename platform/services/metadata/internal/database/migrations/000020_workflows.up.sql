CREATE TABLE IF NOT EXISTS workflows (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    application_id uuid NOT NULL,
    name text NOT NULL,
    definition jsonb NOT NULL DEFAULT '{}'::jsonb,
    deleted_at timestamptz NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_workflows_tenant_id_id
    ON workflows (tenant_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_workflows_app_name_active
    ON workflows (tenant_id, application_id, name)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_workflows_application_id
    ON workflows (application_id);

ALTER TABLE workflows
    ADD CONSTRAINT workflows_application_tenant_fk
    FOREIGN KEY (tenant_id, application_id)
    REFERENCES applications (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY workflows_tenant_isolation ON workflows
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

CREATE TABLE IF NOT EXISTS workflow_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    workflow_id uuid NOT NULL,
    status text NOT NULL,
    triggered_by uuid NULL,
    started_on timestamptz NOT NULL DEFAULT now(),
    finished_on timestamptz NULL,
    result jsonb NOT NULL DEFAULT '{}'::jsonb,
    deleted_at timestamptz NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id
    ON workflow_runs (workflow_id);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_started_on
    ON workflow_runs (started_on DESC);

ALTER TABLE workflow_runs
    ADD CONSTRAINT workflow_runs_workflow_tenant_fk
    FOREIGN KEY (tenant_id, workflow_id)
    REFERENCES workflows (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY workflow_runs_tenant_isolation ON workflow_runs
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
