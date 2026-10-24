// Package store defines the persistence boundary: domain models, input types
// and the Store interface the HTTP layer depends on.
package store

import (
	"context"
	"errors"
	"time"
)

// Sentinel errors returned by Store implementations. The HTTP layer maps them
// to status codes and never exposes the underlying driver error.
var (
	ErrNotFound = errors.New("not found")
	ErrConflict = errors.New("already exists")
	ErrInvalid  = errors.New("invalid data")
)

// User is an account. PasswordHash and TokenVersion are never serialised.
type User struct {
	ID               int64     `json:"id"`
	Email            string    `json:"email"`
	PasswordHash     string    `json:"-"`
	Name             string    `json:"name"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
	TokenVersion     int       `json:"-"`
	HasCalendarToken bool      `json:"has_calendar_token"`
}

// Project is a study subject owned by one user.
type Project struct {
	ID                  int64     `json:"id"`
	UserID              int64     `json:"user_id"`
	Name                string    `json:"name"`
	Color               string    `json:"color"`
	Description         string    `json:"description"`
	TargetMinutesPerDay int       `json:"target_minutes_per_day"`
	CreatedAt           time.Time `json:"created_at"`
	TotalMinutes        int       `json:"total_minutes"`
}

// ProjectInput is the validated payload for creating or replacing a project.
type ProjectInput struct {
	Name                string
	Color               string
	Description         string
	TargetMinutesPerDay int
}

// Session is one block of study time.
type Session struct {
	ID              int64     `json:"id"`
	UserID          int64     `json:"user_id"`
	ProjectID       int64     `json:"project_id"`
	ProjectName     string    `json:"project_name"`
	ProjectColor    string    `json:"project_color"`
	StartTime       time.Time `json:"start_time"`
	EndTime         time.Time `json:"end_time"`
	DurationSeconds int       `json:"duration_seconds"`
	SessionType     string    `json:"session_type"`
	FocusRating     int       `json:"focus_rating"`
	Notes           string    `json:"notes"`
	Interruptions   int       `json:"interruptions"`
	TaskID          *int64    `json:"task_id"`
	CreatedAt       time.Time `json:"created_at"`
}

// SessionTypes is the closed set of accepted session_type values.
var SessionTypes = []string{"pomodoro", "custom", "manual"}

// SessionInput is the validated payload for logging a session.
type SessionInput struct {
	ProjectID       int64
	StartTime       time.Time
	EndTime         time.Time
	DurationSeconds int
	SessionType     string
	FocusRating     int
	Notes           string
	Interruptions   int
	TaskID          *int64
}

// SessionFilter narrows ListSessions. Limit 0 means no limit.
type SessionFilter struct {
	ProjectID *int64
	Limit     int
	Since     *time.Time
}

// Task is a unit of work planned against a project.
type Task struct {
	ID                 int64      `json:"id"`
	UserID             int64      `json:"user_id"`
	ProjectID          int64      `json:"project_id"`
	Title              string     `json:"title"`
	EstimatePomodoros  int        `json:"estimate_pomodoros"`
	CompletedPomodoros int        `json:"completed_pomodoros"`
	Done               bool       `json:"done"`
	Position           int        `json:"position"`
	CreatedAt          time.Time  `json:"created_at"`
	CompletedAt        *time.Time `json:"completed_at"`
}

// TaskInput is the validated payload for creating a task. On update the
// project is fixed and only Title/EstimatePomodoros apply.
type TaskInput struct {
	ProjectID         int64
	Title             string
	EstimatePomodoros int
}

// TaskFilter narrows ListTasks.
type TaskFilter struct {
	ProjectID *int64
	Done      *bool
}

// Settings holds a user's timer preferences (one row per user).
type Settings struct {
	WorkDuration       int  `json:"work_duration"`
	ShortBreakDuration int  `json:"short_break_duration"`
	LongBreakDuration  int  `json:"long_break_duration"`
	LongBreakInterval  int  `json:"long_break_interval"`
	AutoStartBreaks    bool `json:"auto_start_breaks"`
	SoundEnabled       bool `json:"sound_enabled"`
}

// DefaultSettings are applied to every new account.
func DefaultSettings() Settings {
	return Settings{WorkDuration: 25, ShortBreakDuration: 5, LongBreakDuration: 15, LongBreakInterval: 4, SoundEnabled: true}
}

// ProjectStat is per-project aggregate time.
type ProjectStat struct {
	ProjectID    int64  `json:"project_id"`
	Name         string `json:"name"`
	Color        string `json:"color"`
	TotalSeconds int    `json:"total_seconds"`
	SessionCount int    `json:"session_count"`
}

// DailyStat is minutes studied on one calendar day (in the user's timezone).
type DailyStat struct {
	Date    string `json:"date"` // YYYY-MM-DD
	Minutes int    `json:"minutes"`
}

// WeekOverWeek compares the rolling 7 days with the 7 before.
type WeekOverWeek struct {
	ThisWeekMinutes     int      `json:"this_week_minutes"`
	PreviousWeekMinutes int      `json:"previous_week_minutes"`
	DeltaMinutes        int      `json:"delta_minutes"`
	DeltaPercent        *float64 `json:"delta_percent"`
}

// DashboardStats is the analytics payload.
type DashboardStats struct {
	TodayMinutes       int           `json:"today_minutes"`
	WeeklyMinutes      int           `json:"weekly_minutes"`
	TotalMinutes       int           `json:"total_minutes"`
	CurrentStreakDays  int           `json:"current_streak_days"`
	CompletedPomodoros int           `json:"completed_pomodoros"`
	AvgInterruptions   float64       `json:"avg_interruptions"`
	WeekOverWeek       WeekOverWeek  `json:"week_over_week"`
	ProjectStats       []ProjectStat `json:"project_stats"`
	DailyTrend         []DailyStat   `json:"daily_trend"`
}

// GoalStat is today's progress toward one project's daily target.
type GoalStat struct {
	ProjectID           int64   `json:"project_id"`
	Name                string  `json:"name"`
	Color               string  `json:"color"`
	TargetMinutesPerDay int     `json:"target_minutes_per_day"`
	TodayMinutes        int     `json:"today_minutes"`
	Percent             float64 `json:"percent"`
	Met                 bool    `json:"met"`
}

// GoalTotals aggregates all projects.
type GoalTotals struct {
	TargetMinutes int     `json:"target_minutes"`
	TodayMinutes  int     `json:"today_minutes"`
	Percent       float64 `json:"percent"`
	Met           bool    `json:"met"`
}

// GoalsStats is the daily-goal payload.
type GoalsStats struct {
	Date     string     `json:"date"`
	Projects []GoalStat `json:"projects"`
	Overall  GoalTotals `json:"overall"`
}

// HourStat is activity in one local hour-of-day bucket.
type HourStat struct {
	Hour         int     `json:"hour"`
	Minutes      int     `json:"minutes"`
	SessionCount int     `json:"session_count"`
	AvgRating    float64 `json:"avg_rating"`
}

// FeedbackTypes is the closed set of accepted feedback types.
var FeedbackTypes = []string{"feature", "bug", "praise", "general"}

// FeedbackInput is a validated feedback submission. UserID is nil when anonymous.
type FeedbackInput struct {
	UserID  *int64
	Email   string
	Type    string
	Message string
}

// Export is a full backup of one user's data.
type Export struct {
	ExportedAt time.Time `json:"exported_at"`
	User       User      `json:"user"`
	Settings   Settings  `json:"settings"`
	Projects   []Project `json:"projects"`
	Sessions   []Session `json:"sessions"`
}

// ImportSession is a session to import, keyed to a project by name.
type ImportSession struct {
	ProjectName string
	SessionInput
}

// ImportInput is a validated import payload.
type ImportInput struct {
	Projects []ProjectInput
	Sessions []ImportSession
}

// ImportResult reports what an import changed.
type ImportResult struct {
	ProjectsCreated  int `json:"projects_created"`
	ProjectsUpdated  int `json:"projects_updated"`
	SessionsInserted int `json:"sessions_inserted"`
	SessionsSkipped  int `json:"sessions_skipped"`
}

// Store is everything the HTTP layer needs from persistence. Every method
// that touches user data takes the owning userID and must scope to it.
type Store interface {
	Ping(ctx context.Context) error

	CreateUser(ctx context.Context, email, passwordHash, name string) (User, error)
	GetUserByEmail(ctx context.Context, email string) (User, error)
	GetUserByID(ctx context.Context, id int64) (User, error)
	UserExists(ctx context.Context, id int64) (bool, error)
	// AuthState returns whether the user exists and their current token version.
	AuthState(ctx context.Context, id int64) (exists bool, tokenVersion int, err error)
	// UpdatePassword stores a new hash and bumps the token version, which it returns.
	UpdatePassword(ctx context.Context, userID int64, newHash string) (int, error)
	DeleteUser(ctx context.Context, userID int64) error

	SetCalendarToken(ctx context.Context, userID int64, tokenHash string) error
	ClearCalendarToken(ctx context.Context, userID int64) error
	UserIDByCalendarToken(ctx context.Context, tokenHash string) (int64, error)

	ListProjects(ctx context.Context, userID int64) ([]Project, error)
	CreateProject(ctx context.Context, userID int64, in ProjectInput) (Project, error)
	UpdateProject(ctx context.Context, userID, id int64, in ProjectInput) (Project, error)
	DeleteProject(ctx context.Context, userID, id int64) error

	ListSessions(ctx context.Context, userID int64, f SessionFilter) ([]Session, error)
	CreateSession(ctx context.Context, userID int64, in SessionInput) (Session, error)
	DeleteSession(ctx context.Context, userID, id int64) error

	ListTasks(ctx context.Context, userID int64, f TaskFilter) ([]Task, error)
	CreateTask(ctx context.Context, userID int64, in TaskInput) (Task, error)
	UpdateTask(ctx context.Context, userID, id int64, title string, estimate int) (Task, error)
	SetTaskDone(ctx context.Context, userID, id int64, done bool) (Task, error)
	DeleteTask(ctx context.Context, userID, id int64) error
	ReorderTasks(ctx context.Context, userID int64, ids []int64) error

	GetSettings(ctx context.Context, userID int64) (Settings, error)
	UpsertSettings(ctx context.Context, userID int64, s Settings) (Settings, error)

	DashboardStats(ctx context.Context, userID int64, loc *time.Location, now time.Time) (DashboardStats, error)
	GoalsStats(ctx context.Context, userID int64, loc *time.Location, now time.Time) (GoalsStats, error)
	Heatmap(ctx context.Context, userID int64, loc *time.Location, now time.Time, days int) ([]DailyStat, error)
	HourlyStats(ctx context.Context, userID int64, loc *time.Location) ([]HourStat, error)

	ExportAll(ctx context.Context, userID int64) (Export, error)
	ImportAll(ctx context.Context, userID int64, in ImportInput) (ImportResult, error)
	CreateFeedback(ctx context.Context, in FeedbackInput) (int64, error)
}
