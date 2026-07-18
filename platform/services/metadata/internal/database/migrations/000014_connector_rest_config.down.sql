ALTER TABLE connectors
    DROP COLUMN IF EXISTS base_url,
    DROP COLUMN IF EXISTS auth_config;
