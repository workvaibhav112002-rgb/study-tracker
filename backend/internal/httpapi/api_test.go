package httpapi_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"study-tracker-backend/internal/config"
	"study-tracker-backend/internal/store"
	"study-tracker-backend/internal/store/postgres"
)

func TestHealth(t *testing.T) {
	s := newServer(t, nil)
	res, body := s.do(t, "GET", "/api/health", "", nil)
	wantStatus(t, res.StatusCode, 200, body)
	if !strings.Contains(string(body), `"ok"`) {
		t.Errorf("body %s", body)
	}
}

func TestUnknownRouteIsJSON(t *testing.T) {
	s := newServer(t, nil)
	res, body := s.do(t, "GET", "/api/nope", "", nil)
	wantStatus(t, res.StatusCode, 404, body)
	if errorMessage(t, body) == "" {
		t.Error("expected JSON error envelope")
	}
}

func TestAuthFlow(t *testing.T) {
	s := newServer(t, nil)

	token, _ := s.register(t, "Alice@Example.com ")

	res, body := s.do(t, "POST", "/api/auth/register", "", map[string]string{"email": "alice@example.com", "password": "password123"})
	wantStatus(t, res.StatusCode, 409, body)

	res, body = s.do(t, "POST", "/api/auth/login", "", map[string]string{"email": " ALICE@example.com", "password": "password123"})
	wantStatus(t, res.StatusCode, 200, body)

	res, body = s.do(t, "POST", "/api/auth/login", "", map[string]string{"email": "alice@example.com", "password": "wrong-password"})
	wantStatus(t, res.StatusCode, 401, body)
	wrongMsg := errorMessage(t, body)

	res, body = s.do(t, "POST", "/api/auth/login", "", map[string]string{"email": "nobody@example.com", "password": "password123"})
	wantStatus(t, res.StatusCode, 401, body)
	if errorMessage(t, body) != wrongMsg {
		t.Error("login errors must not distinguish unknown email from wrong password")
	}

	res, body = s.do(t, "GET", "/api/auth/me", token, nil)
	wantStatus(t, res.StatusCode, 200, body)
	if !strings.Contains(string(body), `"alice@example.com"`) || strings.Contains(string(body), "password_hash") || strings.Contains(string(body), "$2a$") {
		t.Errorf("me body: %s", body)
	}

	for name, tok := range map[string]string{"none": "", "garbage": "abc.def.ghi", "tampered": token[:len(token)-3] + "xyz"} {
		res, body = s.do(t, "GET", "/api/auth/me", tok, nil)
		if res.StatusCode != 401 {
			t.Errorf("%s token: status %d %s", name, res.StatusCode, body)
		}
	}

	// A token for a user that no longer exists is rejected.
	resetDB(t)
	res, body = s.do(t, "GET", "/api/auth/me", token, nil)
	wantStatus(t, res.StatusCode, 401, body)
}

func TestRegisterValidation(t *testing.T) {
	s := newServer(t, nil)
	cases := map[string]map[string]string{
		"short password": {"email": "a@b.co", "password": "1234567"},
		"long password":  {"email": "a@b.co", "password": strings.Repeat("x", 73)},
		"bad email":      {"email": "not-an-email", "password": "password123"},
		"display name":   {"email": "Bob <bob@b.co>", "password": "password123"},
		"missing":        {},
	}
	for name, payload := range cases {
		res, body := s.do(t, "POST", "/api/auth/register", "", payload)
		if res.StatusCode != 400 {
			t.Errorf("%s: status %d %s", name, res.StatusCode, body)
		}
	}
	res, body := s.do(t, "POST", "/api/auth/register", "", "{not json")
	wantStatus(t, res.StatusCode, 400, body)
}

func TestNewUserGetsSeedData(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "seed@example.com")
	res, body := s.do(t, "GET", "/api/projects", token, nil)
	wantStatus(t, res.StatusCode, 200, body)
	var projects []store.Project
	decode(t, body, &projects)
	if len(projects) != 3 {
		t.Fatalf("expected 3 seed projects, got %d", len(projects))
	}
	res, body = s.do(t, "GET", "/api/settings", token, nil)
	wantStatus(t, res.StatusCode, 200, body)
	var st store.Settings
	decode(t, body, &st)
	if st != store.DefaultSettings() {
		t.Errorf("settings %+v", st)
	}
}

