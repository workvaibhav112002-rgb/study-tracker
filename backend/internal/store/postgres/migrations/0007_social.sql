-- Public profiles, friendships via invite links.

ALTER TABLE users
    ADD COLUMN handle         TEXT    NULL UNIQUE CHECK (handle ~ '^[a-z0-9][a-z0-9-]{2,29}$'),
    ADD COLUMN profile_public BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN bio            TEXT    NOT NULL DEFAULT '' CHECK (length(bio) <= 280);

CREATE TABLE friendships (
    user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id  BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, friend_id),
    CHECK (user_id <> friend_id)
);

CREATE TABLE friend_invites (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT        NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_by    BIGINT      NULL REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX friend_invites_user_idx ON friend_invites (user_id);
