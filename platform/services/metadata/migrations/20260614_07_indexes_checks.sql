-- Migration: Add missing indexes and enum CHECK constraints
BEGIN;

-- Indexes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='screens' AND indexname='idx_screens_appid_display_order') THEN
    CREATE INDEX idx_screens_appid_display_order ON screens (application_id, display_order);
  END IF;
END$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='controls' AND indexname='idx_controls_screen_zindex') THEN
    CREATE INDEX idx_controls_screen_zindex ON controls (screen_id, z_index);
  END IF;
END$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='controls' AND indexname='idx_controls_screen_parent_zindex') THEN
    CREATE INDEX idx_controls_screen_parent_zindex ON controls (screen_id, parent_control_id, z_index);
  END IF;
END$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='formulas' AND indexname='idx_formulas_tenant_control') THEN
    CREATE INDEX idx_formulas_tenant_control ON formulas (tenant_id, control_id);
  END IF;
END$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='connector_actions' AND indexname='idx_connector_actions_tenant_connector') THEN
    CREATE INDEX idx_connector_actions_tenant_connector ON connector_actions (tenant_id, connector_id);
  END IF;
END$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='audit_logs' AND indexname='idx_audit_logs_tenant_created_on') THEN
    CREATE INDEX idx_audit_logs_tenant_created_on ON audit_logs (tenant_id, created_on);
  END IF;
END$$;

-- Enum CHECK constraints
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_connector_type') THEN
    ALTER TABLE connectors ADD CONSTRAINT chk_connector_type CHECK (connector_type IN ('rest','sql','storage'));
  END IF;
END$$;

COMMIT;
