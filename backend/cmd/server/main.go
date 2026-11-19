// Command server runs the Granule API (product name: internal/brand).
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"sync/atomic"
	"syscall"
	"time"
	_ "time/tzdata" // embed the IANA database so ?tz= works in minimal images

	"github.com/getsentry/sentry-go"
	"github.com/jackc/pgx/v5/pgxpool"

	"study-tracker-backend/internal/auth"
	"study-tracker-backend/internal/config"
	"study-tracker-backend/internal/httpapi"
	"study-tracker-backend/internal/mail"
	"study-tracker-backend/internal/push"
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

	if cfg.SentryDSN != "" {
		if err := sentry.Init(sentry.ClientOptions{Dsn: cfg.SentryDSN, Environment: cfg.Env, Release: os.Getenv("RENDER_GIT_COMMIT")}); err != nil {
			logger.Warn("sentry disabled", "err", err)
		} else {
			defer sentry.Flush(2 * time.Second)
			logger.Info("sentry enabled")
		}
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// The pool connects lazily, so this only fails on a malformed URL.
	pool, err := postgres.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("database", "err", err)
		os.Exit(1)
	}
	// Migrate in the background and keep retrying: if the database is
	// unreachable (cold start, outage, or suspended over a quota) the server
	// still starts, answers /api/live, and returns a clear 503 elsewhere
	// instead of exiting and being restarted in a loop.
	var ready atomic.Bool
	go migrateUntilReady(ctx, logger, pool, &ready)

	var mailer mail.Mailer = mail.Nop{}
	if cfg.EmailEnabled() {
		mailer = mail.SMTP{Host: cfg.SMTPHost, Port: cfg.SMTPPort, User: cfg.SMTPUser, Pass: cfg.SMTPPass, From: cfg.SMTPFrom}
		logger.Info("email enabled", "host", cfg.SMTPHost, "from", cfg.SMTPFrom)
	} else {
		logger.Info("email disabled: set SMTP_HOST, SMTP_USER, SMTP_PASS and SMTP_FROM to enable password reset and magic links")
	}
	var google auth.GoogleVerifier
	if cfg.GoogleClientID != "" {
		g, err := auth.NewGoogleVerifier(ctx, cfg.GoogleClientID)
		if err != nil {
			logger.Warn("google sign-in disabled", "err", err)
		} else {
			google = g
			logger.Info("google sign-in enabled")
		}
	}

	var pusher push.Sender = push.Nop{}
	if cfg.PushEnabled() {
		pusher = push.VAPID{PublicKey: cfg.VAPIDPublicKey, PrivateKey: cfg.VAPIDPrivateKey, Subject: cfg.VAPIDSubject}
		logger.Info("push reminders enabled")
	} else {
		logger.Info("push reminders disabled: set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and CRON_SECRET to enable")
	}

	router := httpapi.NewRouter(httpapi.Deps{
		Config: cfg,
		Store:  postgres.New(pool),
		Issuer: auth.NewIssuer(cfg.JWTSecret, cfg.JWTTTL),
		Logger: logger,
		Mailer: mailer,
		Google: google,
		Push:   pusher,
		Ready:  ready.Load,
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

// migrateUntilReady runs migrations, retrying with backoff (5 s doubling to
// 5 min) until they succeed or the server shuts down. Failed attempts against
// a suspended database don't wake it or use compute.
func migrateUntilReady(ctx context.Context, logger *slog.Logger, pool *pgxpool.Pool, ready *atomic.Bool) {
	const maxWait = 5 * time.Minute
	wait := 5 * time.Second
	for attempt := 1; ; attempt++ {
		attemptCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
		err := postgres.Migrate(attemptCtx, pool)
		cancel()
		if err == nil {
			ready.Store(true)
			logger.Info("database ready", "attempts", attempt)
			return
		}
		logger.Error("migrate", "err", err, "attempt", attempt, "retry_in", wait.String())
		select {
		case <-ctx.Done():
			return
		case <-time.After(wait):
		}
		wait = min(wait*2, maxWait)
	}
}
