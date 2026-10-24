package postgres

import (
	"context"

	"study-tracker-backend/internal/store"
)

// GetTimer returns the user's stored timer snapshot (ErrNotFound when none).
func (s *Store) GetTimer(ctx context.Context, userID int64) (store.TimerSnapshot, error) {
	var snap store.TimerSnapshot
	err := s.pool.QueryRow(ctx, `SELECT state, updated_at FROM timer_state WHERE user_id = $1`, userID).Scan(&snap.State, &snap.UpdatedAt)
	return snap, mapErr(err)
}

// PutTimer upserts with last-write-wins on updated_at and returns the winner.
func (s *Store) PutTimer(ctx context.Context, userID int64, snap store.TimerSnapshot) (store.TimerSnapshot, error) {
	var out store.TimerSnapshot
	err := s.pool.QueryRow(ctx, `
		INSERT INTO timer_state (user_id, state, updated_at) VALUES ($1, $2, $3)
		ON CONFLICT (user_id) DO UPDATE SET
			state = CASE WHEN EXCLUDED.updated_at >= timer_state.updated_at THEN EXCLUDED.state ELSE timer_state.state END,
			updated_at = GREATEST(timer_state.updated_at, EXCLUDED.updated_at)
		RETURNING state, updated_at`, userID, snap.State, snap.UpdatedAt).Scan(&out.State, &out.UpdatedAt)
	return out, mapErr(err)
}
