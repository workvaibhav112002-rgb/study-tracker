package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"

	"study-tracker-backend/internal/store"
)

const taskColumns = `id, user_id, project_id, title, estimate_pomodoros, completed_pomodoros, done, position, created_at, completed_at`

func scanTask(row pgx.Row) (store.Task, error) {
	var t store.Task
	err := row.Scan(&t.ID, &t.UserID, &t.ProjectID, &t.Title, &t.EstimatePomodoros, &t.CompletedPomodoros, &t.Done, &t.Position, &t.CreatedAt, &t.CompletedAt)
	return t, mapErr(err)
}

// ListTasks returns tasks ordered open-first, then by position.
func (s *Store) ListTasks(ctx context.Context, userID int64, f store.TaskFilter) ([]store.Task, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT `+taskColumns+` FROM tasks
		WHERE user_id = $1
		  AND ($2::bigint IS NULL OR project_id = $2)
		  AND ($3::boolean IS NULL OR done = $3)
		ORDER BY done, position, id`, userID, f.ProjectID, f.Done)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()
	out := make([]store.Task, 0)
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, mapErr(rows.Err())
}

// CreateTask appends a task to the project if the project belongs to userID.
func (s *Store) CreateTask(ctx context.Context, userID int64, in store.TaskInput) (store.Task, error) {
	return scanTask(s.pool.QueryRow(ctx, `
		INSERT INTO tasks (user_id, project_id, title, estimate_pomodoros, position)
		SELECT p.user_id, p.id, $3, $4,
		       COALESCE((SELECT MAX(position) + 1 FROM tasks WHERE user_id = $1 AND project_id = $2), 0)
		FROM projects p
		WHERE p.id = $2 AND p.user_id = $1
		RETURNING `+taskColumns,
		userID, in.ProjectID, in.Title, in.EstimatePomodoros,
	))
}

// UpdateTask edits title and estimate; the project is fixed after creation.
func (s *Store) UpdateTask(ctx context.Context, userID, id int64, title string, estimate int) (store.Task, error) {
	return scanTask(s.pool.QueryRow(ctx, `
		UPDATE tasks SET title = $3, estimate_pomodoros = $4
		WHERE id = $1 AND user_id = $2
		RETURNING `+taskColumns, id, userID, title, estimate))
}

// SetTaskDone toggles completion and stamps completed_at.
func (s *Store) SetTaskDone(ctx context.Context, userID, id int64, done bool) (store.Task, error) {
	return scanTask(s.pool.QueryRow(ctx, `
		UPDATE tasks SET done = $3,
		       completed_at = CASE WHEN $3 THEN COALESCE(completed_at, now()) ELSE NULL END
		WHERE id = $1 AND user_id = $2
		RETURNING `+taskColumns, id, userID, done))
}

// DeleteTask removes one task; sessions keep their row with task_id nulled.
func (s *Store) DeleteTask(ctx context.Context, userID, id int64) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM tasks WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return store.ErrNotFound
	}
	return nil
}

// ReorderTasks assigns positions in the given order. Any id that is not the
// user's aborts the whole update with store.ErrNotFound.
func (s *Store) ReorderTasks(ctx context.Context, userID int64, ids []int64) error {
	positions := make([]int, len(ids))
	for i := range ids {
		positions[i] = i
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return mapErr(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tag, err := tx.Exec(ctx, `
		UPDATE tasks t SET position = v.pos
		FROM unnest($2::bigint[], $3::int[]) AS v(id, pos)
		WHERE t.id = v.id AND t.user_id = $1`, userID, ids, positions)
	if err != nil {
		return mapErr(err)
	}
	if int(tag.RowsAffected()) != len(ids) {
		return store.ErrNotFound
	}
	return mapErr(tx.Commit(ctx))
}
