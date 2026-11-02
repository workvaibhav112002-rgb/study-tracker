package httpapi_test

import (
	"bytes"
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/xuri/excelize/v2"

	"study-tracker-backend/internal/httpapi"
	"study-tracker-backend/internal/store"
)

func TestScoreSection(t *testing.T) {
	cases := []struct {
		name                       string
		in                         store.MockSection
		net, penalty, acc, attempt float64
		low, high                  bool
	}{
		{"clean", store.MockSection{Questions: 35, Correct: 30, Incorrect: 0, MarksEach: 1, NegativeEach: 0.25}, 30, 0, 100, 85.71, false, false},
		{"negatives", store.MockSection{Questions: 35, Correct: 20, Incorrect: 11, MarksEach: 1, NegativeEach: 0.25}, 17.25, 2.75, 64.52, 88.57, true, true},
		{"at threshold", store.MockSection{Questions: 20, Correct: 17, Incorrect: 3, MarksEach: 1, NegativeEach: 0.25}, 16.25, 0.75, 85, 100, false, false},
		{"penalty exactly limit", store.MockSection{Questions: 40, Correct: 30, Incorrect: 10, MarksEach: 1, NegativeEach: 0.25}, 27.5, 2.5, 75, 100, true, false},
		{"nothing attempted", store.MockSection{Questions: 30, MarksEach: 2, NegativeEach: 0.5}, 0, 0, 0, 0, false, false},
	}
	for _, c := range cases {
		got := httpapi.ScoreSection(c.in, 85, 2.5)
		if got.Net != c.net || got.Penalty != c.penalty || got.Accuracy != c.acc || got.AttemptRate != c.attempt || got.LowAccuracy != c.low || got.HighPenalty != c.high {
			t.Errorf("%s: %+v", c.name, got)
		}
	}
	m := store.Mock{Sections: []store.MockSection{
		{Name: "Quant", Questions: 35, Correct: 20, Incorrect: 11, MarksEach: 1, NegativeEach: 0.25},
		{Name: "English", Questions: 30, Correct: 25, Incorrect: 1, MarksEach: 1, NegativeEach: 0.25},
	}}
	total := httpapi.ScoreMock(m, &store.ExamTemplate{AccuracyThreshold: 60, PenaltyLimit: 3})
	if total.Net != 42 || total.Penalty != 3 || total.MaxMarks != 65 || total.Sections[0].LowAccuracy || total.Sections[0].HighPenalty {
		t.Fatalf("mock total: %+v", total)
	}
}

func mockBody(pid int64, name string) map[string]any {
	return map[string]any{
		"project_id": pid, "name": name, "provider": "Example Series", "attempted_on": time.Now().Format("2006-01-02"),
		"percentile": 91.5, "rank": 120,
		"sections": []map[string]any{
			{"name": "Quant", "questions": 35, "correct": 20, "incorrect": 11, "seconds": 1200, "marks_each": 1, "negative_each": 0.25},
			{"name": "Reasoning", "questions": 35, "correct": 28, "incorrect": 2, "seconds": 1200, "marks_each": 1, "negative_each": 0.25},
		},
	}
}

