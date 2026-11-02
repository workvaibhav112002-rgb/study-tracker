package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"regexp"
	"slices"
	"sort"
	"strings"
	"time"

	"study-tracker-backend/internal/store"
)

var journalKeyRe = regexp.MustCompile(`^[a-z0-9_]{1,30}$`)

const (
	maxCategories     = 12
	maxCategoryOpts   = 200
	maxCustomFields   = 10
	maxFieldOptions   = 30
	maxJournalBytes   = 32 << 10
	maxTagValueLen    = 80
	maxMultiValues    = 10
	maxExtraStringLen = 500
	maxWatchCombos    = 6
)

var customFieldTypes = []string{"text", "number", "yesno", "select"}

// validateJournalConfig checks shape and limits. It returns a cleaned copy.
func validateJournalConfig(c *store.JournalConfig) (*store.JournalConfig, error) {
	if c == nil {
		return nil, nil
	}
	if b, _ := json.Marshal(c); len(b) > maxJournalBytes {
		return nil, invalid("the setup is too large")
	}
	if len(c.Categories) == 0 || len(c.Categories) > maxCategories {
		return nil, invalid("a setup needs between 1 and %d categories", maxCategories)
	}
	out := &store.JournalConfig{Version: 1, ReviewWeekday: c.ReviewWeekday, TestsEnabled: c.TestsEnabled}
	preset, err := cleanText("preset", c.Preset, 30, false)
	if err != nil {
		return nil, err
	}
	out.Preset = preset
	if err := inRange("review_weekday", c.ReviewWeekday, 0, 6); err != nil {
		return nil, err
	}
	catKeys := map[string]bool{}
	for _, cat := range c.Categories {
		if !journalKeyRe.MatchString(cat.Key) {
			return nil, invalid("category keys must be lowercase letters, digits or _")
		}
		if catKeys[cat.Key] {
			return nil, invalid("category %q appears twice", cat.Key)
		}
		catKeys[cat.Key] = true
		label, err := cleanText("category label", cat.Label, 40, true)
		if err != nil {
			return nil, err
		}
		if len(cat.Options) > maxCategoryOpts {
			return nil, invalid("%s has more than %d options", label, maxCategoryOpts)
		}
		if !cat.AllowNew && len(cat.Options) == 0 {
			return nil, invalid("%s needs at least one option, or allow new values", label)
		}
		opts := make([]store.JournalOption, 0, len(cat.Options))
		optKeys := map[string]bool{}
		for _, o := range cat.Options {
			if !journalKeyRe.MatchString(o.Key) || optKeys[o.Key] {
				return nil, invalid("%s has a missing or repeated option key", label)
			}
			optKeys[o.Key] = true
			ol, err := cleanText("option label", o.Label, 40, true)
			if err != nil {
				return nil, err
			}
			color := strings.TrimSpace(o.Color)
			if color != "" && !colorRe.MatchString(color) {
				return nil, invalid("option colours must be hex like #34d399")
			}
			opts = append(opts, store.JournalOption{Key: o.Key, Label: ol, Color: color})
		}
		out.Categories = append(out.Categories, store.JournalCategory{Key: cat.Key, Label: label, Multi: cat.Multi, Required: cat.Required, AllowNew: cat.AllowNew, Options: opts})
	}
	fieldKeys := map[string]bool{}
	custom := 0
	for _, f := range c.Fields {
		if !journalKeyRe.MatchString(f.Key) || fieldKeys[f.Key] || catKeys[f.Key] {
			return nil, invalid("field keys must be unique lowercase names")
		}
		fieldKeys[f.Key] = true
		label, err := cleanText("field label", f.Label, 40, true)
		if err != nil {
			return nil, err
		}
		nf := store.JournalField{Key: f.Key, Label: label, Type: f.Type, Hidden: f.Hidden}
		if slices.Contains(store.BuiltinJournalFields, f.Key) {
			nf.Type = "builtin"
		} else {
			custom++
			if err := oneOf("field type", f.Type, customFieldTypes); err != nil {
				return nil, err
			}
			if f.Type == "select" {
				if len(f.Options) == 0 || len(f.Options) > maxFieldOptions {
					return nil, invalid("%s needs between 1 and %d choices", label, maxFieldOptions)
				}
				for _, o := range f.Options {
					v, err := cleanText("choice", o, 40, true)
					if err != nil {
						return nil, err
					}
					nf.Options = append(nf.Options, v)
				}
			}
		}
		out.Fields = append(out.Fields, nf)
	}
	if custom > maxCustomFields {
		return nil, invalid("at most %d custom fields", maxCustomFields)
	}
	p := c.Patterns
	if err := inRange("repeat threshold", p.Threshold, 2, 20); err != nil {
		return nil, err
	}
	if err := inRange("repeat window", p.WindowDays, 1, 90); err != nil {
		return nil, err
	}
	if len(p.Watch) > maxWatchCombos {
		return nil, invalid("watch at most %d combinations", maxWatchCombos)
	}
	out.Patterns = store.JournalPatterns{Threshold: p.Threshold, WindowDays: p.WindowDays, Watch: [][]string{}}
	for _, combo := range p.Watch {
		if len(combo) == 0 || len(combo) > 3 {
			return nil, invalid("each watched combination needs 1 to 3 categories")
		}
		for _, k := range combo {
			if !catKeys[k] {
				return nil, invalid("watched category %q is not in the setup", k)
			}
		}
		out.Patterns.Watch = append(out.Patterns.Watch, slices.Clone(combo))
	}
	return out, nil
}

