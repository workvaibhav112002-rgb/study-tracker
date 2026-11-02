-- Granule treats mistakes as signals: Mistake Lab is on for new accounts.
-- Existing rows keep the choice already stored.
ALTER TABLE settings ALTER COLUMN mistake_lab_enabled SET DEFAULT true;
