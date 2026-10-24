package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"study-tracker-backend/internal/store"
)

type seedProject struct {
	name, color, description string
	target                   int
}

// seedProjects are created for every new account so the UI is not empty.
var seedProjects = []seedProject{
	{"Go Programming", "#3987e5", "Mastering Go backend development & distributed systems", 90},
	{"Algorithms & DSA", "#9085e9", "Problem solving, data structures, and LeetCode practice", 60},
	{"System Design", "#199e70", "Scalability, microservices, databases, and architectures", 45},
}

// CreateUser inserts the user, a default settings row and seed projects in
// one transaction. A duplicate email yields store.ErrConflict.
func (s *Store) CreateUser(ctx context.Context, email, passwordHash, name string) (store.User, error) {
	return s.createUser(ctx, email, passwordHash, name, nil, false)
}

// CreateGoogleUser creates a password-less account linked to a Google subject.
func (s *Store) CreateGoogleUser(ctx context.Context, email, name, googleSub string, verified bool) (store.User, error) {
	return s.createUser(ctx, email, "", name, &googleSub, verified)
}

func (s *Store) createUser(ctx context.Context, email, passwordHash, name string, googleSub *string, verified bool) (store.User, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return store.User{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	u := store.User{Email: email, Name: name, HasPassword: passwordHash != "", GoogleLinked: googleSub != nil}
	var hash *string
	if passwordHash != "" {
		hash = &passwordHash
	}
	var verifiedAt *time.Time
	if verified {
		now := time.Now().UTC()
		verifiedAt = &now
		u.EmailVerifiedAt = verifiedAt
	}
	err = tx.QueryRow(ctx,
		`INSERT INTO users (email, password_hash, name, google_sub, email_verified_at) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at, updated_at`,
		email, hash, name, googleSub, verifiedAt,
	).Scan(&u.ID, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return store.User{}, mapErr(err)
	}

	if _, err := tx.Exec(ctx, `INSERT INTO settings (user_id) VALUES ($1)`, u.ID); err != nil {
		return store.User{}, fmt.Errorf("seed settings: %w", mapErr(err))
	}
	for _, p := range seedProjects {
		if _, err := tx.Exec(ctx,
			`INSERT INTO projects (user_id, name, color, description, target_minutes_per_day) VALUES ($1, $2, $3, $4, $5)`,
			u.ID, p.name, p.color, p.description, p.target,
		); err != nil {
			return store.User{}, fmt.Errorf("seed project %q: %w", p.name, mapErr(err))
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return store.User{}, err
	}
	return u, nil
}

const userColumns = `id, email, COALESCE(password_hash, ''), name, created_at, updated_at, token_version,
	(calendar_token IS NOT NULL), (google_sub IS NOT NULL), email_verified_at`

func scanUser(row pgx.Row) (store.User, error) {
	var u store.User
	err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Name, &u.CreatedAt, &u.UpdatedAt, &u.TokenVersion,
		&u.HasCalendarToken, &u.GoogleLinked, &u.EmailVerifiedAt)
	u.HasPassword = u.PasswordHash != ""
	return u, mapErr(err)
}

// GetUserByGoogleSub finds the account linked to a Google subject.
func (s *Store) GetUserByGoogleSub(ctx context.Context, sub string) (store.User, error) {
	return scanUser(s.pool.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE google_sub = $1`, sub))
}

// LinkGoogle attaches a Google subject to an existing account.
func (s *Store) LinkGoogle(ctx context.Context, userID int64, sub string, verified bool) error {
	tag, err := s.pool.Exec(ctx, `
		UPDATE users SET google_sub = $2,
		       email_verified_at = CASE WHEN $3 THEN COALESCE(email_verified_at, now()) ELSE email_verified_at END,
		       updated_at = now()
		WHERE id = $1`, userID, sub, verified)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return store.ErrNotFound
	}
	return nil
}

// MarkEmailVerified records that the user proved control of their mailbox.
func (s *Store) MarkEmailVerified(ctx context.Context, userID int64) error {
	_, err := s.pool.Exec(ctx, `UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now() WHERE id = $1`, userID)
	return mapErr(err)
}

// CreateAuthToken stores a hashed single-use token.
func (s *Store) CreateAuthToken(ctx context.Context, userID int64, kind, tokenHash string, expiresAt time.Time) error {
	_, err := s.pool.Exec(ctx, `INSERT INTO auth_tokens (user_id, kind, token_hash, expires_at) VALUES ($1, $2, $3, $4)`, userID, kind, tokenHash, expiresAt)
	return mapErr(err)
}

// ConsumeAuthToken marks a live token as used and returns its owner, in one
// statement so a token can never be redeemed twice.
func (s *Store) ConsumeAuthToken(ctx context.Context, kind, tokenHash string) (int64, error) {
	var userID int64
	err := s.pool.QueryRow(ctx, `
		UPDATE auth_tokens SET used_at = now()
		WHERE kind = $1 AND token_hash = $2 AND used_at IS NULL AND expires_at > now()
		RETURNING user_id`, kind, tokenHash).Scan(&userID)
	return userID, mapErr(err)
}

// GetUserByEmail returns the user including the password hash.
func (s *Store) GetUserByEmail(ctx context.Context, email string) (store.User, error) {
	return scanUser(s.pool.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE email = $1`, email))
}

