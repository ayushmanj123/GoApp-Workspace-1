ALTER TABLE component_definitions
    DROP COLUMN IF EXISTS created_by,
    DROP COLUMN IF EXISTS modified_by;
