package httpapi

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"

	"study-tracker-backend/internal/store"
)

// exportXLSX streams an Excel workbook with one sheet per data type. Times
// are rendered in the requested timezone so the sheet reads naturally.
func (a *api) exportXLSX(w http.ResponseWriter, r *http.Request) {
	loc, err := parseLocation(r.URL.Query().Get("tz"))
	if err != nil {
		handleErr(w, r, err)
		return
	}
	ctx := r.Context()
	uid := userID(r)
	projects, err := a.store.ListProjects(ctx, uid)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	sessions, err := a.store.ListSessions(ctx, uid, store.SessionFilter{})
	if err != nil {
		handleErr(w, r, err)
		return
	}
	tasks, err := a.store.ListTasks(ctx, uid, store.TaskFilter{})
	if err != nil {
		handleErr(w, r, err)
		return
	}
	cards, err := a.store.ListCards(ctx, uid, store.CardFilter{})
	if err != nil {
		handleErr(w, r, err)
		return
	}
	notes, err := a.store.ListNotes(ctx, uid, store.NoteFilter{})
	if err != nil {
		handleErr(w, r, err)
		return
	}
	mocks, err := a.store.ListMocks(ctx, uid, nil)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	mistakes, err := a.store.ListMistakes(ctx, uid, store.MistakeFilter{})
	if err != nil {
		handleErr(w, r, err)
		return
	}

	projectName := make(map[int64]string, len(projects))
	templates := make(map[int64]*store.ExamTemplate, len(projects))
	for _, p := range projects {
		projectName[p.ID] = p.Name
		templates[p.ID] = p.ExamTemplate
	}
	ts := func(t time.Time) string { return t.In(loc).Format("2006-01-02 15:04") }
	optTs := func(t *time.Time) any {
		if t == nil {
			return ""
		}
		return ts(*t)
	}

	f := excelize.NewFile()
	defer f.Close()

	// Sessions is the first, default sheet.
	sheet := "Sessions"
	f.SetSheetName("Sheet1", sheet)
	writeSheet(f, sheet, []string{"Project", "Start", "End", "Minutes", "Type", "Focus rating", "Interruptions", "Notes"}, len(sessions), func(i int) []any {
		s := sessions[i]
		return []any{s.ProjectName, ts(s.StartTime), ts(s.EndTime), s.DurationSeconds / 60, s.SessionType, s.FocusRating, s.Interruptions, s.Notes}
	})

	totalMinutes := 0
	for _, s := range sessions {
		totalMinutes += s.DurationSeconds / 60
	}
	f.NewSheet("Projects")
	writeSheet(f, "Projects", []string{"Name", "Description", "Daily goal (min)", "Planned hours/week", "Exam date", "Total minutes", "Created"}, len(projects), func(i int) []any {
		p := projects[i]
		planned := any("")
		if p.PlannedHoursPerWeek != nil {
			planned = *p.PlannedHoursPerWeek
		}
		exam := ""
		if p.ExamDate != nil {
			exam = *p.ExamDate
		}
		return []any{p.Name, p.Description, p.TargetMinutesPerDay, planned, exam, p.TotalMinutes, ts(p.CreatedAt)}
	})

	f.NewSheet("Tasks")
	writeSheet(f, "Tasks", []string{"Project", "Task", "Estimate (pomodoros)", "Completed (pomodoros)", "Done", "Created", "Completed at"}, len(tasks), func(i int) []any {
		t := tasks[i]
		return []any{projectName[t.ProjectID], t.Title, t.EstimatePomodoros, t.CompletedPomodoros, t.Done, ts(t.CreatedAt), optTs(t.CompletedAt)}
	})

	f.NewSheet("Flashcards")
	writeSheet(f, "Flashcards", []string{"Project", "Front", "Back", "Tags", "Ease", "Interval (days)", "Repetitions", "Lapses", "Due", "Archived"}, len(cards), func(i int) []any {
		c := cards[i]
		return []any{projectName[c.ProjectID], c.Front, c.Back, strings.Join(c.Tags, ", "), c.Ease, c.IntervalDays, c.Repetitions, c.Lapses, ts(c.DueAt), c.Archived}
	})

	f.NewSheet("Notes")
	writeSheet(f, "Notes", []string{"Project", "Title", "Body", "Tags", "Pinned", "Updated"}, len(notes), func(i int) []any {
		n := notes[i]
		proj := ""
		if n.ProjectID != nil {
			proj = projectName[*n.ProjectID]
		}
		return []any{proj, n.Title, n.Body, strings.Join(n.Tags, ", "), n.Pinned, ts(n.UpdatedAt)}
	})

	writeMockSheets(f, mocks, mistakes, projectName, templates, ts)

	f.NewSheet("Summary")
	rows := [][]any{
		{"Exported", ts(time.Now())},
		{"Timezone", loc.String()},
		{"Projects", len(projects)},
		{"Sessions", len(sessions)},
		{"Total minutes", totalMinutes},
		{"Tasks", len(tasks)},
		{"Flashcards", len(cards)},
		{"Notes", len(notes)},
		{"Mocks", len(mocks)},
		{"Mistakes", len(mistakes)},
	}
	for i, row := range rows {
		_ = f.SetSheetRow("Summary", fmt.Sprintf("A%d", i+1), &row)
	}
	_ = f.SetColWidth("Summary", "A", "A", 16)
	_ = f.SetColWidth("Summary", "B", "B", 22)

	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="study_tracker_%s.xlsx"`, time.Now().In(loc).Format("2006-01-02")))
	w.WriteHeader(http.StatusOK)
	_ = f.Write(w)
}

// writeSheet fills a header row (bold, frozen) and n data rows.
func writeSheet(f *excelize.File, sheet string, headers []string, n int, row func(i int) []any) {
	hdr := make([]any, len(headers))
	for i, h := range headers {
		hdr[i] = h
	}
	_ = f.SetSheetRow(sheet, "A1", &hdr)
	if style, err := f.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true}}); err == nil {
		end, _ := excelize.CoordinatesToCellName(len(headers), 1)
		_ = f.SetCellStyle(sheet, "A1", end, style)
	}
	_ = f.SetPanes(sheet, &excelize.Panes{Freeze: true, YSplit: 1, TopLeftCell: "A2", ActivePane: "bottomLeft"})
	for i := 0; i < n; i++ {
		r := row(i)
		_ = f.SetSheetRow(sheet, fmt.Sprintf("A%d", i+2), &r)
	}
	if last, err := excelize.ColumnNumberToName(len(headers)); err == nil {
		_ = f.SetColWidth(sheet, "A", last, 18)
	}
}

// mistakeColumns is shared by the Mistakes export sheet and the import
// template so an exported workbook can be imported again.
var mistakeSheetColumns = []string{"Date", "Project", "Mock", "Subject", "Pattern", "Root cause", "Question / trap", "Execution rule", "Solution", "Actual seconds", "Ideal seconds", "Status"}

func optInt(v *int) any {
	if v == nil {
		return ""
	}
	return *v
}

func writeMockSheets(f *excelize.File, mocks []store.Mock, mistakes []store.Mistake, projectName map[int64]string, templates map[int64]*store.ExamTemplate, ts func(time.Time) string) {
	mockName := make(map[int64]string, len(mocks))
	type sectionRow struct {
		mock store.Mock
		sc   SectionScore
		in   store.MockSection
	}
	var sectionRows []sectionRow
	scores := make([]MockScore, len(mocks))
	for i, m := range mocks {
		mockName[m.ID] = m.Name
		scores[i] = ScoreMock(m, templates[m.ProjectID])
		for j, sc := range scores[i].Sections {
			sectionRows = append(sectionRows, sectionRow{m, sc, m.Sections[j]})
		}
	}

	f.NewSheet("Mocks")
	writeSheet(f, "Mocks", []string{"Project", "Mock", "Provider", "Date", "Net score", "Max marks", "Accuracy %", "Attempt rate %", "Marks lost to negatives", "Percentile", "Rank"}, len(mocks), func(i int) []any {
		m, sc := mocks[i], scores[i]
		pctl := any("")
		if m.Percentile != nil {
			pctl = *m.Percentile
		}
		return []any{projectName[m.ProjectID], m.Name, m.Provider, m.AttemptedOn, sc.Net, sc.MaxMarks, sc.Accuracy, sc.AttemptRate, sc.Penalty, pctl, optInt(m.Rank)}
	})

	f.NewSheet("Mock sections")
	writeSheet(f, "Mock sections", []string{"Mock", "Date", "Section", "Questions", "Correct", "Incorrect", "Attempted", "Net", "Accuracy %", "Attempt rate %", "Minutes", "Flag"}, len(sectionRows), func(i int) []any {
		r := sectionRows[i]
		var flags []string
		if r.sc.LowAccuracy {
			flags = append(flags, "low accuracy")
		}
		if r.sc.HighPenalty {
			flags = append(flags, "high negatives")
		}
		return []any{r.mock.Name, r.mock.AttemptedOn, r.sc.Name, r.in.Questions, r.in.Correct, r.in.Incorrect, r.sc.Attempted, r.sc.Net, r.sc.Accuracy, r.sc.AttemptRate, round2(float64(r.in.Seconds) / 60), strings.Join(flags, ", ")}
	})

	f.NewSheet("Mistakes")
	writeSheet(f, "Mistakes", mistakeSheetColumns, len(mistakes), func(i int) []any {
		m := mistakes[i]
		mock := ""
		if m.MockID != nil {
			mock = mockName[*m.MockID]
		}
		return []any{ts(m.CreatedAt), projectName[m.ProjectID], mock, m.Subject, m.Pattern, m.RootCause, m.Question, m.Rule, m.Solution, optInt(m.ActualSeconds), optInt(m.IdealSeconds), m.Status}
	})
}
