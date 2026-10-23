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

func TestLoadRejectsBadNumbers(t *testing.T) {
	_, err := Load(env(map[string]string{
		"DATABASE_URL": "postgres://x", "JWT_SECRET": strings.Repeat("s", 32),
		"AUTH_RATE_LIMIT": "-1", "REQUEST_TIMEOUT": "soon",
	}))
	if err == nil || !strings.Contains(err.Error(), "AUTH_RATE_LIMIT") || !strings.Contains(err.Error(), "REQUEST_TIMEOUT") {
		t.Fatalf("expected both errors, got %v", err)
	}
}
