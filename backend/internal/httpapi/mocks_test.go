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
	res, body = s.do(t, "POST", "/api/mistakes", token, map[string]any{"project_id": pid, "mock_id": m.ID, "subject": "Quant", "pattern": "DI", "root_cause": "procedural"})
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

func TestMistakesFiltersAndOwnership(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "mistakes@example.test")
	other, _ := s.register(t, "mistakes-other@example.test")
	pid := s.createProject(t, token, "SBI PO")
	otherPid := s.createProject(t, other, "Other")
	res, body := s.do(t, "POST", "/api/mocks", other, mockBody(otherPid, "Other mock"))
	wantStatus(t, res.StatusCode, 201, body)
	var otherMock store.Mock
	decode(t, body, &otherMock)

	add := func(subject, pattern, root string, extra map[string]any) store.Mistake {
		t.Helper()
		b := map[string]any{"project_id": pid, "subject": subject, "pattern": pattern, "root_cause": root,
			"question": "Circular seating, 8 people", "rule": "Mark **N/S** first", "actual_seconds": 150, "ideal_seconds": 45}
		for k, v := range extra {
			b[k] = v
		}
		res, body := s.do(t, "POST", "/api/mistakes", token, b)
		wantStatus(t, res.StatusCode, 201, body)
		var m store.Mistake
		decode(t, body, &m)
		return m
	}
	first := add("Reasoning", "Seating Arrangement", "time_ego", nil)
	if first.Status != "active" || *first.ActualSeconds != 150 || first.Rule != "Mark **N/S** first" {
		t.Fatalf("mistake: %+v", first)
	}
	add("Quant", "Data Interpretation", "procedural", map[string]any{"question": "pie chart units"})
	add("Quant", "Data Interpretation", "concept", nil)

	for _, b := range []map[string]any{
		{"project_id": pid, "subject": "Quant", "pattern": "DI", "root_cause": "lazy"},
		{"project_id": pid, "subject": "", "pattern": "DI", "root_cause": "concept"},
		{"project_id": pid, "subject": "Quant", "pattern": "DI", "root_cause": "concept", "actual_seconds": 99999},
		{"project_id": pid, "subject": "Quant", "pattern": "DI", "root_cause": "concept", "status": "done"},
	} {
		if res, body := s.do(t, "POST", "/api/mistakes", token, b); res.StatusCode != 400 {
			t.Errorf("%v: %d %s", b, res.StatusCode, body)
		}
	}
	// A mock that belongs to someone else cannot be linked.
	res, body = s.do(t, "POST", "/api/mistakes", token, map[string]any{"project_id": pid, "mock_id": otherMock.ID, "subject": "Quant", "pattern": "DI", "root_cause": "concept"})
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
		"": 3, "?subject=Quant": 2, "?pattern=Data+Interpretation&root_cause=concept": 1,
		"?root_cause=time_ego&subject=Reasoning": 1, "?q=pie": 1, "?status=locked_in": 0, "?since_days=1": 3,
		"?project_id=" + itoa(pid): 3,
	} {
		if got := count(q); got != want {
			t.Errorf("filter %q: got %d want %d", q, got, want)
		}
	}
	if res, _ := s.do(t, "GET", "/api/mistakes?root_cause=bogus", token, nil); res.StatusCode != 400 {
		t.Errorf("bad root_cause filter: %d", res.StatusCode)
	}

	// Ownership on update/delete/grade.
	for _, req := range []struct{ method, path string }{
		{"PUT", "/api/mistakes/" + itoa(first.ID)}, {"DELETE", "/api/mistakes/" + itoa(first.ID)}, {"POST", "/api/mistakes/" + itoa(first.ID) + "/review"},
	} {
		res, body := s.do(t, req.method, req.path, other, map[string]any{"project_id": otherPid, "subject": "x", "pattern": "y", "root_cause": "concept", "grade": "locked_in"})
		if res.StatusCode != 404 {
			t.Errorf("%s %s by other: %d %s", req.method, req.path, res.StatusCode, body)
		}
	}
	res, body = s.do(t, "GET", "/api/mistakes", other, nil)
	if strings.Contains(string(body), "Seating") {
		t.Fatalf("other user sees mistakes: %s", body)
	}

	// Update keeps status unless set.
	res, body = s.do(t, "PUT", "/api/mistakes/"+itoa(first.ID), token, map[string]any{"project_id": pid, "subject": "Reasoning", "pattern": "Seating Arrangement", "root_cause": "concept"})
	wantStatus(t, res.StatusCode, 200, body)
	var upd store.Mistake
	decode(t, body, &upd)
	if upd.RootCause != "concept" || upd.Status != "active" || upd.Question != "" {
		t.Fatalf("updated: %+v", upd)
	}
}