func TestMocksAndExamTemplate(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "mocks@example.test")
	other, _ := s.register(t, "mocks-other@example.test")
	pid := s.createProject(t, token, "IBPS PO")

	tpl := map[string]any{"exam_template": map[string]any{
		"key": "ibps-po-pre", "negative_fraction": 0.25, "target_score": 60, "accuracy_threshold": 85, "penalty_limit": 2.5,
		"sections": []map[string]any{{"name": "Quant", "questions": 35, "marks_each": 1, "minutes": 20}},
	}}
	res, body := s.do(t, "PUT", "/api/projects/"+itoa(pid)+"/exam-template", token, tpl)
	wantStatus(t, res.StatusCode, 200, body)
	var p store.Project
	decode(t, body, &p)
	if p.ExamTemplate == nil || p.ExamTemplate.Sections[0].Questions != 35 || p.ExamTemplate.TargetScore != 60 {
		t.Fatalf("template: %+v", p.ExamTemplate)
	}
	// Editing the project keeps the template.
	res, body = s.do(t, "PUT", "/api/projects/"+itoa(pid), token, map[string]any{"name": "IBPS PO 2026", "target_minutes_per_day": 90})
	wantStatus(t, res.StatusCode, 200, body)
	decode(t, body, &p)
	if p.ExamTemplate == nil {
		t.Fatal("project update dropped the exam template")
	}
	res, body = s.do(t, "PUT", "/api/projects/"+itoa(pid)+"/exam-template", other, tpl)
	wantStatus(t, res.StatusCode, 404, body)
	bad := map[string]any{"exam_template": map[string]any{"sections": []any{}}}
	res, body = s.do(t, "PUT", "/api/projects/"+itoa(pid)+"/exam-template", token, bad)
	wantStatus(t, res.StatusCode, 400, body)

	res, body = s.do(t, "POST", "/api/mocks", token, mockBody(pid, "Mock 1"))
	wantStatus(t, res.StatusCode, 201, body)
	var m store.Mock
	decode(t, body, &m)
	if len(m.Sections) != 2 || m.Sections[0].Correct != 20 || m.Percentile == nil || *m.Percentile != 91.5 || m.Rank == nil || *m.Rank != 120 {
		t.Fatalf("mock: %+v", m)
	}

	for name, mutate := range map[string]func(map[string]any){
		"too many answers": func(b map[string]any) {
			b["sections"].([]map[string]any)[0]["correct"] = 30
		},
		"future date":    func(b map[string]any) { b["attempted_on"] = time.Now().AddDate(0, 0, 5).Format("2006-01-02") },
		"no sections":    func(b map[string]any) { b["sections"] = []any{} },
		"bad percentile": func(b map[string]any) { b["percentile"] = 120 },
		"no name":        func(b map[string]any) { b["name"] = " " },
	} {
		b := mockBody(pid, "Bad")
		mutate(b)
		if res, body := s.do(t, "POST", "/api/mocks", token, b); res.StatusCode != 400 {
			t.Errorf("%s: %d %s", name, res.StatusCode, body)
		}
	}
	// Another user can neither create in this project nor see or edit the mock.
	res, body = s.do(t, "POST", "/api/mocks", other, mockBody(pid, "x"))
	wantStatus(t, res.StatusCode, 404, body)
	res, body = s.do(t, "PUT", "/api/mocks/"+itoa(m.ID), other, mockBody(pid, "x"))
	wantStatus(t, res.StatusCode, 404, body)
	res, body = s.do(t, "GET", "/api/mocks", other, nil)
	if strings.Contains(string(body), "Mock 1") {
		t.Fatalf("other user sees mock: %s", body)
	}

	upd := mockBody(pid, "Mock 1 (retake)")
	res, body = s.do(t, "PUT", "/api/mocks/"+itoa(m.ID), token, upd)
	wantStatus(t, res.StatusCode, 200, body)
	res, body = s.do(t, "GET", "/api/mocks?project_id="+itoa(pid), token, nil)
	var list []store.Mock
	decode(t, body, &list)
	if len(list) != 1 || list[0].Name != "Mock 1 (retake)" {
		t.Fatalf("list: %+v", list)
	}

	// Deleting the mock keeps its mistakes, unlinked.
	res, body = s.do(t, "POST", "/api/mistakes", token, map[string]any{"project_id": pid, "mock_id": m.ID, "tags": map[string]any{"topic": "DI", "mistake_type": "careless"}})
	wantStatus(t, res.StatusCode, 201, body)
	var mk store.Mistake
	decode(t, body, &mk)
	res, body = s.do(t, "DELETE", "/api/mocks/"+itoa(m.ID), token, nil)
	wantStatus(t, res.StatusCode, 204, body)
	res, body = s.do(t, "GET", "/api/mistakes", token, nil)
	var mks []store.Mistake
	decode(t, body, &mks)
	if len(mks) != 1 || mks[0].MockID != nil {
		t.Fatalf("mistake after mock delete: %+v", mks)
	}
}

func mk(pid int64, topic, kind string, extra map[string]any) map[string]any {
	b := map[string]any{"project_id": pid, "tags": map[string]any{"topic": topic, "mistake_type": kind},
		"question": "Circular seating, 8 people", "rule": "Mark **N/S** first", "actual_seconds": 150, "ideal_seconds": 45}
	for k, v := range extra {
		b[k] = v
	}
	return b
}

