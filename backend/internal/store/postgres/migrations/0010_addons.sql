-- Study-oriented features become opt-in add-ons. Existing users who already
-- use them keep them switched on.

ALTER TABLE settings
    ADD COLUMN cards_enabled       BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN mistake_lab_enabled BOOLEAN NOT NULL DEFAULT false;

-- Users without a settings row yet get one so the flags can be stored.
INSERT INTO settings (user_id)
SELECT u.id FROM users u
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.user_id = u.id)
  AND (EXISTS (SELECT 1 FROM cards c WHERE c.user_id = u.id) OR EXISTS (SELECT 1 FROM mistakes m WHERE m.user_id = u.id));

UPDATE settings s SET cards_enabled = true WHERE EXISTS (SELECT 1 FROM cards c WHERE c.user_id = s.user_id);
UPDATE settings s SET mistake_lab_enabled = true WHERE EXISTS (SELECT 1 FROM mistakes m WHERE m.user_id = s.user_id);
