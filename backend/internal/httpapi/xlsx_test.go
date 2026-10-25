package httpapi_test

import (
	"bytes"
	"strings"
	"testing"
	"time"

	"github.com/xuri/excelize/v2"
)

func TestExportXLSX(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "xlsx@example.test")
	pid := s.createProject(t, token, "Algebra")
	start := time.Date(2026, 2, 3, 4, 5, 0, 0, time.UTC)
	if res, body := s.createSession(t, token, pid, start, 1500); res.StatusCode != 201 {
		t.Fatalf("session: %d %s", res.StatusCode, body)
	}
	s.createTask(t, token, pid, "Read chapter 2")
	if res, body := s.do(t, "POST", "/api/cards", token, map[string]any{"project_id": pid, "front": "Q", "back": "A", "tags": []string{"x"}}); res.StatusCode != 201 {
		t.Fatalf("card: %d %s", res.StatusCode, body)
	}
	if res, body := s.do(t, "POST", "/api/notes", token, map[string]any{"project_id": pid, "title": "N", "body": "b", "tags": []string{}, "pinned": false}); res.StatusCode != 201 {
		t.Fatalf("note: %d %s", res.StatusCode, body)
	}

	res, body := s.do(t, "GET", "/api/export.xlsx?tz=Asia/Kolkata", token, nil)
	if res.StatusCode != 200 || !strings.Contains(res.Header.Get("Content-Type"), "spreadsheetml") {
		t.Fatalf("xlsx: %d %s", res.StatusCode, res.Header.Get("Content-Type"))
	}
	f, err := excelize.OpenReader(bytes.NewReader(body))
	if err != nil {
		t.Fatalf("open workbook: %v", err)
	}
	defer f.Close()
	want := []string{"Sessions", "Projects", "Tasks", "Flashcards", "Notes", "Summary"}
	if got := f.GetSheetList(); strings.Join(got, ",") != strings.Join(want, ",") {
		t.Fatalf("sheets: %v", got)
	}
	rows, err := f.GetRows("Sessions")
	if err != nil || len(rows) != 2 {
		t.Fatalf("session rows: %v %v", rows, err)
	}
	if rows[0][0] != "Project" || rows[1][0] != "Algebra" || rows[1][1] != "2026-02-03 09:35" || rows[1][3] != "25" {
		t.Fatalf("session row: %q", rows[1])
	}
	for sheet, col := range map[string]string{"Projects": "Algebra", "Tasks": "Read chapter 2", "Flashcards": "Q", "Notes": "N"} {
		r, _ := f.GetRows(sheet)
		found := false
		for _, row := range r[1:] {
			if strings.Contains(strings.Join(row, "|"), col) {
				found = true
			}
		}
		if len(r) < 2 || !found {
			t.Fatalf("%s rows: %v", sheet, r)
		}
	}
	if res, _ := s.do(t, "GET", "/api/export.xlsx", "", nil); res.StatusCode != 401 {
		t.Fatalf("anonymous: %d", res.StatusCode)
	}
}
