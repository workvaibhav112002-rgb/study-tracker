package httpapi_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"study-tracker-backend/internal/config"
	"testing"
	"time"
)

type streakResp struct {
	Days            int      `json:"days"`
	BestDays        int      `json:"best_days"`
	TargetMinutes   int      `json:"target_minutes"`
	TodayMet        bool     `json:"today_met"`
	YesterdayMet    bool     `json:"yesterday_met"`
	FreezeAvailable bool     `json:"freeze_available"`
	FreezeDays      []string `json:"freeze_days"`
}

// clearProjects removes the seed projects (which carry daily targets).
func clearProjects(t *testing.T, s *testServer, token string) {
	t.Helper()
	res0, body0 := s.do(t, "GET", "/api/projects", token, nil)
	if res0.StatusCode != 200 {
		t.Fatalf("list projects: %d %s", res0.StatusCode, body0)
	}
	var existing []struct {
		ID int64 `json:"id"`
	}
	decode(t, body0, &existing)
	for _, p := range existing {
		if res, body := s.do(t, "DELETE", "/api/projects/"+itoa(p.ID), token, nil); res.StatusCode != 204 {
			t.Fatalf("delete seed project: %d %s", res.StatusCode, body)
		}
	}
}

func goalProject(t *testing.T, s *testServer, token string, target int) int64 {
	t.Helper()
	clearProjects(t, s, token)
	res, body := s.do(t, "POST", "/api/projects", token, map[string]any{"name": "Goal", "color": "#112233", "target_minutes_per_day": target})
	if res.StatusCode != 201 {
		t.Fatalf("create project: %d %s", res.StatusCode, body)
	}
	var p struct {
		ID int64 `json:"id"`
	}
	decode(t, body, &p)
	return p.ID
}

func getStreak(t *testing.T, s *testServer, token string) streakResp {
	t.Helper()
	res, body := s.do(t, "GET", "/api/stats/streak?tz=UTC", token, nil)
	if res.StatusCode != 200 {
		t.Fatalf("streak: %d %s", res.StatusCode, body)
	}
	var out streakResp
	decode(t, body, &out)
	return out
}

