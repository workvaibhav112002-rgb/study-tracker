package httpapi_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"study-tracker-backend/internal/config"
	"study-tracker-backend/internal/store"
)

func TestChangePasswordInvalidatesOldToken(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "pw@example.com")

	res, body := s.do(t, "POST", "/api/auth/change-password", token, map[string]string{"current_password": "wrong-password", "new_password": "newpassword123"})
	wantStatus(t, res.StatusCode, 401, body)
	res, body = s.do(t, "POST", "/api/auth/change-password", token, map[string]string{"current_password": "password123", "new_password": "password123"})
	wantStatus(t, res.StatusCode, 400, body)
	res, body = s.do(t, "POST", "/api/auth/change-password", token, map[string]string{"current_password": "password123", "new_password": "short"})
	wantStatus(t, res.StatusCode, 400, body)

	res, body = s.do(t, "POST", "/api/auth/change-password", token, map[string]string{"current_password": "password123", "new_password": "newpassword123"})
	wantStatus(t, res.StatusCode, 200, body)
	var out struct {
		Token string `json:"token"`
	}
	decode(t, body, &out)
	if out.Token == "" || out.Token == token || strings.Contains(string(body), "password_hash") {
		t.Fatalf("bad response: %s", body)
	}

	res, body = s.do(t, "GET", "/api/auth/me", token, nil)
	wantStatus(t, res.StatusCode, 401, body)
	res, body = s.do(t, "GET", "/api/auth/me", out.Token, nil)
	wantStatus(t, res.StatusCode, 200, body)
	res, body = s.do(t, "POST", "/api/auth/login", "", map[string]string{"email": "pw@example.com", "password": "password123"})
	wantStatus(t, res.StatusCode, 401, body)
	res, body = s.do(t, "POST", "/api/auth/login", "", map[string]string{"email": "pw@example.com", "password": "newpassword123"})
	wantStatus(t, res.StatusCode, 200, body)
}

func TestDeleteAccount(t *testing.T) {
	s := newServer(t, nil)
	token, uid := s.register(t, "bye@example.com")
	pid := s.createProject(t, token, "P")
	s.createTask(t, token, pid, "t")
	res, body := s.createSession(t, token, pid, time.Now().Add(-time.Hour), 600)
	wantStatus(t, res.StatusCode, 201, body)
	res, body = s.do(t, "POST", "/api/feedback", token, map[string]string{"message": "bye"})
	wantStatus(t, res.StatusCode, 201, body)

	res, body = s.do(t, "DELETE", "/api/auth/me", token, map[string]string{"password": "nope-nope-nope"})
	wantStatus(t, res.StatusCode, 401, body)
	res, body = s.do(t, "DELETE", "/api/auth/me", token, map[string]string{"password": "password123"})
	wantStatus(t, res.StatusCode, 204, body)
	res, body = s.do(t, "GET", "/api/auth/me", token, nil)
	wantStatus(t, res.StatusCode, 401, body)
	res, body = s.do(t, "POST", "/api/auth/login", "", map[string]string{"email": "bye@example.com", "password": "password123"})
	wantStatus(t, res.StatusCode, 401, body)

	ctx := context.Background()
	for _, table := range []string{"projects", "sessions", "tasks", "settings"} {
		var n int
		_ = testPool.QueryRow(ctx, `SELECT count(*) FROM `+table+` WHERE user_id = $1`, uid).Scan(&n)
		if n != 0 {
			t.Errorf("%s rows remain: %d", table, n)
		}
	}
	var fbUser *int64
	_ = testPool.QueryRow(ctx, `SELECT user_id FROM feedback WHERE message='bye'`).Scan(&fbUser)
	if fbUser != nil {
		t.Error("feedback user_id not nulled")
	}
}

