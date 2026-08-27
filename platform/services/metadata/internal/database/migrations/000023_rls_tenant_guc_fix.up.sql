-- Phase 9.0: align RLS GUC to app.tenant_id (matches set_config in tenant_context.go),
-- FORCE RLS on sensitive tables, and add tenant isolation for entity tables.

-- secrets
DROP POLICY IF EXISTS secrets_tenant_isolation ON secrets;
CREATE POLICY secrets_tenant_isolation ON secrets
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE secrets FORCE ROW LEVEL SECURITY;

-- environment_secret_overrides
DROP POLICY IF EXISTS environment_secret_overrides_tenant_isolation ON environment_secret_overrides;
CREATE POLICY environment_secret_overrides_tenant_isolation ON environment_secret_overrides
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE environment_secret_overrides FORCE ROW LEVEL SECURITY;

-- connector_user_connections
DROP POLICY IF EXISTS connector_user_connections_tenant_isolation ON connector_user_connections;
CREATE POLICY connector_user_connections_tenant_isolation ON connector_user_connections
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE connector_user_connections FORCE ROW LEVEL SECURITY;

-- workflows
DROP POLICY IF EXISTS workflows_tenant_isolation ON workflows;
CREATE POLICY workflows_tenant_isolation ON workflows
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE workflows FORCE ROW LEVEL SECURITY;

-- workflow_runs
DROP POLICY IF EXISTS workflow_runs_tenant_isolation ON workflow_runs;
CREATE POLICY workflow_runs_tenant_isolation ON workflow_runs
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE workflow_runs FORCE ROW LEVEL SECURITY;

-- entities
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS entities_tenant_isolation ON entities;
CREATE POLICY entities_tenant_isolation ON entities
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- entity_fields
ALTER TABLE entity_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_fields FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS entity_fields_tenant_isolation ON entity_fields;
CREATE POLICY entity_fields_tenant_isolation ON entity_fields
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- entity_records
ALTER TABLE entity_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_records FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS entity_records_tenant_isolation ON entity_records;
CREATE POLICY entity_records_tenant_isolation ON entity_records
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