func TestGoalStreakAndFreeze(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "streak@example.test")
	pid := goalProject(t, s, token, 30)

	// No sessions: zero streak, freeze cannot be used (nothing met).
	st := getStreak(t, s, token)
	if st.Days != 0 || st.TargetMinutes != 30 || st.TodayMet {
		t.Fatalf("empty streak: %+v", st)
	}

	// Sessions: today, yesterday, and 3 days ago (gap at 2 days ago).
	// A 30-minute session that ended 10 minutes ago, repeated on earlier days.
	noon := time.Now().UTC().Add(-40 * time.Minute)
	for _, back := range []int{0, 1, 3} {
		if res, body := s.createSession(t, token, pid, noon.AddDate(0, 0, -back), 1800); res.StatusCode != 201 {
			t.Fatalf("session: %d %s", res.StatusCode, body)
		}
	}
	st = getStreak(t, s, token)
	if st.Days != 2 || !st.TodayMet || !st.YesterdayMet || st.BestDays != 2 {
		t.Fatalf("streak after sessions: %+v", st)
	}

	// Yesterday met: freeze refused.
	res, body := s.do(t, "POST", "/api/stats/streak/freeze?tz=UTC", token, nil)
	if res.StatusCode != 400 {
		t.Fatalf("freeze with yesterday met: %d %s", res.StatusCode, body)
	}

	// A user who missed yesterday can freeze once per week.
	token2, _ := s.register(t, "freeze@example.test")
	pid2 := goalProject(t, s, token2, 30)
	for _, back := range []int{0, 2, 3} {
		s.createSession(t, token2, pid2, noon.AddDate(0, 0, -back), 1800)
	}
	st = getStreak(t, s, token2)
	if st.Days != 1 || st.YesterdayMet || !st.FreezeAvailable {
		t.Fatalf("before freeze: %+v", st)
	}
	res, body = s.do(t, "POST", "/api/stats/streak/freeze?tz=UTC", token2, nil)
	if res.StatusCode != 200 {
		t.Fatalf("freeze: %d %s", res.StatusCode, body)
	}
	decode(t, body, &st)
	if st.Days != 4 || !st.YesterdayMet || len(st.FreezeDays) != 1 || st.BestDays != 4 {
		t.Fatalf("after freeze: %+v", st)
	}
	yesterday := noon.AddDate(0, 0, -1).Format("2006-01-02")
	if st.FreezeDays[0] != yesterday {
		t.Fatalf("freeze day %q want %q", st.FreezeDays[0], yesterday)
	}
	// Freeze availability depends on ISO week; it is only guaranteed to be
	// consumed when yesterday falls in the same ISO week as today.
	_, wToday := noon.ISOWeek()
	_, wYest := noon.AddDate(0, 0, -1).ISOWeek()
	if wToday == wYest && st.FreezeAvailable {
		t.Fatalf("freeze should be spent for this week: %+v", st)
	}

	// Freezing again is refused (yesterday now counts as met).
	res, body = s.do(t, "POST", "/api/stats/streak/freeze?tz=UTC", token2, nil)
	if res.StatusCode != 400 {
		t.Fatalf("second freeze: %d %s", res.StatusCode, body)
	}

	// User 1 never sees user 2's freezes.
	if st := getStreak(t, s, token); len(st.FreezeDays) != 0 {
		t.Fatalf("freeze leaked: %+v", st)
	}

	// No goal at all: freeze is refused with a hint.
	token3, _ := s.register(t, "nogoal@example.test")
	clearProjects(t, s, token3)
	res, body = s.do(t, "POST", "/api/stats/streak/freeze", token3, nil)
	if res.StatusCode != 400 || !strings.Contains(string(body), "daily goal") {
		t.Fatalf("freeze without goal: %d %s", res.StatusCode, body)
	}
}

func TestMilestones(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "badge@example.test")
	res, body := s.do(t, "GET", "/api/stats/milestones", token, nil)
	if res.StatusCode != 200 {
		t.Fatalf("milestones: %d %s", res.StatusCode, body)
	}
	var ms []struct {
		ID         string  `json:"id"`
		Target     int     `json:"target"`
		Progress   int     `json:"progress"`
		Achieved   bool    `json:"achieved"`
		AchievedAt *string `json:"achieved_at"`
	}
	decode(t, body, &ms)
	if len(ms) < 10 {
		t.Fatalf("expected a full badge list, got %d", len(ms))
	}
	for _, m := range ms {
		if m.Achieved || m.Progress != 0 {
			t.Fatalf("fresh account should have nothing: %+v", m)
		}
	}

	pid := s.createProject(t, token, "P")
	for i := 0; i < 10; i++ {
		if res, body := s.createSession(t, token, pid, time.Now().Add(-time.Duration(i+1)*time.Hour), 1500); res.StatusCode != 201 {
			t.Fatalf("session: %d %s", res.StatusCode, body)
		}
	}
	res, body = s.do(t, "GET", "/api/stats/milestones", token, nil)
	decode(t, body, &ms)
	byID := map[string]int{}
	for i, m := range ms {
		byID[m.ID] = i
	}
	if m := ms[byID["first-session"]]; !m.Achieved || m.AchievedAt == nil {
		t.Fatalf("first-session: %+v", m)
	}
	if m := ms[byID["pomodoros-10"]]; !m.Achieved || m.Progress != 10 {
		t.Fatalf("pomodoros-10: %+v", m)
	}
	if m := ms[byID["pomodoros-50"]]; m.Achieved || m.Progress != 10 {
		t.Fatalf("pomodoros-50: %+v", m)
	}
	// 10 × 25 min = 250 min, short of the 600 for "hours-10".
	if m := ms[byID["hours-10"]]; m.Achieved || m.Progress != 250 {
		t.Fatalf("hours-10: %+v", m)
	}
}

