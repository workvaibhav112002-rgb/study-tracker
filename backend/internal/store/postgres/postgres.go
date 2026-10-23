// Package postgres implements store.Store on PostgreSQL using pgx.
package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"study-tracker-backend/internal/store"
)

// Store is the PostgreSQL-backed store.Store.
type Store struct {
	pool *pgxpool.Pool
}

var _ store.Store = (*Store)(nil)

// NewPool opens a small connection pool suitable for a serverless Postgres
// (Neon) that scales to zero: few connections, short idle time, generous
// connect timeout for cold starts.
func NewPool(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse DATABASE_URL: %w", err)
	}
	cfg.MaxConns = 5
	cfg.MinConns = 0
	cfg.MaxConnIdleTime = 5 * time.Minute
	cfg.MaxConnLifetime = 30 * time.Minute
	cfg.HealthCheckPeriod = time.Minute
	cfg.ConnConfig.ConnectTimeout = 15 * time.Second

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("open pool: %w", err)
	}
	return pool, nil
}

// New wraps an existing pool.
func New(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

// Ping verifies connectivity.
func (s *Store) Ping(ctx context.Context) error { return s.pool.Ping(ctx) }
