package httpapi

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"

	"study-tracker-backend/internal/store"
)

const (
	maxImportMistakeRows = 2000
	maxImportRowErrors   = 50
)

// mistakeTemplate serves an empty workbook with the import columns.
func (a *api) mistakeTemplate(w http.ResponseWriter, r *http.Request) {
	f := excelize.NewFile()
	defer f.Close()
	f.SetSheetName("Sheet1", "Mistakes")
	writeSheet(f, "Mistakes", mistakeSheetColumns, 0, nil)
	f.NewSheet("How to fill")
	help := [][]any{
		{"Column", "What to put"},
		{"Date", "YYYY-MM-DD (or a date cell). Blank means today."},
		{"Project", "Exact name of one of your projects. Blank uses the project chosen in the app."},
		{"Mock", "Name of a mock you logged (optional)."},
		{"Subject", "Required. e.g. Quant, Reasoning, English, Professional Knowledge."},
		{"Pattern", "Required. e.g. Data Interpretation, Seating Arrangement."},
		{"Root cause", "Required. concept, procedural (calculation) or time_ego (time panic / ego trap)."},
		{"Question / trap", "What the question was and the trap you fell into."},
		{"Execution rule", "The rule that prevents the mistake next time."},
		{"Solution", "Solution notes."},
		{"Actual seconds / Ideal seconds", "Whole seconds, 0 to 3600 (optional)."},
		{"Status", "active, locked_in, review_next_week or needs_drill (optional)."},
	}
	for i, row := range help {
		_ = f.SetSheetRow("How to fill", fmt.Sprintf("A%d", i+1), &row)
	}
	_ = f.SetColWidth("How to fill", "A", "A", 28)
	_ = f.SetColWidth("How to fill", "B", "B", 80)
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", `attachment; filename="mistake_log_template.xlsx"`)
	if err := f.Write(w); err != nil {
		a.logger.Error("write mistake template", "err", err)
	}
}

type importRowError struct {
	Row     int    `json:"row"`
	Message string `json:"message"`
}

type mistakeImportResult struct {
	Rows     int                 `json:"rows"`
	Valid    int                 `json:"valid"`
	Imported int                 `json:"imported"`
	DryRun   bool                `json:"dry_run"`
	Errors   []importRowError    `json:"errors"`
	Sample   []map[string]string `json:"sample"`
}

// parseRootCause accepts the stored values and the PRD's wording.
func parseRootCause(s string) (string, bool) {
	s = strings.ToLower(strings.TrimSpace(s))
	switch {
	case s == "":
		return "", false
	case strings.Contains(s, "concept"):
		return "concept", true
	case strings.Contains(s, "proced"), strings.Contains(s, "calc"), strings.Contains(s, "silly"):
		return "procedural", true
	case strings.Contains(s, "time"), strings.Contains(s, "ego"), strings.Contains(s, "panic"):
		return "time_ego", true
	}
	return "", false
}

var importDateLayouts = []string{"2006-01-02 15:04", "2006-01-02", "02/01/2006", "2/1/2006", "02-01-2006", "01-02-06", "1/2/06"}

func parseImportDate(s string, now time.Time) (*time.Time, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil, nil
	}
	for _, l := range importDateLayouts {
		if t, err := time.Parse(l, s); err == nil {
			t = t.Add(12 * time.Hour) // midday UTC keeps the calendar day in most timezones
			if t.After(now.Add(36*time.Hour)) || t.Year() < 2000 {
				return nil, fmt.Errorf("date %q is out of range", s)
			}
			return &t, nil
		}
	}
	if serial, err := strconv.ParseFloat(s, 64); err == nil {
		if t, err := excelize.ExcelDateToTime(serial, false); err == nil && t.Year() >= 2000 && !t.After(now.Add(36*time.Hour)) {
			return &t, nil
		}
	}
	return nil, fmt.Errorf("date %q is not YYYY-MM-DD", s)
}

func parseOptSeconds(field, s string) (*int, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil, nil
	}
	f, err := strconv.ParseFloat(s, 64)
	if err != nil || f < 0 || f > maxMistakeSeconds {
		return nil, fmt.Errorf("%s must be between 0 and %d", field, maxMistakeSeconds)
	}
	n := int(f)
	return &n, nil
}

