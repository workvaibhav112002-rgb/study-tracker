package httpapi_test

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	embeddedpostgres "github.com/fergusstrange/embedded-postgres"
	"github.com/jackc/pgx/v5/pgxpool"

	"study-tracker-backend/internal/auth"
	"study-tracker-backend/internal/config"
	"study-tracker-backend/internal/httpapi"
	"study-tracker-backend/internal/store/postgres"
)

var testPool *pgxpool.Pool

// TestMain provides one Postgres for the whole package: TEST_DATABASE_URL if
// set (CI), otherwise an embedded server that downloads its binary once.
func TestMain(m *testing.M) {
	os.Exit(runMain(m))
}

func runMain(m *testing.M) int {
	ctx := context.Background()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		if os.Getenv("CI") != "" {
			fmt.Fprintln(os.Stderr, "TEST_DATABASE_URL must be set in CI")
			return 1
		}
		port, err := freePort()
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			return 1
		}
		runtime, err := os.MkdirTemp("", "study-tracker-pg-*")
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			return 1
		}
		defer os.RemoveAll(runtime)
		pg := embeddedpostgres.NewDatabase(embeddedpostgres.DefaultConfig().
			Version(embeddedpostgres.V16).
			Port(port).
			RuntimePath(filepath.Join(runtime, "run")).
			DataPath(filepath.Join(runtime, "data")).
			Logger(io.Discard))
		if err := pg.Start(); err != nil {
			fmt.Fprintln(os.Stderr, "embedded postgres:", err)
			return 1
		}
		defer func() { _ = pg.Stop() }()
		url = fmt.Sprintf("postgres://postgres:postgres@127.0.0.1:%d/postgres?sslmode=disable", port)
	}

	pool, err := postgres.NewPool(ctx, url)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	defer pool.Close()
	if err := postgres.Migrate(ctx, pool); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	testPool = pool
	return m.Run()
}

func freePort() (uint32, error) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}
	defer l.Close()
	return uint32(l.Addr().(*net.TCPAddr).Port), nil
}

func resetDB(t *testing.T) {
	t.Helper()
	if _, err := testPool.Exec(context.Background(), `TRUNCATE users, feedback RESTART IDENTITY CASCADE`); err != nil {
		t.Fatal(err)
	}
}

func testConfig() config.Config {
	cfg, err := config.Load(func(k string) string {
		return map[string]string{
			"DATABASE_URL": "unused", "JWT_SECRET": strings.Repeat("t", 32),
			"CORS_ORIGINS":    "http://localhost:5173,https://*.vercel.app",
			"AUTH_RATE_LIMIT": "100000", "FEEDBACK_RATE_LIMIT": "100000",
		}[k]
	})
	if err != nil {
		panic(err)
	}
	return cfg
}

type testServer struct {
	*httptest.Server
	issuer *auth.Issuer
}

func newServer(t *testing.T, mod func(*config.Config)) *testServer {
	t.Helper()
	resetDB(t)
	cfg := testConfig()
	if mod != nil {
		mod(&cfg)
	}
	issuer := auth.NewIssuer(cfg.JWTSecret, cfg.JWTTTL)
	h := httpapi.NewRouter(httpapi.Deps{
		Config: cfg, Store: postgres.New(testPool), Issuer: issuer,
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
	})
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	return &testServer{Server: srv, issuer: issuer}
}

func (s *testServer) do(t *testing.T, method, path, token string, body any) (*http.Response, []byte) {
	t.Helper()
	var rdr io.Reader
	switch b := body.(type) {
	case nil:
	case string:
		rdr = strings.NewReader(b)
	default:
		rdr = strings.NewReader(mustJSON(b))
	}
	req, err := http.NewRequest(method, s.URL+path, rdr)
	if err != nil {
		t.Fatal(err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := s.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	data, _ := io.ReadAll(res.Body)
	return res, data
}

func (s *testServer) register(t *testing.T, email string) (token string, userID int64) {
	t.Helper()
	res, body := s.do(t, "POST", "/api/auth/register", "", map[string]string{"email": email, "password": "password123", "name": "T"})
	if res.StatusCode != 201 {
		t.Fatalf("register %s: %d %s", email, res.StatusCode, body)
	}
	var out struct {
		Token string `json:"token"`
		User  struct {
			ID int64 `json:"id"`
		} `json:"user"`
	}
	decode(t, body, &out)
	return out.Token, out.User.ID
}

func (s *testServer) createProject(t *testing.T, token, name string) int64 {
	t.Helper()
	res, body := s.do(t, "POST", "/api/projects", token, map[string]any{"name": name, "color": "#112233"})
	if res.StatusCode != 201 {
		t.Fatalf("create project: %d %s", res.StatusCode, body)
	}
	var p struct {
		ID int64 `json:"id"`
	}
	decode(t, body, &p)
	return p.ID
}

func (s *testServer) createSession(t *testing.T, token string, projectID int64, start time.Time, seconds int) (*http.Response, []byte) {
	t.Helper()
	return s.do(t, "POST", "/api/sessions", token, map[string]any{
		"project_id": projectID, "start_time": start.UTC().Format(time.RFC3339),
		"end_time":         start.Add(time.Duration(seconds) * time.Second).UTC().Format(time.RFC3339),
		"duration_seconds": seconds, "session_type": "pomodoro", "focus_rating": 4,
	})
}
