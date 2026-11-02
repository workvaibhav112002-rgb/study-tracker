package httpapi

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"slices"
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

// mistakeTemplate serves an empty workbook laid out from the user's setup
// (or a project's, with ?project_id=).
func (a *api) mistakeTemplate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	uid := userID(r)
	pid, err := parseOptionalID(r.URL.Query().Get("project_id"), "project_id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	cfg, err := a.effectiveConfig(ctx, uid, nil)
	if pid != nil {
		cfg, err = a.projectConfig(ctx, uid, *pid)
	}
	if err != nil {
		handleErr(w, r, err)
		return
	}
	cols := buildMistakeColumns(cfg, nil)
	f := excelize.NewFile()
	defer f.Close()
	f.SetSheetName("Sheet1", "Mistakes")
	writeSheet(f, "Mistakes", cols.headers(), 0, nil)
	f.NewSheet("How to fill")
	help := [][]any{{"Column", "What to put"}, {"Date", "YYYY-MM-DD (or a date cell). Blank means today."}, {"Project", "Exact name of one of your projects. Blank uses the project chosen in the app."}, {"Test", "Name of a test you logged (optional)."}}
	for _, cat := range cfg.Categories {
		what := "Any text."
		if !cat.AllowNew {
			labels := make([]string, 0, len(cat.Options))
			for _, o := range cat.Options {
				labels = append(labels, o.Label)
			}
			what = "One of: " + strings.Join(labels, ", ")
		}
		if cat.Multi {
			what += " Separate several with commas."
		}
		if cat.Required {
			what = "Required. " + what
		}
		help = append(help, []any{cat.Label, what})
	}
	help = append(help, []any{"Actual / Expected seconds", "Whole seconds, 0 to 3600 (optional)."}, []any{"Status", "active, locked_in, review_next_week or needs_drill (optional)."})
	for i, row := range help {
		_ = f.SetSheetRow("How to fill", fmt.Sprintf("A%d", i+1), &row)
	}
	_ = f.SetColWidth("How to fill", "A", "A", 28)
	_ = f.SetColWidth("How to fill", "B", "B", 90)
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
	Rows     int              `json:"rows"`
	Valid    int              `json:"valid"`
	Imported int              `json:"imported"`
	DryRun   bool             `json:"dry_run"`
	Errors   []importRowError `json:"errors"`
	Sample   []map[string]any `json:"sample"`
}

// legacyMistakeType maps the old exam wording onto the default mistake types.
func legacyMistakeType(s string) (string, bool) {
	s = strings.ToLower(strings.TrimSpace(s))
	switch {
	case s == "":
		return "", false
	case strings.Contains(s, "concept"), strings.Contains(s, "didn"):
		return "didnt_know", true
	case strings.Contains(s, "proced"), strings.Contains(s, "calc"), strings.Contains(s, "silly"), strings.Contains(s, "careless"):
		return "careless", true
	case strings.Contains(s, "time"), strings.Contains(s, "ego"), strings.Contains(s, "panic"):
		return "time", true
	}
	return "", false
}

