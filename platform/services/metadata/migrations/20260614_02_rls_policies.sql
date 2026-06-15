-- Migration: Enable RLS and create tenant policies for selected tables
BEGIN;

-- Helper to enable RLS and add policies
DO $$
BEGIN
  -- users
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'users') THEN
    EXECUTE 'ALTER TABLE users ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'tenant_isolation_users') THEN
      EXECUTE 'CREATE POLICY tenant_isolation_users ON users USING (tenant_id = current_setting(''app.tenant_id'')::uuid) WITH CHECK (tenant_id = current_setting(''app.tenant_id'')::uuid)';
    END IF;
  END IF;

  -- application_versions
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'application_versions') THEN
    EXECUTE 'ALTER TABLE application_versions ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'tenant_isolation_appver') THEN
      EXECUTE 'CREATE POLICY tenant_isolation_appver ON application_versions USING (tenant_id = current_setting(''app.tenant_id'')::uuid) WITH CHECK (tenant_id = current_setting(''app.tenant_id'')::uuid)';
    END IF;
  END IF;

  -- control_properties
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'control_properties') THEN
    EXECUTE 'ALTER TABLE control_properties ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'tenant_isolation_control_properties') THEN
      EXECUTE 'CREATE POLICY tenant_isolation_control_properties ON control_properties USING (tenant_id = current_setting(''app.tenant_id'')::uuid) WITH CHECK (tenant_id = current_setting(''app.tenant_id'')::uuid)';
    END IF;
  END IF;

  -- events
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'events') THEN
    EXECUTE 'ALTER TABLE events ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'tenant_isolation_events') THEN
      EXECUTE 'CREATE POLICY tenant_isolation_events ON events USING (tenant_id = current_setting(''app.tenant_id'')::uuid) WITH CHECK (tenant_id = current_setting(''app.tenant_id'')::uuid)';
    END IF;
  END IF;

  -- variables
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'variables') THEN
    EXECUTE 'ALTER TABLE variables ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'tenant_isolation_variables') THEN
      EXECUTE 'CREATE POLICY tenant_isolation_variables ON variables USING (tenant_id = current_setting(''app.tenant_id'')::uuid) WITH CHECK (tenant_id = current_setting(''app.tenant_id'')::uuid)';
    END IF;
  END IF;

  -- collections
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'collections') THEN
    EXECUTE 'ALTER TABLE collections ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'tenant_isolation_collections') THEN
      EXECUTE 'CREATE POLICY tenant_isolation_collections ON collections USING (tenant_id = current_setting(''app.tenant_id'')::uuid) WITH CHECK (tenant_id = current_setting(''app.tenant_id'')::uuid)';
    END IF;
  END IF;

  -- connector_actions
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'connector_actions') THEN
    EXECUTE 'ALTER TABLE connector_actions ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'tenant_isolation_connector_actions') THEN
      EXECUTE 'CREATE POLICY tenant_isolation_connector_actions ON connector_actions USING (tenant_id = current_setting(''app.tenant_id'')::uuid) WITH CHECK (tenant_id = current_setting(''app.tenant_id'')::uuid)';
    END IF;
  END IF;

  -- permissions
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'permissions') THEN
    EXECUTE 'ALTER TABLE permissions ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'tenant_isolation_permissions') THEN
      EXECUTE 'CREATE POLICY tenant_isolation_permissions ON permissions USING (tenant_id = current_setting(''app.tenant_id'')::uuid) WITH CHECK (tenant_id = current_setting(''app.tenant_id'')::uuid)';
    END IF;
  END IF;

  -- audit_logs
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'audit_logs') THEN
    EXECUTE 'ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'tenant_isolation_audit_logs') THEN
      EXECUTE 'CREATE POLICY tenant_isolation_audit_logs ON audit_logs USING (tenant_id = current_setting(''app.tenant_id'')::uuid) WITH CHECK (tenant_id = current_setting(''app.tenant_id'')::uuid)';
    END IF;
  END IF;

  -- packages
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'packages') THEN
    EXECUTE 'ALTER TABLE packages ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'tenant_isolation_packages') THEN
      EXECUTE 'CREATE POLICY tenant_isolation_packages ON packages USING (tenant_id = current_setting(''app.tenant_id'')::uuid) WITH CHECK (tenant_id = current_setting(''app.tenant_id'')::uuid)';
    END IF;
  END IF;

END$$;

COMMIT;
