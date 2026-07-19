DROP INDEX IF EXISTS idx_entity_fields_related_entity_id;

ALTER TABLE entity_fields
    DROP COLUMN IF EXISTS related_entity_id;

ALTER TABLE entity_fields
    DROP CONSTRAINT IF EXISTS entity_fields_field_type_check;

ALTER TABLE entity_fields
    ADD CONSTRAINT entity_fields_field_type_check
    CHECK (field_type IN ('text', 'number', 'boolean', 'date'));
