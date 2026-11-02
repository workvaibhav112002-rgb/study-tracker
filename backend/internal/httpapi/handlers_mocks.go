package httpapi

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"study-tracker-backend/internal/store"
)

const (
	maxSections       = 8
	maxSectionQs      = 300
	maxMockNameLen    = 120
	maxProviderLen    = 80
	maxQuestionLen    = 2000
	maxRuleLen        = 2000
	maxSolutionLen    = 4000
	maxMistakeSeconds = 3600
)

func finiteIn(field string, v, lo, hi float64) error {
	if v != v || v < lo || v > hi { // v != v catches NaN
		return invalid("%s must be between %g and %g", field, lo, hi)
	}
	return nil
}

// ---- exam templates ----

type examTemplateRequest struct {
	ExamTemplate *store.ExamTemplate `json:"exam_template"`
}

func validateExamTemplate(t *store.ExamTemplate) (*store.ExamTemplate, error) {
	if t == nil {
		return nil, nil
	}
	key, err := cleanText("key", t.Key, 40, false)
	if err != nil {
		return nil, err
	}
	if len(t.Sections) == 0 || len(t.Sections) > maxSections {
		return nil, invalid("an exam needs between 1 and %d sections", maxSections)
	}
	out := &store.ExamTemplate{Key: key, Sections: make([]store.ExamSection, 0, len(t.Sections))}
	for _, s := range t.Sections {
		name, err := cleanText("section name", s.Name, 40, true)
		if err != nil {
			return nil, err
		}
		if err := inRange("section questions", s.Questions, 1, maxSectionQs); err != nil {
			return nil, err
		}
		if err := finiteIn("marks each", s.MarksEach, 0.01, 10); err != nil {
			return nil, err
		}
		if err := inRange("section minutes", s.Minutes, 0, 300); err != nil {
			return nil, err
		}
		out.Sections = append(out.Sections, store.ExamSection{Name: name, Questions: s.Questions, MarksEach: s.MarksEach, Minutes: s.Minutes})
	}
	checks := []struct {
		field  string
		v      float64
		lo, hi float64
	}{
		{"negative_fraction", t.NegativeFraction, 0, 1},
		{"target_score", t.TargetScore, 0, 10000},
		{"accuracy_threshold", t.AccuracyThreshold, 0, 100},
		{"penalty_limit", t.PenaltyLimit, 0, 1000},
	}
	for _, c := range checks {
		if err := finiteIn(c.field, c.v, c.lo, c.hi); err != nil {
			return nil, err
		}
	}
	out.NegativeFraction = t.NegativeFraction
	out.TargetScore = t.TargetScore
	out.AccuracyThreshold = t.AccuracyThreshold
	out.PenaltyLimit = t.PenaltyLimit
	return out, nil
}

func (a *api) setExamTemplate(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	var req examTemplateRequest
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	t, err := validateExamTemplate(req.ExamTemplate)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	p, err := a.store.SetExamTemplate(r.Context(), userID(r), id, t)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, p)
}

// ---- mocks ----

type mockRequest struct {
	ProjectID   int64               `json:"project_id"`
	Name        string              `json:"name"`
	Provider    string              `json:"provider"`
	AttemptedOn string              `json:"attempted_on"`
	Percentile  *float64            `json:"percentile"`
	Rank        *int                `json:"rank"`
	Sections    []store.MockSection `json:"sections"`
	Notes       string              `json:"notes"`
}

func validDay(field, s string, now time.Time) (string, error) {
	s = strings.TrimSpace(s)
	d, err := time.Parse("2006-01-02", s)
	if err != nil {
		return "", invalid("%s must be YYYY-MM-DD", field)
	}
	if d.Year() < 2000 || d.After(now.AddDate(0, 0, 1)) {
		return "", invalid("%s must not be in the future", field)
	}
	return s, nil
}

