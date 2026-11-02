package postgres

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"

	"study-tracker-backend/internal/store"
)

// SetExamTemplate stores (or clears, when t is nil) a project's exam pattern.
func (s *Store) SetExamTemplate(ctx context.Context, userID, projectID int64, t *store.ExamTemplate) (store.Project, error) {
	tag, err := s.pool.Exec(ctx, `UPDATE projects SET exam_template = $3 WHERE id = $1 AND user_id = $2`, projectID, userID, t)
	if err != nil {
		return store.Project{}, mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return store.Project{}, store.ErrNotFound
	}
	return scanProject(s.pool.QueryRow(ctx, projectWithTotals+` AND p.id = $2 GROUP BY p.id`, userID, projectID))
}

const mockColumns = `id, user_id, project_id, name, provider, to_char(attempted_on, 'YYYY-MM-DD'),
	percentile, rank, sections, notes, created_at, updated_at`

func scanMock(row pgx.Row) (store.Mock, error) {
	var m store.Mock
	var pct *float32
	err := row.Scan(&m.ID, &m.UserID, &m.ProjectID, &m.Name, &m.Provider, &m.AttemptedOn,
		&pct, &m.Rank, &m.Sections, &m.Notes, &m.CreatedAt, &m.UpdatedAt)
	if pct != nil {
		v := float64(*pct)
		m.Percentile = &v
	}
	if m.Sections == nil {
		m.Sections = []store.MockSection{}
	}
	return m, mapErr(err)
}

