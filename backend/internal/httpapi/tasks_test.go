package httpapi_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"study-tracker-backend/internal/store"
)

func TestSessionInterruptionsAndTask(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "task@example.com")
	pid := s.createProject(t, token, "P")
	tid := s.createTask(t, token, pid, "Write tests")

	res, body := s.sessionWith(t, token, map[string]any{"project_id": pid, "interruptions": 3, "task_id": tid})
	wantStatus(t, res.StatusCode, 201, body)
	var created store.Session
	decode(t, body, &created)
	if created.Interruptions != 3 || created.TaskID == nil || *created.TaskID != tid {
		t.Fatalf("session: %+v", created)
	}

	res, body = s.do(t, "GET", "/api/tasks?project_id="+itoa(pid), token, nil)
	wantStatus(t, res.StatusCode, 200, body)
	var tasks []store.Task
	decode(t, body, &tasks)
	if len(tasks) != 1 || tasks[0].CompletedPomodoros != 1 {
		t.Fatalf("expected completed_pomodoros=1: %+v", tasks)
	}

	for _, bad := range []map[string]any{{"project_id": pid, "interruptions": -1}, {"project_id": pid, "interruptions": 101}, {"project_id": pid, "task_id": 0}} {
		res, body = s.sessionWith(t, token, bad)
		if res.StatusCode != 400 {
			t.Errorf("%v: status %d %s", bad, res.StatusCode, body)
		}
	}
}

func TestSessionTaskOwnership(t *testing.T) {
	s := newServer(t, nil)
	alice, _ := s.register(t, "alice@example.com")
	bob, _ := s.register(t, "bob@example.com")
	ap := s.createProject(t, alice, "A")
	ap2 := s.createProject(t, alice, "A2")
	bp := s.createProject(t, bob, "B")
	at := s.createTask(t, alice, ap, "alice task")

	cases := map[string]map[string]any{
		"task on another project": {"project_id": ap2, "task_id": at},
		"bob uses alice's task":   {"project_id": bp, "task_id": at},
		"nonexistent task":        {"project_id": ap, "task_id": 999999},
	}
	for name, payload := range cases {
		tok := alice
		if strings.HasPrefix(name, "bob") {
			tok = bob
		}
		res, body := s.sessionWith(t, tok, payload)
		if res.StatusCode != 404 {
			t.Errorf("%s: status %d %s", name, res.StatusCode, body)
		}
	}
	var n int
	_ = testPool.QueryRow(context.Background(), `SELECT count(*) FROM sessions`).Scan(&n)
	if n != 0 {
		t.Fatalf("sessions inserted: %d", n)
	}
}

func TestTasksCRUD(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "crud@example.com")
	bob, _ := s.register(t, "bob2@example.com")
	pid := s.createProject(t, token, "P")

	res, body := s.do(t, "GET", "/api/tasks", token, nil)
	wantStatus(t, res.StatusCode, 200, body)
	if strings.TrimSpace(string(body)) != "[]" {
		t.Fatalf("expected empty list: %s", body)
	}

	res, body = s.do(t, "POST", "/api/tasks", token, map[string]any{"project_id": pid, "title": "  First  "})
	wantStatus(t, res.StatusCode, 201, body)
	var first store.Task
	decode(t, body, &first)
	if first.Title != "First" || first.EstimatePomodoros != 1 || first.Done || first.Position != 0 {
		t.Fatalf("defaults: %+v", first)
	}
	second := s.createTask(t, token, pid, "Second")

	bad := []map[string]any{
		{"project_id": pid, "title": ""}, {"project_id": pid, "title": strings.Repeat("x", 201)},
		{"project_id": pid, "title": "ok", "estimate_pomodoros": 0}, {"project_id": pid, "title": "ok", "estimate_pomodoros": 21},
		{"project_id": 0, "title": "ok"},
	}
	for _, payload := range bad {
		res, body = s.do(t, "POST", "/api/tasks", token, payload)
		if res.StatusCode != 400 {
			t.Errorf("%v: status %d %s", payload, res.StatusCode, body)
		}
	}
	res, body = s.do(t, "POST", "/api/tasks", bob, map[string]any{"project_id": pid, "title": "hijack"})
	wantStatus(t, res.StatusCode, 404, body)

	res, body = s.do(t, "PUT", "/api/tasks/"+itoa(first.ID), token, map[string]any{"title": "Renamed", "estimate_pomodoros": 3})
	wantStatus(t, res.StatusCode, 200, body)
	var renamed store.Task
	decode(t, body, &renamed)
	if renamed.Title != "Renamed" || renamed.EstimatePomodoros != 3 {
		t.Fatalf("update: %+v", renamed)
	}
	res, body = s.do(t, "PUT", "/api/tasks/"+itoa(first.ID), bob, map[string]any{"title": "x"})
	wantStatus(t, res.StatusCode, 404, body)

	res, body = s.do(t, "PUT", "/api/tasks/"+itoa(first.ID)+"/done", token, map[string]any{"done": true})
	wantStatus(t, res.StatusCode, 200, body)
	var done store.Task
	decode(t, body, &done)
	if !done.Done || done.CompletedAt == nil {
		t.Fatalf("done: %+v", done)
	}
	res, body = s.do(t, "PUT", "/api/tasks/"+itoa(first.ID)+"/done", token, map[string]any{"done": false})
	wantStatus(t, res.StatusCode, 200, body)
	decode(t, body, &done)
	if done.Done || done.CompletedAt != nil {
		t.Fatalf("undone: %+v", done)
	}
	res, body = s.do(t, "PUT", "/api/tasks/"+itoa(first.ID)+"/done", token, map[string]any{})
	wantStatus(t, res.StatusCode, 400, body)

	res, body = s.do(t, "GET", "/api/tasks?done=x", token, nil)
	wantStatus(t, res.StatusCode, 400, body)
	res, body = s.do(t, "GET", "/api/tasks?done=false&project_id="+itoa(pid), token, nil)
	wantStatus(t, res.StatusCode, 200, body)
	var open []store.Task
	decode(t, body, &open)
	if len(open) != 2 {
		t.Fatalf("open tasks: %d", len(open))
	}

	res, body = s.do(t, "DELETE", "/api/tasks/"+itoa(second), token, nil)
	wantStatus(t, res.StatusCode, 204, body)
	res, body = s.do(t, "DELETE", "/api/tasks/"+itoa(second), token, nil)
	wantStatus(t, res.StatusCode, 404, body)
}

