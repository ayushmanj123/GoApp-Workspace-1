CREATE TABLE IF NOT EXISTS connector_user_connections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    connector_id uuid NOT NULL,
    user_id uuid NOT NULL,
    refresh_secret_id uuid NOT NULL,
    deleted_at timestamptz NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_connector_user_connections_active
    ON connector_user_connections (tenant_id, connector_id, user_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_connector_user_connections_connector_id
    ON connector_user_connections (connector_id);

CREATE INDEX IF NOT EXISTS idx_connector_user_connections_user_id
    ON connector_user_connections (user_id);

ALTER TABLE connector_user_connections
    ADD CONSTRAINT connector_user_connections_connector_tenant_fk
    FOREIGN KEY (tenant_id, connector_id)
    REFERENCES connectors (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE connector_user_connections
    ADD CONSTRAINT connector_user_connections_secret_tenant_fk
    FOREIGN KEY (tenant_id, refresh_secret_id)
    REFERENCES secrets (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE connector_user_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY connector_user_connections_tenant_isolation ON connector_user_connections
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
