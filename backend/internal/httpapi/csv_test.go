package httpapi_test

import (
	"encoding/csv"
	"strings"
	"testing"
	"time"
)

func TestExportCSV(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "csv@example.test")
	pid := s.createProject(t, token, "Algebra, advanced")
	start := time.Date(2026, 2, 3, 4, 5, 0, 0, time.UTC)
	if res, body := s.sessionWith(t, token, map[string]any{"project_id": pid, "start_time": start.Format(time.RFC3339), "end_time": start.Add(25 * time.Minute).Format(time.RFC3339), "duration_seconds": 1500, "notes": "line one\n\"quoted\""}); res.StatusCode != 201 {
		t.Fatalf("session: %d %s", res.StatusCode, body)
	}
	res, body := s.do(t, "GET", "/api/export.csv?tz=Asia/Kolkata", token, nil)
	if res.StatusCode != 200 || !strings.HasPrefix(res.Header.Get("Content-Type"), "text/csv") {
		t.Fatalf("csv: %d %s %s", res.StatusCode, res.Header.Get("Content-Type"), body)
	}
	rows, err := csv.NewReader(strings.NewReader(string(body))).ReadAll()
	if err != nil {
		t.Fatalf("parse: %v\n%s", err, body)
	}
	if len(rows) != 2 || rows[0][0] != "project" || len(rows[0]) != 8 {
		t.Fatalf("rows: %v", rows)
	}
	r := rows[1]
	if r[0] != "Algebra, advanced" || r[1] != "2026-02-03T09:35:00+05:30" || r[3] != "25" || r[4] != "pomodoro" || r[5] != "4" || r[7] != "line one\n\"quoted\"" {
		t.Fatalf("row: %q", r)
	}
	if res, _ := s.do(t, "GET", "/api/export.csv", "", nil); res.StatusCode != 401 {
		t.Fatalf("anonymous: %d", res.StatusCode)
	}
}
