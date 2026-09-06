-- Database Manager 1A parity: entity properties, rich field types, choices,
-- uniqueness, alternate keys, N:N relationships, lookup delete behavior.

ALTER TABLE entities
    ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS plural_display_name text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS primary_field_id uuid REFERENCES entity_fields (id);

ALTER TABLE entity_fields
    ADD COLUMN IF NOT EXISTS is_unique boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS options_json jsonb,
    ADD COLUMN IF NOT EXISTS config_json jsonb,
    ADD COLUMN IF NOT EXISTS delete_behavior text NOT NULL DEFAULT 'restrict';

ALTER TABLE entity_fields
    DROP CONSTRAINT IF EXISTS entity_fields_field_type_check;

ALTER TABLE entity_fields
    ADD CONSTRAINT entity_fields_field_type_check
    CHECK (field_type IN (
        'text', 'number', 'boolean', 'date', 'lookup',
        'multiline', 'email', 'phone', 'url',
        'integer', 'decimal', 'currency',
        'datetime', 'choice', 'choices'
    ));

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'entity_fields_delete_behavior_check'
    ) THEN
        ALTER TABLE entity_fields
            ADD CONSTRAINT entity_fields_delete_behavior_check
            CHECK (delete_behavior IN ('restrict', 'clear', 'cascade'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS entity_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants (id),
    entity_id uuid NOT NULL REFERENCES entities (id),
    name text NOT NULL,
    field_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid,
    deleted_at timestamptz,
    UNIQUE (tenant_id, entity_id, name)
);

CREATE INDEX IF NOT EXISTS idx_entity_keys_entity_id ON entity_keys (entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_keys_tenant_id ON entity_keys (tenant_id);

CREATE TABLE IF NOT EXISTS entity_relationships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants (id),
    name text NOT NULL,
    relationship_type text NOT NULL DEFAULT 'nn',
    left_entity_id uuid NOT NULL REFERENCES entities (id),
    right_entity_id uuid NOT NULL REFERENCES entities (id),
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid,
    deleted_at timestamptz,
    UNIQUE (tenant_id, name),
    CHECK (relationship_type IN ('nn')),
    CHECK (left_entity_id <> right_entity_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_relationships_left ON entity_relationships (left_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_relationships_right ON entity_relationships (right_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_relationships_tenant ON entity_relationships (tenant_id);

-- Junction rows for N:N associations (runtime-owned data, shared Postgres).
CREATE TABLE IF NOT EXISTS entity_record_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    relationship_id uuid NOT NULL REFERENCES entity_relationships (id),
    left_record_id uuid NOT NULL,
    right_record_id uuid NOT NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    deleted_on timestamptz,
    deleted_by uuid,
    UNIQUE (relationship_id, left_record_id, right_record_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_record_links_rel
    ON entity_record_links (relationship_id)
    WHERE deleted_on IS NULL;
CREATE INDEX IF NOT EXISTS idx_entity_record_links_left
    ON entity_record_links (left_record_id)
    WHERE deleted_on IS NULL;
CREATE INDEX IF NOT EXISTS idx_entity_record_links_right
    ON entity_record_links (right_record_id)
    WHERE deleted_on IS NULL;
