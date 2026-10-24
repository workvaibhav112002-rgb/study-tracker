package httpapi_test

import (
	"strings"
	"testing"

	"study-tracker-backend/internal/store"
)

func TestCardsLifecycle(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "cards@example.com")
	bob, _ := s.register(t, "bobcards@example.com")
	pid := s.createProject(t, token, "Go")

	res, body := s.do(t, "POST", "/api/cards", token, map[string]any{"project_id": pid, "front": " What is a goroutine? ", "back": "A lightweight thread managed by the Go runtime.", "tags": []string{"Concurrency", "go", "concurrency"}})
	wantStatus(t, res.StatusCode, 201, body)
	var c store.Card
	decode(t, body, &c)
	if c.Front != "What is a goroutine?" || len(c.Tags) != 2 || c.Tags[0] != "concurrency" || c.Ease != 2.5 || c.Repetitions != 0 {
		t.Fatalf("card: %+v", c)
	}
	for _, bad := range []map[string]any{{"project_id": pid, "front": "", "back": "x"}, {"project_id": pid, "front": "x", "back": strings.Repeat("b", 4001)}, {"project_id": pid, "front": "x", "back": "y", "tags": []string{"two words"}}, {"project_id": 0, "front": "x", "back": "y"}} {
		res, body = s.do(t, "POST", "/api/cards", token, bad)
		if res.StatusCode != 400 {
			t.Errorf("%v: %d %s", bad, res.StatusCode, body)
		}
	}
	res, body = s.do(t, "POST", "/api/cards", bob, map[string]any{"project_id": pid, "front": "x", "back": "y"})
	wantStatus(t, res.StatusCode, 404, body)

	// New card is due now.
	res, body = s.do(t, "GET", "/api/cards?due=true", token, nil)
	wantStatus(t, res.StatusCode, 200, body)
	var due []store.Card
	decode(t, body, &due)
	if len(due) != 1 {
		t.Fatalf("due: %d", len(due))
	}
	res, body = s.do(t, "GET", "/api/cards/stats", token, nil)
	wantStatus(t, res.StatusCode, 200, body)
	var st store.CardStats
	decode(t, body, &st)
	if st.Total != 1 || st.Due != 1 || st.New != 1 {
		t.Fatalf("stats: %+v", st)
	}

	// Good review schedules it a day out; no longer due.
	res, body = s.do(t, "POST", "/api/cards/"+itoa(c.ID)+"/review", token, map[string]any{"rating": 3})
	wantStatus(t, res.StatusCode, 200, body)
	decode(t, body, &c)
	if c.IntervalDays != 1 || c.Repetitions != 1 {
		t.Fatalf("after good: %+v", c)
	}
	res, body = s.do(t, "GET", "/api/cards?due=true", token, nil)
	decode(t, body, &due)
	if len(due) != 0 {
		t.Fatalf("still due after review: %d", len(due))
	}
	res, body = s.do(t, "GET", "/api/cards/stats", token, nil)
	decode(t, body, &st)
	if st.Reviewed7 != 1 || st.New != 0 {
		t.Fatalf("stats after review: %+v", st)
	}
	res, body = s.do(t, "POST", "/api/cards/"+itoa(c.ID)+"/review", token, map[string]any{"rating": 9})
	wantStatus(t, res.StatusCode, 400, body)
	res, body = s.do(t, "POST", "/api/cards/"+itoa(c.ID)+"/review", bob, map[string]any{"rating": 3})
	wantStatus(t, res.StatusCode, 404, body)

	// Edit keeps the schedule; archive hides from lists; delete removes.
	res, body = s.do(t, "PUT", "/api/cards/"+itoa(c.ID), token, map[string]any{"front": "Edited", "back": "Still here", "tags": []string{}})
	wantStatus(t, res.StatusCode, 200, body)
	decode(t, body, &c)
	if c.Front != "Edited" || c.Repetitions != 1 {
		t.Fatalf("edit: %+v", c)
	}
	res, body = s.do(t, "PUT", "/api/cards/"+itoa(c.ID)+"/archive", token, map[string]any{"archived": true})
	wantStatus(t, res.StatusCode, 200, body)
	res, body = s.do(t, "GET", "/api/cards", token, nil)
	if strings.TrimSpace(string(body)) != "[]" {
		t.Fatalf("archived card still listed: %s", body)
	}
	res, body = s.do(t, "GET", "/api/cards?archived=true", token, nil)
	if !strings.Contains(string(body), "Edited") {
		t.Fatalf("archived filter: %s", body)
	}
	res, body = s.do(t, "DELETE", "/api/cards/"+itoa(c.ID), bob, nil)
	wantStatus(t, res.StatusCode, 404, body)
	res, body = s.do(t, "DELETE", "/api/cards/"+itoa(c.ID), token, nil)
	wantStatus(t, res.StatusCode, 204, body)
}

