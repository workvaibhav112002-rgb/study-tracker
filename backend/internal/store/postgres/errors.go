package postgres

import (
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"study-tracker-backend/internal/store"
)

// mapErr converts driver errors into store sentinels so callers never need
// to know about pgx.
func mapErr(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return store.ErrNotFound
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505": // unique_violation
			return fmt.Errorf("%w: %s", store.ErrConflict, pgErr.ConstraintName)
		case "23503": // foreign_key_violation
			return store.ErrNotFound
		case "23514": // check_violation
			return fmt.Errorf("%w: %s", store.ErrInvalid, pgErr.ConstraintName)
		}
	}
	return err
}
