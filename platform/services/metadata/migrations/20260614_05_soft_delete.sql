-- Migration: Add deleted_at columns for soft delete support
BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='applications' AND column_name='deleted_at') THEN
    ALTER TABLE applications ADD COLUMN deleted_at timestamptz;
  END IF;
END$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='screens' AND column_name='deleted_at') THEN
    ALTER TABLE screens ADD COLUMN deleted_at timestamptz;
  END IF;
END$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='controls' AND column_name='deleted_at') THEN
    ALTER TABLE controls ADD COLUMN deleted_at timestamptz;
  END IF;
END$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='connectors' AND column_name='deleted_at') THEN
    ALTER TABLE connectors ADD COLUMN deleted_at timestamptz;
  END IF;
END$$;

COMMIT;
