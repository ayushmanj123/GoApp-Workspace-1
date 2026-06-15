DROP INDEX IF EXISTS idx_audit_logs_tenant_created_on_enterprise;
DROP INDEX IF EXISTS idx_connector_actions_tenant_connector;
DROP INDEX IF EXISTS idx_formulas_tenant_control;
DROP INDEX IF EXISTS idx_controls_screen_parent_z_index;
DROP INDEX IF EXISTS idx_controls_screen_z_index;
DROP INDEX IF EXISTS idx_screens_application_display_order;

DROP TRIGGER IF EXISTS trg_audit_logs_block_delete ON audit_logs;
DROP TRIGGER IF EXISTS trg_audit_logs_block_update ON audit_logs;
DROP FUNCTION IF EXISTS audit_logs_append_only();

DROP POLICY IF EXISTS application_snapshots_tenant_isolation ON application_snapshots;
ALTER TABLE application_snapshots NO FORCE ROW LEVEL SECURITY;
ALTER TABLE application_snapshots DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS packages_tenant_isolation ON packages;
ALTER TABLE packages NO FORCE ROW LEVEL SECURITY;
ALTER TABLE packages DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_tenant_isolation ON audit_logs;
ALTER TABLE audit_logs NO FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS permissions_tenant_isolation ON permissions;
ALTER TABLE permissions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE permissions DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS connector_actions_tenant_isolation ON connector_actions;
ALTER TABLE connector_actions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE connector_actions DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS collections_tenant_isolation ON collections;
ALTER TABLE collections NO FORCE ROW LEVEL SECURITY;
ALTER TABLE collections DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS variables_tenant_isolation ON variables;
ALTER TABLE variables NO FORCE ROW LEVEL SECURITY;
ALTER TABLE variables DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS events_tenant_isolation ON events;
ALTER TABLE events NO FORCE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS control_properties_tenant_isolation ON control_properties;
ALTER TABLE control_properties NO FORCE ROW LEVEL SECURITY;
ALTER TABLE control_properties DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS application_versions_tenant_isolation ON application_versions;
ALTER TABLE application_versions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE application_versions DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_tenant_isolation ON users;
ALTER TABLE users NO FORCE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

DROP TABLE IF EXISTS application_snapshots;

ALTER TABLE connectors DROP CONSTRAINT IF EXISTS connectors_type_check;

ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE applications
    ADD CONSTRAINT applications_status_check
    CHECK (status IN ('draft', 'published', 'archived'));

ALTER TABLE environments DROP CONSTRAINT IF EXISTS environments_type_check;
ALTER TABLE environments
    ADD CONSTRAINT environments_type_check
    CHECK (environment_type IN ('development', 'test', 'staging', 'production'));

ALTER TABLE packages DROP CONSTRAINT IF EXISTS packages_application_version_tenant_fk;
ALTER TABLE permissions DROP CONSTRAINT IF EXISTS permissions_application_tenant_fk;
ALTER TABLE connector_actions DROP CONSTRAINT IF EXISTS connector_actions_connector_tenant_fk;
ALTER TABLE connectors DROP CONSTRAINT IF EXISTS connectors_application_tenant_fk;
ALTER TABLE collections DROP CONSTRAINT IF EXISTS collections_application_tenant_fk;
ALTER TABLE variables DROP CONSTRAINT IF EXISTS variables_application_tenant_fk;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_formula_tenant_fk;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_control_tenant_fk;
ALTER TABLE formulas DROP CONSTRAINT IF EXISTS formulas_control_tenant_fk;
ALTER TABLE control_properties DROP CONSTRAINT IF EXISTS control_properties_control_tenant_fk;
ALTER TABLE controls DROP CONSTRAINT IF EXISTS controls_parent_control_tenant_fk;
ALTER TABLE controls DROP CONSTRAINT IF EXISTS controls_screen_tenant_fk;
ALTER TABLE screens DROP CONSTRAINT IF EXISTS screens_application_tenant_fk;
ALTER TABLE application_versions DROP CONSTRAINT IF EXISTS application_versions_application_tenant_fk;
ALTER TABLE environments DROP CONSTRAINT IF EXISTS environments_application_tenant_fk;
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_current_version_tenant_fk;

