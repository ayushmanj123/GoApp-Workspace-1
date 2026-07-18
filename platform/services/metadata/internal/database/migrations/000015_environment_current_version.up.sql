ALTER TABLE environments ADD COLUMN IF NOT EXISTS current_version_id uuid;

ALTER TABLE environments
    ADD CONSTRAINT environments_current_version_tenant_fk
    FOREIGN KEY (tenant_id, current_version_id)
    REFERENCES application_versions (tenant_id, id)
    ON DELETE SET NULL (current_version_id);

CREATE INDEX IF NOT EXISTS idx_environments_current_version_id ON environments (current_version_id);
