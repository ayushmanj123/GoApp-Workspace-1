CREATE TABLE IF NOT EXISTS entities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    application_id uuid NOT NULL,
    name text NOT NULL,
    display_name text NOT NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid,
    deleted_at timestamptz,
    CONSTRAINT ux_entity_tenant_app_name UNIQUE (tenant_id, application_id, name)
);

CREATE TABLE IF NOT EXISTS entity_fields (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    name text NOT NULL,
    display_name text NOT NULL,
    field_type text NOT NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid,
    deleted_at timestamptz,
    CONSTRAINT ux_entity_field_tenant_entity_name UNIQUE (tenant_id, entity_id, name),
    CONSTRAINT entity_fields_field_type_check CHECK (field_type IN ('text', 'number', 'boolean', 'date'))
);

CREATE INDEX IF NOT EXISTS idx_entities_application_id ON entities (application_id);
CREATE INDEX IF NOT EXISTS idx_entities_tenant_id ON entities (tenant_id);
CREATE INDEX IF NOT EXISTS idx_entity_fields_entity_id ON entity_fields (entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_fields_tenant_id ON entity_fields (tenant_id);