func TestNotesAndProjectPlanning(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "notes@example.com")
	bob, _ := s.register(t, "bobnotes@example.com")
	pid := s.createProject(t, token, "Go")

	res, body := s.do(t, "POST", "/api/notes", token, map[string]any{"project_id": pid, "title": "Channels", "body": "Unbuffered channels block until both sides are ready.", "tags": []string{"Go", "channels"}, "pinned": true})
	wantStatus(t, res.StatusCode, 201, body)
	var n store.Note
	decode(t, body, &n)
	res, body = s.do(t, "POST", "/api/notes", token, map[string]any{"title": "Scratch", "body": "unrelated"})
	wantStatus(t, res.StatusCode, 201, body)
	res, body = s.do(t, "POST", "/api/notes", bob, map[string]any{"project_id": pid, "title": "hijack"})
	wantStatus(t, res.StatusCode, 404, body)
	res, body = s.do(t, "POST", "/api/notes", token, map[string]any{"title": ""})
	wantStatus(t, res.StatusCode, 400, body)

	res, body = s.do(t, "GET", "/api/notes", token, nil)
	var list []store.Note
	decode(t, body, &list)
	if len(list) != 2 || list[0].Title != "Channels" {
		t.Fatalf("pinned first: %+v", list)
	}
	res, body = s.do(t, "GET", "/api/notes?q=block", token, nil)
	decode(t, body, &list)
	if len(list) != 1 || list[0].ID != n.ID {
		t.Fatalf("search: %+v", list)
	}
	res, body = s.do(t, "GET", "/api/notes?tag=go", token, nil)
	decode(t, body, &list)
	if len(list) != 1 {
		t.Fatalf("tag filter: %+v", list)
	}
	res, body = s.do(t, "GET", "/api/notes", bob, nil)
	if strings.Contains(string(body), "Channels") {
		t.Fatal("notes leak")
	}
	res, body = s.do(t, "PUT", "/api/notes/"+itoa(n.ID), token, map[string]any{"title": "Channels v2", "body": "x", "pinned": false})
	wantStatus(t, res.StatusCode, 200, body)
	res, body = s.do(t, "DELETE", "/api/notes/"+itoa(n.ID), token, nil)
	wantStatus(t, res.StatusCode, 204, body)

	// Exam date and weekly plan on a project; deleting the project nulls note links.
	res, body = s.do(t, "PUT", "/api/projects/"+itoa(pid), token, map[string]any{"name": "Go", "exam_date": "2027-03-15", "planned_hours_per_week": 6})
	wantStatus(t, res.StatusCode, 200, body)
	var p store.Project
	decode(t, body, &p)
	if p.ExamDate == nil || *p.ExamDate != "2027-03-15" || p.PlannedHoursPerWeek == nil || *p.PlannedHoursPerWeek != 6 {
		t.Fatalf("project plan: %+v", p)
	}
	res, body = s.do(t, "PUT", "/api/projects/"+itoa(pid), token, map[string]any{"name": "Go", "exam_date": "15/03/2027"})
	wantStatus(t, res.StatusCode, 400, body)
	res, body = s.do(t, "PUT", "/api/projects/"+itoa(pid), token, map[string]any{"name": "Go", "planned_hours_per_week": 500})
	wantStatus(t, res.StatusCode, 400, body)
	res, body = s.do(t, "PUT", "/api/projects/"+itoa(pid), token, map[string]any{"name": "Go", "exam_date": ""})
	wantStatus(t, res.StatusCode, 200, body)
	decode(t, body, &p)
	if p.ExamDate != nil {
		t.Fatalf("exam date should clear: %+v", p)
	}
}
