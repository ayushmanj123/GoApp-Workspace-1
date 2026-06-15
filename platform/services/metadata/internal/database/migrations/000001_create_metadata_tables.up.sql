CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE OR REPLACE FUNCTION set_modified_on()
RETURNS TRIGGER AS $$
BEGIN
    NEW.modified_on = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE tenants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    status text NOT NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid,
    CONSTRAINT tenants_name_unique UNIQUE (name),
    CONSTRAINT tenants_status_check CHECK (status IN ('active', 'inactive', 'suspended'))
);

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_id text NOT NULL,
    email citext,
    display_name text NOT NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid,
    CONSTRAINT users_tenant_external_unique UNIQUE (tenant_id, external_id),
    CONSTRAINT users_tenant_email_unique UNIQUE (tenant_id, email)
);

CREATE TABLE applications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    status text NOT NULL,
    current_version text NOT NULL DEFAULT '0.1.0',
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT applications_tenant_name_unique UNIQUE (tenant_id, name),
    CONSTRAINT applications_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE TABLE environments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    name text NOT NULL,
    environment_type text NOT NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT environments_app_name_unique UNIQUE (application_id, name),
    CONSTRAINT environments_type_check CHECK (environment_type IN ('development', 'test', 'staging', 'production'))
);

CREATE TABLE application_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    version text NOT NULL,
    status text NOT NULL,
    manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT application_versions_app_version_unique UNIQUE (application_id, version),
    CONSTRAINT application_versions_status_check CHECK (status IN ('draft', 'released', 'deprecated'))
);

CREATE TABLE screens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    name text NOT NULL,
    display_order integer NOT NULL DEFAULT 0,
    layout_type text NOT NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT screens_app_name_unique UNIQUE (application_id, name),
    CONSTRAINT screens_display_order_check CHECK (display_order >= 0)
);

CREATE TABLE controls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    screen_id uuid NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
    parent_control_id uuid REFERENCES controls(id) ON DELETE CASCADE,
    control_type text NOT NULL,
    name text NOT NULL,
    x numeric(12, 2) NOT NULL DEFAULT 0,
    y numeric(12, 2) NOT NULL DEFAULT 0,
    width numeric(12, 2) NOT NULL DEFAULT 0,
    height numeric(12, 2) NOT NULL DEFAULT 0,
    z_index integer NOT NULL DEFAULT 0,
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT controls_screen_name_unique UNIQUE (screen_id, name),
    CONSTRAINT controls_size_check CHECK (width >= 0 AND height >= 0)
);

CREATE TABLE control_properties (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    control_id uuid NOT NULL REFERENCES controls(id) ON DELETE CASCADE,
    property_name text NOT NULL,
    property_value jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT control_properties_control_name_unique UNIQUE (control_id, property_name)
);

CREATE TABLE formulas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    control_id uuid NOT NULL REFERENCES controls(id) ON DELETE CASCADE,
    property_name text NOT NULL,
    formula_text text NOT NULL,
    formula_type text NOT NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT formulas_control_property_type_unique UNIQUE (control_id, property_name, formula_type),
    CONSTRAINT formulas_type_check CHECK (formula_type IN ('property', 'behavior', 'validation', 'data'))
);

CREATE TABLE events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    control_id uuid NOT NULL REFERENCES controls(id) ON DELETE CASCADE,
    event_name text NOT NULL,
    formula_id uuid NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT events_control_name_unique UNIQUE (control_id, event_name)
);

CREATE TABLE variables (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    name text NOT NULL,
    variable_type text NOT NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT variables_app_name_unique UNIQUE (application_id, name)
);

CREATE TABLE collections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    name text NOT NULL,
    schema_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT collections_app_name_unique UNIQUE (application_id, name)
);

CREATE TABLE connectors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    connector_type text NOT NULL,
    name text NOT NULL,
    authentication_type text NOT NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT connectors_app_name_unique UNIQUE (application_id, name)
);

CREATE TABLE connector_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    connector_id uuid NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
    action_name text NOT NULL,
    http_method text NOT NULL,
    endpoint text NOT NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT connector_actions_connector_name_unique UNIQUE (connector_id, action_name),
    CONSTRAINT connector_actions_method_check CHECK (http_method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'))
);

CREATE TABLE permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    role_name text NOT NULL,
    permission_name text NOT NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT permissions_app_role_permission_unique UNIQUE (application_id, role_name, permission_name)
);

