package httpapi_test

import (
	"strings"
	"testing"
	"time"

	"study-tracker-backend/internal/store"
)

func TestWeeklyReview(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "review@example.com")
	pid := s.createProject(t, token, "Go")
	pid2 := s.createProject(t, token, "DSA")

	// Last complete Monday–Sunday week in UTC.
	now := time.Now().UTC()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	offset := (int(today.Weekday()) + 6) % 7
	thisMonday := today.AddDate(0, 0, -offset)
	lastMonday := thisMonday.AddDate(0, 0, -7)

	// Tue: 50m on Go, Thu: 25m on Go + 25m on DSA, previous week Wed: 30m.
	mk := func(day time.Time, hour int, pid int64, mins int) {
		res, body := s.createSession(t, token, pid, day.Add(time.Duration(hour)*time.Hour), mins*60)
		wantStatus(t, res.StatusCode, 201, body)
	}
	mk(lastMonday.AddDate(0, 0, 1), 9, pid, 50)
	mk(lastMonday.AddDate(0, 0, 3), 9, pid, 25)
	mk(lastMonday.AddDate(0, 0, 3), 14, pid2, 25)
	mk(lastMonday.AddDate(0, 0, -5), 9, pid, 30)

	res, body := s.do(t, "GET", "/api/stats/weekly-review?tz=UTC", token, nil)
	wantStatus(t, res.StatusCode, 200, body)
	var r store.WeeklyReview
	decode(t, body, &r)
	if r.WeekStart != lastMonday.Format("2006-01-02") || r.Minutes != 100 || r.PreviousMinutes != 30 || r.Sessions != 3 || r.ActiveDays != 2 {
		t.Fatalf("review: %+v", r)
	}
	if r.BestDay == nil || r.BestDay.Minutes != 50 || r.TopProject == nil || r.TopProject.Name != "Go" || r.TopProjectShare != 75 || r.BestHour == nil || *r.BestHour != 9 {
		t.Fatalf("review details: best=%+v top=%+v share=%v hour=%v", r.BestDay, r.TopProject, r.TopProjectShare, r.BestHour)
	}
	if r.DeltaPercent == nil || *r.DeltaPercent != 233.3 || len(r.Days) != 7 || len(r.Insights) < 2 {
		t.Fatalf("review delta/days/insights: %+v", r)
	}
	if !strings.Contains(strings.Join(r.Insights, " "), "up 233%") {
		t.Errorf("insights: %v", r.Insights)
	}

	// Empty week for a fresh user.
	fresh, _ := s.register(t, "fresh@example.com")
	res, body = s.do(t, "GET", "/api/stats/weekly-review", fresh, nil)
	wantStatus(t, res.StatusCode, 200, body)
	decode(t, body, &r)
	if r.Minutes != 0 || len(r.Insights) != 1 || r.BestDay != nil {
		t.Fatalf("empty review: %+v", r)
	}
}

func TestTimerSync(t *testing.T) {
	s := newServer(t, nil)
	alice, _ := s.register(t, "ta@example.com")
	bob, _ := s.register(t, "tb@example.com")

	res, body := s.do(t, "GET", "/api/timer", alice, nil)
	wantStatus(t, res.StatusCode, 200, body)
	if !strings.Contains(string(body), `"state":null`) {
		t.Fatalf("empty timer: %s", body)
	}

	res, body = s.do(t, "PUT", "/api/timer", alice, map[string]any{"state": map[string]any{"mode": "work", "status": "running"}, "updated_at": 1000})
	wantStatus(t, res.StatusCode, 200, body)
	// Older write loses, newer wins.
	res, body = s.do(t, "PUT", "/api/timer", alice, map[string]any{"state": map[string]any{"mode": "old"}, "updated_at": 500})
	wantStatus(t, res.StatusCode, 200, body)
	if !strings.Contains(string(body), `"running"`) || !strings.Contains(string(body), `"updated_at":1000`) {
		t.Fatalf("stale write should lose: %s", body)
	}
	res, body = s.do(t, "PUT", "/api/timer", alice, map[string]any{"state": map[string]any{"mode": "short_break"}, "updated_at": 2000})
	wantStatus(t, res.StatusCode, 200, body)
	res, body = s.do(t, "GET", "/api/timer", alice, nil)
	if !strings.Contains(string(body), `"short_break"`) {
		t.Fatalf("get after newer write: %s", body)
	}
	res, body = s.do(t, "GET", "/api/timer", bob, nil)
	if !strings.Contains(string(body), `"state":null`) {
		t.Fatalf("timer leaked across users: %s", body)
	}
	for _, bad := range []map[string]any{{"state": "x", "updated_at": 1}, {"state": map[string]any{}, "updated_at": 0}, {"state": []int{1}, "updated_at": 1}} {
		res, body = s.do(t, "PUT", "/api/timer", alice, bad)
		if res.StatusCode != 400 {
			t.Errorf("%v: status %d %s", bad, res.StatusCode, body)
		}
	}
}
