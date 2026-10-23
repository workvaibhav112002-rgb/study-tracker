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

// User is an account. PasswordHash is never serialised.
type User struct {
	ID           int64     `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Name         string    `json:"name"`
	CreatedAt    time.Time `json:"created_at"`
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
}

// SessionFilter narrows ListSessions.
type SessionFilter struct {
	ProjectID *int64
	Limit     int
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

// DashboardStats is the analytics payload.
type DashboardStats struct {
	TodayMinutes       int           `json:"today_minutes"`
	WeeklyMinutes      int           `json:"weekly_minutes"`
	TotalMinutes       int           `json:"total_minutes"`
	CurrentStreakDays  int           `json:"current_streak_days"`
	CompletedPomodoros int           `json:"completed_pomodoros"`
	ProjectStats       []ProjectStat `json:"project_stats"`
	DailyTrend         []DailyStat   `json:"daily_trend"`
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

// Store is everything the HTTP layer needs from persistence. Every method
// that touches user data takes the owning userID and must scope to it.
type Store interface {
	Ping(ctx context.Context) error

	CreateUser(ctx context.Context, email, passwordHash, name string) (User, error)
	GetUserByEmail(ctx context.Context, email string) (User, error)
	GetUserByID(ctx context.Context, id int64) (User, error)
	UserExists(ctx context.Context, id int64) (bool, error)

	ListProjects(ctx context.Context, userID int64) ([]Project, error)
	CreateProject(ctx context.Context, userID int64, in ProjectInput) (Project, error)
	UpdateProject(ctx context.Context, userID, id int64, in ProjectInput) (Project, error)
	DeleteProject(ctx context.Context, userID, id int64) error

	ListSessions(ctx context.Context, userID int64, f SessionFilter) ([]Session, error)
	CreateSession(ctx context.Context, userID int64, in SessionInput) (Session, error)
	DeleteSession(ctx context.Context, userID, id int64) error

	GetSettings(ctx context.Context, userID int64) (Settings, error)
	UpsertSettings(ctx context.Context, userID int64, s Settings) (Settings, error)

	DashboardStats(ctx context.Context, userID int64, loc *time.Location, now time.Time) (DashboardStats, error)
	ExportAll(ctx context.Context, userID int64) (Export, error)
	CreateFeedback(ctx context.Context, in FeedbackInput) (int64, error)
}