ALTER TABLE packages
    ADD CONSTRAINT packages_application_version_id_fkey
    FOREIGN KEY (application_version_id)
    REFERENCES application_versions(id)
    ON DELETE CASCADE;

ALTER TABLE permissions
    ADD CONSTRAINT permissions_application_id_fkey
    FOREIGN KEY (application_id)
    REFERENCES applications(id)
    ON DELETE CASCADE;

ALTER TABLE connector_actions
    ADD CONSTRAINT connector_actions_connector_id_fkey
    FOREIGN KEY (connector_id)
    REFERENCES connectors(id)
    ON DELETE CASCADE;

ALTER TABLE connectors
    ADD CONSTRAINT connectors_application_id_fkey
    FOREIGN KEY (application_id)
    REFERENCES applications(id)
    ON DELETE CASCADE;

ALTER TABLE collections
    ADD CONSTRAINT collections_application_id_fkey
    FOREIGN KEY (application_id)
    REFERENCES applications(id)
    ON DELETE CASCADE;

ALTER TABLE variables
    ADD CONSTRAINT variables_application_id_fkey
    FOREIGN KEY (application_id)
    REFERENCES applications(id)
    ON DELETE CASCADE;

ALTER TABLE events
    ADD CONSTRAINT events_control_id_fkey
    FOREIGN KEY (control_id)
    REFERENCES controls(id)
    ON DELETE CASCADE;

ALTER TABLE events
    ADD CONSTRAINT events_formula_id_fkey
    FOREIGN KEY (formula_id)
    REFERENCES formulas(id)
    ON DELETE CASCADE;

ALTER TABLE formulas
    ADD CONSTRAINT formulas_control_id_fkey
    FOREIGN KEY (control_id)
    REFERENCES controls(id)
    ON DELETE CASCADE;

ALTER TABLE control_properties
    ADD CONSTRAINT control_properties_control_id_fkey
    FOREIGN KEY (control_id)
    REFERENCES controls(id)
    ON DELETE CASCADE;

ALTER TABLE controls
    ADD CONSTRAINT controls_screen_id_fkey
    FOREIGN KEY (screen_id)
    REFERENCES screens(id)
    ON DELETE CASCADE;

ALTER TABLE controls
    ADD CONSTRAINT controls_parent_control_id_fkey
    FOREIGN KEY (parent_control_id)
    REFERENCES controls(id)
    ON DELETE CASCADE;

ALTER TABLE screens
    ADD CONSTRAINT screens_application_id_fkey
    FOREIGN KEY (application_id)
    REFERENCES applications(id)
    ON DELETE CASCADE;

ALTER TABLE application_versions
    ADD CONSTRAINT application_versions_application_id_fkey
    FOREIGN KEY (application_id)
    REFERENCES applications(id)
    ON DELETE CASCADE;

ALTER TABLE environments
    ADD CONSTRAINT environments_application_id_fkey
    FOREIGN KEY (application_id)
    REFERENCES applications(id)
    ON DELETE CASCADE;

ALTER TABLE applications ADD COLUMN current_version text NOT NULL DEFAULT '0.1.0';
UPDATE applications a
SET current_version = av.version
FROM application_versions av
WHERE av.id = a.current_version_id;
ALTER TABLE applications DROP COLUMN current_version_id;

ALTER TABLE connectors DROP COLUMN deleted_at;
ALTER TABLE controls DROP COLUMN deleted_at;
ALTER TABLE screens DROP COLUMN deleted_at;
ALTER TABLE applications DROP COLUMN deleted_at;

ALTER TABLE formulas DROP CONSTRAINT IF EXISTS formulas_tenant_id_id_unique;
ALTER TABLE application_versions DROP CONSTRAINT IF EXISTS application_versions_tenant_id_id_unique;
ALTER TABLE connectors DROP CONSTRAINT IF EXISTS connectors_tenant_id_id_unique;
ALTER TABLE controls DROP CONSTRAINT IF EXISTS controls_tenant_id_id_unique;
ALTER TABLE screens DROP CONSTRAINT IF EXISTS screens_tenant_id_id_unique;
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_tenant_id_id_unique;