func (m mockRequest) validate(now time.Time) (store.MockInput, error) {
	var in store.MockInput
	if m.ProjectID <= 0 {
		return in, invalid("project_id is required")
	}
	name, err := cleanText("name", m.Name, maxMockNameLen, true)
	if err != nil {
		return in, err
	}
	provider, err := cleanText("provider", m.Provider, maxProviderLen, false)
	if err != nil {
		return in, err
	}
	day, err := validDay("attempted_on", m.AttemptedOn, now)
	if err != nil {
		return in, err
	}
	if m.Percentile != nil {
		if err := finiteIn("percentile", *m.Percentile, 0, 100); err != nil {
			return in, err
		}
	}
	if m.Rank != nil && *m.Rank < 1 {
		return in, invalid("rank must be at least 1")
	}
	notes, err := cleanText("notes", m.Notes, maxNotesLen, false)
	if err != nil {
		return in, err
	}
	if len(m.Sections) == 0 || len(m.Sections) > maxSections {
		return in, invalid("a mock needs between 1 and %d sections", maxSections)
	}
	sections := make([]store.MockSection, 0, len(m.Sections))
	for _, s := range m.Sections {
		sname, err := cleanText("section name", s.Name, 40, true)
		if err != nil {
			return in, err
		}
		if err := inRange("section questions", s.Questions, 1, maxSectionQs); err != nil {
			return in, err
		}
		if s.Correct < 0 || s.Incorrect < 0 {
			return in, invalid("correct and incorrect must not be negative")
		}
		if s.Correct+s.Incorrect > s.Questions {
			return in, invalid("%s: correct plus incorrect is more than the number of questions", sname)
		}
		if err := inRange("section seconds", s.Seconds, 0, 36000); err != nil {
			return in, err
		}
		if err := finiteIn("marks each", s.MarksEach, 0.01, 10); err != nil {
			return in, err
		}
		if err := finiteIn("negative each", s.NegativeEach, 0, 10); err != nil {
			return in, err
		}
		s.Name = sname
		sections = append(sections, s)
	}
	return store.MockInput{
		ProjectID: m.ProjectID, Name: name, Provider: provider, AttemptedOn: day,
		Percentile: m.Percentile, Rank: m.Rank, Sections: sections, Notes: notes,
	}, nil
}

func (a *api) listMocks(w http.ResponseWriter, r *http.Request) {
	pid, err := parseOptionalID(r.URL.Query().Get("project_id"), "project_id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	mocks, err := a.store.ListMocks(r.Context(), userID(r), pid)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, mocks)
}

func (a *api) saveMock(w http.ResponseWriter, r *http.Request, id int64) {
	var req mockRequest
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	in, err := req.validate(time.Now())
	if err != nil {
		handleErr(w, r, err)
		return
	}
	var m store.Mock
	status := http.StatusCreated
	if id == 0 {
		m, err = a.store.CreateMock(r.Context(), userID(r), in)
	} else {
		m, err = a.store.UpdateMock(r.Context(), userID(r), id, in)
		status = http.StatusOK
	}
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, status, m)
}

func (a *api) createMock(w http.ResponseWriter, r *http.Request) { a.saveMock(w, r, 0) }

func (a *api) updateMock(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	a.saveMock(w, r, id)
}

