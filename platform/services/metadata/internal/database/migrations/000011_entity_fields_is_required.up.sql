ALTER TABLE entity_fields
    ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT false;
