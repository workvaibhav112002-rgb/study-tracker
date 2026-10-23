package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"

	"study-tracker-backend/internal/store"
)

const projectWithTotals = `
	SELECT p.id, p.user_id, p.name, p.color, p.description, p.target_minutes_per_day, p.created_at,
	       COALESCE(SUM(s.duration_seconds), 0) / 60 AS total_minutes
	FROM projects p
	LEFT JOIN sessions s ON s.project_id = p.id AND s.user_id = p.user_id
	WHERE p.user_id = $1`

func scanProject(row pgx.Row) (store.Project, error) {
	var p store.Project
	err := row.Scan(&p.ID, &p.UserID, &p.Name, &p.Color, &p.Description, &p.TargetMinutesPerDay, &p.CreatedAt, &p.TotalMinutes)
	return p, mapErr(err)
}

// ListProjects returns the user's projects with accumulated minutes.
func (s *Store) ListProjects(ctx context.Context, userID int64) ([]store.Project, error) {
	rows, err := s.pool.Query(ctx, projectWithTotals+` GROUP BY p.id ORDER BY p.created_at, p.id`, userID)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()

	projects := make([]store.Project, 0)
	for rows.Next() {
		p, err := scanProject(rows)
		if err != nil {
			return nil, err
		}
		projects = append(projects, p)
	}
	return projects, mapErr(rows.Err())
}

// CreateProject inserts a project; duplicate names yield store.ErrConflict.
func (s *Store) CreateProject(ctx context.Context, userID int64, in store.ProjectInput) (store.Project, error) {
	var p store.Project
	err := s.pool.QueryRow(ctx, `
		INSERT INTO projects (user_id, name, color, description, target_minutes_per_day)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, user_id, name, color, description, target_minutes_per_day, created_at`,
		userID, in.Name, in.Color, in.Description, in.TargetMinutesPerDay,
	).Scan(&p.ID, &p.UserID, &p.Name, &p.Color, &p.Description, &p.TargetMinutesPerDay, &p.CreatedAt)
	return p, mapErr(err)
}

// UpdateProject replaces the editable fields. Missing or foreign rows yield
// store.ErrNotFound; a name collision yields store.ErrConflict.
func (s *Store) UpdateProject(ctx context.Context, userID, id int64, in store.ProjectInput) (store.Project, error) {
	tag, err := s.pool.Exec(ctx, `
		UPDATE projects SET name = $3, color = $4, description = $5, target_minutes_per_day = $6
		WHERE id = $1 AND user_id = $2`,
		id, userID, in.Name, in.Color, in.Description, in.TargetMinutesPerDay,
	)
	if err != nil {
		return store.Project{}, mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return store.Project{}, store.ErrNotFound
	}
	return scanProject(s.pool.QueryRow(ctx, projectWithTotals+` AND p.id = $2 GROUP BY p.id`, userID, id))
}

// DeleteProject removes the project and, via FK cascade, its sessions.
func (s *Store) DeleteProject(ctx context.Context, userID, id int64) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM projects WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return store.ErrNotFound
	}
	return nil
}
