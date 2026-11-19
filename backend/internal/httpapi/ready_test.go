package httpapi_test

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"study-tracker-backend/internal/auth"
	"study-tracker-backend/internal/httpapi"
)

// Without a database the server still answers /api/live, and every other
// route gets a retryable 503 that browsers can read (CORS headers present).
func TestNotReadyAnswers503ButLiveWorks(t *testing.T) {
	cfg := testConfig()
	cfg.CORSOrigins = []string{"https://app.example.test"}
	var ready atomic.Bool
	h := httpapi.NewRouter(httpapi.Deps{
		Config: cfg, Store: nil, Issuer: auth.NewIssuer(cfg.JWTSecret, cfg.JWTTTL),
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		Ready:  ready.Load,
	})
	get := func(path string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.Header.Set("Origin", "https://app.example.test")
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec
	}

	if rec := get("/api/live"); rec.Code != 200 || !strings.Contains(rec.Body.String(), `"live"`) {
		t.Fatalf("live: %d %s", rec.Code, rec.Body)
	}
	for _, path := range []string{"/api/health", "/api/config", "/api/projects"} {
		rec := get(path)
		if rec.Code != http.StatusServiceUnavailable {
			t.Fatalf("%s: want 503, got %d %s", path, rec.Code, rec.Body)
		}
		if rec.Header().Get("Retry-After") == "" || rec.Header().Get("Access-Control-Allow-Origin") == "" {
			t.Errorf("%s: missing Retry-After or CORS headers: %v", path, rec.Header())
		}
		if !strings.Contains(rec.Body.String(), "database") {
			t.Errorf("%s: unclear message %s", path, rec.Body)
		}
	}

	// Once migrations succeed, routes behave normally (401 here: no token).
	ready.Store(true)
	if rec := get("/api/projects"); rec.Code != http.StatusUnauthorized {
		t.Fatalf("after ready: want 401, got %d %s", rec.Code, rec.Body)
	}
}

func TestLiveDoesNotNeedTheDatabase(t *testing.T) {
	s := newServer(t, nil)
	res, body := s.do(t, "GET", "/api/live", "", nil)
	wantStatus(t, res.StatusCode, 200, body)
}
