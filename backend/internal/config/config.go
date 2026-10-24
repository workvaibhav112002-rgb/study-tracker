// Package config loads and validates runtime configuration from the environment.
package config

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// MinJWTSecretLen is the minimum accepted length of JWT_SECRET in bytes.
const MinJWTSecretLen = 32

// Config holds every tunable the server needs. It is immutable after Load.
type Config struct {
	Port        string
	Env         string // "production" | "development"
	DatabaseURL string
	JWTSecret   []byte
	JWTTTL      time.Duration
	CORSOrigins []string

	AuthRateLimit      int
	AuthRateWindow     time.Duration
	FeedbackRateLimit  int
	FeedbackRateWindow time.Duration

	CalendarRateLimit  int
	CalendarRateWindow time.Duration

	RequestTimeout     time.Duration
	ShutdownTimeout    time.Duration
	MaxBodyBytes       int64
	ImportMaxBodyBytes int64

	// SentryDSN enables error reporting when set.
	SentryDSN string

	// AppURL is the public frontend origin used in emailed links.
	AppURL string
	// GoogleClientID enables "Sign in with Google" when set.
	GoogleClientID string
	// SMTP settings; email features are disabled when Host is empty.
	SMTPHost string
	SMTPPort int
	SMTPUser string
	SMTPPass string
	SMTPFrom string

	// VAPID keys enable Web Push reminders when both are set.
	VAPIDPublicKey  string
	VAPIDPrivateKey string
	VAPIDSubject    string
	// CronSecret authorises the scheduled reminder endpoint.
	CronSecret string
}

// PushEnabled reports whether Web Push reminders can be sent.
func (c Config) PushEnabled() bool { return c.VAPIDPublicKey != "" && c.VAPIDPrivateKey != "" }

// EmailEnabled reports whether transactional email can be sent.
func (c Config) EmailEnabled() bool { return c.SMTPHost != "" && c.SMTPFrom != "" }

// IsProduction reports whether the server runs with production settings.
func (c Config) IsProduction() bool { return c.Env == "production" }

// Load reads configuration using getenv (usually os.Getenv). It returns a
// joined error listing every missing or invalid variable so operators can
// fix them all at once.
func Load(getenv func(string) string) (Config, error) {
	var errs []error

	cfg := Config{
		Port:               orDefault(getenv("PORT"), "8080"),
		Env:                orDefault(getenv("APP_ENV"), "development"),
		DatabaseURL:        strings.TrimSpace(getenv("DATABASE_URL")),
		JWTSecret:          []byte(getenv("JWT_SECRET")),
		MaxBodyBytes:       64 << 10,
		ImportMaxBodyBytes: 2 << 20,
		SentryDSN:          strings.TrimSpace(getenv("SENTRY_DSN")),
		AppURL:             strings.TrimRight(orDefault(getenv("APP_URL"), "https://study-tracker-olive-nine.vercel.app"), "/"),
		GoogleClientID:     strings.TrimSpace(getenv("GOOGLE_CLIENT_ID")),
		SMTPHost:           strings.TrimSpace(getenv("SMTP_HOST")),
		SMTPUser:           strings.TrimSpace(getenv("SMTP_USER")),
		SMTPPass:           getenv("SMTP_PASS"),
		SMTPFrom:           strings.TrimSpace(getenv("SMTP_FROM")),
		VAPIDPublicKey:     strings.TrimSpace(getenv("VAPID_PUBLIC_KEY")),
		VAPIDPrivateKey:    strings.TrimSpace(getenv("VAPID_PRIVATE_KEY")),
		CronSecret:         strings.TrimSpace(getenv("CRON_SECRET")),
	}
	cfg.VAPIDSubject = orDefault(getenv("VAPID_SUBJECT"), cfg.AppURL)
	if (cfg.VAPIDPublicKey == "") != (cfg.VAPIDPrivateKey == "") {
		errs = append(errs, errors.New("VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set together"))
	}
	cfg.SMTPPort = integer(getenv, "SMTP_PORT", 587, &errs)
	if cfg.SMTPHost != "" && cfg.SMTPFrom == "" {
		errs = append(errs, errors.New("SMTP_FROM is required when SMTP_HOST is set"))
	}

	if cfg.DatabaseURL == "" {
		errs = append(errs, errors.New("DATABASE_URL is required"))
	}
	if len(cfg.JWTSecret) < MinJWTSecretLen {
		errs = append(errs, fmt.Errorf("JWT_SECRET must be at least %d bytes", MinJWTSecretLen))
	}
	if cfg.Env != "production" && cfg.Env != "development" {
		errs = append(errs, fmt.Errorf("APP_ENV must be production or development, got %q", cfg.Env))
	}

	for _, o := range strings.Split(getenv("CORS_ORIGINS"), ",") {
		if o = strings.TrimSpace(o); o != "" {
			cfg.CORSOrigins = append(cfg.CORSOrigins, o)
		}
	}
	// With no allow-list the router emits no CORS headers at all, so browsers
	// deny every cross-origin call. That is never what production wants.
	if cfg.IsProduction() && len(cfg.CORSOrigins) == 0 {
		errs = append(errs, errors.New("CORS_ORIGINS is required in production (comma-separated origins, e.g. https://*.vercel.app)"))
	}

	cfg.JWTTTL = duration(getenv, "JWT_TTL", 7*24*time.Hour, &errs)
	cfg.AuthRateLimit = integer(getenv, "AUTH_RATE_LIMIT", 10, &errs)
	cfg.AuthRateWindow = duration(getenv, "AUTH_RATE_WINDOW", time.Minute, &errs)
	cfg.FeedbackRateLimit = integer(getenv, "FEEDBACK_RATE_LIMIT", 5, &errs)
	cfg.FeedbackRateWindow = duration(getenv, "FEEDBACK_RATE_WINDOW", 10*time.Minute, &errs)
	cfg.CalendarRateLimit = integer(getenv, "CALENDAR_RATE_LIMIT", 30, &errs)
	cfg.CalendarRateWindow = duration(getenv, "CALENDAR_RATE_WINDOW", time.Minute, &errs)
	cfg.RequestTimeout = duration(getenv, "REQUEST_TIMEOUT", 20*time.Second, &errs)
	cfg.ShutdownTimeout = duration(getenv, "SHUTDOWN_TIMEOUT", 15*time.Second, &errs)

	return cfg, errors.Join(errs...)
}

func orDefault(v, def string) string {
	if v = strings.TrimSpace(v); v != "" {
		return v
	}
	return def
}

func duration(getenv func(string) string, key string, def time.Duration, errs *[]error) time.Duration {
	raw := strings.TrimSpace(getenv(key))
	if raw == "" {
		return def
	}
	d, err := time.ParseDuration(raw)
	if err != nil || d <= 0 {
		*errs = append(*errs, fmt.Errorf("%s must be a positive duration like 30s or 5m, got %q", key, raw))
		return def
	}
	return d
}

func integer(getenv func(string) string, key string, def int, errs *[]error) int {
	raw := strings.TrimSpace(getenv(key))
	if raw == "" {
		return def
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		*errs = append(*errs, fmt.Errorf("%s must be a positive integer, got %q", key, raw))
		return def
	}
	return n
}
