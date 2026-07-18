CREATE TABLE IF NOT EXISTS solution_packages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    name text NOT NULL,
    display_name text NOT NULL,
    description text NOT NULL DEFAULT '',
    version text NOT NULL DEFAULT '1.0.0',
    managed boolean NOT NULL DEFAULT false,
    is_master boolean NOT NULL DEFAULT false,
    status text NOT NULL DEFAULT 'draft',
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid,
    deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_solution_packages_master_tenant
    ON solution_packages (tenant_id)
    WHERE is_master = true AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_solution_packages_tenant_name
    ON solution_packages (tenant_id, name)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_solution_packages_tenant_id ON solution_packages (tenant_id);

CREATE TABLE IF NOT EXISTS solution_package_components (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    package_id uuid NOT NULL REFERENCES solution_packages(id) ON DELETE CASCADE,
    component_type text NOT NULL,
    component_id uuid NOT NULL,
    added_on timestamptz NOT NULL DEFAULT now(),
    added_by uuid,
    CONSTRAINT solution_package_components_type_check
        CHECK (component_type IN ('app', 'table')),
    CONSTRAINT ux_solution_package_component
        UNIQUE (package_id, component_type, component_id)
);

CREATE INDEX IF NOT EXISTS idx_solution_package_components_package_id
    ON solution_package_components (package_id);
CREATE INDEX IF NOT EXISTS idx_solution_package_components_tenant_id
    ON solution_package_components (tenant_id);

ALTER TABLE solution_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE solution_packages FORCE ROW LEVEL SECURITY;
CREATE POLICY solution_packages_tenant_isolation ON solution_packages
    USING (tenant_id = current_setting('app.tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

ALTER TABLE solution_package_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE solution_package_components FORCE ROW LEVEL SECURITY;
CREATE POLICY solution_package_components_tenant_isolation ON solution_package_components
    USING (tenant_id = current_setting('app.tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