func (a *api) deleteMock(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	if err := a.store.DeleteMock(r.Context(), userID(r), id); err != nil {
		handleErr(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- mistakes ----

type mistakeRequest struct {
	ProjectID     int64          `json:"project_id"`
	MockID        *int64         `json:"mock_id"`
	Tags          map[string]any `json:"tags"`
	Extra         map[string]any `json:"extra"`
	Question      string         `json:"question"`
	Rule          string         `json:"rule"`
	Solution      string         `json:"solution"`
	ActualSeconds *int           `json:"actual_seconds"`
	IdealSeconds  *int           `json:"ideal_seconds"`
	Status        string         `json:"status"`
}

func (m mistakeRequest) validate(cfg store.JournalConfig) (store.MistakeInput, error) {
	var in store.MistakeInput
	if m.ProjectID <= 0 {
		return in, invalid("project_id is required")
	}
	if m.MockID != nil && *m.MockID <= 0 {
		m.MockID = nil
	}
	tags, err := validateTags(m.Tags, cfg)
	if err != nil {
		return in, err
	}
	extra, err := validateExtra(m.Extra)
	if err != nil {
		return in, err
	}
	question, err := cleanText("question", m.Question, maxQuestionLen, false)
	if err != nil {
		return in, err
	}
	rule, err := cleanText("rule", m.Rule, maxRuleLen, false)
	if err != nil {
		return in, err
	}
	solution, err := cleanText("solution", m.Solution, maxSolutionLen, false)
	if err != nil {
		return in, err
	}
	for _, p := range []struct {
		field string
		v     *int
	}{{"actual_seconds", m.ActualSeconds}, {"ideal_seconds", m.IdealSeconds}} {
		if p.v != nil {
			if err := inRange(p.field, *p.v, 0, maxMistakeSeconds); err != nil {
				return in, err
			}
		}
	}
	if m.Status != "" {
		if err := oneOf("status", m.Status, store.MistakeStatuses); err != nil {
			return in, err
		}
	}
	return store.MistakeInput{
		ProjectID: m.ProjectID, MockID: m.MockID, Tags: tags, Extra: extra,
		Question: question, Rule: rule, Solution: solution,
		ActualSeconds: m.ActualSeconds, IdealSeconds: m.IdealSeconds, Status: m.Status,
	}, nil
}

func (a *api) listMistakes(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	var f store.MistakeFilter
	var err error
	if f.ProjectID, err = parseOptionalID(q.Get("project_id"), "project_id"); err != nil {
		handleErr(w, r, err)
		return
	}
	if f.MockID, err = parseOptionalID(q.Get("mock_id"), "mock_id"); err != nil {
		handleErr(w, r, err)
		return
	}
	if f.Tag, err = parseTagFilter(q.Get("tag")); err != nil {
		handleErr(w, r, err)
		return
	}
	f.Limit = 2000
	if raw := q.Get("limit"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n <= 0 {
			handleErr(w, r, invalid("limit must be a positive integer"))
			return
		}
		f.Limit = min(n, 2000)
	}
	f.Query = strings.TrimSpace(q.Get("q"))
	if len(f.Query) > 100 {
		f.Query = f.Query[:100]
	}
	if v := q.Get("status"); v != "" {
		if err := oneOf("status", v, store.MistakeStatuses); err != nil {
			handleErr(w, r, err)
			return
		}
		f.Status = v
	}
	if v := q.Get("since_days"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 3650 {
			handleErr(w, r, invalid("since_days must be between 1 and 3650"))
			return
		}
		since := time.Now().AddDate(0, 0, -n)
		f.Since = &since
	}
	list, err := a.store.ListMistakes(r.Context(), userID(r), f)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (a *api) saveMistake(w http.ResponseWriter, r *http.Request, id int64) {
	var req mistakeRequest
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	if req.ProjectID <= 0 {
		handleErr(w, r, invalid("project_id is required"))
		return
	}
	cfg, err := a.projectConfig(r.Context(), userID(r), req.ProjectID)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	in, err := req.validate(cfg)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	var m store.Mistake
	status := http.StatusCreated
	if id == 0 {
		m, err = a.store.CreateMistake(r.Context(), userID(r), in)
	} else {
		m, err = a.store.UpdateMistake(r.Context(), userID(r), id, in)
		status = http.StatusOK
	}
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, status, m)
}

func (a *api) createMistake(w http.ResponseWriter, r *http.Request) { a.saveMistake(w, r, 0) }

func (a *api) updateMistake(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	a.saveMistake(w, r, id)
}

func (a *api) deleteMistake(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	if err := a.store.DeleteMistake(r.Context(), userID(r), id); err != nil {
		handleErr(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *api) mistakeReviewDeck(w http.ResponseWriter, r *http.Request) {
	tag, err := parseTagFilter(r.URL.Query().Get("tag"))
	if err != nil {
		handleErr(w, r, err)
		return
	}
	deck, err := a.store.MistakeReviewDeck(r.Context(), userID(r), time.Now(), tag)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, deck)
}

func (a *api) gradeMistake(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	var req struct {
		Grade string `json:"grade"`
	}
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	if err := oneOf("grade", req.Grade, store.MistakeReviewSet); err != nil {
		handleErr(w, r, err)
		return
	}
	m, err := a.store.GradeMistake(r.Context(), userID(r), id, req.Grade, time.Now())
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, m)
}
