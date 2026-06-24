DROP INDEX IF EXISTS screens_app_name_unique_active;

ALTER TABLE screens
  ADD CONSTRAINT screens_app_name_unique UNIQUE (application_id, name);