// GetUserByID returns the user by primary key.
func (s *Store) GetUserByID(ctx context.Context, id int64) (store.User, error) {
	return scanUser(s.pool.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE id = $1`, id))
}

// UserExists reports whether the user row exists.
func (s *Store) UserExists(ctx context.Context, id int64) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM users WHERE id = $1)`, id).Scan(&exists)
	return exists, mapErr(err)
}

// AuthState is the cheap per-request check the auth middleware runs.
func (s *Store) AuthState(ctx context.Context, id int64) (bool, int, error) {
	var version int
	err := s.pool.QueryRow(ctx, `SELECT token_version FROM users WHERE id = $1`, id).Scan(&version)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, 0, nil
	}
	if err != nil {
		return false, 0, mapErr(err)
	}
	return true, version, nil
}

// UpdatePassword stores the new hash and invalidates existing tokens.
func (s *Store) UpdatePassword(ctx context.Context, userID int64, newHash string) (int, error) {
	var version int
	err := s.pool.QueryRow(ctx,
		`UPDATE users SET password_hash = $2, token_version = token_version + 1, updated_at = now() WHERE id = $1 RETURNING token_version`,
		userID, newHash,
	).Scan(&version)
	return version, mapErr(err)
}

// DeleteUser removes the account; FKs cascade to everything the user owns.
func (s *Store) DeleteUser(ctx context.Context, userID int64) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, userID)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return store.ErrNotFound
	}
	return nil
}

// SetCalendarToken stores the hash of a freshly generated feed token.
func (s *Store) SetCalendarToken(ctx context.Context, userID int64, tokenHash string) error {
	tag, err := s.pool.Exec(ctx, `UPDATE users SET calendar_token = $2, updated_at = now() WHERE id = $1`, userID, tokenHash)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return store.ErrNotFound
	}
	return nil
}

// ClearCalendarToken revokes the feed. ErrNotFound when none was set.
func (s *Store) ClearCalendarToken(ctx context.Context, userID int64) error {
	tag, err := s.pool.Exec(ctx, `UPDATE users SET calendar_token = NULL, updated_at = now() WHERE id = $1 AND calendar_token IS NOT NULL`, userID)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return store.ErrNotFound
	}
	return nil
}

// UserIDByCalendarToken resolves a feed token hash to its owner.
func (s *Store) UserIDByCalendarToken(ctx context.Context, tokenHash string) (int64, error) {
	var id int64
	err := s.pool.QueryRow(ctx, `SELECT id FROM users WHERE calendar_token = $1`, tokenHash).Scan(&id)
	return id, mapErr(err)
}
