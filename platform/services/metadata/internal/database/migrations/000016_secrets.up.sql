CREATE TABLE IF NOT EXISTS secrets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants (id),
    application_id uuid NULL,
    name text NOT NULL,
    ciphertext bytea NOT NULL,
    nonce bytea NOT NULL,
    deleted_at timestamptz NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid NULL
);

CREATE INDEX IF NOT EXISTS idx_secrets_tenant_id ON secrets (tenant_id);
CREATE INDEX IF NOT EXISTS idx_secrets_application_id ON secrets (application_id);
CREATE INDEX IF NOT EXISTS idx_secrets_deleted_at ON secrets (deleted_at);
CREATE UNIQUE INDEX IF NOT EXISTS ux_secrets_tenant_id_id ON secrets (tenant_id, id);

ALTER TABLE secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY secrets_tenant_isolation ON secrets
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