// effectiveConfig is the project's setup, else the user's default, else the built-in one.
func (a *api) effectiveConfig(ctx context.Context, uid int64, project *store.Project) (store.JournalConfig, error) {
	if project != nil && project.JournalConfig != nil {
		return *project.JournalConfig, nil
	}
	c, err := a.store.GetJournalConfig(ctx, uid)
	if err != nil {
		return store.JournalConfig{}, err
	}
	if c != nil {
		return *c, nil
	}
	return store.DefaultJournalConfig(), nil
}

func (a *api) projectConfig(ctx context.Context, uid, projectID int64) (store.JournalConfig, error) {
	projects, err := a.store.ListProjects(ctx, uid)
	if err != nil {
		return store.JournalConfig{}, err
	}
	for i := range projects {
		if projects[i].ID == projectID {
			return a.effectiveConfig(ctx, uid, &projects[i])
		}
	}
	return store.JournalConfig{}, store.ErrNotFound
}

func cleanTagValue(cat string, v any) (string, error) {
	s, ok := v.(string)
	if !ok {
		return "", invalid("%s must be text", cat)
	}
	return cleanText(cat, s, maxTagValueLen, false)
}

// validateTags normalises tag values and enforces required categories and
// fixed option lists from the setup. Unknown categories are kept (they may
// come from an earlier setup) but size-limited.
func validateTags(raw map[string]any, cfg store.JournalConfig) (map[string]any, error) {
	if len(raw) > maxCategories*2 {
		return nil, invalid("too many categories")
	}
	byKey := map[string]store.JournalCategory{}
	for _, c := range cfg.Categories {
		byKey[c.Key] = c
	}
	out := map[string]any{}
	for k, v := range raw {
		if !journalKeyRe.MatchString(k) {
			return nil, invalid("category keys must be lowercase names")
		}
		cat, known := byKey[k]
		label := k
		if known {
			label = cat.Label
		}
		var values []string
		switch t := v.(type) {
		case nil:
			continue
		case []any:
			if len(t) > maxMultiValues {
				return nil, invalid("%s allows at most %d values", label, maxMultiValues)
			}
			for _, x := range t {
				s, err := cleanTagValue(label, x)
				if err != nil {
					return nil, err
				}
				if s != "" && !slices.Contains(values, s) {
					values = append(values, s)
				}
			}
		default:
			s, err := cleanTagValue(label, t)
			if err != nil {
				return nil, err
			}
			if s != "" {
				values = []string{s}
			}
		}
		if len(values) == 0 {
			continue
		}
		if known && !cat.AllowNew {
			for _, val := range values {
				if !slices.ContainsFunc(cat.Options, func(o store.JournalOption) bool { return o.Key == val }) {
					return nil, invalid("%q is not an option of %s", val, label)
				}
			}
		}
		if known && cat.Multi {
			out[k] = values
		} else {
			if len(values) > 1 {
				return nil, invalid("%s takes one value", label)
			}
			out[k] = values[0]
		}
	}
	for _, c := range cfg.Categories {
		if _, ok := out[c.Key]; c.Required && !ok {
			return nil, invalid("%s is required", c.Label)
		}
	}
	return out, nil
}

func validateExtra(raw map[string]any) (map[string]any, error) {
	if len(raw) > maxCustomFields*2 {
		return nil, invalid("too many custom fields")
	}
	out := map[string]any{}
	for k, v := range raw {
		if !journalKeyRe.MatchString(k) {
			return nil, invalid("custom field keys must be lowercase names")
		}
		switch t := v.(type) {
		case nil:
		case bool, float64:
			out[k] = t
		case string:
			s, err := cleanText(k, t, maxExtraStringLen, false)
			if err != nil {
				return nil, err
			}
			if s != "" {
				out[k] = s
			}
		default:
			return nil, invalid("%s must be text, a number or yes/no", k)
		}
	}
	return out, nil
}

// tagValues lists a mistake's values for a category (one for single, many for multi).
func tagValues(m store.Mistake, cat string) []string {
	switch v := m.Tags[cat].(type) {
	case string:
		return []string{v}
	case []any:
		out := make([]string, 0, len(v))
		for _, x := range v {
			if s, ok := x.(string); ok {
				out = append(out, s)
			}
		}
		return out
	}
	return nil
}