func TestTasksReorderAndCascade(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "order@example.com")
	bob, _ := s.register(t, "bob3@example.com")
	pid := s.createProject(t, token, "P")
	a := s.createTask(t, token, pid, "a")
	b := s.createTask(t, token, pid, "b")
	c := s.createTask(t, token, pid, "c")
	bp := s.createProject(t, bob, "BP")
	bt := s.createTask(t, bob, bp, "bob")

	res, body := s.do(t, "PUT", "/api/tasks/order", token, map[string]any{"ids": []int64{c, a, b}})
	wantStatus(t, res.StatusCode, 204, body)
	res, body = s.do(t, "GET", "/api/tasks?project_id="+itoa(pid), token, nil)
	wantStatus(t, res.StatusCode, 200, body)
	var tasks []store.Task
	decode(t, body, &tasks)
	if len(tasks) != 3 || tasks[0].ID != c || tasks[1].ID != a || tasks[2].ID != b {
		t.Fatalf("order: %+v", tasks)
	}

	res, body = s.do(t, "PUT", "/api/tasks/order", token, map[string]any{"ids": []int64{a, bt}})
	wantStatus(t, res.StatusCode, 404, body)
	res, body = s.do(t, "GET", "/api/tasks?project_id="+itoa(pid), token, nil)
	decode(t, body, &tasks)
	if tasks[0].ID != c {
		t.Fatalf("positions changed after failed reorder: %+v", tasks)
	}
	for _, bad := range []map[string]any{{"ids": []int64{}}, {"ids": []int64{a, a}}, {"ids": []int64{0}}} {
		res, body = s.do(t, "PUT", "/api/tasks/order", token, bad)
		if res.StatusCode != 400 {
			t.Errorf("%v: status %d %s", bad, res.StatusCode, body)
		}
	}

	// Session keeps its row when its task is deleted; tasks vanish with the project.
	res, body = s.sessionWith(t, token, map[string]any{"project_id": pid, "task_id": a})
	wantStatus(t, res.StatusCode, 201, body)
	res, body = s.do(t, "DELETE", "/api/tasks/"+itoa(a), token, nil)
	wantStatus(t, res.StatusCode, 204, body)
	var nullTask int
	_ = testPool.QueryRow(context.Background(), `SELECT count(*) FROM sessions WHERE task_id IS NULL`).Scan(&nullTask)
	if nullTask != 1 {
		t.Fatalf("expected task_id nulled, got %d", nullTask)
	}
	res, body = s.do(t, "DELETE", "/api/projects/"+itoa(pid), token, nil)
	wantStatus(t, res.StatusCode, 204, body)
	var remaining int
	_ = testPool.QueryRow(context.Background(), `SELECT count(*) FROM tasks WHERE project_id = $1`, pid).Scan(&remaining)
	if remaining != 0 {
		t.Fatalf("tasks survived project delete: %d", remaining)
	}
}

