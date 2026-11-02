package store

import (
	"context"
	"time"
)

// ExamSection is one timed section of an exam pattern.
type ExamSection struct {
	Name      string  `json:"name"`
	Questions int     `json:"questions"`
	MarksEach float64 `json:"marks_each"`
	Minutes   int     `json:"minutes"`
}

// ExamTemplate describes an exam's structure and the user's targets. It is
// stored on the project so each exam track keeps its own rules.
type ExamTemplate struct {
	Key               string        `json:"key"`
	Sections          []ExamSection `json:"sections"`
	NegativeFraction  float64       `json:"negative_fraction"`  // e.g. 0.25 of the marks per wrong answer
	TargetScore       float64       `json:"target_score"`       // personal cutoff target
	AccuracyThreshold float64       `json:"accuracy_threshold"` // percent; sections below are flagged
	PenaltyLimit      float64       `json:"penalty_limit"`      // marks; penalties above are flagged
}

// MockSection is the user's result in one section of a mock test.
type MockSection struct {
	Name         string  `json:"name"`
	Questions    int     `json:"questions"`
	Correct      int     `json:"correct"`
	Incorrect    int     `json:"incorrect"`
	Seconds      int     `json:"seconds"`
	MarksEach    float64 `json:"marks_each"`
	NegativeEach float64 `json:"negative_each"`
}

// Mock is one attempted mock test.
type Mock struct {
	ID          int64         `json:"id"`
	UserID      int64         `json:"user_id"`
	ProjectID   int64         `json:"project_id"`
	Name        string        `json:"name"`
	Provider    string        `json:"provider"`
	AttemptedOn string        `json:"attempted_on"` // YYYY-MM-DD
	Percentile  *float64      `json:"percentile"`
	Rank        *int          `json:"rank"`
	Sections    []MockSection `json:"sections"`
	Notes       string        `json:"notes"`
	CreatedAt   time.Time     `json:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at"`
}

// MockInput is the validated payload for a mock.
type MockInput struct {
	ProjectID   int64
	Name        string
	Provider    string
	AttemptedOn string
	Percentile  *float64
	Rank        *int
	Sections    []MockSection
	Notes       string
}

// Review statuses for mistakes.
var (
	MistakeStatuses  = []string{"active", "locked_in", "review_next_week", "needs_drill"}
	MistakeReviewSet = []string{"locked_in", "review_next_week", "needs_drill"}
)

// Mistake is one logged error. Its categories are user-defined tags: the
// keys come from the user's journal setup, values are option keys or free
// text (a string, or an array of strings for multi-select categories).
type Mistake struct {
	ID             int64          `json:"id"`
	UserID         int64          `json:"user_id"`
	ProjectID      int64          `json:"project_id"`
	MockID         *int64         `json:"mock_id"`
	Tags           map[string]any `json:"tags"`
	Extra          map[string]any `json:"extra"`
	Question       string         `json:"question"`
	Rule           string         `json:"rule"`
	Solution       string         `json:"solution"`
	ActualSeconds  *int           `json:"actual_seconds"`
	IdealSeconds   *int           `json:"ideal_seconds"`
	Status         string         `json:"status"`
	LastReviewedAt *time.Time     `json:"last_reviewed_at"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
}

// MistakeInput is the validated payload for a mistake.
type MistakeInput struct {
	ProjectID     int64
	MockID        *int64
	Tags          map[string]any
	Extra         map[string]any
	Question      string
	Rule          string
	Solution      string
	ActualSeconds *int
	IdealSeconds  *int
	Status        string
	// CreatedAt overrides the insert time (used by spreadsheet import).
	CreatedAt *time.Time
}

// TagFilter matches a mistake whose category holds the value (directly or
// inside a multi-select array).
type TagFilter struct {
	Category string
	Value    string
}

// MistakeFilter narrows ListMistakes; zero values mean "any".
type MistakeFilter struct {
	ProjectID *int64
	MockID    *int64
	Tag       *TagFilter
	Status    string
	Query     string
	Since     *time.Time
	Limit     int
}

// PatternAlert is a combination of category values the user keeps hitting.
type PatternAlert struct {
	ProjectID  int64     `json:"project_id"`
	Categories []string  `json:"categories"`
	Values     []string  `json:"values"`
	Count      int       `json:"count"`
	LastAt     time.Time `json:"last_at"`
	MistakeIDs []int64   `json:"mistake_ids"`
}

// MockStore is the persistence for mocks and mistakes.
type MockStore interface {
	SetExamTemplate(ctx context.Context, userID, projectID int64, t *ExamTemplate) (Project, error)

	ListMocks(ctx context.Context, userID int64, projectID *int64) ([]Mock, error)
	CreateMock(ctx context.Context, userID int64, in MockInput) (Mock, error)
	UpdateMock(ctx context.Context, userID, id int64, in MockInput) (Mock, error)
	DeleteMock(ctx context.Context, userID, id int64) error

	ListMistakes(ctx context.Context, userID int64, f MistakeFilter) ([]Mistake, error)
	CreateMistake(ctx context.Context, userID int64, in MistakeInput) (Mistake, error)
	// CreateMistakes inserts all rows in one transaction.
	CreateMistakes(ctx context.Context, userID int64, in []MistakeInput) (int, error)
	UpdateMistake(ctx context.Context, userID, id int64, in MistakeInput) (Mistake, error)
	DeleteMistake(ctx context.Context, userID, id int64) error
	// RetagMistakes renames (or, with an empty to, removes) a category value
	// on the user's mistakes, optionally within one project.
	RetagMistakes(ctx context.Context, userID int64, projectID *int64, category, from, to string) (int, error)
	// MistakeReviewDeck returns the weekly review deck as of now.
	MistakeReviewDeck(ctx context.Context, userID int64, now time.Time, tag *TagFilter) ([]Mistake, error)

	GetJournalConfig(ctx context.Context, userID int64) (*JournalConfig, error)
	SetJournalConfig(ctx context.Context, userID int64, c *JournalConfig) error
	SetProjectJournal(ctx context.Context, userID, projectID int64, c *JournalConfig) (Project, error)
	GradeMistake(ctx context.Context, userID, id int64, status string, now time.Time) (Mistake, error)
}