func TestSettingsReminderFields(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "remind@example.test")
	base := map[string]any{"work_duration": 25, "short_break_duration": 5, "long_break_duration": 15, "long_break_interval": 4, "sound_enabled": true}

	res, body := s.do(t, "GET", "/api/settings", token, nil)
	if res.StatusCode != 200 || !strings.Contains(string(body), `"timezone":"UTC"`) || !strings.Contains(string(body), `"reminder_hour":9`) {
		t.Fatalf("defaults: %d %s", res.StatusCode, body)
	}

	ok := map[string]any{"reminder_enabled": true, "reminder_hour": 20, "timezone": "Asia/Kolkata"}
	for k, v := range base {
		ok[k] = v
	}
	res, body = s.do(t, "POST", "/api/settings", token, ok)
	if res.StatusCode != 200 || !strings.Contains(string(body), `"timezone":"Asia/Kolkata"`) || !strings.Contains(string(body), `"reminder_enabled":true`) {
		t.Fatalf("save: %d %s", res.StatusCode, body)
	}

	for _, bad := range []map[string]any{{"reminder_hour": 24}, {"reminder_hour": -1}, {"timezone": "Mars/Olympus"}, {"timezone": "utc"}} {
		in := map[string]any{}
		for k, v := range base {
			in[k] = v
		}
		for k, v := range bad {
			in[k] = v
		}
		if res, body := s.do(t, "POST", "/api/settings", token, in); res.StatusCode != 400 {
			t.Fatalf("expected 400 for %v: %d %s", bad, res.StatusCode, body)
		}
	}
}

