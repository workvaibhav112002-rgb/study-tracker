-- Per-user timer snapshot so a session can be followed from another device.
CREATE TABLE timer_state (
    user_id    BIGINT      PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    state      JSONB       NOT NULL,
    updated_at BIGINT      NOT NULL  -- client epoch milliseconds, for last-write-wins
);
