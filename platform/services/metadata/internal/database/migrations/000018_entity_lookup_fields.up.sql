-- Phase 7.14: Entity relationships (minimal many-to-one lookup fields).
ALTER TABLE entity_fields
    DROP CONSTRAINT IF EXISTS entity_fields_field_type_check;

ALTER TABLE entity_fields
    ADD CONSTRAINT entity_fields_field_type_check
    CHECK (field_type IN ('text', 'number', 'boolean', 'date', 'lookup'));

ALTER TABLE entity_fields
    ADD COLUMN IF NOT EXISTS related_entity_id uuid REFERENCES entities (id);

CREATE INDEX IF NOT EXISTS idx_entity_fields_related_entity_id
    ON entity_fields (related_entity_id);
