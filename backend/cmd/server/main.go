// Command server runs the Study Tracker API.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	_ "time/tzdata" // embed the IANA database so ?tz= works in minimal images

	"study-tracker-backend/internal/auth"
	"study-tracker-backend/internal/config"
	"study-tracker-backend/internal/httpapi"
	"study-tracker-backend/internal/store/postgres"
)

func main() {
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		slog.Error("invalid configuration", "err", err)
		os.Exit(1)
	}

	logger := newLogger(cfg)
	slog.SetDefault(logger)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	startCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
	pool, err := postgres.NewPool(startCtx, cfg.DatabaseURL)
	if err != nil {
		cancel()
		logger.Error("database", "err", err)
		os.Exit(1)
	}
	if err := postgres.Migrate(startCtx, pool); err != nil {
		cancel()
		logger.Error("migrate", "err", err)
		os.Exit(1)
	}
	cancel()
	logger.Info("database ready")

	router := httpapi.NewRouter(httpapi.Deps{
		Config: cfg,
		Store:  postgres.New(pool),
		Issuer: auth.NewIssuer(cfg.JWTSecret, cfg.JWTTTL),
		Logger: logger,
	})

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      cfg.RequestTimeout + 10*time.Second,
		IdleTimeout:       120 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() { errCh <- srv.ListenAndServe() }()
	logger.Info("listening", "addr", srv.Addr, "env", cfg.Env)

	select {
	case err := <-errCh:
		if !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server", "err", err)
			pool.Close()
			os.Exit(1)
		}
	case <-ctx.Done():
		logger.Info("shutting down")
	}

	shCtx, cancelSh := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancelSh()
	if err := srv.Shutdown(shCtx); err != nil {
		logger.Error("shutdown", "err", err)
	}
	pool.Close()
	logger.Info("stopped")
}

func newLogger(cfg config.Config) *slog.Logger {
	if cfg.IsProduction() {
		return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	}
	return slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug}))
}
