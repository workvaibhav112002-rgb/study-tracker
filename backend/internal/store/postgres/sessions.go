package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"study-tracker-backend/internal/store"
)

const sessionColumns = `
	s.id, s.user_id, s.project_id, p.name, p.color, s.start_time, s.end_time,
	s.duration_seconds, s.session_type, s.focus_rating, s.notes, s.interruptions, s.task_id, s.created_at`

func scanSession(row pgx.Row) (store.Session, error) {
	var x store.Session
	err := row.Scan(&x.ID, &x.UserID, &x.ProjectID, &x.ProjectName, &x.ProjectColor, &x.StartTime, &x.EndTime,
		&x.DurationSeconds, &x.SessionType, &x.FocusRating, &x.Notes, &x.Interruptions, &x.TaskID, &x.CreatedAt)
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
		WHERE s.user_id = $1
		  AND ($2::bigint IS NULL OR s.project_id = $2)
		  AND ($4::timestamptz IS NULL OR s.start_time >= $4)
		ORDER BY s.start_time DESC, s.id DESC
		LIMIT NULLIF($3::int, 0)`, userID, f.ProjectID, f.Limit, f.Since)
	if err != nil {
		return nil, mapErr(err)
	}
	return collectSessions(rows)
}

// CreateSession inserts a session only if the project belongs to userID, and
// bumps the linked task's completed count in the same statement. A task that
// is missing, foreign, or on another project violates the composite FK and
// yields store.ErrNotFound with nothing inserted.
func (s *Store) CreateSession(ctx context.Context, userID int64, in store.SessionInput) (store.Session, error) {
	// Saving the same session twice (a client retry after a lost response)
	// returns the stored one instead of a duplicate.
	existing, err := scanSession(s.pool.QueryRow(ctx, `
		SELECT `+sessionColumns+`
		FROM sessions s JOIN projects p ON p.id = s.project_id
		WHERE s.user_id = $1 AND s.project_id = $2 AND s.start_time = $3 AND s.duration_seconds = $4
		LIMIT 1`, userID, in.ProjectID, in.StartTime, in.DurationSeconds))
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, store.ErrNotFound) {
		return store.Session{}, err
	}
	return scanSession(s.pool.QueryRow(ctx, `
		WITH ins AS (
			INSERT INTO sessions (user_id, project_id, start_time, end_time, duration_seconds, session_type, focus_rating, notes, interruptions, task_id)
			SELECT p.user_id, p.id, $3, $4, $5, $6, $7, $8, $9, $10
			FROM projects p
			WHERE p.id = $2 AND p.user_id = $1
			RETURNING *
		), bump AS (
			UPDATE tasks t SET completed_pomodoros = t.completed_pomodoros + 1
			FROM ins WHERE t.id = ins.task_id AND t.user_id = ins.user_id
		)
		SELECT `+sessionColumns+`
		FROM ins s JOIN projects p ON p.id = s.project_id`,
		userID, in.ProjectID, in.StartTime, in.EndTime, in.DurationSeconds, in.SessionType, in.FocusRating, in.Notes, in.Interruptions, in.TaskID,
	))
}

// UpdateSessionReview changes the rating and/or notes of a saved session.
func (s *Store) UpdateSessionReview(ctx context.Context, userID, id int64, rating *int, notes *string) (store.Session, error) {
	return scanSession(s.pool.QueryRow(ctx, `
		WITH upd AS (
			UPDATE sessions SET focus_rating = COALESCE($3, focus_rating), notes = COALESCE($4, notes)
			WHERE id = $1 AND user_id = $2
			RETURNING *
		)
		SELECT `+sessionColumns+`
		FROM upd s JOIN projects p ON p.id = s.project_id`, id, userID, rating, notes))
}

// DeleteSession removes one session owned by userID and takes back the
// pomodoro it added to its task, if any.
func (s *Store) DeleteSession(ctx context.Context, userID, id int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return mapErr(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var taskID *int64
	if err := tx.QueryRow(ctx, `DELETE FROM sessions WHERE id = $1 AND user_id = $2 RETURNING task_id`, id, userID).Scan(&taskID); err != nil {
		return mapErr(err) // no rows -> store.ErrNotFound
	}
	if taskID != nil {
		if _, err := tx.Exec(ctx, `UPDATE tasks SET completed_pomodoros = GREATEST(0, completed_pomodoros - 1) WHERE id = $1 AND user_id = $2`, *taskID, userID); err != nil {
			return mapErr(err)
		}
	}
	return mapErr(tx.Commit(ctx))
}