func TestMistakesFiltersAndOwnership(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "mistakes@example.test")
	other, _ := s.register(t, "mistakes-other@example.test")
	pid := s.createProject(t, token, "Biology")
	otherPid := s.createProject(t, other, "Other")
	res, body := s.do(t, "POST", "/api/mocks", other, mockBody(otherPid, "Other mock"))
	wantStatus(t, res.StatusCode, 201, body)
	var otherMock store.Mock
	decode(t, body, &otherMock)

	add := func(b map[string]any) store.Mistake {
		t.Helper()
		res, body := s.do(t, "POST", "/api/mistakes", token, b)
		wantStatus(t, res.StatusCode, 201, body)
		var m store.Mistake
		decode(t, body, &m)
		return m
	}
	first := add(mk(pid, "Cell division", "time", nil))
	if first.Status != "active" || *first.ActualSeconds != 150 || first.Tags["topic"] != "Cell division" || first.Tags["mistake_type"] != "time" {
		t.Fatalf("mistake: %+v", first)
	}
	add(mk(pid, "Genetics", "careless", map[string]any{"question": "pie chart units"}))
	add(mk(pid, "Genetics", "didnt_know", map[string]any{"extra": map[string]any{"page": 42.0, "with_teacher": true}}))

	for name, b := range map[string]map[string]any{
		"unknown option":   mk(pid, "Genetics", "lazy", nil),
		"missing required": {"project_id": pid, "tags": map[string]any{"topic": "Genetics"}},
		"too slow":         mk(pid, "Genetics", "careless", map[string]any{"actual_seconds": 99999}),
		"bad status":       mk(pid, "Genetics", "careless", map[string]any{"status": "done"}),
		"bad tag key":      {"project_id": pid, "tags": map[string]any{"Mistake Type": "careless"}},
		"nested extra":     mk(pid, "Genetics", "careless", map[string]any{"extra": map[string]any{"x": map[string]any{}}}),
		"two values":       {"project_id": pid, "tags": map[string]any{"mistake_type": []any{"careless", "time"}}},
	} {
		if res, body := s.do(t, "POST", "/api/mistakes", token, b); res.StatusCode != 400 {
			t.Errorf("%s: %d %s", name, res.StatusCode, body)
		}
	}
	// A test that belongs to someone else cannot be linked, nor their project used.
	res, body = s.do(t, "POST", "/api/mistakes", token, mk(pid, "Genetics", "careless", map[string]any{"mock_id": otherMock.ID}))
	wantStatus(t, res.StatusCode, 404, body)
	res, body = s.do(t, "POST", "/api/mistakes", token, mk(otherPid, "Genetics", "careless", nil))
	wantStatus(t, res.StatusCode, 404, body)

	count := func(q string) int {
		t.Helper()
		res, body := s.do(t, "GET", "/api/mistakes"+q, token, nil)
		wantStatus(t, res.StatusCode, 200, body)
		var l []store.Mistake
		decode(t, body, &l)
		return len(l)
	}
	for q, want := range map[string]int{
		"": 3, "?tag=topic:Genetics": 2, "?tag=mistake_type:time": 1, "?q=pie": 1, "?q=Genetics": 2,
		"?status=locked_in": 0, "?since_days=1": 3, "?project_id=" + itoa(pid): 3,
	} {
		if got := count(q); got != want {
			t.Errorf("filter %q: got %d want %d", q, got, want)
		}
	}
	if res, _ := s.do(t, "GET", "/api/mistakes?tag=bogus", token, nil); res.StatusCode != 400 {
		t.Errorf("bad tag filter: %d", res.StatusCode)
	}

	for _, req := range []struct{ method, path string }{
		{"PUT", "/api/mistakes/" + itoa(first.ID)}, {"DELETE", "/api/mistakes/" + itoa(first.ID)}, {"POST", "/api/mistakes/" + itoa(first.ID) + "/review"},
	} {
		b := mk(otherPid, "x", "careless", map[string]any{"grade": "locked_in"})
		if res, body := s.do(t, req.method, req.path, other, b); res.StatusCode != 404 {
			t.Errorf("%s %s by other: %d %s", req.method, req.path, res.StatusCode, body)
		}
	}
	res, body = s.do(t, "GET", "/api/mistakes", other, nil)
	if strings.Contains(string(body), "Genetics") {
		t.Fatalf("other user sees mistakes: %s", body)
	}

	res, body = s.do(t, "PUT", "/api/mistakes/"+itoa(first.ID), token, map[string]any{"project_id": pid, "tags": map[string]any{"topic": "Cell division", "mistake_type": "didnt_know"}})
	wantStatus(t, res.StatusCode, 200, body)
	var upd store.Mistake
	decode(t, body, &upd)
	if upd.Tags["mistake_type"] != "didnt_know" || upd.Status != "active" || upd.Question != "" {
		t.Fatalf("updated: %+v", upd)
	}
}

