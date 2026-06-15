-- GoApps Platform — PostgreSQL initialization script
-- Creates the Keycloak database alongside the default goapps database.

CREATE DATABASE keycloak;

GRANT ALL PRIVILEGES ON DATABASE keycloak TO goapps;

-- Future: create per-service schemas in the goapps database.
-- CREATE SCHEMA IF NOT EXISTS metadata;
-- CREATE SCHEMA IF NOT EXISTS audit;
