package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"study-tracker-backend/internal/store"
)

// UpdateProfile sets handle, visibility and bio. A taken handle maps to
// store.ErrConflict through the unique index.
func (s *Store) UpdateProfile(ctx context.Context, userID int64, in store.ProfileInput) (store.User, error) {
	return scanUser(s.pool.QueryRow(ctx, `
		UPDATE users SET handle = $2, profile_public = $3, bio = $4, updated_at = now()
		WHERE id = $1
		RETURNING `+userColumns, userID, in.Handle, in.Public, in.Bio))
}

// PublicProfile aggregates what a public page shows. Unknown and private
// handles are indistinguishable (both ErrNotFound).
func (s *Store) PublicProfile(ctx context.Context, handle string, loc *time.Location, now time.Time) (store.PublicProfile, error) {
	var out store.PublicProfile
	var id int64
	var created time.Time
	err := s.pool.QueryRow(ctx, `
		SELECT id, name, handle, bio, created_at FROM users WHERE handle = $1 AND profile_public`, handle,
	).Scan(&id, &out.Name, &out.Handle, &out.Bio, &created)
	if err != nil {
		return out, mapErr(err)
	}
	out.MemberSince = created.In(loc).Format(dateLayout)
	dash, err := s.DashboardStats(ctx, id, loc, now)
	if err != nil {
		return out, err
	}
	out.TotalMinutes = dash.TotalMinutes
	out.WeekMinutes = dash.WeeklyMinutes
	out.CurrentStreakDays = dash.CurrentStreakDays
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM sessions WHERE user_id = $1`, id).Scan(&out.Sessions); err != nil {
		return out, mapErr(err)
	}
	gs, err := s.GoalStreak(ctx, id, loc, now)
	if err != nil {
		return out, err
	}
	out.GoalStreakDays = gs.Days
	if out.Heatmap, err = s.Heatmap(ctx, id, loc, now, 91); err != nil {
		return out, err
	}
	all, err := s.Milestones(ctx, id, loc, now)
	if err != nil {
		return out, err
	}
	out.Badges = []store.Milestone{}
	for _, m := range all {
		if m.Achieved {
			out.Badges = append(out.Badges, m)
		}
	}
	return out, nil
}

// CreateFriendInvite stores a hashed, expiring invite token.
func (s *Store) CreateFriendInvite(ctx context.Context, userID int64, tokenHash string, expires time.Time) error {
	_, err := s.pool.Exec(ctx, `INSERT INTO friend_invites (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`, userID, tokenHash, expires)
	return mapErr(err)
}

// AcceptFriendInvite consumes a token and links the two accounts both ways.
// Invalid, expired, used, or self-addressed tokens return ErrNotFound /
// ErrInvalid so the handler can explain without leaking which.
func (s *Store) AcceptFriendInvite(ctx context.Context, userID int64, tokenHash string, now time.Time) (int64, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var inviter int64
	err = tx.QueryRow(ctx, `
		SELECT user_id FROM friend_invites
		WHERE token_hash = $1 AND used_by IS NULL AND expires_at > $2
		FOR UPDATE`, tokenHash, now).Scan(&inviter)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, store.ErrNotFound
	}
	if err != nil {
		return 0, mapErr(err)
	}
	if inviter == userID {
		return 0, store.ErrInvalid
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO friendships (user_id, friend_id) VALUES ($1, $2), ($2, $1)
		ON CONFLICT DO NOTHING`, inviter, userID); err != nil {
		return 0, mapErr(err)
	}
	if _, err := tx.Exec(ctx, `UPDATE friend_invites SET used_by = $2 WHERE token_hash = $1`, tokenHash, userID); err != nil {
		return 0, mapErr(err)
	}
	return inviter, tx.Commit(ctx)
}

// ListFriends returns connections with today's and this week's minutes and
// whether a focus timer is currently running (and not yet expired).
func (s *Store) ListFriends(ctx context.Context, userID int64, loc *time.Location, now time.Time) ([]store.Friend, error) {
	today, _, tz := localDay(loc, now)
	weekStart := today.AddDate(0, 0, -6)
	rows, err := s.pool.Query(ctx, `
		SELECT u.id, u.name, u.handle,
		       COALESCE(t.state->>'status' = 'running' AND t.state->>'mode' = 'work'
		                AND (t.state->>'targetEndAt')::bigint > $4, false) AS studying,
		       COALESCE((SELECT SUM(duration_seconds) / 60 FROM sessions
		                 WHERE user_id = u.id AND (start_time AT TIME ZONE $2)::date = $3::date), 0),
		       COALESCE((SELECT SUM(duration_seconds) / 60 FROM sessions
		                 WHERE user_id = u.id AND (start_time AT TIME ZONE $2)::date >= $5::date), 0)
		FROM friendships f
		JOIN users u ON u.id = f.friend_id
		LEFT JOIN timer_state t ON t.user_id = u.id
		WHERE f.user_id = $1
		ORDER BY u.name, u.id`, userID, tz, today.Format(dateLayout), now.UnixMilli(), weekStart.Format(dateLayout))
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()
	out := []store.Friend{}
	for rows.Next() {
		var f store.Friend
		if err := rows.Scan(&f.ID, &f.Name, &f.Handle, &f.Studying, &f.TodayMinutes, &f.WeekMinutes); err != nil {
			return nil, mapErr(err)
		}
		out = append(out, f)
	}
	if err := rows.Err(); err != nil {
		return nil, mapErr(err)
	}
	for i := range out {
		d, err := s.DashboardStats(ctx, out[i].ID, loc, now)
		if err != nil {
			return nil, err
		}
		out[i].CurrentStreakDays = d.CurrentStreakDays
	}
	return out, nil
}

// RemoveFriend deletes the connection in both directions.
func (s *Store) RemoveFriend(ctx context.Context, userID, friendID int64) error {
	tag, err := s.pool.Exec(ctx, `
		DELETE FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`, userID, friendID)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return store.ErrNotFound
	}
	return nil
}
