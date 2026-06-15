-- Migration: Replace applications.current_version varchar -> current_version_id uuid and enforce tenant FK
BEGIN;

-- Drop legacy column if exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='applications' AND column_name='current_version') THEN
    ALTER TABLE applications DROP COLUMN current_version;
  END IF;
END$$;

-- Add current_version_id if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='applications' AND column_name='current_version_id') THEN
    ALTER TABLE applications ADD COLUMN current_version_id uuid;
  END IF;
END$$;

-- Add composite FK to ensure the referenced app version belongs to same tenant
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_app_current_version_tenant_appver') THEN
    ALTER TABLE applications
      ADD CONSTRAINT fk_app_current_version_tenant_appver FOREIGN KEY (tenant_id, current_version_id) REFERENCES application_versions(tenant_id, id) ON DELETE SET NULL;
  END IF;
END$$;

COMMIT;
