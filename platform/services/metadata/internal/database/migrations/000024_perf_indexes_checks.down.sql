DROP INDEX IF EXISTS idx_audit_logs_tenant_created_on;
DROP INDEX IF EXISTS idx_connector_actions_tenant_connector;
DROP INDEX IF EXISTS idx_formulas_tenant_control;
DROP INDEX IF EXISTS idx_controls_screen_parent_zindex;
DROP INDEX IF EXISTS idx_controls_screen_zindex;
DROP INDEX IF EXISTS idx_screens_appid_display_order;

ALTER TABLE applications DROP CONSTRAINT IF EXISTS chk_application_status;
ALTER TABLE environments DROP CONSTRAINT IF EXISTS chk_environment_type;