func TestCalendarTokenFlow(t *testing.T) {
	s := newServer(t, nil)
	alice, _ := s.register(t, "cal@example.com")
	bob, _ := s.register(t, "bob5@example.com")
	ap := s.createProject(t, alice, "Alice Proj")
	bp := s.createProject(t, bob, "Bob Proj")
	res, body := s.sessionWith(t, alice, map[string]any{"project_id": ap, "notes": "line one\nsemi; comma, back\\slash", "interruptions": 1})
	wantStatus(t, res.StatusCode, 201, body)
	var sess store.Session
	decode(t, body, &sess)
	res, body = s.createSession(t, alice, ap, time.Now().AddDate(0, 0, -200), 600)
	wantStatus(t, res.StatusCode, 201, body)
	res, body = s.createSession(t, bob, bp, time.Now().Add(-time.Hour), 600)
	wantStatus(t, res.StatusCode, 201, body)

	res, body = s.do(t, "GET", "/api/auth/me", alice, nil)
	if !strings.Contains(string(body), `"has_calendar_token":false`) {
		t.Fatalf("me before token: %s", body)
	}

	res, body = s.do(t, "POST", "/api/auth/calendar-token", alice, nil)
	wantStatus(t, res.StatusCode, 201, body)
	var tok struct {
		Token string `json:"token"`
		URL   string `json:"url"`
	}
	decode(t, body, &tok)
	if len(tok.Token) != 43 || !strings.HasSuffix(tok.URL, tok.Token+".ics") {
		t.Fatalf("token response: %+v", tok)
	}
	res, body = s.do(t, "GET", "/api/auth/me", alice, nil)
	if !strings.Contains(string(body), `"has_calendar_token":true`) {
		t.Fatalf("me after token: %s", body)
	}

	res, body = s.do(t, "GET", "/api/calendar/"+tok.Token+".ics", "", nil)
	wantStatus(t, res.StatusCode, 200, body)
	ics := strings.ReplaceAll(string(body), "\r\n ", "") // unfold for assertions
	if ct := res.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/calendar") {
		t.Errorf("content-type %q", ct)
	}
	for _, want := range []string{"BEGIN:VCALENDAR", "UID:" + itoa(sess.ID) + "@study-tracker", "SUMMARY:Focus: Alice Proj", `line one\nsemi\; comma\, back\\slash\nFocus rating: 4/5\nInterruptions: 1`, "\r\n"} {
		if !strings.Contains(ics, want) {
			t.Errorf("ics missing %q:\n%s", want, ics)
		}
	}
	if strings.Contains(ics, "Bob Proj") {
		t.Error("feed leaks another user's sessions")
	}
	if strings.Count(ics, "BEGIN:VEVENT") != 1 {
		t.Errorf("expected 1 event (old one excluded), got %d", strings.Count(ics, "BEGIN:VEVENT"))
	}

	old := tok.Token
	res, body = s.do(t, "POST", "/api/auth/calendar-token", alice, nil)
	wantStatus(t, res.StatusCode, 201, body)
	decode(t, body, &tok)
	res, body = s.do(t, "GET", "/api/calendar/"+old+".ics", "", nil)
	wantStatus(t, res.StatusCode, 404, body)
	res, body = s.do(t, "GET", "/api/calendar/"+tok.Token+".ics", "", nil)
	wantStatus(t, res.StatusCode, 200, body)

	res, body = s.do(t, "DELETE", "/api/auth/calendar-token", alice, nil)
	wantStatus(t, res.StatusCode, 204, body)
	res, body = s.do(t, "GET", "/api/calendar/"+tok.Token+".ics", "", nil)
	wantStatus(t, res.StatusCode, 404, body)
	res, body = s.do(t, "DELETE", "/api/auth/calendar-token", alice, nil)
	wantStatus(t, res.StatusCode, 404, body)
	for _, garbage := range []string{"x.ics", strings.Repeat("a", 43), "../export.ics"} {
		res, _ = s.do(t, "GET", "/api/calendar/"+garbage, "", nil)
		if res.StatusCode != 404 {
			t.Errorf("%q: status %d", garbage, res.StatusCode)
		}
	}
}