// ListMocks returns mocks newest first.
func (s *Store) ListMocks(ctx context.Context, userID int64, projectID *int64) ([]store.Mock, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT `+mockColumns+` FROM mocks
		WHERE user_id = $1 AND ($2::bigint IS NULL OR project_id = $2)
		ORDER BY attempted_on DESC, id DESC`, userID, projectID)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()
	out := make([]store.Mock, 0)
	for rows.Next() {
		m, err := scanMock(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, mapErr(rows.Err())
}

// CreateMock inserts a mock; the project must be the user's own.
func (s *Store) CreateMock(ctx context.Context, userID int64, in store.MockInput) (store.Mock, error) {
	return scanMock(s.pool.QueryRow(ctx, `
		INSERT INTO mocks (user_id, project_id, name, provider, attempted_on, percentile, rank, sections, notes)
		VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9)
		RETURNING `+mockColumns,
		userID, in.ProjectID, in.Name, in.Provider, in.AttemptedOn, in.Percentile, in.Rank, in.Sections, in.Notes))
}

// UpdateMock replaces the editable fields.
func (s *Store) UpdateMock(ctx context.Context, userID, id int64, in store.MockInput) (store.Mock, error) {
	return scanMock(s.pool.QueryRow(ctx, `
		UPDATE mocks SET project_id = $3, name = $4, provider = $5, attempted_on = $6::date,
		       percentile = $7, rank = $8, sections = $9, notes = $10, updated_at = now()
		WHERE id = $1 AND user_id = $2
		RETURNING `+mockColumns,
		id, userID, in.ProjectID, in.Name, in.Provider, in.AttemptedOn, in.Percentile, in.Rank, in.Sections, in.Notes))
}

// DeleteMock removes a mock; its mistakes stay, unlinked.
func (s *Store) DeleteMock(ctx context.Context, userID, id int64) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM mocks WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return store.ErrNotFound
	}
	return nil
}

const mistakeColumns = `id, user_id, project_id, mock_id, subject, pattern, root_cause, question, rule, solution,
	actual_seconds, ideal_seconds, status, last_reviewed_at, created_at, updated_at`

func scanMistake(row pgx.Row) (store.Mistake, error) {
	var m store.Mistake
	err := row.Scan(&m.ID, &m.UserID, &m.ProjectID, &m.MockID, &m.Subject, &m.Pattern, &m.RootCause,
		&m.Question, &m.Rule, &m.Solution, &m.ActualSeconds, &m.IdealSeconds, &m.Status,
		&m.LastReviewedAt, &m.CreatedAt, &m.UpdatedAt)
	return m, mapErr(err)
}

func collectMistakes(rows pgx.Rows, err error) ([]store.Mistake, error) {
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()
	out := make([]store.Mistake, 0)
	for rows.Next() {
		m, err := scanMistake(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, mapErr(rows.Err())
}

// ListMistakes returns the newest mistakes matching the filter.
func (s *Store) ListMistakes(ctx context.Context, userID int64, f store.MistakeFilter) ([]store.Mistake, error) {
	return collectMistakes(s.pool.Query(ctx, `
		SELECT `+mistakeColumns+` FROM mistakes
		WHERE user_id = $1
		  AND ($2::bigint IS NULL OR project_id = $2)
		  AND ($3::bigint IS NULL OR mock_id = $3)
		  AND ($4::text = '' OR subject = $4)
		  AND ($5::text = '' OR pattern = $5)
		  AND ($6::text = '' OR root_cause = $6)
		  AND ($7::text = '' OR status = $7)
		  AND ($8::text = '' OR question ILIKE '%' || $8 || '%' OR rule ILIKE '%' || $8 || '%'
		       OR solution ILIKE '%' || $8 || '%' OR pattern ILIKE '%' || $8 || '%')
		  AND ($9::timestamptz IS NULL OR created_at >= $9)
		ORDER BY created_at DESC, id DESC
		LIMIT NULLIF($10::int, 0)`,
		userID, f.ProjectID, f.MockID, f.Subject, f.Pattern, f.RootCause, f.Status, f.Query, f.Since, f.Limit))
}

const insertMistake = `
	INSERT INTO mistakes (user_id, project_id, mock_id, subject, pattern, root_cause, question, rule, solution,
	                      actual_seconds, ideal_seconds, status, created_at, updated_at)
	VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE($13, now()), COALESCE($13, now()))`

func mistakeArgs(userID int64, in store.MistakeInput) []any {
	status := in.Status
	if status == "" {
		status = "active"
	}
	return []any{userID, in.ProjectID, in.MockID, in.Subject, in.Pattern, in.RootCause, in.Question, in.Rule,
		in.Solution, in.ActualSeconds, in.IdealSeconds, status, in.CreatedAt}
}

// CreateMistake inserts one mistake; project and mock must be the user's own.
func (s *Store) CreateMistake(ctx context.Context, userID int64, in store.MistakeInput) (store.Mistake, error) {
	return scanMistake(s.pool.QueryRow(ctx, insertMistake+` RETURNING `+mistakeColumns, mistakeArgs(userID, in)...))
}

// CreateMistakes inserts all rows or none.
func (s *Store) CreateMistakes(ctx context.Context, userID int64, in []store.MistakeInput) (int, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, mapErr(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	for _, m := range in {
		if _, err := tx.Exec(ctx, insertMistake, mistakeArgs(userID, m)...); err != nil {
			return 0, mapErr(err)
		}
	}
	return len(in), mapErr(tx.Commit(ctx))
}

// UpdateMistake replaces the editable fields; the review status is kept
// unless the input sets one.
func (s *Store) UpdateMistake(ctx context.Context, userID, id int64, in store.MistakeInput) (store.Mistake, error) {
	return scanMistake(s.pool.QueryRow(ctx, `
		UPDATE mistakes SET project_id = $3, mock_id = $4, subject = $5, pattern = $6, root_cause = $7,
		       question = $8, rule = $9, solution = $10, actual_seconds = $11, ideal_seconds = $12,
		       status = COALESCE(NULLIF($13, ''), status), updated_at = now()
		WHERE id = $1 AND user_id = $2
		RETURNING `+mistakeColumns,
		id, userID, in.ProjectID, in.MockID, in.Subject, in.Pattern, in.RootCause, in.Question, in.Rule,
		in.Solution, in.ActualSeconds, in.IdealSeconds, in.Status))
}

// DeleteMistake removes a mistake.
func (s *Store) DeleteMistake(ctx context.Context, userID, id int64) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM mistakes WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return store.ErrNotFound
	}
	return nil
}

// RepeatMistakes finds pattern + root cause pairs logged at least minCount
// times since the cutoff. Locked-in mistakes still count: the alert is about
// how often the trap was hit, not whether it has been revised.
func (s *Store) RepeatMistakes(ctx context.Context, userID int64, since time.Time, minCount int) ([]store.RepeatAlert, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT mode() WITHIN GROUP (ORDER BY subject), pattern, root_cause, COUNT(*), MAX(created_at)
		FROM mistakes
		WHERE user_id = $1 AND created_at >= $2
		GROUP BY pattern, root_cause
		HAVING COUNT(*) >= $3
		ORDER BY COUNT(*) DESC, MAX(created_at) DESC`, userID, since, minCount)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()
	out := make([]store.RepeatAlert, 0)
	for rows.Next() {
		var a store.RepeatAlert
		if err := rows.Scan(&a.Subject, &a.Pattern, &a.RootCause, &a.Count, &a.LastAt); err != nil {
			return nil, mapErr(err)
		}
		out = append(out, a)
	}
	return out, mapErr(rows.Err())
}

// MistakeReviewDeck is every mistake that still needs revision: logged in the
// last 7 days and not yet locked in, marked "needs drill", or marked "review
// next week" at least 6 days ago.
func (s *Store) MistakeReviewDeck(ctx context.Context, userID int64, now time.Time) ([]store.Mistake, error) {
	return collectMistakes(s.pool.Query(ctx, `
		SELECT `+mistakeColumns+` FROM mistakes
		WHERE user_id = $1 AND status <> 'locked_in' AND (
		      status = 'needs_drill'
		   OR (status = 'active' AND created_at >= $2::timestamptz - interval '7 days')
		   OR (status = 'review_next_week' AND (last_reviewed_at IS NULL OR last_reviewed_at <= $2::timestamptz - interval '6 days'))
		)
		ORDER BY (status = 'needs_drill') DESC, created_at ASC, id ASC
		LIMIT 200`, userID, now))
}

// GradeMistake records a Sunday Reset grade.
func (s *Store) GradeMistake(ctx context.Context, userID, id int64, status string, now time.Time) (store.Mistake, error) {
	return scanMistake(s.pool.QueryRow(ctx, `
		UPDATE mistakes SET status = $3, last_reviewed_at = $4, updated_at = now()
		WHERE id = $1 AND user_id = $2
		RETURNING `+mistakeColumns, id, userID, status, now))
}
