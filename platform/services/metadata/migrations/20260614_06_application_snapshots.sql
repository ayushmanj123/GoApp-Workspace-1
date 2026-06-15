-- Migration: Create application_snapshots table for immutable publish snapshots
BEGIN;

CREATE TABLE IF NOT EXISTS application_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  application_version_id uuid NOT NULL,
  snapshot_json jsonb NOT NULL,
  created_on timestamptz NOT NULL DEFAULT now()
);

-- GIN index for snapshot JSON
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_application_snapshots_snapshot_json_gin') THEN
    CREATE INDEX idx_application_snapshots_snapshot_json_gin ON application_snapshots USING gin (snapshot_json);
  END IF;
END$$;

-- Composite FK to ensure tenant consistency
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_appsnap_tenant_appver') THEN
    ALTER TABLE application_snapshots
      ADD CONSTRAINT fk_appsnap_tenant_appver FOREIGN KEY (tenant_id, application_version_id) REFERENCES application_versions(tenant_id, id) ON DELETE CASCADE;
  END IF;
END$$;

COMMIT;