func backdate(t *testing.T, id int64, ago time.Duration) {
	t.Helper()
	if _, err := testPool.Exec(context.Background(), `UPDATE mistakes SET created_at = now() - $2::interval WHERE id = $1`, id, fmt.Sprintf("%d seconds", int(ago.Seconds()))); err != nil {
		t.Fatal(err)
	}
}

func TestRepeatMistakes(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "repeats@example.test")
	pid := s.createProject(t, token, "NICL AO")
	add := func(pattern, root string, ago time.Duration) {
		t.Helper()
		res, body := s.do(t, "POST", "/api/mistakes", token, map[string]any{"project_id": pid, "subject": "Reasoning", "pattern": pattern, "root_cause": root})
		wantStatus(t, res.StatusCode, 201, body)
		var m store.Mistake
		decode(t, body, &m)
		backdate(t, m.ID, ago)
	}
	repeats := func() []store.RepeatAlert {
		t.Helper()
		res, body := s.do(t, "GET", "/api/mistakes/repeats", token, nil)
		wantStatus(t, res.StatusCode, 200, body)
		var a []store.RepeatAlert
		decode(t, body, &a)
		return a
	}
	day := 24 * time.Hour
	add("Puzzles", "time_ego", 1*day)
	add("Puzzles", "time_ego", 13*day)
	add("Puzzles", "time_ego", 15*day) // outside the 14-day window
	add("Puzzles", "concept", 2*day)   // different root cause
	if a := repeats(); len(a) != 0 {
		t.Fatalf("2 in window must not alert: %+v", a)
	}
	add("Puzzles", "time_ego", 3*day)
	a := repeats()
	if len(a) != 1 || a[0].Pattern != "Puzzles" || a[0].RootCause != "time_ego" || a[0].Count != 3 || a[0].Subject != "Reasoning" {
		t.Fatalf("repeat alert: %+v", a)
	}
}

