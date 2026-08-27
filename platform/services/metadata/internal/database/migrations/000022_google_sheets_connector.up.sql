ALTER TABLE connectors DROP CONSTRAINT IF EXISTS connectors_type_check;
ALTER TABLE connectors
    ADD CONSTRAINT connectors_type_check
    CHECK (connector_type IN ('rest', 'sql', 'storage', 'google_sheets'));