func TestJournalConfig(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "journal@example.test")
	other, _ := s.register(t, "journal-other@example.test")
	pid := s.createProject(t, token, "AWS")
	pid2 := s.createProject(t, token, "French")

	res, body := s.do(t, "GET", "/api/journal", token, nil)
	wantStatus(t, res.StatusCode, 200, body)
	var got struct {
		Config  *store.JournalConfig `json:"config"`
		Default store.JournalConfig  `json:"default"`
	}
	decode(t, body, &got)
	if got.Config != nil || got.Default.Categories[1].Key != "mistake_type" || got.Default.Patterns.Threshold != 3 {
		t.Fatalf("initial: %+v", got)
	}

	cfg := store.DefaultJournalConfig()
	cfg.Categories = append(cfg.Categories, store.JournalCategory{Key: "chapter", Label: "Chapter", Multi: true, AllowNew: true})
	cfg.Categories[1].Options[1].Label = "Silly error"
	cfg.Fields = append(cfg.Fields, store.JournalField{Key: "with_teacher", Label: "Asked the teacher", Type: "yesno"})
	cfg.Patterns.Watch = [][]string{{"chapter"}}
	res, body = s.do(t, "PUT", "/api/journal", token, map[string]any{"config": cfg})
	wantStatus(t, res.StatusCode, 200, body)

	// Multi-select category from the user default is accepted on any project without an override.
	res, body = s.do(t, "POST", "/api/mistakes", token, map[string]any{"project_id": pid2, "tags": map[string]any{"mistake_type": "careless", "chapter": []any{"Verbs", "Verbs", "Tenses"}}})
	wantStatus(t, res.StatusCode, 201, body)
	var m store.Mistake
	decode(t, body, &m)
	if ch, _ := m.Tags["chapter"].([]any); len(ch) != 2 {
		t.Fatalf("multi tags: %+v", m.Tags)
	}

	// A project override with a different required category.
	pcfg := store.DefaultJournalConfig()
	pcfg.Preset = "certification"
	pcfg.Categories = []store.JournalCategory{{Key: "domain", Label: "Domain", Required: true, Options: []store.JournalOption{{Key: "security", Label: "Security", Color: "#f26a86"}, {Key: "networking", Label: "Networking"}}}}
	pcfg.Patterns.Watch = [][]string{{"domain"}}
	res, body = s.do(t, "PUT", "/api/projects/"+itoa(pid)+"/journal", token, map[string]any{"config": pcfg})
	wantStatus(t, res.StatusCode, 200, body)
	var p store.Project
	decode(t, body, &p)
	if p.JournalConfig == nil || p.JournalConfig.Categories[0].Key != "domain" {
		t.Fatalf("project config: %+v", p.JournalConfig)
	}
	res, body = s.do(t, "POST", "/api/mistakes", token, map[string]any{"project_id": pid, "tags": map[string]any{"mistake_type": "careless"}})
	wantStatus(t, res.StatusCode, 400, body)
	res, body = s.do(t, "POST", "/api/mistakes", token, map[string]any{"project_id": pid, "tags": map[string]any{"domain": "security"}})
	wantStatus(t, res.StatusCode, 201, body)
	res, body = s.do(t, "PUT", "/api/projects/"+itoa(pid)+"/journal", other, map[string]any{"config": pcfg})
	wantStatus(t, res.StatusCode, 404, body)
	// Clearing the override inherits the default again.
	res, body = s.do(t, "PUT", "/api/projects/"+itoa(pid)+"/journal", token, map[string]any{"config": nil})
	wantStatus(t, res.StatusCode, 200, body)
	decode(t, body, &p)
	if p.JournalConfig != nil {
		t.Fatal("override not cleared")
	}

	bad := func(mut func(c *store.JournalConfig)) map[string]any {
		c := store.DefaultJournalConfig()
		mut(&c)
		return map[string]any{"config": c}
	}
	for name, b := range map[string]map[string]any{
		"no categories": bad(func(c *store.JournalConfig) { c.Categories = nil }),
		"bad key":       bad(func(c *store.JournalConfig) { c.Categories[0].Key = "Topic!" }),
		"dup category":  bad(func(c *store.JournalConfig) { c.Categories[1].Key = "topic" }),
		"dup option":    bad(func(c *store.JournalConfig) { c.Categories[1].Options[1].Key = "didnt_know" }),
		"empty fixed":   bad(func(c *store.JournalConfig) { c.Categories[2].Options = nil }),
		"bad colour":    bad(func(c *store.JournalConfig) { c.Categories[1].Options[0].Color = "red" }),
		"bad field type": bad(func(c *store.JournalConfig) {
			c.Fields = append(c.Fields, store.JournalField{Key: "x", Label: "X", Type: "date"})
		}),
		"select no opts": bad(func(c *store.JournalConfig) {
			c.Fields = append(c.Fields, store.JournalField{Key: "x", Label: "X", Type: "select"})
		}),
		"threshold":     bad(func(c *store.JournalConfig) { c.Patterns.Threshold = 1 }),
		"window":        bad(func(c *store.JournalConfig) { c.Patterns.WindowDays = 365 }),
		"watch unknown": bad(func(c *store.JournalConfig) { c.Patterns.Watch = [][]string{{"nope"}} }),
		"weekday":       bad(func(c *store.JournalConfig) { c.ReviewWeekday = 7 }),
		"field = category": bad(func(c *store.JournalConfig) {
			c.Fields = append(c.Fields, store.JournalField{Key: "topic", Label: "T", Type: "text"})
		}),
	} {
		if res, body := s.do(t, "PUT", "/api/journal", token, b); res.StatusCode != 400 {
			t.Errorf("%s: %d %s", name, res.StatusCode, body)
		}
	}
}

