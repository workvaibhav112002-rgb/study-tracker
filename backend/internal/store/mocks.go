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

// Root causes and review statuses for mistakes.
var (
	RootCauses       = []string{"concept", "procedural", "time_ego"}
	MistakeStatuses  = []string{"active", "locked_in", "review_next_week", "needs_drill"}
	MistakeReviewSet = []string{"locked_in", "review_next_week", "needs_drill"}
)

// Mistake is one logged error from a mock or practice.
type Mistake struct {
	ID             int64      `json:"id"`
	UserID         int64      `json:"user_id"`
	ProjectID      int64      `json:"project_id"`
	MockID         *int64     `json:"mock_id"`
	Subject        string     `json:"subject"`
	Pattern        string     `json:"pattern"`
	RootCause      string     `json:"root_cause"`
	Question       string     `json:"question"`
	Rule           string     `json:"rule"`
	Solution       string     `json:"solution"`
	ActualSeconds  *int       `json:"actual_seconds"`
	IdealSeconds   *int       `json:"ideal_seconds"`
	Status         string     `json:"status"`
	LastReviewedAt *time.Time `json:"last_reviewed_at"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// MistakeInput is the validated payload for a mistake.
type MistakeInput struct {
	ProjectID     int64
	MockID        *int64
	Subject       string
	Pattern       string
	RootCause     string
	Question      string
	Rule          string
	Solution      string
	ActualSeconds *int
	IdealSeconds  *int
	Status        string
	// CreatedAt overrides the insert time (used by spreadsheet import).
	CreatedAt *time.Time
}

// MistakeFilter narrows ListMistakes; zero values mean "any".
type MistakeFilter struct {
	ProjectID *int64
	MockID    *int64
	Subject   string
	Pattern   string
	RootCause string
	Status    string
	Query     string
	Since     *time.Time
	Limit     int
}

// RepeatAlert is a pattern and root cause the user keeps getting wrong.
type RepeatAlert struct {
	Subject   string    `json:"subject"`
	Pattern   string    `json:"pattern"`
	RootCause string    `json:"root_cause"`
	Count     int       `json:"count"`
	LastAt    time.Time `json:"last_at"`
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
	// RepeatMistakes groups mistakes since `since` by pattern and root cause
	// and returns the groups with at least minCount entries.
	RepeatMistakes(ctx context.Context, userID int64, since time.Time, minCount int) ([]RepeatAlert, error)
	// MistakeReviewDeck returns the Sunday Reset deck as of now.
	MistakeReviewDeck(ctx context.Context, userID int64, now time.Time) ([]Mistake, error)
	GradeMistake(ctx context.Context, userID, id int64, status string, now time.Time) (Mistake, error)
}