func TestTenantIsolation(t *testing.T) {
	s := newServer(t, nil)
	alice, _ := s.register(t, "alice@example.com")
	bob, _ := s.register(t, "bob@example.com")
	aliceProject := s.createProject(t, alice, "Alice Only")

	// Bob cannot attach a session to Alice's project and nothing is inserted.
	res, body := s.createSession(t, bob, aliceProject, time.Now().Add(-time.Hour), 1500)
	wantStatus(t, res.StatusCode, 404, body)
	var n int
	if err := testPool.QueryRow(context.Background(), `SELECT count(*) FROM sessions`).Scan(&n); err != nil || n != 0 {
		t.Fatalf("sessions in db: %d (%v)", n, err)
	}

	// Bob cannot see, edit or delete Alice's project.
	res, body = s.do(t, "PUT", "/api/projects/"+itoa(aliceProject), bob, map[string]any{"name": "Hijack", "color": "#000000"})
	wantStatus(t, res.StatusCode, 404, body)
	res, body = s.do(t, "DELETE", "/api/projects/"+itoa(aliceProject), bob, nil)
	wantStatus(t, res.StatusCode, 404, body)
	res, body = s.do(t, "GET", "/api/projects", bob, nil)
	wantStatus(t, res.StatusCode, 200, body)
	if strings.Contains(string(body), "Alice Only") {
		t.Error("bob can see alice's project")
	}

	// Alice logs a session; Bob's views stay empty.
	res, body = s.createSession(t, alice, aliceProject, time.Now().Add(-time.Hour), 1800)
	wantStatus(t, res.StatusCode, 201, body)
	var created store.Session
	decode(t, body, &created)
	if created.ProjectName != "Alice Only" || created.ProjectColor != "#112233" {
		t.Errorf("created session lacks project info: %+v", created)
	}

	res, body = s.do(t, "DELETE", "/api/sessions/"+itoa(created.ID), bob, nil)
	wantStatus(t, res.StatusCode, 404, body)

	res, body = s.do(t, "GET", "/api/sessions", bob, nil)
	wantStatus(t, res.StatusCode, 200, body)
	if strings.TrimSpace(string(body)) != "[]" {
		t.Errorf("bob sessions: %s", body)
	}
	res, body = s.do(t, "GET", "/api/stats/dashboard", bob, nil)
	wantStatus(t, res.StatusCode, 200, body)
	var bobStats store.DashboardStats
	decode(t, body, &bobStats)
	if bobStats.TotalMinutes != 0 || bobStats.CompletedPomodoros != 0 || len(bobStats.ProjectStats) != 0 {
		t.Errorf("bob stats leak: %+v", bobStats)
	}
	res, body = s.do(t, "GET", "/api/export", bob, nil)
	wantStatus(t, res.StatusCode, 200, body)
	if strings.Contains(string(body), "Alice Only") {
		t.Error("export leaks")
	}

	res, body = s.do(t, "GET", "/api/stats/dashboard", alice, nil)
	wantStatus(t, res.StatusCode, 200, body)
	var aliceStats store.DashboardStats
	decode(t, body, &aliceStats)
	if aliceStats.TotalMinutes != 30 || aliceStats.CompletedPomodoros != 1 {
		t.Errorf("alice stats: %+v", aliceStats)
	}

	// Deleting Alice's project cascades to her sessions only.
	res, body = s.do(t, "DELETE", "/api/projects/"+itoa(aliceProject), alice, nil)
	wantStatus(t, res.StatusCode, 204, body)
	res, body = s.do(t, "GET", "/api/sessions", alice, nil)
	wantStatus(t, res.StatusCode, 200, body)
	if strings.TrimSpace(string(body)) != "[]" {
		t.Errorf("sessions survived cascade: %s", body)
	}
}

