-- Phase 9.1: fold useful indexes/checks from the unused services/metadata/migrations/ tree
-- into the embedded golang-migrate path.

CREATE INDEX IF NOT EXISTS idx_screens_appid_display_order ON screens (application_id, display_order);
CREATE INDEX IF NOT EXISTS idx_controls_screen_zindex ON controls (screen_id, z_index);
CREATE INDEX IF NOT EXISTS idx_controls_screen_parent_zindex ON controls (screen_id, parent_control_id, z_index);
CREATE INDEX IF NOT EXISTS idx_formulas_tenant_control ON formulas (tenant_id, control_id);
CREATE INDEX IF NOT EXISTS idx_connector_actions_tenant_connector ON connector_actions (tenant_id, connector_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created_on ON audit_logs (tenant_id, created_on);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_environment_type') THEN
    ALTER TABLE environments ADD CONSTRAINT chk_environment_type CHECK (environment_type IN ('development','test','production'));
  END IF;
END$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_application_status') THEN
    ALTER TABLE applications ADD CONSTRAINT chk_application_status CHECK (status IN ('draft','published','archived'));
  END IF;
END$$;
