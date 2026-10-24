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
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	embeddedpostgres "github.com/fergusstrange/embedded-postgres"
	"github.com/jackc/pgx/v5/pgxpool"

	"study-tracker-backend/internal/auth"
	"study-tracker-backend/internal/config"
	"study-tracker-backend/internal/httpapi"
	"study-tracker-backend/internal/push"
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
			"DATABASE_URL": "unused", "JWT_SECRET": strings.Repeat("t", 32), "APP_URL": "https://app.test", "GOOGLE_CLIENT_ID": "test-client",
			"CORS_ORIGINS":    "http://localhost:5173,https://*.vercel.app",
			"AUTH_RATE_LIMIT": "100000", "FEEDBACK_RATE_LIMIT": "100000", "CALENDAR_RATE_LIMIT": "100000", "PROFILE_RATE_LIMIT": "100000",
			"VAPID_PUBLIC_KEY": "test-public", "VAPID_PRIVATE_KEY": "test-private", "CRON_SECRET": "cron-secret-for-tests",
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
	mail   *fakeMailer
	google *fakeGoogle
	push   *fakePush
}

// fakePush records payloads; endpoints containing "gone" are reported dead.
type fakePush struct {
	mu   sync.Mutex
	sent map[string][]string
}

func (f *fakePush) Enabled() bool { return true }
func (f *fakePush) Send(_ context.Context, sub push.Subscription, payload []byte) error {
	if strings.Contains(sub.Endpoint, "gone") {
		return push.ErrGone
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.sent == nil {
		f.sent = map[string][]string{}
	}
	f.sent[sub.Endpoint] = append(f.sent[sub.Endpoint], string(payload))
	return nil
}
func (f *fakePush) count(endpoint string) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.sent[endpoint])
}

// fakeMailer records outgoing mail so tests can pull links out of it.
type fakeMailer struct {
	mu   sync.Mutex
	sent []sentMail
	on   bool
}
type sentMail struct{ To, Subject, Body string }

func (f *fakeMailer) Enabled() bool { return f.on }
func (f *fakeMailer) Send(_ context.Context, to, subject, body string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sent = append(f.sent, sentMail{to, subject, body})
	return nil
}
func (f *fakeMailer) wait(t *testing.T, n int) []sentMail {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		f.mu.Lock()
		if len(f.sent) >= n {
			out := append([]sentMail(nil), f.sent...)
			f.mu.Unlock()
			return out
		}
		f.mu.Unlock()
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("expected %d mails", n)
	return nil
}

// fakeGoogle maps credential strings to claims.
type fakeGoogle struct{ tokens map[string]auth.GoogleClaims }

func (f *fakeGoogle) Verify(_ context.Context, tok string) (auth.GoogleClaims, error) {
	if c, ok := f.tokens[tok]; ok {
		return c, nil
	}
	return auth.GoogleClaims{}, auth.ErrGoogleToken
}

var linkRe = regexp.MustCompile(`https?://\S+token=([A-Za-z0-9_-]+)`)

func tokenFrom(t *testing.T, body string) string {
	t.Helper()
	m := linkRe.FindStringSubmatch(body)
	if m == nil {
		t.Fatalf("no token link in mail body: %s", body)
	}
	return m[1]
}

func newServer(t *testing.T, mod func(*config.Config)) *testServer {
	t.Helper()
	resetDB(t)
	cfg := testConfig()
	if mod != nil {
		mod(&cfg)
	}
	issuer := auth.NewIssuer(cfg.JWTSecret, cfg.JWTTTL)
	mailer := &fakeMailer{on: true}
	google := &fakeGoogle{tokens: map[string]auth.GoogleClaims{}}
	pusher := &fakePush{}
	h := httpapi.NewRouter(httpapi.Deps{
		Config: cfg, Store: postgres.New(testPool), Issuer: issuer,
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		Mailer: mailer, Google: google, Push: pusher,
	})
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	return &testServer{Server: srv, issuer: issuer, mail: mailer, google: google, push: pusher}
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

func (s *testServer) createTask(t *testing.T, token string, projectID int64, title string) int64 {
	t.Helper()
	res, body := s.do(t, "POST", "/api/tasks", token, map[string]any{"project_id": projectID, "title": title})
	if res.StatusCode != 201 {
		t.Fatalf("create task: %d %s", res.StatusCode, body)
	}
	var out struct {
		ID int64 `json:"id"`
	}
	decode(t, body, &out)
	return out.ID
}

func (s *testServer) sessionWith(t *testing.T, token string, extra map[string]any) (*http.Response, []byte) {
	t.Helper()
	now := time.Now().UTC()
	payload := map[string]any{
		"duration_seconds": 1500, "session_type": "pomodoro", "focus_rating": 4,
		"start_time": now.Add(-25 * time.Minute).Format(time.RFC3339), "end_time": now.Format(time.RFC3339),
	}
	for k, v := range extra {
		payload[k] = v
	}
	return s.do(t, "POST", "/api/sessions", token, payload)
}