// matchOption resolves a cell to an option key by key or label.
func matchOption(cat store.JournalCategory, cell string) (string, bool) {
	c := strings.ToLower(strings.TrimSpace(cell))
	for _, o := range cat.Options {
		if strings.ToLower(o.Key) == c || strings.ToLower(o.Label) == c {
			return o.Key, true
		}
	}
	if cat.Key == "mistake_type" {
		if k, ok := legacyMistakeType(cell); ok && slices.ContainsFunc(cat.Options, func(o store.JournalOption) bool { return o.Key == k }) {
			return k, true
		}
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

	header := make([]string, len(rows[0]))
	for i, h := range rows[0] {
		header[i] = strings.ToLower(strings.TrimSpace(h))
	}
	colOf := func(names ...string) int {
		for _, n := range names {
			if i := slices.Index(header, strings.ToLower(n)); i >= 0 {
				return i
			}
		}
		return -1
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
	defaultCfg, err := a.effectiveConfig(ctx, uid, nil)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	byName := make(map[string]int64, len(projects))
	cfgOf := make(map[int64]store.JournalConfig, len(projects))
	for _, p := range projects {
		byName[strings.ToLower(p.Name)] = p.ID
		cfgOf[p.ID] = defaultCfg
		if p.JournalConfig != nil {
			cfgOf[p.ID] = *p.JournalConfig
		}
	}
	if defaultProject != nil {
		if _, ok := cfgOf[*defaultProject]; !ok {
			handleErr(w, r, invalid("project_id is not one of your projects"))
			return
		}
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

	// Category columns are found per setup; old exam headers still work.
	legacy := map[string][]string{"subject": {"subject"}, "topic": {"pattern", "pattern tag"}, "mistake_type": {"root cause", "rootcause"}}
	catCol := func(cat store.JournalCategory) int {
		return colOf(append([]string{cat.Label, cat.Key}, legacy[cat.Key]...)...)
	}
	fieldCol := func(fd store.JournalField) int {
		names := []string{fd.Label, fd.Key}
		switch fd.Key {
		case "question":
			names = append(names, "question / trap", "question", "trap", "trap description", "what went wrong")
		case "rule":
			names = append(names, "execution rule", "rule", "correct execution rule", "lesson", "lesson for next time")
		case "solution":
			names = append(names, "solution", "solution notes", "correct approach")
		}
		return colOf(names...)
	}
	dateCol, projectCol, testCol := colOf("date", "created"), colOf("project"), colOf("test", "mock")
	actualCol, idealCol, statusCol := colOf("actual seconds", "actual time"), colOf("expected seconds", "ideal seconds", "ideal time"), colOf("status")
	known := 0
	for _, cat := range defaultCfg.Categories {
		if catCol(cat) >= 0 {
			known++
		}
	}
	for _, c := range cfgOf {
		for _, cat := range c.Categories {
			if catCol(cat) >= 0 {
				known++
			}
		}
	}
	if known == 0 {
		handleErr(w, r, invalid("the first row needs column headers that match your categories (for example Topic and Mistake type)"))
		return
	}

	now := time.Now()
	res := mistakeImportResult{DryRun: dryRun, Errors: []importRowError{}, Sample: []map[string]any{}}
	valid := make([]store.MistakeInput, 0, len(rows)-1)
	for i, row := range rows[1:] {
		cell := func(c int) string {
			if c >= 0 && c < len(row) {
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
		if name := cell(projectCol); name != "" {
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
		cfg := cfgOf[pid]
		tags := map[string]any{}
		bad := ""
		for _, cat := range cfg.Categories {
			raw := cell(catCol(cat))
			if raw == "" {
				continue
			}
			parts := []string{raw}
			if cat.Multi {
				parts = strings.Split(raw, ",")
			}
			var vals []any
			for _, part := range parts {
				part = strings.TrimSpace(part)
				if part == "" {
					continue
				}
				if k, ok := matchOption(cat, part); ok {
					vals = append(vals, k)
				} else if cat.AllowNew {
					vals = append(vals, part)
				} else {
					bad = fmt.Sprintf("%q is not an option of %s", part, cat.Label)
					break
				}
			}
			if bad != "" {
				break
			}
			if cat.Multi {
				tags[cat.Key] = vals
			} else if len(vals) > 0 {
				tags[cat.Key] = vals[0]
			}
		}
		if bad != "" {
			fail(bad)
			continue
		}
		actual, err := parseOptSeconds("actual seconds", cell(actualCol))
		if err != nil {
			fail(err.Error())
			continue
		}
		ideal, err := parseOptSeconds("expected seconds", cell(idealCol))
		if err != nil {
			fail(err.Error())
			continue
		}
		req := mistakeRequest{ProjectID: pid, Tags: tags, Extra: map[string]any{}, ActualSeconds: actual, IdealSeconds: ideal, Status: strings.ToLower(cell(statusCol))}
		for _, fd := range cfg.Fields {
			v := cell(fieldCol(fd))
			switch fd.Key {
			case "question":
				req.Question = v
			case "rule":
				req.Rule = v
			case "solution":
				req.Solution = v
			case "time":
			default:
				if v == "" {
					continue
				}
				switch fd.Type {
				case "number":
					if n, err := strconv.ParseFloat(v, 64); err == nil {
						req.Extra[fd.Key] = n
					}
				case "yesno":
					l := strings.ToLower(v)
					req.Extra[fd.Key] = l == "yes" || l == "true" || l == "y" || l == "1"
				default:
					req.Extra[fd.Key] = v
				}
			}
		}
		if id, ok := mockByName[strings.ToLower(cell(testCol))]; ok {
			req.MockID = &id
		}
		in, err := req.validate(cfg)
		if err != nil {
			fail(err.Error())
			continue
		}
		created, err := parseImportDate(cell(dateCol), now)
		if err != nil {
			fail(err.Error())
			continue
		}
		in.CreatedAt = created
		valid = append(valid, in)
		if len(res.Sample) < 5 {
			res.Sample = append(res.Sample, map[string]any{"tags": in.Tags, "question": in.Question})
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
