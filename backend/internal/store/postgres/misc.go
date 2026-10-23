package postgres

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"

	"study-tracker-backend/internal/store"
)

// CreateFeedback stores a feedback entry; UserID may be nil for anonymous.
func (s *Store) CreateFeedback(ctx context.Context, in store.FeedbackInput) (int64, error) {
	var id int64
	err := s.pool.QueryRow(ctx,
		`INSERT INTO feedback (user_id, email, type, message) VALUES ($1, $2, $3, $4) RETURNING id`,
		in.UserID, in.Email, in.Type, in.Message,
	).Scan(&id)
	return id, mapErr(err)
}

// ExportAll returns a consistent snapshot of everything the user owns.
func (s *Store) ExportAll(ctx context.Context, userID int64) (store.Export, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return store.Export{}, mapErr(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	out := store.Export{ExportedAt: time.Now().UTC()}

	out.User, err = scanUser(tx.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE id = $1`, userID))
	if err != nil {
		return store.Export{}, err
	}
	out.User.PasswordHash = ""

	out.Settings, err = scanSettings(tx.QueryRow(ctx, `SELECT `+settingsColumns+` FROM settings WHERE user_id = $1`, userID))
	if err != nil {
		if err != store.ErrNotFound {
			return store.Export{}, err
		}
		out.Settings = store.DefaultSettings()
	}

	rows, err := tx.Query(ctx, projectWithTotals+` GROUP BY p.id ORDER BY p.created_at, p.id`, userID)
	if err != nil {
		return store.Export{}, mapErr(err)
	}
	out.Projects = make([]store.Project, 0)
	for rows.Next() {
		p, err := scanProject(rows)
		if err != nil {
			rows.Close()
			return store.Export{}, err
		}
		out.Projects = append(out.Projects, p)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return store.Export{}, mapErr(err)
	}

	rows, err = tx.Query(ctx, `
		SELECT `+sessionColumns+`
		FROM sessions s JOIN projects p ON p.id = s.project_id AND p.user_id = s.user_id
		WHERE s.user_id = $1
		ORDER BY s.start_time DESC, s.id DESC`, userID)
	if err != nil {
		return store.Export{}, mapErr(err)
	}
	out.Sessions, err = collectSessions(rows)
	if err != nil {
		return store.Export{}, err
	}

	return out, tx.Commit(ctx)
}