// detectPatterns groups mistakes by each watched combination and returns the
// groups reaching the threshold. Mistakes must already be windowed. The
// frontend mirrors this in src/lib/patterns.ts.
func detectPatterns(projectID int64, mistakes []store.Mistake, p store.JournalPatterns) []store.PatternAlert {
	out := []store.PatternAlert{}
	for _, combo := range p.Watch {
		groups := map[string]*store.PatternAlert{}
		for _, m := range mistakes {
			// Cartesian product of the combo's values (multi-select expands).
			keys := [][]string{{}}
			for _, cat := range combo {
				vals := tagValues(m, cat)
				if len(vals) == 0 {
					keys = nil
					break
				}
				var next [][]string
				for _, k := range keys {
					for _, v := range vals {
						next = append(next, append(slices.Clone(k), v))
					}
				}
				keys = next
			}
			for _, vals := range keys {
				id := strings.Join(vals, "\x00")
				g := groups[id]
				if g == nil {
					g = &store.PatternAlert{ProjectID: projectID, Categories: slices.Clone(combo), Values: vals}
					groups[id] = g
				}
				g.Count++
				g.MistakeIDs = append(g.MistakeIDs, m.ID)
				if m.CreatedAt.After(g.LastAt) {
					g.LastAt = m.CreatedAt
				}
			}
		}
		for _, g := range groups {
			if g.Count >= p.Threshold {
				out = append(out, *g)
			}
		}
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Count != out[j].Count {
			return out[i].Count > out[j].Count
		}
		if len(out[i].Categories) != len(out[j].Categories) {
			return len(out[i].Categories) > len(out[j].Categories)
		}
		return out[i].LastAt.After(out[j].LastAt)
	})
	return out
}

// ---- handlers ----

type journalRequest struct {
	Config *store.JournalConfig `json:"config"`
}

func (a *api) getJournalConfig(w http.ResponseWriter, r *http.Request) {
	c, err := a.store.GetJournalConfig(r.Context(), userID(r))
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"config": c, "default": store.DefaultJournalConfig()})
}

func (a *api) putJournalConfig(w http.ResponseWriter, r *http.Request) {
	var req journalRequest
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	c, err := validateJournalConfig(req.Config)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	if err := a.store.SetJournalConfig(r.Context(), userID(r), c); err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"config": c, "default": store.DefaultJournalConfig()})
}

func (a *api) putProjectJournal(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	var req journalRequest
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	c, err := validateJournalConfig(req.Config)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	p, err := a.store.SetProjectJournal(r.Context(), userID(r), id, c)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (a *api) retagMistakes(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ProjectID *int64 `json:"project_id"`
		Category  string `json:"category"`
		From      string `json:"from"`
		To        string `json:"to"`
	}
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	if !journalKeyRe.MatchString(req.Category) {
		handleErr(w, r, invalid("category is required"))
		return
	}
	from, err := cleanText("from", req.From, maxTagValueLen, true)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	to, err := cleanText("to", req.To, maxTagValueLen, false)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	if req.ProjectID != nil {
		if _, err := a.projectConfig(r.Context(), userID(r), *req.ProjectID); err != nil {
			handleErr(w, r, err)
			return
		}
	}
	n, err := a.store.RetagMistakes(r.Context(), userID(r), req.ProjectID, req.Category, from, to)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"updated": n})
}

// mistakePatterns runs repeat detection per project with that project's setup.
func (a *api) mistakePatterns(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	uid := userID(r)
	only, err := parseOptionalID(r.URL.Query().Get("project_id"), "project_id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	projects, err := a.store.ListProjects(ctx, uid)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	now := time.Now()
	out := []store.PatternAlert{}
	found := only == nil
	for i := range projects {
		p := &projects[i]
		if only != nil && p.ID != *only {
			continue
		}
		found = true
		cfg, err := a.effectiveConfig(ctx, uid, p)
		if err != nil {
			handleErr(w, r, err)
			return
		}
		since := now.AddDate(0, 0, -cfg.Patterns.WindowDays)
		pid := p.ID
		list, err := a.store.ListMistakes(ctx, uid, store.MistakeFilter{ProjectID: &pid, Since: &since, Limit: 2000})
		if err != nil {
			handleErr(w, r, err)
			return
		}
		out = append(out, detectPatterns(pid, list, cfg.Patterns)...)
	}
	if !found {
		handleErr(w, r, store.ErrNotFound)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func parseTagFilter(raw string) (*store.TagFilter, error) {
	if raw == "" {
		return nil, nil
	}
	k, v, ok := strings.Cut(raw, ":")
	if !ok || !journalKeyRe.MatchString(k) || v == "" || len(v) > maxTagValueLen {
		return nil, invalid("tag must look like category:value")
	}
	return &store.TagFilter{Category: k, Value: v}, nil
}

// optionLabel resolves an option key to its label for exports.
func optionLabel(cfg store.JournalConfig, cat, value string) string {
	for _, c := range cfg.Categories {
		if c.Key != cat {
			continue
		}
		for _, o := range c.Options {
			if o.Key == value {
				return o.Label
			}
		}
	}
	return value
}

func joinTagLabels(cfg store.JournalConfig, m store.Mistake, cat string) string {
	vals := tagValues(m, cat)
	for i, v := range vals {
		vals[i] = optionLabel(cfg, cat, v)
	}
	return strings.Join(vals, ", ")
}
