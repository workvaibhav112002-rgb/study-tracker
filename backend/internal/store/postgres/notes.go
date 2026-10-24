package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"

	"study-tracker-backend/internal/store"
)

const noteColumns = `id, user_id, project_id, title, body, tags, pinned, created_at, updated_at`

func scanNote(row pgx.Row) (store.Note, error) {
	var n store.Note
	err := row.Scan(&n.ID, &n.UserID, &n.ProjectID, &n.Title, &n.Body, &n.Tags, &n.Pinned, &n.CreatedAt, &n.UpdatedAt)
	if n.Tags == nil {
		n.Tags = []string{}
	}
	return n, mapErr(err)
}

// ListNotes returns pinned notes first, then most recently updated.
func (s *Store) ListNotes(ctx context.Context, userID int64, f store.NoteFilter) ([]store.Note, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT `+noteColumns+` FROM notes
		WHERE user_id = $1
		  AND ($2::bigint IS NULL OR project_id = $2)
		  AND ($3::text = '' OR $3 = ANY(tags))
		  AND ($4::text = '' OR title ILIKE '%' || $4 || '%' OR body ILIKE '%' || $4 || '%')
		ORDER BY pinned DESC, updated_at DESC, id DESC
		LIMIT NULLIF($5::int, 0)`, userID, f.ProjectID, f.Tag, f.Query, f.Limit)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()
	out := make([]store.Note, 0)
	for rows.Next() {
		n, err := scanNote(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, mapErr(rows.Err())
}

// CreateNote inserts a note; a project, if given, must be the user's own.
func (s *Store) CreateNote(ctx context.Context, userID int64, in store.NoteInput) (store.Note, error) {
	return scanNote(s.pool.QueryRow(ctx, `
		INSERT INTO notes (user_id, project_id, title, body, tags, pinned)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING `+noteColumns, userID, in.ProjectID, in.Title, in.Body, in.Tags, in.Pinned))
}

// UpdateNote replaces the editable fields.
func (s *Store) UpdateNote(ctx context.Context, userID, id int64, in store.NoteInput) (store.Note, error) {
	return scanNote(s.pool.QueryRow(ctx, `
		UPDATE notes SET project_id = $3, title = $4, body = $5, tags = $6, pinned = $7, updated_at = now()
		WHERE id = $1 AND user_id = $2
		RETURNING `+noteColumns, id, userID, in.ProjectID, in.Title, in.Body, in.Tags, in.Pinned))
}

// DeleteNote removes a note.
func (s *Store) DeleteNote(ctx context.Context, userID, id int64) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM notes WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return store.ErrNotFound
	}
	return nil
}
