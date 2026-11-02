-- Mistake Lab is part of the core product for everyone. Accounts created
-- before it became the default had it off without ever choosing that, so
-- switch it on for all existing settings rows. Users can still turn it off.
UPDATE settings SET mistake_lab_enabled = true WHERE NOT mistake_lab_enabled;
