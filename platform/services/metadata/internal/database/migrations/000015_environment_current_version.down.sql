DROP INDEX IF EXISTS idx_environments_current_version_id;
ALTER TABLE environments DROP CONSTRAINT IF EXISTS environments_current_version_tenant_fk;
ALTER TABLE environments DROP COLUMN IF EXISTS current_version_id;