func TestProjectValidationAndConflicts(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "p@example.com")

	bad := []map[string]any{
		{"name": ""}, {"name": strings.Repeat("n", 101)}, {"name": "ok", "color": "red"},
		{"name": "ok", "target_minutes_per_day": 0}, {"name": "ok", "target_minutes_per_day": 1441},
		{"name": "ok", "description": strings.Repeat("d", 501)}, {"name": "bad\x00name"},
	}
	for _, payload := range bad {
		res, body := s.do(t, "POST", "/api/projects", token, payload)
		if res.StatusCode != 400 {
			t.Errorf("%v: status %d %s", payload, res.StatusCode, body)
		}
	}

	id := s.createProject(t, token, "Dup")
	res, body := s.do(t, "POST", "/api/projects", token, map[string]any{"name": "Dup"})
	wantStatus(t, res.StatusCode, 409, body)

	other := s.createProject(t, token, "Other")
	res, body = s.do(t, "PUT", "/api/projects/"+itoa(other), token, map[string]any{"name": "Dup"})
	wantStatus(t, res.StatusCode, 409, body)

	res, body = s.do(t, "PUT", "/api/projects/"+itoa(id), token, map[string]any{"name": "Renamed", "color": "#abcdef", "target_minutes_per_day": 30})
	wantStatus(t, res.StatusCode, 200, body)
	var p store.Project
	decode(t, body, &p)
	if p.Name != "Renamed" || p.Color != "#abcdef" || p.TargetMinutesPerDay != 30 || p.ID != id {
		t.Errorf("updated: %+v", p)
	}

	res, body = s.do(t, "PUT", "/api/projects/abc", token, map[string]any{"name": "x"})
	wantStatus(t, res.StatusCode, 400, body)
	res, body = s.do(t, "DELETE", "/api/projects/999999", token, nil)
	wantStatus(t, res.StatusCode, 404, body)
}

func TestSessionValidation(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "s@example.com")
	pid := s.createProject(t, token, "P")
	now := time.Now().UTC()
	start := now.Add(-30 * time.Minute).Format(time.RFC3339)
	end := now.Format(time.RFC3339)

	bad := []map[string]any{
		{"project_id": pid, "duration_seconds": 0},
		{"project_id": pid, "duration_seconds": 90000},
		{"project_id": 0, "duration_seconds": 60},
		{"project_id": pid, "duration_seconds": 60, "session_type": "nap"},
		{"project_id": pid, "duration_seconds": 60, "focus_rating": 6},
		{"project_id": pid, "duration_seconds": 60, "start_time": "yesterday"},
		{"project_id": pid, "duration_seconds": 60, "start_time": end, "end_time": start},
		{"project_id": pid, "duration_seconds": 60, "start_time": now.Add(time.Hour).Format(time.RFC3339), "end_time": now.Add(2 * time.Hour).Format(time.RFC3339)},
		{"project_id": pid, "duration_seconds": 60, "notes": strings.Repeat("n", 2001)},
		{"project_id": pid, "duration_seconds": 60, "start_time": now.Add(-10 * time.Hour).Format(time.RFC3339), "end_time": end},
	}
	for _, payload := range bad {
		res, body := s.do(t, "POST", "/api/sessions", token, payload)
		if res.StatusCode != 400 {
			t.Errorf("%v: status %d %s", payload, res.StatusCode, body)
		}
	}

	// Defaults: missing times → ends now; focus 0 → 5; type → pomodoro.
	res, body := s.do(t, "POST", "/api/sessions", token, map[string]any{"project_id": pid, "duration_seconds": 600})
	wantStatus(t, res.StatusCode, 201, body)
	var created store.Session
	decode(t, body, &created)
	if created.FocusRating != 5 || created.SessionType != "pomodoro" || created.EndTime.Sub(created.StartTime) != 10*time.Minute {
		t.Errorf("defaults: %+v", created)
	}

	// Query validation.
	for _, q := range []string{"?limit=abc", "?limit=0", "?project_id=x"} {
		res, body = s.do(t, "GET", "/api/sessions"+q, token, nil)
		if res.StatusCode != 400 {
			t.Errorf("%s: status %d %s", q, res.StatusCode, body)
		}
	}
	res, body = s.do(t, "GET", "/api/sessions?limit=100000&project_id="+itoa(pid), token, nil)
	wantStatus(t, res.StatusCode, 200, body)

	res, body = s.do(t, "DELETE", "/api/sessions/"+itoa(created.ID), token, nil)
	wantStatus(t, res.StatusCode, 204, body)
	res, body = s.do(t, "DELETE", "/api/sessions/"+itoa(created.ID), token, nil)
	wantStatus(t, res.StatusCode, 404, body)
}

func TestBodyTooLarge(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "big@example.com")
	payload := `{"name":"` + strings.Repeat("a", 70*1024) + `"}`
	res, body := s.do(t, "POST", "/api/projects", token, payload)
	wantStatus(t, res.StatusCode, 413, body)
}

