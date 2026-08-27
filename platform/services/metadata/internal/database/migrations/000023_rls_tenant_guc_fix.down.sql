-- Phase 9.0 down: restore prior GUC name where applicable; drop entity RLS.

DROP POLICY IF EXISTS entity_records_tenant_isolation ON entity_records;
ALTER TABLE entity_records NO FORCE ROW LEVEL SECURITY;
ALTER TABLE entity_records DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS entity_fields_tenant_isolation ON entity_fields;
ALTER TABLE entity_fields NO FORCE ROW LEVEL SECURITY;
ALTER TABLE entity_fields DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS entities_tenant_isolation ON entities;
ALTER TABLE entities NO FORCE ROW LEVEL SECURITY;
ALTER TABLE entities DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workflow_runs_tenant_isolation ON workflow_runs;
CREATE POLICY workflow_runs_tenant_isolation ON workflow_runs
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
ALTER TABLE workflow_runs NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workflows_tenant_isolation ON workflows;
CREATE POLICY workflows_tenant_isolation ON workflows
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
ALTER TABLE workflows NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS connector_user_connections_tenant_isolation ON connector_user_connections;
CREATE POLICY connector_user_connections_tenant_isolation ON connector_user_connections
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
ALTER TABLE connector_user_connections NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS environment_secret_overrides_tenant_isolation ON environment_secret_overrides;
CREATE POLICY environment_secret_overrides_tenant_isolation ON environment_secret_overrides
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
ALTER TABLE environment_secret_overrides NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS secrets_tenant_isolation ON secrets;
CREATE POLICY secrets_tenant_isolation ON secrets
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
ALTER TABLE secrets NO FORCE ROW LEVEL SECURITY;
