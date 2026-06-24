ALTER TABLE component_definitions
    ADD COLUMN IF NOT EXISTS created_by uuid,
    ADD COLUMN IF NOT EXISTS modified_by uuid;