func TestRetagMistakes(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "retag@example.test")
	other, _ := s.register(t, "retag-other@example.test")
	pid := s.createProject(t, token, "Maths")
	pid2 := s.createProject(t, token, "Physics")
	opid := s.createProject(t, other, "Maths")
	cfg := store.DefaultJournalConfig()
	cfg.Categories = append(cfg.Categories, store.JournalCategory{Key: "chapter", Label: "Chapter", Multi: true, AllowNew: true})
	for _, tok := range []string{token, other} {
		if res, body := s.do(t, "PUT", "/api/journal", tok, map[string]any{"config": cfg}); res.StatusCode != 200 {
			t.Fatalf("config: %d %s", res.StatusCode, body)
		}
	}
	post := func(tok string, p int64, tags map[string]any) {
		t.Helper()
		if res, body := s.do(t, "POST", "/api/mistakes", tok, map[string]any{"project_id": p, "tags": tags}); res.StatusCode != 201 {
			t.Fatalf("post: %d %s", res.StatusCode, body)
		}
	}
	post(token, pid, map[string]any{"topic": "Fractons", "mistake_type": "careless", "chapter": []any{"Ch1", "Ch2"}})
	post(token, pid2, map[string]any{"topic": "Fractons", "mistake_type": "careless"})
	post(other, opid, map[string]any{"topic": "Fractons", "mistake_type": "careless"})

	// Merge a typo within one project only.
	res, body := s.do(t, "POST", "/api/mistakes/retag", token, map[string]any{"project_id": pid, "category": "topic", "from": "Fractons", "to": "Fractions"})
	wantStatus(t, res.StatusCode, 200, body)
	if !strings.Contains(string(body), `"updated":1`) {
		t.Fatalf("retag: %s", body)
	}
	// Merge inside a multi-select array, then remove a value everywhere.
	res, body = s.do(t, "POST", "/api/mistakes/retag", token, map[string]any{"category": "chapter", "from": "Ch1", "to": "Ch2"})
	wantStatus(t, res.StatusCode, 200, body)
	res, body = s.do(t, "POST", "/api/mistakes/retag", token, map[string]any{"category": "topic", "from": "Fractons", "to": ""})
	wantStatus(t, res.StatusCode, 200, body)
	res, body = s.do(t, "GET", "/api/mistakes", token, nil)
	var l []store.Mistake
	decode(t, body, &l)
	for _, m := range l {
		switch m.ProjectID {
		case pid:
			ch, _ := m.Tags["chapter"].([]any)
			if m.Tags["topic"] != "Fractions" || len(ch) != 1 || ch[0] != "Ch2" {
				t.Errorf("project 1: %+v", m.Tags)
			}
		case pid2:
			if _, ok := m.Tags["topic"]; ok {
				t.Errorf("project 2 topic not removed: %+v", m.Tags)
			}
		}
	}
	// Another user's data is untouched; another user's project is refused.
	res, body = s.do(t, "GET", "/api/mistakes", other, nil)
	if !strings.Contains(string(body), "Fractons") {
		t.Fatalf("other user's mistake changed: %s", body)
	}
	res, body = s.do(t, "POST", "/api/mistakes/retag", token, map[string]any{"project_id": opid, "category": "topic", "from": "Fractons", "to": "x"})
	wantStatus(t, res.StatusCode, 404, body)
}

