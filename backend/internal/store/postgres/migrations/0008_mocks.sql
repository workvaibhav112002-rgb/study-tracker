-- Mock test logger and mistake log for competitive exams.

ALTER TABLE projects
    ADD COLUMN exam_template JSONB NULL;

CREATE TABLE mocks (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id   BIGINT      NOT NULL,
    name         TEXT        NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
    provider     TEXT        NOT NULL DEFAULT '' CHECK (length(provider) <= 80),
    attempted_on DATE        NOT NULL,
    percentile   REAL        NULL CHECK (percentile BETWEEN 0 AND 100),
    rank         INTEGER     NULL CHECK (rank >= 1),
    sections     JSONB       NOT NULL DEFAULT '[]',
    notes        TEXT        NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id, user_id),
    FOREIGN KEY (project_id, user_id) REFERENCES projects (id, user_id) ON DELETE CASCADE
);
CREATE INDEX mocks_user_date_idx ON mocks (user_id, attempted_on DESC, id DESC);

CREATE TABLE mistakes (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id          BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id       BIGINT      NOT NULL,
    mock_id          BIGINT      NULL,
    subject          TEXT        NOT NULL CHECK (length(subject) BETWEEN 1 AND 60),
    pattern          TEXT        NOT NULL CHECK (length(pattern) BETWEEN 1 AND 80),
    root_cause       TEXT        NOT NULL CHECK (root_cause IN ('concept', 'procedural', 'time_ego')),
    question         TEXT        NOT NULL DEFAULT '' CHECK (length(question) <= 2000),
    rule             TEXT        NOT NULL DEFAULT '' CHECK (length(rule) <= 2000),
    solution         TEXT        NOT NULL DEFAULT '' CHECK (length(solution) <= 4000),
    actual_seconds   INTEGER     NULL CHECK (actual_seconds BETWEEN 0 AND 3600),
    ideal_seconds    INTEGER     NULL CHECK (ideal_seconds BETWEEN 0 AND 3600),
    status           TEXT        NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'locked_in', 'review_next_week', 'needs_drill')),
    last_reviewed_at TIMESTAMPTZ NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (project_id, user_id) REFERENCES projects (id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (mock_id, user_id) REFERENCES mocks (id, user_id) ON DELETE SET NULL (mock_id)
);
CREATE INDEX mistakes_user_created_idx ON mistakes (user_id, created_at DESC, id DESC);
CREATE INDEX mistakes_user_pattern_idx ON mistakes (user_id, pattern, root_cause, created_at);
