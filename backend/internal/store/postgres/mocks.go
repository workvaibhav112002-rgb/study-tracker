package postgres

import (
	"context"
	"errors"
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

const mistakeColumns = `id, user_id, project_id, mock_id, tags, extra, question, rule, solution,
	actual_seconds, ideal_seconds, status, last_reviewed_at, created_at, updated_at`

func scanMistake(row pgx.Row) (store.Mistake, error) {
	var m store.Mistake
	err := row.Scan(&m.ID, &m.UserID, &m.ProjectID, &m.MockID, &m.Tags, &m.Extra,
		&m.Question, &m.Rule, &m.Solution, &m.ActualSeconds, &m.IdealSeconds, &m.Status,
		&m.LastReviewedAt, &m.CreatedAt, &m.UpdatedAt)
	if m.Tags == nil {
		m.Tags = map[string]any{}
	}
	if m.Extra == nil {
		m.Extra = map[string]any{}
	}
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

// tagMatch is true when category $k holds $v as a string or inside an array.
func tagMatch(k, v string) string {
	return `(tags->>` + k + ` = ` + v + ` OR (jsonb_typeof(tags->` + k + `) = 'array' AND tags->` + k + ` ? ` + v + `))`
}

func tagArgs(t *store.TagFilter) (string, string) {
	if t == nil {
		return "", ""
	}
	return t.Category, t.Value
}

// ListMistakes returns the newest mistakes matching the filter.
func (s *Store) ListMistakes(ctx context.Context, userID int64, f store.MistakeFilter) ([]store.Mistake, error) {
	tk, tv := tagArgs(f.Tag)
	return collectMistakes(s.pool.Query(ctx, `
		SELECT `+mistakeColumns+` FROM mistakes
		WHERE user_id = $1
		  AND ($2::bigint IS NULL OR project_id = $2)
		  AND ($3::bigint IS NULL OR mock_id = $3)
		  AND ($4::text = '' OR `+tagMatch("$4::text", "$5::text")+`)
		  AND ($6::text = '' OR status = $6)
		  AND ($7::text = '' OR question ILIKE '%' || $7 || '%' OR rule ILIKE '%' || $7 || '%'
		       OR solution ILIKE '%' || $7 || '%' OR tags::text ILIKE '%' || $7 || '%')
		  AND ($8::timestamptz IS NULL OR created_at >= $8)
		ORDER BY created_at DESC, id DESC
		LIMIT NULLIF($9::int, 0)`,
		userID, f.ProjectID, f.MockID, tk, tv, f.Status, f.Query, f.Since, f.Limit))
}

const insertMistake = `
	INSERT INTO mistakes (user_id, project_id, mock_id, tags, extra, question, rule, solution,
	                      actual_seconds, ideal_seconds, status, created_at, updated_at)
	VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, now()), COALESCE($12, now()))`

func mistakeArgs(userID int64, in store.MistakeInput) []any {
	status := in.Status
	if status == "" {
		status = "active"
	}
	tags, extra := in.Tags, in.Extra
	if tags == nil {
		tags = map[string]any{}
	}
	if extra == nil {
		extra = map[string]any{}
	}
	return []any{userID, in.ProjectID, in.MockID, tags, extra, in.Question, in.Rule,
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
	a := mistakeArgs(userID, in)
	return scanMistake(s.pool.QueryRow(ctx, `
		UPDATE mistakes SET project_id = $3, mock_id = $4, tags = $5, extra = $6,
		       question = $7, rule = $8, solution = $9, actual_seconds = $10, ideal_seconds = $11,
		       status = COALESCE(NULLIF($12, ''), status), updated_at = now()
		WHERE id = $1 AND user_id = $2
		RETURNING `+mistakeColumns,
		id, userID, in.ProjectID, in.MockID, a[3], a[4], in.Question, in.Rule,
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

// RetagMistakes replaces one value of a category with another, or removes it
// when to is empty. Arrays (multi-select) are rewritten element by element.
func (s *Store) RetagMistakes(ctx context.Context, userID int64, projectID *int64, category, from, to string) (int, error) {
	tag, err := s.pool.Exec(ctx, `
		UPDATE mistakes SET updated_at = now(), tags = CASE
			WHEN jsonb_typeof(tags->$3::text) = 'array' THEN
				CASE WHEN $5::text = '' THEN
					jsonb_set(tags, ARRAY[$3::text], COALESCE((SELECT jsonb_agg(e) FROM jsonb_array_elements_text(tags->$3::text) e WHERE e <> $4::text), '[]'::jsonb))
				ELSE
					jsonb_set(tags, ARRAY[$3::text], COALESCE((SELECT jsonb_agg(DISTINCT CASE WHEN e = $4::text THEN $5::text ELSE e END) FROM jsonb_array_elements_text(tags->$3::text) e), '[]'::jsonb))
				END
			WHEN $5::text = '' THEN tags - $3::text
			ELSE jsonb_set(tags, ARRAY[$3::text], to_jsonb($5::text))
		END
		WHERE user_id = $1 AND ($2::bigint IS NULL OR project_id = $2) AND `+tagMatch("$3::text", "$4::text"),
		userID, projectID, category, from, to)
	if err != nil {
		return 0, mapErr(err)
	}
	return int(tag.RowsAffected()), nil
}

// MistakeReviewDeck is every mistake that still needs revision: logged in the
// last 7 days and not yet locked in, marked "needs drill", or marked "review
// next week" at least 6 days ago. An optional tag narrows it to one topic.
func (s *Store) MistakeReviewDeck(ctx context.Context, userID int64, now time.Time, t *store.TagFilter) ([]store.Mistake, error) {
	tk, tv := tagArgs(t)
	return collectMistakes(s.pool.Query(ctx, `
		SELECT `+mistakeColumns+` FROM mistakes
		WHERE user_id = $1 AND status <> 'locked_in' AND (
		      status = 'needs_drill'
		   OR (status = 'active' AND created_at >= $2::timestamptz - interval '7 days')
		   OR (status = 'review_next_week' AND (last_reviewed_at IS NULL OR last_reviewed_at <= $2::timestamptz - interval '6 days'))
		   OR $3::text <> ''
		)
		  AND ($3::text = '' OR `+tagMatch("$3::text", "$4::text")+`)
		ORDER BY (status = 'needs_drill') DESC, created_at ASC, id ASC
		LIMIT 200`, userID, now, tk, tv))
}

// GradeMistake records a review grade.
func (s *Store) GradeMistake(ctx context.Context, userID, id int64, status string, now time.Time) (store.Mistake, error) {
	return scanMistake(s.pool.QueryRow(ctx, `
		UPDATE mistakes SET status = $3, last_reviewed_at = $4, updated_at = now()
		WHERE id = $1 AND user_id = $2
		RETURNING `+mistakeColumns, id, userID, status, now))
}

// GetJournalConfig returns the user's default setup, or nil for the built-in one.
func (s *Store) GetJournalConfig(ctx context.Context, userID int64) (*store.JournalConfig, error) {
	var c *store.JournalConfig
	err := s.pool.QueryRow(ctx, `SELECT journal_config FROM settings WHERE user_id = $1`, userID).Scan(&c)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return c, mapErr(err)
}

// SetJournalConfig stores (or clears) the user's default setup, creating the
// settings row with defaults if needed.
func (s *Store) SetJournalConfig(ctx context.Context, userID int64, c *store.JournalConfig) error {
	d := store.DefaultSettings()
	_, err := s.pool.Exec(ctx, `
		INSERT INTO settings (user_id, work_duration, short_break_duration, long_break_duration, long_break_interval,
		                      auto_start_breaks, sound_enabled, reminder_enabled, reminder_hour, timezone, journal_config)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (user_id) DO UPDATE SET journal_config = EXCLUDED.journal_config, updated_at = now()`,
		userID, d.WorkDuration, d.ShortBreakDuration, d.LongBreakDuration, d.LongBreakInterval,
		d.AutoStartBreaks, d.SoundEnabled, d.ReminderEnabled, d.ReminderHour, d.Timezone, c)
	return mapErr(err)
}

// SetProjectJournal stores (or clears, to inherit the default) a project's setup.
func (s *Store) SetProjectJournal(ctx context.Context, userID, projectID int64, c *store.JournalConfig) (store.Project, error) {
	tag, err := s.pool.Exec(ctx, `UPDATE projects SET journal_config = $3 WHERE id = $1 AND user_id = $2`, projectID, userID, c)
	if err != nil {
		return store.Project{}, mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return store.Project{}, store.ErrNotFound
	}
	return scanProject(s.pool.QueryRow(ctx, projectWithTotals+` AND p.id = $2 GROUP BY p.id`, userID, projectID))
}
