-- Initial schema. Every tenant-owned table carries user_id and every query
-- in the store scopes by it. The composite FK on sessions makes it impossible
-- to attach a session to a project owned by a different user.

CREATE TABLE users (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email         TEXT        NOT NULL UNIQUE
                              CHECK (email = lower(btrim(email)) AND length(email) BETWEEN 3 AND 254),
    password_hash TEXT        NOT NULL,
    name          TEXT        NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projects (
    id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id                BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                   TEXT        NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    color                  TEXT        NOT NULL DEFAULT '#3b82f6' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
    description            TEXT        NOT NULL DEFAULT '' CHECK (length(description) <= 500),
    target_minutes_per_day INTEGER     NOT NULL DEFAULT 60 CHECK (target_minutes_per_day BETWEEN 1 AND 1440),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, name),
    UNIQUE (id, user_id)
);

CREATE TABLE sessions (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id          BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id       BIGINT      NOT NULL,
    start_time       TIMESTAMPTZ NOT NULL,
    end_time         TIMESTAMPTZ NOT NULL,
    duration_seconds INTEGER     NOT NULL CHECK (duration_seconds BETWEEN 1 AND 86400),
    session_type     TEXT        NOT NULL DEFAULT 'pomodoro' CHECK (session_type IN ('pomodoro', 'custom', 'manual')),
    focus_rating     SMALLINT    NOT NULL DEFAULT 5 CHECK (focus_rating BETWEEN 1 AND 5),
    notes            TEXT        NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (start_time <= end_time),
    FOREIGN KEY (project_id, user_id) REFERENCES projects (id, user_id) ON DELETE CASCADE
);
CREATE INDEX sessions_user_start_idx ON sessions (user_id, start_time DESC);
CREATE INDEX sessions_project_idx    ON sessions (project_id);

CREATE TABLE settings (
    user_id              BIGINT      PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    work_duration        INTEGER     NOT NULL DEFAULT 25 CHECK (work_duration        BETWEEN 1 AND 180),
    short_break_duration INTEGER     NOT NULL DEFAULT 5  CHECK (short_break_duration BETWEEN 1 AND 60),
    long_break_duration  INTEGER     NOT NULL DEFAULT 15 CHECK (long_break_duration  BETWEEN 1 AND 120),
    long_break_interval  INTEGER     NOT NULL DEFAULT 4  CHECK (long_break_interval  BETWEEN 1 AND 12),
    auto_start_breaks    BOOLEAN     NOT NULL DEFAULT false,
    sound_enabled        BOOLEAN     NOT NULL DEFAULT true,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE feedback (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT      REFERENCES users(id) ON DELETE SET NULL,
    email      TEXT        NOT NULL DEFAULT '' CHECK (length(email) <= 254),
    type       TEXT        NOT NULL DEFAULT 'general' CHECK (type IN ('feature', 'bug', 'praise', 'general')),
    message    TEXT        NOT NULL CHECK (length(message) BETWEEN 1 AND 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX feedback_created_idx ON feedback (created_at DESC);