func TestMistakeReviewDeck(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "review-deck@example.test")
	pid := s.createProject(t, token, "SSC CGL")
	add := func(pattern string, ago time.Duration) store.Mistake {
		t.Helper()
		res, body := s.do(t, "POST", "/api/mistakes", token, map[string]any{"project_id": pid, "subject": "English", "pattern": pattern, "root_cause": "concept"})
		wantStatus(t, res.StatusCode, 201, body)
		var m store.Mistake
		decode(t, body, &m)
		backdate(t, m.ID, ago)
		return m
	}
	day := 24 * time.Hour
	recent := add("Grammar", 2*day)
	old := add("Vocab", 10*day)
	drill := add("RC", 30*day)
	res, body := s.do(t, "POST", "/api/mistakes/"+itoa(drill.ID)+"/review", token, map[string]any{"grade": "needs_drill"})
	wantStatus(t, res.StatusCode, 200, body)

	deck := func() map[int64]bool {
		t.Helper()
		res, body := s.do(t, "GET", "/api/mistakes/review", token, nil)
		wantStatus(t, res.StatusCode, 200, body)
		var l []store.Mistake
		decode(t, body, &l)
		out := map[int64]bool{}
		for _, m := range l {
			out[m.ID] = true
		}
		return out
	}
	d := deck()
	if !d[recent.ID] || d[old.ID] || !d[drill.ID] || len(d) != 2 {
		t.Fatalf("deck: %v", d)
	}
	// Locked in leaves the deck; review next week leaves it until 6 days pass.
	res, body = s.do(t, "POST", "/api/mistakes/"+itoa(recent.ID)+"/review", token, map[string]any{"grade": "review_next_week"})
	wantStatus(t, res.StatusCode, 200, body)
	var graded store.Mistake
	decode(t, body, &graded)
	if graded.Status != "review_next_week" || graded.LastReviewedAt == nil {
		t.Fatalf("graded: %+v", graded)
	}
	res, body = s.do(t, "POST", "/api/mistakes/"+itoa(drill.ID)+"/review", token, map[string]any{"grade": "locked_in"})
	wantStatus(t, res.StatusCode, 200, body)
	if d := deck(); len(d) != 0 {
		t.Fatalf("deck after grading: %v", d)
	}
	if _, err := testPool.Exec(context.Background(), `UPDATE mistakes SET last_reviewed_at = now() - interval '7 days' WHERE id = $1`, recent.ID); err != nil {
		t.Fatal(err)
	}
	if d := deck(); !d[recent.ID] || len(d) != 1 {
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

	res, body = s.do(t, "GET", "/api/import/mistakes-template.xlsx", token, nil)
	wantStatus(t, res.StatusCode, 200, body)
	tf, err := excelize.OpenReader(bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	hdr, _ := tf.GetRows("Mistakes")
	tf.Close()
	if len(hdr) != 1 || hdr[0][3] != "Subject" {
		t.Fatalf("template header: %v", hdr)
	}

	file := xlsxBytes(t, [][]any{
		{"Date", "Project", "Mock", "Subject", "Pattern", "Root cause", "Question / trap", "Execution rule", "Solution", "Actual seconds", "Ideal seconds", "Status"},
		{"2026-10-01", "SSC CGL", "", "English", "Grammar", "Concept Gap", "Subject-verb agreement", "Find the real subject", "", 60, 30, ""},
		{"", "", "Mock 7", "Quant", "Data Interpretation", "Calculation flaw", "Misread units", "Circle units", "", "", "", "needs_drill"},
		{"", "", "", "Reasoning", "Puzzles", "Ego trap", "", "", "", 200, 45, ""},
		{"", "Nope", "", "Quant", "DI", "concept"},
		{"", "", "", "Quant", "DI", "laziness"},
		{"2099-01-01", "", "", "Quant", "DI", "concept"},
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
	if r.Rows != 6 || r.Valid != 3 || r.Imported != 0 || !r.DryRun || len(r.Errors) != 3 || r.Errors[0].Row != 5 {
		t.Fatalf("dry run: %+v", r)
	}
	res, body = s.do(t, "GET", "/api/mistakes", token, nil)
	if strings.TrimSpace(string(body)) != "[]" {
		t.Fatalf("dry run wrote rows: %s", body)
	}
	res, body = s.do(t, "POST", "/api/import/mistakes.xlsx?project_id="+itoa(pid), token, file)
	wantStatus(t, res.StatusCode, 200, body)
	decode(t, body, &r)
	if r.Imported != 3 {
		t.Fatalf("import: %+v", r)
	}
	res, body = s.do(t, "GET", "/api/mistakes", token, nil)
	var l []store.Mistake
	decode(t, body, &l)
	byPattern := map[string]store.Mistake{}
	for _, m := range l {
		byPattern[m.Pattern] = m
	}
	g := byPattern["Grammar"]
	if g.RootCause != "concept" || g.ProjectID == pid || g.CreatedAt.Format("2006-01-02") != "2026-10-01" || *g.ActualSeconds != 60 {
		t.Fatalf("grammar row: %+v", g)
	}
	di := byPattern["Data Interpretation"]
	if di.RootCause != "procedural" || di.MockID == nil || di.Status != "needs_drill" || di.ProjectID != pid {
		t.Fatalf("di row: %+v", di)
	}
	if byPattern["Puzzles"].RootCause != "time_ego" {
		t.Fatalf("puzzles row: %+v", byPattern["Puzzles"])
	}

	res, body = s.do(t, "POST", "/api/import/mistakes.xlsx", token, "not a workbook")
	wantStatus(t, res.StatusCode, 400, body)
	res, body = s.do(t, "POST", "/api/import/mistakes.xlsx", token, xlsxBytes(t, [][]any{{"Foo", "Bar"}}))
	wantStatus(t, res.StatusCode, 400, body)

	// Export round-trips: the Mistakes sheet uses the import columns.
	res, body = s.do(t, "GET", "/api/export.xlsx", token, nil)
	wantStatus(t, res.StatusCode, 200, body)
	f, err := excelize.OpenReader(bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	rows, _ := f.GetRows("Mistakes")
	if len(rows) != 4 || rows[0][5] != "Root cause" {
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