func TestRateLimit(t *testing.T) {
	s := newServer(t, func(c *config.Config) {
		c.AuthRateLimit = 2
		c.AuthRateWindow = time.Minute
		c.FeedbackRateLimit = 1
		c.FeedbackRateWindow = time.Minute
	})
	creds := map[string]string{"email": "x@example.com", "password": "password123"}
	for i := 0; i < 2; i++ {
		res, body := s.do(t, "POST", "/api/auth/login", "", creds)
		wantStatus(t, res.StatusCode, 401, body)
	}
	res, body := s.do(t, "POST", "/api/auth/login", "", creds)
	wantStatus(t, res.StatusCode, 429, body)
	if errorMessage(t, body) == "" {
		t.Error("429 should carry JSON envelope")
	}

	fb := map[string]string{"message": "hi"}
	res, body = s.do(t, "POST", "/api/feedback", "", fb)
	wantStatus(t, res.StatusCode, 201, body)
	res, body = s.do(t, "POST", "/api/feedback", "", fb)
	wantStatus(t, res.StatusCode, 429, body)
}

func TestSettingsRoundTrip(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "set@example.com")
	want := store.Settings{WorkDuration: 50, ShortBreakDuration: 10, LongBreakDuration: 30, LongBreakInterval: 3, AutoStartBreaks: true, SoundEnabled: false, ReminderHour: 8, Timezone: "UTC"}
	res, body := s.do(t, "POST", "/api/settings", token, want)
	wantStatus(t, res.StatusCode, 200, body)
	res, body = s.do(t, "GET", "/api/settings", token, nil)
	wantStatus(t, res.StatusCode, 200, body)
	var got store.Settings
	decode(t, body, &got)
	if got != want {
		t.Errorf("got %+v want %+v", got, want)
	}
	for _, bad := range []store.Settings{
		{WorkDuration: 0, ShortBreakDuration: 5, LongBreakDuration: 15, LongBreakInterval: 4},
		{WorkDuration: 25, ShortBreakDuration: 61, LongBreakDuration: 15, LongBreakInterval: 4},
		{WorkDuration: 25, ShortBreakDuration: 5, LongBreakDuration: 15, LongBreakInterval: 13},
	} {
		res, body = s.do(t, "POST", "/api/settings", token, bad)
		if res.StatusCode != 400 {
			t.Errorf("%+v: status %d %s", bad, res.StatusCode, body)
		}
	}
}

func TestStatsTimezoneAndStreak(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "tz@example.com")
	pid := s.createProject(t, token, "TZ")

	// 22:30 UTC today is already "tomorrow" in Asia/Kolkata (UTC+5:30).
	// To keep the test deterministic we anchor on a fixed instant in the past
	// and check the daily trend buckets rather than "today".
	anchor := time.Date(2026, 10, 20, 22, 30, 0, 0, time.UTC)
	res, body := s.createSession(t, token, pid, anchor, 600)
	wantStatus(t, res.StatusCode, 201, body)

	res, body = s.do(t, "GET", "/api/stats/dashboard?tz=UTC", token, nil)
	wantStatus(t, res.StatusCode, 200, body)
	var utc store.DashboardStats
	decode(t, body, &utc)
	res, body = s.do(t, "GET", "/api/stats/dashboard?tz=Asia/Kolkata", token, nil)
	wantStatus(t, res.StatusCode, 200, body)
	var ist store.DashboardStats
	decode(t, body, &ist)

	if minutesOn(utc, "2026-10-20") != 10 || minutesOn(utc, "2026-10-21") != 0 {
		t.Errorf("utc trend: %+v", utc.DailyTrend)
	}
	if minutesOn(ist, "2026-10-21") != 10 || minutesOn(ist, "2026-10-20") != 0 {
		t.Errorf("ist trend: %+v", ist.DailyTrend)
	}
	if len(utc.DailyTrend) != 14 || utc.DailyTrend[0].Date >= utc.DailyTrend[13].Date {
		t.Errorf("trend shape: %+v", utc.DailyTrend)
	}

	res, body = s.do(t, "GET", "/api/stats/dashboard?tz=Mars/Olympus", token, nil)
	wantStatus(t, res.StatusCode, 400, body)

	// Streak: sessions today, yesterday, two days ago → 3; a gap resets.
	resetDB(t)
	token, _ = s.register(t, "streak@example.com")
	pid = s.createProject(t, token, "S")
	now := time.Now().UTC()
	for _, d := range []int{0, 1, 2, 4} {
		res, body = s.createSession(t, token, pid, now.Add(-time.Duration(d)*24*time.Hour-time.Hour), 300)
		wantStatus(t, res.StatusCode, 201, body)
	}
	res, body = s.do(t, "GET", "/api/stats/dashboard?tz=UTC", token, nil)
	wantStatus(t, res.StatusCode, 200, body)
	var st store.DashboardStats
	decode(t, body, &st)
	// Depending on the hour, "-1h" may fall on the previous UTC day; both
	// layouts produce an unbroken run of 3 ending today or yesterday.
	if st.CurrentStreakDays != 3 {
		t.Errorf("streak %d, trend %+v", st.CurrentStreakDays, st.DailyTrend)
	}
	if st.TodayMinutes+minutesOn(st, now.Add(-24*time.Hour).Format("2006-01-02")) < 5 {
		t.Errorf("expected recent minutes: %+v", st)
	}
}