func TestPushSubscribeAndReminders(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "push@example.test")

	// Config advertises the public key.
	res, body := s.do(t, "GET", "/api/config", "", nil)
	if res.StatusCode != 200 || !strings.Contains(string(body), `"vapid_public_key":"test-public"`) {
		t.Fatalf("config: %d %s", res.StatusCode, body)
	}

	sub := func(endpoint string) map[string]any {
		return map[string]any{"endpoint": endpoint, "keys": map[string]string{"p256dh": "p", "auth": "a"}}
	}
	for _, bad := range []map[string]any{
		{"endpoint": "http://insecure.example/x", "keys": map[string]string{"p256dh": "p", "auth": "a"}},
		{"endpoint": "https://push.example/x", "keys": map[string]string{"p256dh": "", "auth": "a"}},
	} {
		if res, body := s.do(t, "POST", "/api/push/subscribe", token, bad); res.StatusCode != 400 {
			t.Fatalf("expected 400: %d %s", res.StatusCode, body)
		}
	}
	live := "https://push.example/live"
	gone := "https://push.example/gone"
	for _, e := range []string{live, gone} {
		if res, body := s.do(t, "POST", "/api/push/subscribe", token, sub(e)); res.StatusCode != 204 {
			t.Fatalf("subscribe: %d %s", res.StatusCode, body)
		}
	}
	// Re-subscribing the same endpoint is idempotent.
	if res, _ := s.do(t, "POST", "/api/push/subscribe", token, sub(live)); res.StatusCode != 204 {
		t.Fatalf("resubscribe: %d", res.StatusCode)
	}
	if res, _ := s.do(t, "POST", "/api/push/subscribe", "", sub(live)); res.StatusCode != 401 {
		t.Fatalf("anonymous subscribe: %d", res.StatusCode)
	}

	// Cron auth.
	cron := func(secret string, at time.Time) (int, map[string]any) {
		req, _ := http.NewRequest("POST", s.URL+"/api/cron/reminders?now="+at.UTC().Format(time.RFC3339), nil)
		if secret != "" {
			req.Header.Set("Authorization", "Bearer "+secret)
		}
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		var out map[string]any
		_ = json.NewDecoder(res.Body).Decode(&out)
		return res.StatusCode, out
	}
	if code, _ := cron("", time.Now()); code != 401 {
		t.Fatalf("no secret: %d", code)
	}
	if code, _ := cron("wrong", time.Now()); code != 401 {
		t.Fatalf("wrong secret: %d", code)
	}

	// Reminders off: nothing is sent.
	at := time.Date(2026, 3, 10, 9, 30, 0, 0, time.UTC) // 15:00 in Asia/Kolkata
	if code, out := cron("cron-secret-for-tests", at); code != 200 || out["sent"].(float64) != 0 {
		t.Fatalf("reminders off: %d %v", code, out)
	}

	// Enable reminders at 15:00 Kolkata.
	settings := map[string]any{"work_duration": 25, "short_break_duration": 5, "long_break_duration": 15, "long_break_interval": 4, "sound_enabled": true,
		"reminder_enabled": true, "reminder_hour": 15, "timezone": "Asia/Kolkata"}
	if res, body := s.do(t, "POST", "/api/settings", token, settings); res.StatusCode != 200 {
		t.Fatalf("settings: %d %s", res.StatusCode, body)
	}

	// Wrong hour: skipped.
	if _, out := cron("cron-secret-for-tests", at.Add(-2*time.Hour)); out["sent"].(float64) != 0 || out["skipped"].(float64) != 1 {
		t.Fatalf("wrong hour: %v", out)
	}
	// Right hour: one push delivered to the live endpoint, dead one pruned.
	if _, out := cron("cron-secret-for-tests", at); out["sent"].(float64) != 1 {
		t.Fatalf("right hour: %v", out)
	}
	if n := s.push.count(live); n != 1 {
		t.Fatalf("live endpoint got %d pushes", n)
	}
	if !strings.Contains(s.push.sent[live][0], "Time to study") {
		t.Fatalf("payload: %s", s.push.sent[live][0])
	}
	// Second run the same day: already reminded today, so nothing new.
	if _, out := cron("cron-secret-for-tests", at.Add(10*time.Minute)); out["sent"].(float64) != 0 {
		t.Fatalf("repeat same day: %v", out)
	}
	if n := s.push.count(live); n != 1 {
		t.Fatalf("duplicate push: %d", n)
	}
	// The gone endpoint was deleted, so unsubscribing it is 404.
	if res, _ := s.do(t, "DELETE", "/api/push/subscribe", token, map[string]any{"endpoint": gone}); res.StatusCode != 404 {
		t.Fatalf("gone endpoint should be pruned: %d", res.StatusCode)
	}
	if res, _ := s.do(t, "DELETE", "/api/push/subscribe", token, map[string]any{"endpoint": live}); res.StatusCode != 204 {
		t.Fatalf("unsubscribe: %d", res.StatusCode)
	}

	// Candidate who studied today is not nudged. Note last_reminded_on was set
	// by the earlier run, so use a later day.
	next := at.AddDate(0, 0, 1)
	s.do(t, "POST", "/api/push/subscribe", token, sub(live))
	pid := s.createProject(t, token, "P")
	if res, body := s.createSession(t, token, pid, next.Add(-time.Hour), 1500); res.StatusCode != 201 {
		t.Fatalf("session: %d %s", res.StatusCode, body)
	}
	if _, out := cron("cron-secret-for-tests", next); out["sent"].(float64) != 0 {
		t.Fatalf("studied today should skip: %v", out)
	}
	if n := s.push.count(live); n != 1 {
		t.Fatalf("push after studying: %d", n)
	}
}

func TestCronDisabledWithoutSecret(t *testing.T) {
	s := newServer(t, func(c *config.Config) { c.CronSecret = "" })
	req, _ := http.NewRequest("POST", s.URL+"/api/cron/reminders", nil)
	req.Header.Set("Authorization", "Bearer anything")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 404 {
		t.Fatalf("expected 404 when cron is not configured, got %d", res.StatusCode)
	}
}
