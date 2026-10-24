package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"

	"study-tracker-backend/internal/store"
)

const cardColumns = `id, user_id, project_id, front, back, tags, ease, interval_days, repetitions, lapses, due_at, archived, created_at, updated_at`

func scanCard(row pgx.Row) (store.Card, error) {
	var c store.Card
	err := row.Scan(&c.ID, &c.UserID, &c.ProjectID, &c.Front, &c.Back, &c.Tags, &c.Ease, &c.IntervalDays, &c.Repetitions, &c.Lapses, &c.DueAt, &c.Archived, &c.CreatedAt, &c.UpdatedAt)
	if c.Tags == nil {
		c.Tags = []string{}
	}
	return c, mapErr(err)
}

// ListCards returns cards, due-first when DueOnly, newest otherwise.
func (s *Store) ListCards(ctx context.Context, userID int64, f store.CardFilter) ([]store.Card, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT `+cardColumns+` FROM cards
		WHERE user_id = $1
		  AND ($2::bigint IS NULL OR project_id = $2)
		  AND (NOT $3::boolean OR (due_at <= now() AND NOT archived))
		  AND ($4::boolean IS NULL OR archived = $4)
		ORDER BY CASE WHEN $3 THEN due_at END ASC, created_at DESC, id DESC
		LIMIT NULLIF($5::int, 0)`, userID, f.ProjectID, f.DueOnly, f.Archived, f.Limit)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()
	out := make([]store.Card, 0)
	for rows.Next() {
		c, err := scanCard(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, mapErr(rows.Err())
}

// GetCard returns one owned card.
func (s *Store) GetCard(ctx context.Context, userID, id int64) (store.Card, error) {
	return scanCard(s.pool.QueryRow(ctx, `SELECT `+cardColumns+` FROM cards WHERE id = $1 AND user_id = $2`, id, userID))
}

// CreateCard inserts a card on an owned project.
func (s *Store) CreateCard(ctx context.Context, userID int64, in store.CardInput) (store.Card, error) {
	return scanCard(s.pool.QueryRow(ctx, `
		INSERT INTO cards (user_id, project_id, front, back, tags)
		SELECT p.user_id, p.id, $3, $4, $5 FROM projects p WHERE p.id = $2 AND p.user_id = $1
		RETURNING `+cardColumns, userID, in.ProjectID, in.Front, in.Back, in.Tags))
}

// UpdateCard edits content; the schedule is untouched.
func (s *Store) UpdateCard(ctx context.Context, userID, id int64, in store.CardInput) (store.Card, error) {
	return scanCard(s.pool.QueryRow(ctx, `
		UPDATE cards SET front = $3, back = $4, tags = $5, updated_at = now()
		WHERE id = $1 AND user_id = $2
		RETURNING `+cardColumns, id, userID, in.Front, in.Back, in.Tags))
}

// SetCardArchived hides or restores a card.
func (s *Store) SetCardArchived(ctx context.Context, userID, id int64, archived bool) (store.Card, error) {
	return scanCard(s.pool.QueryRow(ctx, `
		UPDATE cards SET archived = $3, updated_at = now() WHERE id = $1 AND user_id = $2
		RETURNING `+cardColumns, id, userID, archived))
}

// DeleteCard removes a card and its reviews.
func (s *Store) DeleteCard(ctx context.Context, userID, id int64) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM cards WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return store.ErrNotFound
	}
	return nil
}

// ReviewCard writes the new schedule and the review row in one transaction.
func (s *Store) ReviewCard(ctx context.Context, userID, id int64, rating int, next store.CardSchedule) (store.Card, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return store.Card{}, mapErr(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var before int
	if err := tx.QueryRow(ctx, `SELECT interval_days FROM cards WHERE id = $1 AND user_id = $2 FOR UPDATE`, id, userID).Scan(&before); err != nil {
		return store.Card{}, mapErr(err)
	}
	c, err := scanCard(tx.QueryRow(ctx, `
		UPDATE cards SET ease = $3, interval_days = $4, repetitions = $5, lapses = $6, due_at = $7, updated_at = now()
		WHERE id = $1 AND user_id = $2
		RETURNING `+cardColumns, id, userID, next.Ease, next.IntervalDays, next.Repetitions, next.Lapses, next.DueAt))
	if err != nil {
		return store.Card{}, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO card_reviews (user_id, card_id, rating, interval_before, interval_after) VALUES ($1, $2, $3, $4, $5)`,
		userID, id, rating, before, next.IntervalDays); err != nil {
		return store.Card{}, mapErr(err)
	}
	return c, mapErr(tx.Commit(ctx))
}

// CardStats counts the deck state.
func (s *Store) CardStats(ctx context.Context, userID int64, projectID *int64) (store.CardStats, error) {
	var st store.CardStats
	err := s.pool.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE NOT archived),
			COUNT(*) FILTER (WHERE NOT archived AND due_at <= now()),
			COUNT(*) FILTER (WHERE NOT archived AND repetitions = 0),
			COUNT(*) FILTER (WHERE NOT archived AND interval_days >= 21),
			(SELECT COUNT(*) FROM card_reviews r WHERE r.user_id = $1 AND r.reviewed_at >= now() - interval '7 days'
			   AND ($2::bigint IS NULL OR r.card_id IN (SELECT id FROM cards WHERE project_id = $2)))
		FROM cards WHERE user_id = $1 AND ($2::bigint IS NULL OR project_id = $2)`, userID, projectID,
	).Scan(&st.Total, &st.Due, &st.New, &st.Mastered, &st.Reviewed7)
	return st, mapErr(err)
}
