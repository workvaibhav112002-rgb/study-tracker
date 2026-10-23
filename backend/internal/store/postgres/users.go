package postgres

import (
	"context"
	"fmt"

	"study-tracker-backend/internal/store"
)

type seedProject struct {
	name, color, description string
	target                   int
}

// seedProjects are created for every new account so the UI is not empty.
var seedProjects = []seedProject{
	{"Go Programming", "#00ADD8", "Mastering Go backend development & distributed systems", 90},
	{"Algorithms & DSA", "#8B5CF6", "Problem solving, data structures, and LeetCode practice", 60},
	{"System Design", "#10B981", "Scalability, microservices, databases, and architectures", 45},
}

// CreateUser inserts the user, a default settings row and seed projects in
// one transaction. A duplicate email yields store.ErrConflict.
func (s *Store) CreateUser(ctx context.Context, email, passwordHash, name string) (store.User, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return store.User{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	u := store.User{Email: email, Name: name}
	err = tx.QueryRow(ctx,
		`INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, created_at`,
		email, passwordHash, name,
	).Scan(&u.ID, &u.CreatedAt)
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

const userColumns = `id, email, password_hash, name, created_at`

func scanUser(row interface{ Scan(dest ...any) error }) (store.User, error) {
	var u store.User
	err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Name, &u.CreatedAt)
	return u, mapErr(err)
}

// GetUserByEmail returns the user including the password hash.
func (s *Store) GetUserByEmail(ctx context.Context, email string) (store.User, error) {
	return scanUser(s.pool.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE email = $1`, email))
}

// GetUserByID returns the user by primary key.
func (s *Store) GetUserByID(ctx context.Context, id int64) (store.User, error) {
	return scanUser(s.pool.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE id = $1`, id))
}

// UserExists is the cheap check the auth middleware runs per request.
func (s *Store) UserExists(ctx context.Context, id int64) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM users WHERE id = $1)`, id).Scan(&exists)
	return exists, mapErr(err)
}
