CREATE TABLE IF NOT EXISTS environment_secret_overrides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    environment_id uuid NOT NULL REFERENCES environments (id) ON DELETE CASCADE,
    base_secret_id uuid NOT NULL,
    ciphertext bytea NOT NULL,
    nonce bytea NOT NULL,
    deleted_at timestamptz NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL,
    modified_on timestamptz NOT NULL DEFAULT now(),
    modified_by uuid NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_env_secret_override
    ON environment_secret_overrides (tenant_id, environment_id, base_secret_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_env_secret_overrides_environment_id
    ON environment_secret_overrides (environment_id);

CREATE INDEX IF NOT EXISTS idx_env_secret_overrides_base_secret_id
    ON environment_secret_overrides (base_secret_id);

ALTER TABLE environment_secret_overrides
    ADD CONSTRAINT environment_secret_overrides_secret_tenant_fk
    FOREIGN KEY (tenant_id, base_secret_id)
    REFERENCES secrets (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE environment_secret_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY environment_secret_overrides_tenant_isolation ON environment_secret_overrides
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
