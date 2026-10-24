package config

import (
	"strings"
	"testing"
	"time"
)

func env(m map[string]string) func(string) string {
	return func(k string) string { return m[k] }
}

func TestLoadFailsFastOnMissingRequired(t *testing.T) {
	_, err := Load(env(map[string]string{}))
	if err == nil {
		t.Fatal("expected error")
	}
	for _, want := range []string{"DATABASE_URL", "JWT_SECRET"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error should mention %s: %v", want, err)
		}
	}
}

func TestLoadRejectsShortSecret(t *testing.T) {
	_, err := Load(env(map[string]string{"DATABASE_URL": "postgres://x", "JWT_SECRET": "short"}))
	if err == nil || !strings.Contains(err.Error(), "JWT_SECRET") {
		t.Fatalf("expected JWT_SECRET error, got %v", err)
	}
}

func TestLoadDefaultsAndOverrides(t *testing.T) {
	cfg, err := Load(env(map[string]string{
		"DATABASE_URL":    "postgres://x",
		"JWT_SECRET":      strings.Repeat("s", 32),
		"CORS_ORIGINS":    " https://a.example , https://*.vercel.app ,",
		"AUTH_RATE_LIMIT": "3",
		"REQUEST_TIMEOUT": "5s",
		"APP_ENV":         "production",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Port != "8080" || cfg.JWTTTL != 7*24*time.Hour || cfg.AuthRateLimit != 3 || cfg.RequestTimeout != 5*time.Second {
		t.Errorf("unexpected config: %+v", cfg)
	}
	if len(cfg.CORSOrigins) != 2 || cfg.CORSOrigins[1] != "https://*.vercel.app" {
		t.Errorf("origins: %v", cfg.CORSOrigins)
	}
	if !cfg.IsProduction() {
		t.Error("expected production")
	}
}

func TestProductionRequiresCORSOrigins(t *testing.T) {
	_, err := Load(env(map[string]string{
		"DATABASE_URL": "postgres://x", "JWT_SECRET": strings.Repeat("s", 32), "APP_ENV": "production",
	}))
	if err == nil || !strings.Contains(err.Error(), "CORS_ORIGINS") {
		t.Fatalf("expected CORS_ORIGINS error in production, got %v", err)
	}
	if _, err := Load(env(map[string]string{"DATABASE_URL": "postgres://x", "JWT_SECRET": strings.Repeat("s", 32)})); err != nil {
		t.Fatalf("development should not require CORS_ORIGINS: %v", err)
	}
}

func TestLoadRejectsBadNumbers(t *testing.T) {
	_, err := Load(env(map[string]string{
		"DATABASE_URL": "postgres://x", "JWT_SECRET": strings.Repeat("s", 32),
		"AUTH_RATE_LIMIT": "-1", "REQUEST_TIMEOUT": "soon", "CALENDAR_RATE_LIMIT": "0",
	}))
	for _, want := range []string{"AUTH_RATE_LIMIT", "REQUEST_TIMEOUT", "CALENDAR_RATE_LIMIT"} {
		if err == nil || !strings.Contains(err.Error(), want) {
			t.Fatalf("expected %s error, got %v", want, err)
		}
	}
}

func TestLoadOptionalSentryAndDefaults(t *testing.T) {
	cfg, err := Load(env(map[string]string{"DATABASE_URL": "postgres://x", "JWT_SECRET": strings.Repeat("s", 32), "SENTRY_DSN": " https://k@o.ingest.sentry.io/1 "}))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.SentryDSN != "https://k@o.ingest.sentry.io/1" || cfg.CalendarRateLimit != 30 || cfg.ImportMaxBodyBytes != 2<<20 {
		t.Errorf("unexpected: %+v", cfg)
	}
}
