package postgres

import (
	"context"
	"fmt"
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

// ImportAll upserts projects by name and inserts sessions that do not already
// exist (same project, start time and duration), all in one transaction.
func (s *Store) ImportAll(ctx context.Context, userID int64, in store.ImportInput) (store.ImportResult, error) {
	var res store.ImportResult
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return res, mapErr(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	ids := make(map[string]int64, len(in.Projects))
	for _, p := range in.Projects {
		var id int64
		var inserted bool
		err := tx.QueryRow(ctx, `
			INSERT INTO projects (user_id, name, color, description, target_minutes_per_day)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (user_id, name) DO UPDATE SET
				color = EXCLUDED.color,
				description = EXCLUDED.description,
				target_minutes_per_day = EXCLUDED.target_minutes_per_day
			RETURNING id, (xmax = 0)`,
			userID, p.Name, p.Color, p.Description, p.TargetMinutesPerDay,
		).Scan(&id, &inserted)
		if err != nil {
			return res, mapErr(err)
		}
		ids[p.Name] = id
		if inserted {
			res.ProjectsCreated++
		} else {
			res.ProjectsUpdated++
		}
	}

	type key struct {
		project  int64
		start    int64
		duration int
	}
	seen := make(map[key]struct{}, len(in.Sessions))
	batch := &pgx.Batch{}
	queued := 0
	for _, x := range in.Sessions {
		pid, ok := ids[x.ProjectName]
		if !ok {
			return res, fmt.Errorf("%w: unknown project %q", store.ErrInvalid, x.ProjectName)
		}
		k := key{pid, x.StartTime.Unix(), x.DurationSeconds}
		if _, dup := seen[k]; dup {
			res.SessionsSkipped++
			continue
		}
		seen[k] = struct{}{}
		batch.Queue(`
			INSERT INTO sessions (user_id, project_id, start_time, end_time, duration_seconds, session_type, focus_rating, notes, interruptions)
			SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9
			WHERE NOT EXISTS (
				SELECT 1 FROM sessions WHERE user_id = $1 AND project_id = $2 AND start_time = $3 AND duration_seconds = $5
			)`, userID, pid, x.StartTime, x.EndTime, x.DurationSeconds, x.SessionType, x.FocusRating, x.Notes, x.Interruptions)
		queued++
	}
	if queued > 0 {
		results := tx.SendBatch(ctx, batch)
		for i := 0; i < queued; i++ {
			tag, err := results.Exec()
			if err != nil {
				_ = results.Close()
				return res, mapErr(err)
			}
			if tag.RowsAffected() == 1 {
				res.SessionsInserted++
			} else {
				res.SessionsSkipped++
			}
		}
		if err := results.Close(); err != nil {
			return res, mapErr(err)
		}
	}

	return res, mapErr(tx.Commit(ctx))
}