// importMistakes reads an .xlsx body. With ?dry_run=1 it only validates.
// Valid rows are imported in one transaction; invalid rows are reported and
// skipped.
func (a *api) importMistakes(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	dryRun := q.Get("dry_run") == "1" || q.Get("dry_run") == "true"
	defaultProject, err := parseOptionalID(q.Get("project_id"), "project_id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	data, err := io.ReadAll(r.Body)
	if err != nil {
		handleErr(w, r, invalid("the file is too large"))
		return
	}
	f, err := excelize.OpenReader(bytes.NewReader(data), excelize.Options{UnzipSizeLimit: 64 << 20, UnzipXMLSizeLimit: 32 << 20})
	if err != nil {
		handleErr(w, r, invalid("the file is not an Excel workbook (.xlsx)"))
		return
	}
	defer f.Close()
	sheet := "Mistakes"
	if idx, _ := f.GetSheetIndex(sheet); idx < 0 {
		sheet = f.GetSheetName(0)
	}
	rows, err := f.GetRows(sheet)
	if err != nil || len(rows) == 0 {
		handleErr(w, r, invalid("the workbook has no rows"))
		return
	}
	if len(rows)-1 > maxImportMistakeRows {
		handleErr(w, r, invalid("import is limited to %d rows", maxImportMistakeRows))
		return
	}

	col := map[string]int{}
	aliases := map[string]string{
		"date": "date", "created": "date", "project": "project", "mock": "mock", "subject": "subject",
		"pattern": "pattern", "pattern tag": "pattern", "root cause": "root", "rootcause": "root",
		"question / trap": "question", "question": "question", "trap": "question", "trap description": "question",
		"execution rule": "rule", "rule": "rule", "correct execution rule": "rule",
		"solution": "solution", "solution notes": "solution",
		"actual seconds": "actual", "actual time": "actual", "ideal seconds": "ideal", "ideal time": "ideal", "status": "status",
	}
	for i, h := range rows[0] {
		if k, ok := aliases[strings.ToLower(strings.TrimSpace(h))]; ok {
			if _, dup := col[k]; !dup {
				col[k] = i
			}
		}
	}
	for _, need := range []string{"subject", "pattern", "root"} {
		if _, ok := col[need]; !ok {
			handleErr(w, r, invalid("the first row must have Subject, Pattern and Root cause columns"))
			return
		}
	}

	ctx := r.Context()
	uid := userID(r)
	projects, err := a.store.ListProjects(ctx, uid)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	if len(projects) == 0 {
		handleErr(w, r, invalid("create a project before importing"))
		return
	}
	byName := make(map[string]int64, len(projects))
	owned := make(map[int64]bool, len(projects))
	for _, p := range projects {
		byName[strings.ToLower(p.Name)] = p.ID
		owned[p.ID] = true
	}
	if defaultProject != nil && !owned[*defaultProject] {
		handleErr(w, r, invalid("project_id is not one of your projects"))
		return
	}
	mocks, err := a.store.ListMocks(ctx, uid, nil)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	mockByName := make(map[string]int64, len(mocks))
	for _, m := range mocks {
		mockByName[strings.ToLower(m.Name)] = m.ID
	}

	now := time.Now()
	res := mistakeImportResult{DryRun: dryRun, Errors: []importRowError{}, Sample: []map[string]string{}}
	valid := make([]store.MistakeInput, 0, len(rows)-1)
	for i, row := range rows[1:] {
		get := func(k string) string {
			if c, ok := col[k]; ok && c < len(row) {
				return strings.TrimSpace(row[c])
			}
			return ""
		}
		if strings.TrimSpace(strings.Join(row, "")) == "" {
			continue
		}
		res.Rows++
		rowNum := i + 2
		fail := func(msg string) {
			if len(res.Errors) < maxImportRowErrors {
				res.Errors = append(res.Errors, importRowError{Row: rowNum, Message: msg})
			}
		}
		var pid int64
		if name := get("project"); name != "" {
			id, ok := byName[strings.ToLower(name)]
			if !ok {
				fail(fmt.Sprintf("project %q does not exist", name))
				continue
			}
			pid = id
		} else if defaultProject != nil {
			pid = *defaultProject
		} else {
			pid = projects[0].ID
		}
		root, ok := parseRootCause(get("root"))
		if !ok {
			fail("root cause must be concept, procedural or time_ego")
			continue
		}
		actual, err := parseOptSeconds("actual seconds", get("actual"))
		if err != nil {
			fail(err.Error())
			continue
		}
		ideal, err := parseOptSeconds("ideal seconds", get("ideal"))
		if err != nil {
			fail(err.Error())
			continue
		}
		req := mistakeRequest{
			ProjectID: pid, Subject: get("subject"), Pattern: get("pattern"), RootCause: root,
			Question: get("question"), Rule: get("rule"), Solution: get("solution"),
			ActualSeconds: actual, IdealSeconds: ideal, Status: strings.ToLower(get("status")),
		}
		if id, ok := mockByName[strings.ToLower(get("mock"))]; ok {
			req.MockID = &id
		}
		in, err := req.validate()
		if err != nil {
			fail(err.Error())
			continue
		}
		created, err := parseImportDate(get("date"), now)
		if err != nil {
			fail(err.Error())
			continue
		}
		in.CreatedAt = created
		valid = append(valid, in)
		if len(res.Sample) < 5 {
			res.Sample = append(res.Sample, map[string]string{"subject": in.Subject, "pattern": in.Pattern, "root_cause": in.RootCause, "question": in.Question})
		}
	}
	res.Valid = len(valid)
	if !dryRun && len(valid) > 0 {
		n, err := a.store.CreateMistakes(ctx, uid, valid)
		if err != nil {
			handleErr(w, r, err)
			return
		}
		res.Imported = n
	}
	writeJSON(w, http.StatusOK, res)
}