func backdate(t *testing.T, id int64, ago time.Duration) {
	t.Helper()
	if _, err := testPool.Exec(context.Background(), `UPDATE mistakes SET created_at = now() - $2::interval WHERE id = $1`, id, fmt.Sprintf("%d seconds", int(ago.Seconds()))); err != nil {
		t.Fatal(err)
	}
}

func TestMistakePatterns(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "patterns@example.test")
	pid := s.createProject(t, token, "Chemistry")
	add := func(topic, kind string, ago time.Duration) {
		t.Helper()
		res, body := s.do(t, "POST", "/api/mistakes", token, mk(pid, topic, kind, nil))
		wantStatus(t, res.StatusCode, 201, body)
		var m store.Mistake
		decode(t, body, &m)
		backdate(t, m.ID, ago)
	}
	patterns := func(q string) []store.PatternAlert {
		t.Helper()
		res, body := s.do(t, "GET", "/api/mistakes/patterns"+q, token, nil)
		wantStatus(t, res.StatusCode, 200, body)
		var a []store.PatternAlert
		decode(t, body, &a)
		return a
	}
	day := 24 * time.Hour
	add("Moles", "careless", 1*day)
	add("Moles", "careless", 13*day)
	add("Moles", "careless", 15*day) // outside the 14-day window
	add("Moles", "didnt_know", 2*day)
	if a := patterns(""); len(a) != 0 {
		t.Fatalf("2 in window must not alert: %+v", a)
	}
	add("Bonds", "careless", 3*day)
	// Topic+type still 2; type alone now 3 (Moles x2 + Bonds).
	a := patterns("?project_id=" + itoa(pid))
	if len(a) != 1 || strings.Join(a[0].Categories, ",") != "mistake_type" || a[0].Values[0] != "careless" || a[0].Count != 3 {
		t.Fatalf("type pattern: %+v", a)
	}
	add("Moles", "careless", 4*day)
	a = patterns("")
	if len(a) != 2 || strings.Join(a[0].Categories, ",") != "mistake_type" || a[0].Count != 4 ||
		strings.Join(a[1].Values, "|") != "Moles|careless" || a[1].Count != 3 || len(a[1].MistakeIDs) != 3 {
		t.Fatalf("patterns: %+v", a)
	}
	// A stricter rule from the user's setup applies.
	cfg := store.DefaultJournalConfig()
	cfg.Patterns.Threshold = 5
	if res, body := s.do(t, "PUT", "/api/journal", token, map[string]any{"config": cfg}); res.StatusCode != 200 {
		t.Fatalf("config: %d %s", res.StatusCode, body)
	}
	if a := patterns(""); len(a) != 0 {
		t.Fatalf("threshold 5: %+v", a)
	}
	if res, _ := s.do(t, "GET", "/api/mistakes/patterns?project_id=999999", token, nil); res.StatusCode != 404 {
		t.Fatalf("unknown project: %d", res.StatusCode)
	}
}

