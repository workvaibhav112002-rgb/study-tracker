package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"

	"study-tracker-backend/internal/store"
)

const projectWithTotals = `
	SELECT p.id, p.user_id, p.name, p.color, p.description, p.target_minutes_per_day,
	       to_char(p.exam_date, 'YYYY-MM-DD'), p.planned_hours_per_week, p.created_at,
	       COALESCE(SUM(s.duration_seconds), 0) / 60 AS total_minutes,
	       COALESCE(SUM(s.duration_seconds) FILTER (WHERE s.start_time >= now() - interval '7 days'), 0) / 60 AS week_minutes
	FROM projects p
	LEFT JOIN sessions s ON s.project_id = p.id AND s.user_id = p.user_id
	WHERE p.user_id = $1`

func scanProject(row pgx.Row) (store.Project, error) {
	var p store.Project
	err := row.Scan(&p.ID, &p.UserID, &p.Name, &p.Color, &p.Description, &p.TargetMinutesPerDay,
		&p.ExamDate, &p.PlannedHoursPerWeek, &p.CreatedAt, &p.TotalMinutes, &p.WeekMinutes)
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
	var id int64
	err := s.pool.QueryRow(ctx, `
		INSERT INTO projects (user_id, name, color, description, target_minutes_per_day, exam_date, planned_hours_per_week)
		VALUES ($1, $2, $3, $4, $5, $6::date, $7)
		RETURNING id`,
		userID, in.Name, in.Color, in.Description, in.TargetMinutesPerDay, in.ExamDate, in.PlannedHoursPerWeek,
	).Scan(&id)
	if err != nil {
		return store.Project{}, mapErr(err)
	}
	return scanProject(s.pool.QueryRow(ctx, projectWithTotals+` AND p.id = $2 GROUP BY p.id`, userID, id))
}

// UpdateProject replaces the editable fields. Missing or foreign rows yield
// store.ErrNotFound; a name collision yields store.ErrConflict.
func (s *Store) UpdateProject(ctx context.Context, userID, id int64, in store.ProjectInput) (store.Project, error) {
	tag, err := s.pool.Exec(ctx, `
		UPDATE projects SET name = $3, color = $4, description = $5, target_minutes_per_day = $6,
		       exam_date = $7::date, planned_hours_per_week = $8
		WHERE id = $1 AND user_id = $2`,
		id, userID, in.Name, in.Color, in.Description, in.TargetMinutesPerDay, in.ExamDate, in.PlannedHoursPerWeek,
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
