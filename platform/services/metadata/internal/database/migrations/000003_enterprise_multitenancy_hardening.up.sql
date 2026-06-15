ALTER TABLE applications ADD COLUMN current_version_id uuid;
UPDATE applications a
SET current_version_id = av.id
FROM application_versions av
WHERE av.tenant_id = a.tenant_id
  AND av.application_id = a.id
  AND av.version = a.current_version;
ALTER TABLE applications DROP COLUMN current_version;

ALTER TABLE applications ADD COLUMN deleted_at timestamptz;
ALTER TABLE screens ADD COLUMN deleted_at timestamptz;
ALTER TABLE controls ADD COLUMN deleted_at timestamptz;
ALTER TABLE connectors ADD COLUMN deleted_at timestamptz;

ALTER TABLE applications ADD CONSTRAINT applications_tenant_id_id_unique UNIQUE (tenant_id, id);
ALTER TABLE screens ADD CONSTRAINT screens_tenant_id_id_unique UNIQUE (tenant_id, id);
ALTER TABLE controls ADD CONSTRAINT controls_tenant_id_id_unique UNIQUE (tenant_id, id);
ALTER TABLE connectors ADD CONSTRAINT connectors_tenant_id_id_unique UNIQUE (tenant_id, id);
ALTER TABLE application_versions ADD CONSTRAINT application_versions_tenant_id_id_unique UNIQUE (tenant_id, id);
ALTER TABLE formulas ADD CONSTRAINT formulas_tenant_id_id_unique UNIQUE (tenant_id, id);

ALTER TABLE applications
    ADD CONSTRAINT applications_current_version_tenant_fk
    FOREIGN KEY (tenant_id, current_version_id)
    REFERENCES application_versions (tenant_id, id)
    ON DELETE SET NULL (current_version_id);

ALTER TABLE environments DROP CONSTRAINT IF EXISTS environments_application_id_fkey;
ALTER TABLE application_versions DROP CONSTRAINT IF EXISTS application_versions_application_id_fkey;
ALTER TABLE screens DROP CONSTRAINT IF EXISTS screens_application_id_fkey;
ALTER TABLE controls DROP CONSTRAINT IF EXISTS controls_screen_id_fkey;
ALTER TABLE controls DROP CONSTRAINT IF EXISTS controls_parent_control_id_fkey;
ALTER TABLE control_properties DROP CONSTRAINT IF EXISTS control_properties_control_id_fkey;
ALTER TABLE formulas DROP CONSTRAINT IF EXISTS formulas_control_id_fkey;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_control_id_fkey;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_formula_id_fkey;
ALTER TABLE variables DROP CONSTRAINT IF EXISTS variables_application_id_fkey;
ALTER TABLE collections DROP CONSTRAINT IF EXISTS collections_application_id_fkey;
ALTER TABLE connectors DROP CONSTRAINT IF EXISTS connectors_application_id_fkey;
ALTER TABLE connector_actions DROP CONSTRAINT IF EXISTS connector_actions_connector_id_fkey;
ALTER TABLE permissions DROP CONSTRAINT IF EXISTS permissions_application_id_fkey;
ALTER TABLE packages DROP CONSTRAINT IF EXISTS packages_application_version_id_fkey;

