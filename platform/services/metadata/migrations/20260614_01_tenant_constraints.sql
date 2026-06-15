-- Migration: add composite unique constraints and cross-tenant FK enforcement
BEGIN;

-- Composite unique constraints (tenant_id, id)
ALTER TABLE IF EXISTS applications
  ADD CONSTRAINT IF NOT EXISTS ux_app_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE IF EXISTS screens
  ADD CONSTRAINT IF NOT EXISTS ux_screen_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE IF EXISTS controls
  ADD CONSTRAINT IF NOT EXISTS ux_control_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE IF EXISTS connectors
  ADD CONSTRAINT IF NOT EXISTS ux_connector_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE IF EXISTS application_versions
  ADD CONSTRAINT IF NOT EXISTS ux_appver_tenant_id_id UNIQUE (tenant_id, id);

-- Composite foreign keys to prevent cross-tenant references
-- screens. (tenant_id, application_id) -> applications(tenant_id, id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_screens_tenant_application') THEN
    ALTER TABLE screens
      ADD CONSTRAINT fk_screens_tenant_application FOREIGN KEY (tenant_id, application_id) REFERENCES applications(tenant_id, id) ON DELETE CASCADE;
  END IF;
END$$;

-- controls. (tenant_id, screen_id) -> screens(tenant_id,id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_controls_tenant_screen') THEN
    ALTER TABLE controls
      ADD CONSTRAINT fk_controls_tenant_screen FOREIGN KEY (tenant_id, screen_id) REFERENCES screens(tenant_id, id) ON DELETE CASCADE;
  END IF;
END$$;

-- control_properties. (tenant_id, control_id) -> controls(tenant_id,id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_controlprops_tenant_control') THEN
    ALTER TABLE control_properties
      ADD CONSTRAINT fk_controlprops_tenant_control FOREIGN KEY (tenant_id, control_id) REFERENCES controls(tenant_id, id) ON DELETE CASCADE;
  END IF;
END$$;

-- formulas. (tenant_id, control_id) -> controls(tenant_id,id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_formulas_tenant_control') THEN
    ALTER TABLE formulas
      ADD CONSTRAINT fk_formulas_tenant_control FOREIGN KEY (tenant_id, control_id) REFERENCES controls(tenant_id, id) ON DELETE CASCADE;
  END IF;
END$$;

-- events. (tenant_id, control_id) -> controls(tenant_id,id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_events_tenant_control') THEN
    ALTER TABLE events
      ADD CONSTRAINT fk_events_tenant_control FOREIGN KEY (tenant_id, control_id) REFERENCES controls(tenant_id, id) ON DELETE CASCADE;
  END IF;
END$$;

-- connector_actions. (tenant_id, connector_id) -> connectors(tenant_id,id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_connectoractions_tenant_connector') THEN
    ALTER TABLE connector_actions
      ADD CONSTRAINT fk_connectoractions_tenant_connector FOREIGN KEY (tenant_id, connector_id) REFERENCES connectors(tenant_id, id) ON DELETE CASCADE;
  END IF;
END$$;

-- packages. (tenant_id, application_version_id) -> application_versions(tenant_id,id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_packages_tenant_appver') THEN
    ALTER TABLE packages
      ADD CONSTRAINT fk_packages_tenant_appver FOREIGN KEY (tenant_id, application_version_id) REFERENCES application_versions(tenant_id, id) ON DELETE CASCADE;
  END IF;
END$$;

COMMIT;
