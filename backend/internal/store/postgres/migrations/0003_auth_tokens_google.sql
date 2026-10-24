-- Password reset / magic-link tokens and Google sign-in linkage.

ALTER TABLE users
    ALTER COLUMN password_hash DROP NOT NULL,
    ADD COLUMN google_sub        TEXT        NULL,
    ADD COLUMN email_verified_at TIMESTAMPTZ NULL;
ALTER TABLE users ADD CONSTRAINT users_google_sub_key UNIQUE (google_sub);

CREATE TABLE auth_tokens (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind       TEXT        NOT NULL CHECK (kind IN ('reset', 'magic')),
    token_hash TEXT        NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX auth_tokens_user_idx ON auth_tokens (user_id, kind);