func TestExportAndFeedback(t *testing.T) {
	s := newServer(t, nil)
	token, uid := s.register(t, "exp@example.com")
	pid := s.createProject(t, token, "Exported")
	res, body := s.createSession(t, token, pid, time.Now().Add(-time.Hour), 900)
	wantStatus(t, res.StatusCode, 201, body)

	res, body = s.do(t, "GET", "/api/export", token, nil)
	wantStatus(t, res.StatusCode, 200, body)
	if cd := res.Header.Get("Content-Disposition"); !strings.HasPrefix(cd, `attachment; filename="study_tracker_backup_`) {
		t.Errorf("content-disposition %q", cd)
	}
	var exp store.Export
	decode(t, body, &exp)
	if len(exp.Projects) != 4 || len(exp.Sessions) != 1 || exp.User.Email != "exp@example.com" || strings.Contains(string(body), "password_hash") || strings.Contains(string(body), "$2a$") {
		t.Errorf("export: %d projects %d sessions", len(exp.Projects), len(exp.Sessions))
	}

	res, body = s.do(t, "POST", "/api/feedback", "", map[string]string{"message": "anon", "type": "bug", "email": "a@b.co"})
	wantStatus(t, res.StatusCode, 201, body)
	res, body = s.do(t, "POST", "/api/feedback", token, map[string]string{"message": "signed"})
	wantStatus(t, res.StatusCode, 201, body)
	res, body = s.do(t, "POST", "/api/feedback", token, map[string]string{"message": "x", "type": "rant"})
	wantStatus(t, res.StatusCode, 400, body)
	res, body = s.do(t, "POST", "/api/feedback", token, map[string]string{"message": ""})
	wantStatus(t, res.StatusCode, 400, body)

	var anonUser *int64
	var signedUser *int64
	_ = testPool.QueryRow(context.Background(), `SELECT user_id FROM feedback WHERE message='anon'`).Scan(&anonUser)
	_ = testPool.QueryRow(context.Background(), `SELECT user_id FROM feedback WHERE message='signed'`).Scan(&signedUser)
	if anonUser != nil || signedUser == nil || *signedUser != uid {
		t.Errorf("feedback user ids: anon=%v signed=%v want %d", anonUser, signedUser, uid)
	}
}

func TestCORS(t *testing.T) {
	s := newServer(t, nil)
	for origin, allowed := range map[string]bool{"https://my-app.vercel.app": true, "http://localhost:5173": true, "https://evil.example": false} {
		req, _ := newRequest("OPTIONS", s.URL+"/api/projects")
		req.Header.Set("Origin", origin)
		req.Header.Set("Access-Control-Request-Method", "GET")
		res, err := s.Client().Do(req)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		got := res.Header.Get("Access-Control-Allow-Origin") == origin
		if got != allowed {
			t.Errorf("origin %s allowed=%v want %v", origin, got, allowed)
		}
	}
}

func TestCORSDeniedWithoutAllowList(t *testing.T) {
	s := newServer(t, func(c *config.Config) { c.CORSOrigins = nil })
	req, _ := newRequest("OPTIONS", s.URL+"/api/projects")
	req.Header.Set("Origin", "https://evil.example")
	req.Header.Set("Access-Control-Request-Method", "GET")
	res, err := s.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if got := res.Header.Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("expected no CORS headers without an allow-list, got %q", got)
	}
}

func TestMigrateIsIdempotent(t *testing.T) {
	ctx := context.Background()
	if err := postgres.Migrate(ctx, testPool); err != nil {
		t.Fatal(err)
	}
	var n int
	if err := testPool.QueryRow(ctx, `SELECT count(*) FROM schema_migrations`).Scan(&n); err != nil || n != 6 {
		t.Fatalf("schema_migrations rows=%d err=%v", n, err)
	}
}

func minutesOn(s store.DashboardStats, date string) int {
	for _, d := range s.DailyTrend {
		if d.Date == date {
			return d.Minutes
		}
	}
	return -1
}