ALTER TABLE environments
    ADD CONSTRAINT environments_application_tenant_fk
    FOREIGN KEY (tenant_id, application_id)
    REFERENCES applications (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE application_versions
    ADD CONSTRAINT application_versions_application_tenant_fk
    FOREIGN KEY (tenant_id, application_id)
    REFERENCES applications (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE screens
    ADD CONSTRAINT screens_application_tenant_fk
    FOREIGN KEY (tenant_id, application_id)
    REFERENCES applications (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE controls
    ADD CONSTRAINT controls_screen_tenant_fk
    FOREIGN KEY (tenant_id, screen_id)
    REFERENCES screens (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE controls
    ADD CONSTRAINT controls_parent_control_tenant_fk
    FOREIGN KEY (tenant_id, parent_control_id)
    REFERENCES controls (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE control_properties
    ADD CONSTRAINT control_properties_control_tenant_fk
    FOREIGN KEY (tenant_id, control_id)
    REFERENCES controls (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE formulas
    ADD CONSTRAINT formulas_control_tenant_fk
    FOREIGN KEY (tenant_id, control_id)
    REFERENCES controls (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE events
    ADD CONSTRAINT events_control_tenant_fk
    FOREIGN KEY (tenant_id, control_id)
    REFERENCES controls (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE events
    ADD CONSTRAINT events_formula_tenant_fk
    FOREIGN KEY (tenant_id, formula_id)
    REFERENCES formulas (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE variables
    ADD CONSTRAINT variables_application_tenant_fk
    FOREIGN KEY (tenant_id, application_id)
    REFERENCES applications (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE collections
    ADD CONSTRAINT collections_application_tenant_fk
    FOREIGN KEY (tenant_id, application_id)
    REFERENCES applications (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE connectors
    ADD CONSTRAINT connectors_application_tenant_fk
    FOREIGN KEY (tenant_id, application_id)
    REFERENCES applications (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE connector_actions
    ADD CONSTRAINT connector_actions_connector_tenant_fk
    FOREIGN KEY (tenant_id, connector_id)
    REFERENCES connectors (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE permissions
    ADD CONSTRAINT permissions_application_tenant_fk
    FOREIGN KEY (tenant_id, application_id)
    REFERENCES applications (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE packages
    ADD CONSTRAINT packages_application_version_tenant_fk
    FOREIGN KEY (tenant_id, application_version_id)
    REFERENCES application_versions (tenant_id, id)
    ON DELETE CASCADE;

CREATE TABLE application_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    application_version_id uuid NOT NULL,
    snapshot_json jsonb NOT NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT application_snapshots_version_unique UNIQUE (application_version_id),
    CONSTRAINT application_snapshots_tenant_version_fk
        FOREIGN KEY (tenant_id, application_version_id)
        REFERENCES application_versions (tenant_id, id)
        ON DELETE CASCADE
);

CREATE INDEX idx_application_snapshots_snapshot_json_gin ON application_snapshots USING gin (snapshot_json);
CREATE INDEX idx_application_snapshots_tenant_version ON application_snapshots (tenant_id, application_version_id);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY users_tenant_isolation ON users
    USING (tenant_id = current_setting('app.tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

ALTER TABLE application_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY application_versions_tenant_isolation ON application_versions
    USING (tenant_id = current_setting('app.tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

ALTER TABLE control_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_properties FORCE ROW LEVEL SECURITY;
CREATE POLICY control_properties_tenant_isolation ON control_properties
    USING (tenant_id = current_setting('app.tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE events FORCE ROW LEVEL SECURITY;
CREATE POLICY events_tenant_isolation ON events
    USING (tenant_id = current_setting('app.tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

ALTER TABLE variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE variables FORCE ROW LEVEL SECURITY;
CREATE POLICY variables_tenant_isolation ON variables
    USING (tenant_id = current_setting('app.tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections FORCE ROW LEVEL SECURITY;
CREATE POLICY collections_tenant_isolation ON collections
    USING (tenant_id = current_setting('app.tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

ALTER TABLE connector_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_actions FORCE ROW LEVEL SECURITY;
CREATE POLICY connector_actions_tenant_isolation ON connector_actions
    USING (tenant_id = current_setting('app.tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions FORCE ROW LEVEL SECURITY;
CREATE POLICY permissions_tenant_isolation ON permissions
    USING (tenant_id = current_setting('app.tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_tenant_isolation ON audit_logs
    USING (tenant_id = current_setting('app.tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages FORCE ROW LEVEL SECURITY;
CREATE POLICY packages_tenant_isolation ON packages
    USING (tenant_id = current_setting('app.tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

ALTER TABLE application_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_snapshots FORCE ROW LEVEL SECURITY;
CREATE POLICY application_snapshots_tenant_isolation ON application_snapshots
    USING (tenant_id = current_setting('app.tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE OR REPLACE FUNCTION audit_logs_append_only()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_block_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();

CREATE TRIGGER trg_audit_logs_block_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();

CREATE INDEX idx_screens_application_display_order ON screens (application_id, display_order);
CREATE INDEX idx_controls_screen_z_index ON controls (screen_id, z_index);
CREATE INDEX idx_controls_screen_parent_z_index ON controls (screen_id, parent_control_id, z_index);
CREATE INDEX idx_formulas_tenant_control ON formulas (tenant_id, control_id);
CREATE INDEX idx_connector_actions_tenant_connector ON connector_actions (tenant_id, connector_id);
CREATE INDEX idx_audit_logs_tenant_created_on_enterprise ON audit_logs (tenant_id, created_on DESC);

ALTER TABLE environments DROP CONSTRAINT IF EXISTS environments_type_check;
ALTER TABLE environments
    ADD CONSTRAINT environments_type_check
    CHECK (environment_type IN ('development', 'test', 'production'));

ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE applications
    ADD CONSTRAINT applications_status_check
    CHECK (status IN ('draft', 'published', 'archived'));

ALTER TABLE connectors
    ADD CONSTRAINT connectors_type_check
    CHECK (connector_type IN ('rest', 'sql', 'storage'));