func TestMistakeReviewDeck(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "review-deck@example.test")
	pid := s.createProject(t, token, "French")
	add := func(topic string, ago time.Duration) store.Mistake {
		t.Helper()
		res, body := s.do(t, "POST", "/api/mistakes", token, mk(pid, topic, "didnt_know", nil))
		wantStatus(t, res.StatusCode, 201, body)
		var m store.Mistake
		decode(t, body, &m)
		backdate(t, m.ID, ago)
		return m
	}
	day := 24 * time.Hour
	recent := add("Grammar", 2*day)
	old := add("Vocab", 10*day)
	drill := add("Reading", 30*day)
	res, body := s.do(t, "POST", "/api/mistakes/"+itoa(drill.ID)+"/review", token, map[string]any{"grade": "needs_drill"})
	wantStatus(t, res.StatusCode, 200, body)

	deck := func(q string) map[int64]bool {
		t.Helper()
		res, body := s.do(t, "GET", "/api/mistakes/review"+q, token, nil)
		wantStatus(t, res.StatusCode, 200, body)
		var l []store.Mistake
		decode(t, body, &l)
		out := map[int64]bool{}
		for _, m := range l {
			out[m.ID] = true
		}
		return out
	}
	d := deck("")
	if !d[recent.ID] || d[old.ID] || !d[drill.ID] || len(d) != 2 {
		t.Fatalf("deck: %v", d)
	}
	// "Review these" for one topic includes older, unlearned ones too.
	if d := deck("?tag=topic:Vocab"); !d[old.ID] || len(d) != 1 {
		t.Fatalf("topic deck: %v", d)
	}
	res, body = s.do(t, "POST", "/api/mistakes/"+itoa(recent.ID)+"/review", token, map[string]any{"grade": "review_next_week"})
	wantStatus(t, res.StatusCode, 200, body)
	var graded store.Mistake
	decode(t, body, &graded)
	if graded.Status != "review_next_week" || graded.LastReviewedAt == nil {
		t.Fatalf("graded: %+v", graded)
	}
	res, body = s.do(t, "POST", "/api/mistakes/"+itoa(drill.ID)+"/review", token, map[string]any{"grade": "locked_in"})
	wantStatus(t, res.StatusCode, 200, body)
	if d := deck(""); len(d) != 0 {
		t.Fatalf("deck after grading: %v", d)
	}
	if _, err := testPool.Exec(context.Background(), `UPDATE mistakes SET last_reviewed_at = now() - interval '7 days' WHERE id = $1`, recent.ID); err != nil {
		t.Fatal(err)
	}
	if d := deck(""); !d[recent.ID] || len(d) != 1 {
		t.Fatalf("review next week should return after 6 days: %v", d)
	}
	res, body = s.do(t, "POST", "/api/mistakes/"+itoa(recent.ID)+"/review", token, map[string]any{"grade": "active"})
	wantStatus(t, res.StatusCode, 400, body)
}

func xlsxBytes(t *testing.T, rows [][]any) string {
	t.Helper()
	f := excelize.NewFile()
	defer f.Close()
	f.SetSheetName("Sheet1", "Mistakes")
	for i, r := range rows {
		if err := f.SetSheetRow("Mistakes", fmt.Sprintf("A%d", i+1), &r); err != nil {
			t.Fatal(err)
		}
	}
	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		t.Fatal(err)
	}
	return buf.String()
}

