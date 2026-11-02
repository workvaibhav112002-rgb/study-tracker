package store

// JournalOption is one choice in a category. Keys are stable so renaming the
// label never touches stored mistakes.
type JournalOption struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Color string `json:"color"`
}

// JournalCategory is a tagging dimension such as Topic or Mistake type.
type JournalCategory struct {
	Key      string          `json:"key"`
	Label    string          `json:"label"`
	Multi    bool            `json:"multi"`
	Required bool            `json:"required"`
	AllowNew bool            `json:"allow_new"`
	Options  []JournalOption `json:"options"`
}

// JournalField is a built-in field (question, rule, solution, time) with a
// custom label or visibility, or a custom field (text, number, yesno, select).
type JournalField struct {
	Key     string   `json:"key"`
	Label   string   `json:"label"`
	Type    string   `json:"type"`
	Hidden  bool     `json:"hidden"`
	Options []string `json:"options,omitempty"`
}

// JournalPatterns controls repeat detection.
type JournalPatterns struct {
	Threshold  int        `json:"threshold"`
	WindowDays int        `json:"window_days"`
	Watch      [][]string `json:"watch"`
}

// JournalConfig is a user's mistake-journal setup.
type JournalConfig struct {
	Version       int               `json:"version"`
	Preset        string            `json:"preset"`
	Categories    []JournalCategory `json:"categories"`
	Fields        []JournalField    `json:"fields"`
	Patterns      JournalPatterns   `json:"patterns"`
	ReviewWeekday int               `json:"review_weekday"` // 0 = Sunday
	TestsEnabled  bool              `json:"tests_enabled"`
}

// Built-in field keys map to mistake columns.
var BuiltinJournalFields = []string{"question", "rule", "solution", "time"}

// DefaultJournalConfig is the "Any learner" setup. The frontend mirrors it in
// src/lib/journal.ts; keep the keys in step.
func DefaultJournalConfig() JournalConfig {
	return JournalConfig{
		Version: 1,
		Preset:  "any",
		Categories: []JournalCategory{
			{Key: "topic", Label: "Topic", AllowNew: true, Options: []JournalOption{}},
			{Key: "mistake_type", Label: "Mistake type", Required: true, Options: []JournalOption{
				{Key: "didnt_know", Label: "Didn't know it", Color: "#3987e5"},
				{Key: "careless", Label: "Careless slip", Color: "#d95926"},
				{Key: "misread", Label: "Misread the question", Color: "#199e70"},
				{Key: "time", Label: "Ran out of time", Color: "#c98500"},
				{Key: "stuck", Label: "Got stuck", Color: "#d55181"},
				{Key: "forgot_step", Label: "Forgot a step", Color: "#9085e9"},
			}},
			{Key: "source", Label: "Source", Options: []JournalOption{
				{Key: "test", Label: "Test", Color: "#3987e5"},
				{Key: "homework", Label: "Homework", Color: "#d95926"},
				{Key: "practice", Label: "Practice set", Color: "#199e70"},
				{Key: "book", Label: "Book", Color: "#c98500"},
				{Key: "class", Label: "Class", Color: "#d55181"},
				{Key: "other", Label: "Other", Color: "#8b8f99"},
			}},
		},
		Fields: []JournalField{
			{Key: "question", Label: "What went wrong", Type: "builtin"},
			{Key: "rule", Label: "Lesson for next time", Type: "builtin"},
			{Key: "solution", Label: "Correct approach", Type: "builtin"},
			{Key: "time", Label: "Time spent vs expected", Type: "builtin"},
		},
		Patterns:      JournalPatterns{Threshold: 3, WindowDays: 14, Watch: [][]string{{"topic", "mistake_type"}, {"mistake_type"}}},
		ReviewWeekday: 0,
	}
}