func TestCalendarRateLimit(t *testing.T) {
	s := newServer(t, func(c *config.Config) { c.CalendarRateLimit = 2; c.CalendarRateWindow = time.Minute })
	for i := 0; i < 2; i++ {
		res, _ := s.do(t, "GET", "/api/calendar/"+strings.Repeat("a", 43)+".ics", "", nil)
		if res.StatusCode != 404 {
			t.Fatalf("attempt %d: %d", i, res.StatusCode)
		}
	}
	res, body := s.do(t, "GET", "/api/calendar/"+strings.Repeat("a", 43)+".ics", "", nil)
	wantStatus(t, res.StatusCode, 429, body)
}

func TestImportRoundTrip(t *testing.T) {
	s := newServer(t, nil)
	alice, _ := s.register(t, "exp@example.com")
	bob, _ := s.register(t, "imp@example.com")
	ap := s.createProject(t, alice, "Shared Name")
	res, body := s.sessionWith(t, alice, map[string]any{"project_id": ap, "notes": "imported", "interruptions": 2})
	wantStatus(t, res.StatusCode, 201, body)

	res, body = s.do(t, "GET", "/api/export", alice, nil)
	wantStatus(t, res.StatusCode, 200, body)
	var exported map[string]any
	decode(t, body, &exported)
	payload := map[string]any{"projects": exported["projects"], "sessions": exported["sessions"]}

	res, body = s.do(t, "POST", "/api/import", bob, payload)
	wantStatus(t, res.StatusCode, 201, body)
	var result store.ImportResult
	decode(t, body, &result)
	// Bob already has the 3 seed projects; Alice's export has 3 seeds + "Shared Name".
	if result.ProjectsCreated != 1 || result.ProjectsUpdated != 3 || result.SessionsInserted != 1 || result.SessionsSkipped != 0 {
		t.Fatalf("first import: %+v", result)
	}
	res, body = s.do(t, "GET", "/api/sessions", bob, nil)
	if !strings.Contains(string(body), `"notes":"imported"`) || !strings.Contains(string(body), `"interruptions":2`) {
		t.Fatalf("bob sessions: %s", body)
	}

	res, body = s.do(t, "POST", "/api/import", bob, payload)
	wantStatus(t, res.StatusCode, 201, body)
	decode(t, body, &result)
	if result.SessionsInserted != 0 || result.SessionsSkipped != 1 || result.ProjectsCreated != 0 || result.ProjectsUpdated != 4 {
		t.Fatalf("second import: %+v", result)
	}

	for name, bad := range map[string]map[string]any{
		"unknown project": {"projects": []map[string]any{{"name": "X"}}, "sessions": []map[string]any{{"project_name": "Y", "duration_seconds": 60}}},
		"bad color":       {"projects": []map[string]any{{"name": "X", "color": "red"}}, "sessions": []any{}},
		"no projects":     {"projects": []any{}, "sessions": []any{}},
		"dup project":     {"projects": []map[string]any{{"name": "X"}, {"name": "X"}}, "sessions": []any{}},
	} {
		res, body = s.do(t, "POST", "/api/import", bob, bad)
		if res.StatusCode != 400 {
			t.Errorf("%s: status %d %s", name, res.StatusCode, body)
		}
	}

	// Per-route body limit: 100 KB import is fine, 100 KB project is not.
	big := strings.Repeat("a", 100*1024)
	res, body = s.do(t, "POST", "/api/import", bob, map[string]any{"projects": []map[string]any{{"name": "Big", "description": big[:400]}}, "sessions": []any{}, "padding": big})
	wantStatus(t, res.StatusCode, 201, body)
	res, body = s.do(t, "POST", "/api/projects", bob, map[string]any{"name": "Big2", "padding": big})
	wantStatus(t, res.StatusCode, 413, body)
}
