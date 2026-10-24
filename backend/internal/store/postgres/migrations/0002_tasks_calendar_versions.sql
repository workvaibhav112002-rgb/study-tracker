-- Tasks, session interruptions, calendar feed tokens, JWT token versioning.

ALTER TABLE users
    ADD COLUMN token_version  INTEGER     NOT NULL DEFAULT 0,
    ADD COLUMN calendar_token TEXT        NULL,
    ADD COLUMN updated_at     TIMESTAMPTZ NOT NULL DEFAULT now();
-- calendar_token stores sha256(token) as 64 hex chars; the raw token is never persisted.
ALTER TABLE users ADD CONSTRAINT users_calendar_token_key UNIQUE (calendar_token);
ALTER TABLE users ADD CONSTRAINT users_calendar_token_shape
    CHECK (calendar_token IS NULL OR calendar_token ~ '^[0-9a-f]{64}$');

CREATE TABLE tasks (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id             BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id          BIGINT      NOT NULL,
    title               TEXT        NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
    estimate_pomodoros  INTEGER     NOT NULL DEFAULT 1 CHECK (estimate_pomodoros BETWEEN 1 AND 20),
    completed_pomodoros INTEGER     NOT NULL DEFAULT 0 CHECK (completed_pomodoros >= 0),
    done                BOOLEAN     NOT NULL DEFAULT false,
    position            INTEGER     NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at        TIMESTAMPTZ NULL,
    FOREIGN KEY (project_id, user_id) REFERENCES projects (id, user_id) ON DELETE CASCADE,
    -- Lets sessions reference (task, user, project) as one unit.
    UNIQUE (id, user_id, project_id)
);
CREATE INDEX tasks_user_project_done_pos_idx ON tasks (user_id, project_id, done, position, id);

ALTER TABLE sessions
    ADD COLUMN interruptions INTEGER NOT NULL DEFAULT 0 CHECK (interruptions >= 0),
    ADD COLUMN task_id       BIGINT  NULL;
-- A session may only point at a task owned by the same user AND the same project.
-- "ON DELETE SET NULL (task_id)" (column list) needs PostgreSQL 15+; without the
-- list Postgres would also null user_id/project_id, which violates NOT NULL.
ALTER TABLE sessions ADD CONSTRAINT sessions_task_fkey
    FOREIGN KEY (task_id, user_id, project_id) REFERENCES tasks (id, user_id, project_id)
    ON DELETE SET NULL (task_id);
CREATE INDEX sessions_task_idx ON sessions (task_id) WHERE task_id IS NOT NULL;
