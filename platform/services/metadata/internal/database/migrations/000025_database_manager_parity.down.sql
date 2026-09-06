DROP TABLE IF EXISTS entity_record_links;
DROP TABLE IF EXISTS entity_relationships;
DROP TABLE IF EXISTS entity_keys;

ALTER TABLE entity_fields DROP CONSTRAINT IF EXISTS entity_fields_delete_behavior_check;
ALTER TABLE entity_fields DROP CONSTRAINT IF EXISTS entity_fields_field_type_check;
ALTER TABLE entity_fields
    ADD CONSTRAINT entity_fields_field_type_check
    CHECK (field_type IN ('text', 'number', 'boolean', 'date', 'lookup'));

ALTER TABLE entity_fields
    DROP COLUMN IF EXISTS delete_behavior,
    DROP COLUMN IF EXISTS config_json,
    DROP COLUMN IF EXISTS options_json,
    DROP COLUMN IF EXISTS is_unique;

ALTER TABLE entities
    DROP COLUMN IF EXISTS primary_field_id,
    DROP COLUMN IF EXISTS plural_display_name,
    DROP COLUMN IF EXISTS description;