func TestMistakeImportAndExport(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "mistake-import@example.test")
	pid := s.createProject(t, token, "IBPS PO")
	s.createProject(t, token, "SSC CGL")
	res, body := s.do(t, "POST", "/api/mocks", token, mockBody(pid, "Mock 7"))
	wantStatus(t, res.StatusCode, 201, body)
	cfg := store.DefaultJournalConfig()
	cfg.Fields = append(cfg.Fields, store.JournalField{Key: "page", Label: "Page", Type: "number"})
	if res, body := s.do(t, "PUT", "/api/journal", token, map[string]any{"config": cfg}); res.StatusCode != 200 {
		t.Fatalf("config: %d %s", res.StatusCode, body)
	}

	res, body = s.do(t, "GET", "/api/import/mistakes-template.xlsx", token, nil)
	wantStatus(t, res.StatusCode, 200, body)
	tf, err := excelize.OpenReader(bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	hdr, _ := tf.GetRows("Mistakes")
	tf.Close()
	if len(hdr) != 1 || strings.Join(hdr[0], "|") != "Date|Project|Test|Topic|Mistake type|Source|What went wrong|Lesson for next time|Correct approach|Page|Actual seconds|Expected seconds|Status" {
		t.Fatalf("template header: %v", hdr)
	}

	// New-style headers (labels) and old exam headers both import.
	file := xlsxBytes(t, [][]any{
		{"Date", "Project", "Test", "Topic", "Mistake type", "Source", "What went wrong", "Lesson for next time", "Page", "Actual seconds", "Expected seconds", "Status"},
		{"2026-10-01", "SSC CGL", "", "Grammar", "Didn't know it", "Book", "Subject-verb agreement", "Find the real subject", 12, 60, 30, ""},
		{"", "", "Mock 7", "Data Interpretation", "careless", "", "Misread units", "Circle units", "", "", "", "needs_drill"},
		{"", "Nope", "", "DI", "careless"},
		{"", "", "", "DI", "laziness"},
		{"", "", "", "DI", ""},
		{"2099-01-01", "", "", "DI", "careless"},
		{},
	})
	res, body = s.do(t, "POST", "/api/import/mistakes.xlsx?dry_run=1&project_id="+itoa(pid), token, file)
	wantStatus(t, res.StatusCode, 200, body)
	var r struct {
		Rows, Valid, Imported int
		DryRun                bool `json:"dry_run"`
		Errors                []struct {
			Row     int
			Message string
		}
	}
	decode(t, body, &r)
	if r.Rows != 6 || r.Valid != 2 || r.Imported != 0 || !r.DryRun || len(r.Errors) != 4 || r.Errors[0].Row != 4 {
		t.Fatalf("dry run: %+v", r)
	}
	res, body = s.do(t, "GET", "/api/mistakes", token, nil)
	if strings.TrimSpace(string(body)) != "[]" {
		t.Fatalf("dry run wrote rows: %s", body)
	}
	res, body = s.do(t, "POST", "/api/import/mistakes.xlsx?project_id="+itoa(pid), token, file)
	wantStatus(t, res.StatusCode, 200, body)
	decode(t, body, &r)
	if r.Imported != 2 {
		t.Fatalf("import: %+v", r)
	}
	legacy := xlsxBytes(t, [][]any{
		{"Date", "Project", "Mock", "Subject", "Pattern", "Root cause", "Question / trap", "Execution rule", "Solution", "Actual seconds", "Ideal seconds", "Status"},
		{"", "", "", "Reasoning", "Puzzles", "Ego trap", "", "", "", 200, 45, ""},
	})
	res, body = s.do(t, "POST", "/api/import/mistakes.xlsx?project_id="+itoa(pid), token, legacy)
	wantStatus(t, res.StatusCode, 200, body)
	decode(t, body, &r)
	if r.Imported != 1 {
		t.Fatalf("legacy import: %+v", r)
	}

	res, body = s.do(t, "GET", "/api/mistakes", token, nil)
	var l []store.Mistake
	decode(t, body, &l)
	byTopic := map[string]store.Mistake{}
	for _, m := range l {
		byTopic[m.Tags["topic"].(string)] = m
	}
	g := byTopic["Grammar"]
	if g.Tags["mistake_type"] != "didnt_know" || g.Tags["source"] != "book" || g.ProjectID == pid || g.CreatedAt.Format("2006-01-02") != "2026-10-01" || *g.ActualSeconds != 60 || g.Extra["page"] != 12.0 {
		t.Fatalf("grammar row: %+v", g)
	}
	di := byTopic["Data Interpretation"]
	if di.Tags["mistake_type"] != "careless" || di.MockID == nil || di.Status != "needs_drill" || di.ProjectID != pid {
		t.Fatalf("di row: %+v", di)
	}
	if p := byTopic["Puzzles"]; p.Tags["mistake_type"] != "time" || p.Tags["subject"] != nil {
		t.Fatalf("legacy row: %+v", p)
	}

	res, body = s.do(t, "POST", "/api/import/mistakes.xlsx", token, "not a workbook")
	wantStatus(t, res.StatusCode, 400, body)
	res, body = s.do(t, "POST", "/api/import/mistakes.xlsx", token, xlsxBytes(t, [][]any{{"Foo", "Bar"}}))
	wantStatus(t, res.StatusCode, 400, body)

	// Export round-trips: the Mistakes sheet uses the setup's labels.
	res, body = s.do(t, "GET", "/api/export.xlsx", token, nil)
	wantStatus(t, res.StatusCode, 200, body)
	f, err := excelize.OpenReader(bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	rows, _ := f.GetRows("Mistakes")
	if len(rows) != 4 || rows[0][4] != "Mistake type" || !strings.Contains(fmt.Sprint(rows), "Didn't know it") {
		t.Fatalf("mistakes sheet: %v", rows)
	}
	mrows, _ := f.GetRows("Mocks")
	if len(mrows) != 2 || mrows[1][1] != "Mock 7" || mrows[1][4] != "44.75" {
		t.Fatalf("mocks sheet: %v", mrows)
	}
	res, body = s.do(t, "POST", "/api/import/mistakes.xlsx", token, string(body))
	wantStatus(t, res.StatusCode, 200, body)
	decode(t, body, &r)
	if r.Imported != 3 || len(r.Errors) != 0 {
		t.Fatalf("re-import of export: %+v", r)
	}
}
