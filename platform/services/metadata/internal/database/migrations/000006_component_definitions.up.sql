CREATE TABLE IF NOT EXISTS component_definitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    application_id uuid NOT NULL,
    name text NOT NULL,
    definition_json jsonb NOT NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid,
    deleted_at timestamptz,
    CONSTRAINT ux_component_def_tenant_app_name UNIQUE (tenant_id, application_id, name)
);

CREATE INDEX IF NOT EXISTS idx_component_definitions_application_id
    ON component_definitions (application_id);

CREATE INDEX IF NOT EXISTS idx_component_definitions_tenant_id
    ON component_definitions (tenant_id);
