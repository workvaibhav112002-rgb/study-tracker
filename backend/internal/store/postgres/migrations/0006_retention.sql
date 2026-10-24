-- Goal streak freezes, reminders, push subscriptions.

ALTER TABLE settings
    ADD COLUMN streak_freeze_days DATE[]   NOT NULL DEFAULT '{}',
    ADD COLUMN reminder_enabled   BOOLEAN  NOT NULL DEFAULT false,
    ADD COLUMN reminder_hour      SMALLINT NOT NULL DEFAULT 9 CHECK (reminder_hour BETWEEN 0 AND 23),
    ADD COLUMN timezone           TEXT     NOT NULL DEFAULT 'UTC' CHECK (length(timezone) BETWEEN 1 AND 64),
    ADD COLUMN last_reminded_on   DATE     NULL;

CREATE TABLE push_subscriptions (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint   TEXT        NOT NULL UNIQUE CHECK (length(endpoint) BETWEEN 1 AND 2048),
    p256dh     TEXT        NOT NULL,
    auth       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error TEXT        NULL
);
CREATE INDEX push_subscriptions_user_idx ON push_subscriptions (user_id);