CREATE TABLE audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id uuid NOT NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE packages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    application_version_id uuid NOT NULL REFERENCES application_versions(id) ON DELETE CASCADE,
    package_url text NOT NULL,
    package_hash text NOT NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT packages_version_unique UNIQUE (application_version_id),
    CONSTRAINT packages_hash_unique UNIQUE (package_hash)
);

CREATE INDEX idx_applications_tenant_id ON applications (tenant_id);
CREATE INDEX idx_applications_name ON applications (name);
CREATE INDEX idx_screens_application_id ON screens (application_id);
CREATE INDEX idx_controls_screen_id ON controls (screen_id);
CREATE INDEX idx_controls_parent_control_id ON controls (parent_control_id);
CREATE INDEX idx_control_properties_control_id ON control_properties (control_id);
CREATE INDEX idx_control_properties_property_value_gin ON control_properties USING gin (property_value);
CREATE INDEX idx_formulas_control_id ON formulas (control_id);
CREATE INDEX idx_collections_schema_definition_gin ON collections USING gin (schema_definition);
CREATE INDEX idx_audit_logs_tenant_created_on ON audit_logs (tenant_id, created_on DESC);

CREATE INDEX idx_users_tenant_id ON users (tenant_id);
CREATE INDEX idx_environments_tenant_id ON environments (tenant_id);
CREATE INDEX idx_application_versions_application_id ON application_versions (application_id);
CREATE INDEX idx_events_control_id ON events (control_id);
CREATE INDEX idx_variables_application_id ON variables (application_id);
CREATE INDEX idx_collections_application_id ON collections (application_id);
CREATE INDEX idx_connectors_application_id ON connectors (application_id);
CREATE INDEX idx_connector_actions_connector_id ON connector_actions (connector_id);
CREATE INDEX idx_permissions_application_id ON permissions (application_id);
CREATE INDEX idx_packages_application_version_id ON packages (application_version_id);

CREATE TRIGGER trg_tenants_modified_on BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION set_modified_on();
CREATE TRIGGER trg_users_modified_on BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_modified_on();
CREATE TRIGGER trg_applications_modified_on BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION set_modified_on();
CREATE TRIGGER trg_environments_modified_on BEFORE UPDATE ON environments FOR EACH ROW EXECUTE FUNCTION set_modified_on();
CREATE TRIGGER trg_application_versions_modified_on BEFORE UPDATE ON application_versions FOR EACH ROW EXECUTE FUNCTION set_modified_on();
CREATE TRIGGER trg_screens_modified_on BEFORE UPDATE ON screens FOR EACH ROW EXECUTE FUNCTION set_modified_on();
CREATE TRIGGER trg_controls_modified_on BEFORE UPDATE ON controls FOR EACH ROW EXECUTE FUNCTION set_modified_on();
CREATE TRIGGER trg_control_properties_modified_on BEFORE UPDATE ON control_properties FOR EACH ROW EXECUTE FUNCTION set_modified_on();
CREATE TRIGGER trg_formulas_modified_on BEFORE UPDATE ON formulas FOR EACH ROW EXECUTE FUNCTION set_modified_on();
CREATE TRIGGER trg_events_modified_on BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION set_modified_on();
CREATE TRIGGER trg_variables_modified_on BEFORE UPDATE ON variables FOR EACH ROW EXECUTE FUNCTION set_modified_on();
CREATE TRIGGER trg_collections_modified_on BEFORE UPDATE ON collections FOR EACH ROW EXECUTE FUNCTION set_modified_on();
CREATE TRIGGER trg_connectors_modified_on BEFORE UPDATE ON connectors FOR EACH ROW EXECUTE FUNCTION set_modified_on();
CREATE TRIGGER trg_connector_actions_modified_on BEFORE UPDATE ON connector_actions FOR EACH ROW EXECUTE FUNCTION set_modified_on();
CREATE TRIGGER trg_permissions_modified_on BEFORE UPDATE ON permissions FOR EACH ROW EXECUTE FUNCTION set_modified_on();
CREATE TRIGGER trg_audit_logs_modified_on BEFORE UPDATE ON audit_logs FOR EACH ROW EXECUTE FUNCTION set_modified_on();
CREATE TRIGGER trg_packages_modified_on BEFORE UPDATE ON packages FOR EACH ROW EXECUTE FUNCTION set_modified_on();
