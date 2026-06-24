-- Allow reusing screen names after soft delete
ALTER TABLE screens DROP CONSTRAINT IF EXISTS screens_app_name_unique;

CREATE UNIQUE INDEX IF NOT EXISTS screens_app_name_unique_active
  ON screens (application_id, name)
  WHERE deleted_at IS NULL;
