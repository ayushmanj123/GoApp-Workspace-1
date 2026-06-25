CREATE TABLE IF NOT EXISTS entity_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    entity_id uuid NOT NULL REFERENCES entities(id),
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    version integer NOT NULL DEFAULT 1,
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid,
    deleted_on timestamptz,
    deleted_by uuid
);

CREATE INDEX IF NOT EXISTS idx_entity_records_tenant_entity
    ON entity_records (tenant_id, entity_id)
    WHERE deleted_on IS NULL;

CREATE INDEX IF NOT EXISTS idx_entity_records_data_gin
    ON entity_records USING gin (data);
