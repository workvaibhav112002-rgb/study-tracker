package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"

	"study-tracker-backend/internal/store"
)

const sessionColumns = `
	s.id, s.user_id, s.project_id, p.name, p.color, s.start_time, s.end_time,
	s.duration_seconds, s.session_type, s.focus_rating, s.notes, s.created_at`

func scanSession(row pgx.Row) (store.Session, error) {
	var x store.Session
	err := row.Scan(&x.ID, &x.UserID, &x.ProjectID, &x.ProjectName, &x.ProjectColor, &x.StartTime, &x.EndTime,
		&x.DurationSeconds, &x.SessionType, &x.FocusRating, &x.Notes, &x.CreatedAt)
	return x, mapErr(err)
}

func collectSessions(rows pgx.Rows) ([]store.Session, error) {
	defer rows.Close()
	out := make([]store.Session, 0)
	for rows.Next() {
		x, err := scanSession(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, x)
	}
	return out, mapErr(rows.Err())
}

// ListSessions returns the newest sessions first. The join is INNER because
// the composite FK guarantees the owning project exists.
func (s *Store) ListSessions(ctx context.Context, userID int64, f store.SessionFilter) ([]store.Session, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT `+sessionColumns+`
		FROM sessions s
		JOIN projects p ON p.id = s.project_id AND p.user_id = s.user_id
		WHERE s.user_id = $1 AND ($2::bigint IS NULL OR s.project_id = $2)
		ORDER BY s.start_time DESC, s.id DESC
		LIMIT $3`, userID, f.ProjectID, f.Limit)
	if err != nil {
		return nil, mapErr(err)
	}
	return collectSessions(rows)
}

// CreateSession inserts a session only if the project belongs to userID.
// Otherwise it returns store.ErrNotFound and inserts nothing.
func (s *Store) CreateSession(ctx context.Context, userID int64, in store.SessionInput) (store.Session, error) {
	return scanSession(s.pool.QueryRow(ctx, `
		WITH ins AS (
			INSERT INTO sessions (user_id, project_id, start_time, end_time, duration_seconds, session_type, focus_rating, notes)
			SELECT p.user_id, p.id, $3, $4, $5, $6, $7, $8
			FROM projects p
			WHERE p.id = $2 AND p.user_id = $1
			RETURNING *
		)
		SELECT `+sessionColumns+`
		FROM ins s JOIN projects p ON p.id = s.project_id`,
		userID, in.ProjectID, in.StartTime, in.EndTime, in.DurationSeconds, in.SessionType, in.FocusRating, in.Notes,
	))
}

// DeleteSession removes one session owned by userID.
func (s *Store) DeleteSession(ctx context.Context, userID, id int64) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM sessions WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return store.ErrNotFound
	}
	return nil
}
