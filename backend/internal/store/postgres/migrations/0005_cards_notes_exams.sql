-- Flashcards with spaced repetition, notes, exam dates and weekly plans.

ALTER TABLE projects
    ADD COLUMN exam_date              DATE    NULL,
    ADD COLUMN planned_hours_per_week INTEGER NULL CHECK (planned_hours_per_week BETWEEN 1 AND 168);

CREATE TABLE cards (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id    BIGINT      NOT NULL,
    front         TEXT        NOT NULL CHECK (length(front) BETWEEN 1 AND 2000),
    back          TEXT        NOT NULL CHECK (length(back) BETWEEN 1 AND 4000),
    tags          TEXT[]      NOT NULL DEFAULT '{}',
    ease          REAL        NOT NULL DEFAULT 2.5,
    interval_days INTEGER     NOT NULL DEFAULT 0,
    repetitions   INTEGER     NOT NULL DEFAULT 0,
    lapses        INTEGER     NOT NULL DEFAULT 0,
    due_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived      BOOLEAN     NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (project_id, user_id) REFERENCES projects (id, user_id) ON DELETE CASCADE
);
CREATE INDEX cards_user_due_idx ON cards (user_id, archived, due_at);
CREATE INDEX cards_user_project_idx ON cards (user_id, project_id);

CREATE TABLE card_reviews (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id         BIGINT      NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    rating          SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 4),
    interval_before INTEGER     NOT NULL,
    interval_after  INTEGER     NOT NULL,
    reviewed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX card_reviews_user_time_idx ON card_reviews (user_id, reviewed_at DESC);

CREATE TABLE notes (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id BIGINT      NULL,
    title      TEXT        NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
    body       TEXT        NOT NULL DEFAULT '' CHECK (length(body) <= 20000),
    tags       TEXT[]      NOT NULL DEFAULT '{}',
    pinned     BOOLEAN     NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (project_id, user_id) REFERENCES projects (id, user_id) ON DELETE SET NULL (project_id)
);
CREATE INDEX notes_user_updated_idx ON notes (user_id, pinned DESC, updated_at DESC);
