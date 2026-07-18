ALTER TABLE connectors
    ADD COLUMN IF NOT EXISTS base_url text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS auth_config jsonb NOT NULL DEFAULT '{}'::jsonb;