func TestStatsGoalsHeatmapHoursAndWeekOverWeek(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "goals@example.com")
	bob, _ := s.register(t, "bob4@example.com")
	p60 := s.createProject(t, token, "Sixty")
	p30 := s.createProject(t, token, "Thirty")
	res, body := s.do(t, "PUT", "/api/projects/"+itoa(p30), token, map[string]any{"name": "Thirty", "target_minutes_per_day": 30})
	wantStatus(t, res.StatusCode, 200, body)
	res, body = s.do(t, "PUT", "/api/projects/"+itoa(p60), token, map[string]any{"name": "Sixty", "target_minutes_per_day": 60})
	wantStatus(t, res.StatusCode, 200, body)

	now := time.Now().UTC()
	// Use "now" so the sessions are unambiguously today in UTC.
	res, body = s.createSession(t, token, p60, now.Add(-31*time.Minute), 1800)
	wantStatus(t, res.StatusCode, 201, body)
	res, body = s.createSession(t, token, p30, now.Add(-46*time.Minute), 2700)
	wantStatus(t, res.StatusCode, 201, body)

	res, body = s.do(t, "GET", "/api/stats/goals?tz=UTC", token, nil)
	wantStatus(t, res.StatusCode, 200, body)
	var goals store.GoalsStats
	decode(t, body, &goals)
	byName := map[string]store.GoalStat{}
	for _, g := range goals.Projects {
		byName[g.Name] = g
	}
	if g := byName["Sixty"]; g.TodayMinutes != 30 || g.Percent != 50 || g.Met {
		t.Errorf("sixty: %+v", g)
	}
	if g := byName["Thirty"]; g.TodayMinutes != 45 || g.Percent != 100 || !g.Met {
		t.Errorf("thirty: %+v", g)
	}
	if goals.Overall.TodayMinutes != 75 {
		t.Errorf("overall: %+v", goals.Overall)
	}
	res, body = s.do(t, "GET", "/api/stats/goals?tz=Mars/Olympus", token, nil)
	wantStatus(t, res.StatusCode, 400, body)
	res, body = s.do(t, "GET", "/api/stats/goals?tz=UTC", bob, nil)
	wantStatus(t, res.StatusCode, 200, body)
	if strings.Contains(string(body), "Sixty") {
		t.Error("goals leak across users")
	}

	// Heatmap.
	res, body = s.do(t, "GET", "/api/stats/heatmap?tz=UTC&days=3", token, nil)
	wantStatus(t, res.StatusCode, 200, body)
	var heat []store.DailyStat
	decode(t, body, &heat)
	if len(heat) != 3 || heat[0].Date >= heat[2].Date || heat[2].Minutes != 75 {
		t.Errorf("heatmap: %+v", heat)
	}
	res, body = s.do(t, "GET", "/api/stats/heatmap?tz=UTC", token, nil)
	decode(t, body, &heat)
	if len(heat) != 365 {
		t.Errorf("default heatmap length %d", len(heat))
	}
	for _, q := range []string{"?days=0", "?days=731", "?days=x"} {
		res, body = s.do(t, "GET", "/api/stats/heatmap"+q, token, nil)
		if res.StatusCode != 400 {
			t.Errorf("%s: status %d", q, res.StatusCode)
		}
	}

	// Hours: anchor a session at 22:30 UTC two days ago (always inside the rolling week).
	d := now.AddDate(0, 0, -2)
	anchor := time.Date(d.Year(), d.Month(), d.Day(), 22, 30, 0, 0, time.UTC)
	res, body = s.createSession(t, token, p60, anchor, 600)
	wantStatus(t, res.StatusCode, 201, body)
	res, body = s.do(t, "GET", "/api/stats/hours?tz=UTC", token, nil)
	wantStatus(t, res.StatusCode, 200, body)
	var hours []store.HourStat
	decode(t, body, &hours)
	if len(hours) != 24 || hours[22].Minutes != 10 || hours[22].SessionCount != 1 || hours[22].AvgRating != 4 {
		t.Errorf("hours utc: %+v", hours[22])
	}
	res, body = s.do(t, "GET", "/api/stats/hours?tz=Asia/Kolkata", token, nil)
	decode(t, body, &hours)
	if hours[4].Minutes != 10 {
		t.Errorf("hours ist: %+v", hours[4])
	}

	// Week over week + avg interruptions.
	res, body = s.sessionWith(t, token, map[string]any{"project_id": p60, "interruptions": 2,
		"start_time": now.AddDate(0, 0, -9).Add(-10 * time.Minute).Format(time.RFC3339), "end_time": now.AddDate(0, 0, -9).Format(time.RFC3339), "duration_seconds": 600})
	wantStatus(t, res.StatusCode, 201, body)
	res, body = s.do(t, "GET", "/api/stats/dashboard?tz=UTC", token, nil)
	wantStatus(t, res.StatusCode, 200, body)
	var dash store.DashboardStats
	decode(t, body, &dash)
	// This week: 30 + 45 today + the 10-minute anchor two days ago = 85. Previous week: 10.
	if dash.WeekOverWeek.ThisWeekMinutes != 85 || dash.WeekOverWeek.PreviousWeekMinutes != 10 || dash.WeekOverWeek.DeltaMinutes != 75 || dash.WeekOverWeek.DeltaPercent == nil || *dash.WeekOverWeek.DeltaPercent != 750 {
		t.Errorf("wow: %+v", dash.WeekOverWeek)
	}
	if dash.AvgInterruptions != 0.5 {
		t.Errorf("avg interruptions: %v", dash.AvgInterruptions)
	}
}
