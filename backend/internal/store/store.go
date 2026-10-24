// Package store defines the persistence boundary: domain models, input types
// and the Store interface the HTTP layer depends on.
package store

import (
	"context"
	"encoding/json"
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
	ID               int64      `json:"id"`
	Email            string     `json:"email"`
	PasswordHash     string     `json:"-"`
	Name             string     `json:"name"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	TokenVersion     int        `json:"-"`
	HasCalendarToken bool       `json:"has_calendar_token"`
	HasPassword      bool       `json:"has_password"`
	GoogleLinked     bool       `json:"google_linked"`
	EmailVerifiedAt  *time.Time `json:"email_verified_at"`
	Handle           *string    `json:"handle"`
	ProfilePublic    bool       `json:"profile_public"`
	Bio              string     `json:"bio"`
}

// ProfileInput updates the public-facing part of an account.
type ProfileInput struct {
	Handle *string
	Public bool
	Bio    string
}

// PublicProfile is what anyone can see at /u/{handle}. It never carries
// the email address.
type PublicProfile struct {
	Name              string      `json:"name"`
	Handle            string      `json:"handle"`
	Bio               string      `json:"bio"`
	MemberSince       string      `json:"member_since"`
	TotalMinutes      int         `json:"total_minutes"`
	Sessions          int         `json:"sessions"`
	CurrentStreakDays int         `json:"current_streak_days"`
	GoalStreakDays    int         `json:"goal_streak_days"`
	WeekMinutes       int         `json:"week_minutes"`
	Heatmap           []DailyStat `json:"heatmap"`
	Badges            []Milestone `json:"badges"`
}

// Friend is another account the user is connected to, with a live summary.
type Friend struct {
	ID                int64   `json:"id"`
	Name              string  `json:"name"`
	Handle            *string `json:"handle"`
	Studying          bool    `json:"studying"`
	TodayMinutes      int     `json:"today_minutes"`
	WeekMinutes       int     `json:"week_minutes"`
	CurrentStreakDays int     `json:"current_streak_days"`
}

// AuthTokenKinds is the closed set of single-use token purposes.
var AuthTokenKinds = []string{"reset", "magic"}

// Project is a study subject owned by one user.
type Project struct {
	ID                  int64     `json:"id"`
	UserID              int64     `json:"user_id"`
	Name                string    `json:"name"`
	Color               string    `json:"color"`
	Description         string    `json:"description"`
	TargetMinutesPerDay int       `json:"target_minutes_per_day"`
	ExamDate            *string   `json:"exam_date"`
	PlannedHoursPerWeek *int      `json:"planned_hours_per_week"`
	CreatedAt           time.Time `json:"created_at"`
	TotalMinutes        int       `json:"total_minutes"`
	WeekMinutes         int       `json:"week_minutes"`
}

// ProjectInput is the validated payload for creating or replacing a project.
type ProjectInput struct {
	Name                string
	Color               string
	Description         string
	TargetMinutesPerDay int
	ExamDate            *string // YYYY-MM-DD
	PlannedHoursPerWeek *int
}

// Card is a flashcard scheduled with SM-2.
type Card struct {
	ID           int64     `json:"id"`
	UserID       int64     `json:"user_id"`
	ProjectID    int64     `json:"project_id"`
	Front        string    `json:"front"`
	Back         string    `json:"back"`
	Tags         []string  `json:"tags"`
	Ease         float64   `json:"ease"`
	IntervalDays int       `json:"interval_days"`
	Repetitions  int       `json:"repetitions"`
	Lapses       int       `json:"lapses"`
	DueAt        time.Time `json:"due_at"`
	Archived     bool      `json:"archived"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// CardInput is the validated payload for creating or editing a card.
type CardInput struct {
	ProjectID int64
	Front     string
	Back      string
	Tags      []string
}

// CardFilter narrows ListCards.
type CardFilter struct {
	ProjectID *int64
	DueOnly   bool
	Archived  *bool
	Limit     int
}

// CardStats summarises a deck.
type CardStats struct {
	Total     int `json:"total"`
	Due       int `json:"due"`
	New       int `json:"new"`
	Mastered  int `json:"mastered"`
	Reviewed7 int `json:"reviewed_last_7_days"`
}

// CardSchedule is the SM-2 outcome of a review.
type CardSchedule struct {
	Ease         float64
	IntervalDays int
	Repetitions  int
	Lapses       int
	DueAt        time.Time
}

// Note is free-form study text.
type Note struct {
	ID        int64     `json:"id"`
	UserID    int64     `json:"user_id"`
	ProjectID *int64    `json:"project_id"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	Tags      []string  `json:"tags"`
	Pinned    bool      `json:"pinned"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// NoteInput is the validated payload for a note.
type NoteInput struct {
	ProjectID *int64
	Title     string
	Body      string
	Tags      []string
	Pinned    bool
}

// NoteFilter narrows ListNotes.
type NoteFilter struct {
	ProjectID *int64
	Tag       string
	Query     string
	Limit     int
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
	WorkDuration       int    `json:"work_duration"`
	ShortBreakDuration int    `json:"short_break_duration"`
	LongBreakDuration  int    `json:"long_break_duration"`
	LongBreakInterval  int    `json:"long_break_interval"`
	AutoStartBreaks    bool   `json:"auto_start_breaks"`
	SoundEnabled       bool   `json:"sound_enabled"`
	ReminderEnabled    bool   `json:"reminder_enabled"`
	ReminderHour       int    `json:"reminder_hour"`
	Timezone           string `json:"timezone"`
}

// DefaultSettings are applied to every new account.
func DefaultSettings() Settings {
	return Settings{WorkDuration: 25, ShortBreakDuration: 5, LongBreakDuration: 15, LongBreakInterval: 4, SoundEnabled: true, ReminderHour: 9, Timezone: "UTC"}
}

// GoalStreak is the run of days where the daily goal was met (or frozen).
type GoalStreak struct {
	Days               int      `json:"days"`
	BestDays           int      `json:"best_days"`
	TargetMinutes      int      `json:"target_minutes"`
	TodayMet           bool     `json:"today_met"`
	YesterdayMet       bool     `json:"yesterday_met"`
	// DayBeforeMet tells the UI whether a freeze on yesterday would actually
	// reconnect a streak.
	DayBeforeMet       bool     `json:"day_before_met"`
	FreezeAvailable    bool     `json:"freeze_available"`
	FreezeDays         []string `json:"freeze_days"`
	MissedYesterdayISO string   `json:"missed_yesterday"`
}

// Milestone is an achievement with progress toward it.
type Milestone struct {
	ID          string  `json:"id"`
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Icon        string  `json:"icon"`
	Target      int     `json:"target"`
	Progress    int     `json:"progress"`
	Achieved    bool    `json:"achieved"`
	AchievedAt  *string `json:"achieved_at"`
}

// PushSubscription is a Web Push endpoint for one browser.
type PushSubscription struct {
	ID       int64  `json:"id"`
	UserID   int64  `json:"user_id"`
	Endpoint string `json:"endpoint"`
	P256dh   string `json:"-"`
	Auth     string `json:"-"`
}

// ReminderCandidate is a user who may need a nudge right now.
type ReminderCandidate struct {
	UserID        int64
	Name          string
	Timezone      string
	ReminderHour  int
	LastReminded  *time.Time
	Subscriptions []PushSubscription
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

// WeeklyReview summarises the most recent complete Monday–Sunday week.
type WeeklyReview struct {
	WeekStart        string       `json:"week_start"`
	WeekEnd          string       `json:"week_end"`
	Minutes          int          `json:"minutes"`
	PreviousMinutes  int          `json:"previous_minutes"`
	DeltaPercent     *float64     `json:"delta_percent"`
	Sessions         int          `json:"sessions"`
	Pomodoros        int          `json:"pomodoros"`
	ActiveDays       int          `json:"active_days"`
	AvgRating        float64      `json:"avg_rating"`
	AvgInterruptions float64      `json:"avg_interruptions"`
	BestDay          *DailyStat   `json:"best_day"`
	TopProject       *ProjectStat `json:"top_project"`
	TopProjectShare  float64      `json:"top_project_share"`
	BestHour         *int         `json:"best_hour"`
	StreakDays       int          `json:"streak_days"`
	Days             []DailyStat  `json:"days"`
	Insights         []string     `json:"insights"`
}

// TimerSnapshot is the client's timer state, stored opaquely for cross-device sync.
type TimerSnapshot struct {
	State     json.RawMessage `json:"state"`
	UpdatedAt int64           `json:"updated_at"`
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

	// CreateUser creates an account; passwordHash may be empty for social-only
	// accounts, and googleSub may be empty.
	CreateUser(ctx context.Context, email, passwordHash, name string) (User, error)
	CreateGoogleUser(ctx context.Context, email, name, googleSub string, verified bool) (User, error)
	GetUserByEmail(ctx context.Context, email string) (User, error)
	GetUserByGoogleSub(ctx context.Context, sub string) (User, error)
	LinkGoogle(ctx context.Context, userID int64, sub string, verified bool) error
	MarkEmailVerified(ctx context.Context, userID int64) error

	// CreateAuthToken stores a single-use token hash for a user.
	CreateAuthToken(ctx context.Context, userID int64, kind, tokenHash string, expiresAt time.Time) error
	// ConsumeAuthToken atomically marks a live token used and returns its user.
	ConsumeAuthToken(ctx context.Context, kind, tokenHash string) (int64, error)
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

	ListCards(ctx context.Context, userID int64, f CardFilter) ([]Card, error)
	CreateCard(ctx context.Context, userID int64, in CardInput) (Card, error)
	UpdateCard(ctx context.Context, userID, id int64, in CardInput) (Card, error)
	SetCardArchived(ctx context.Context, userID, id int64, archived bool) (Card, error)
	DeleteCard(ctx context.Context, userID, id int64) error
	// ReviewCard applies the new schedule and records the review atomically.
	ReviewCard(ctx context.Context, userID, id int64, rating int, next CardSchedule) (Card, error)
	GetCard(ctx context.Context, userID, id int64) (Card, error)
	CardStats(ctx context.Context, userID int64, projectID *int64) (CardStats, error)

	ListNotes(ctx context.Context, userID int64, f NoteFilter) ([]Note, error)
	CreateNote(ctx context.Context, userID int64, in NoteInput) (Note, error)
	UpdateNote(ctx context.Context, userID, id int64, in NoteInput) (Note, error)
	DeleteNote(ctx context.Context, userID, id int64) error

	GetSettings(ctx context.Context, userID int64) (Settings, error)
	UpsertSettings(ctx context.Context, userID int64, s Settings) (Settings, error)

	DashboardStats(ctx context.Context, userID int64, loc *time.Location, now time.Time) (DashboardStats, error)
	UpdateProfile(ctx context.Context, userID int64, in ProfileInput) (User, error)
	PublicProfile(ctx context.Context, handle string, loc *time.Location, now time.Time) (PublicProfile, error)
	CreateFriendInvite(ctx context.Context, userID int64, tokenHash string, expires time.Time) error
	// AcceptFriendInvite links both users and returns the inviter's id.
	AcceptFriendInvite(ctx context.Context, userID int64, tokenHash string, now time.Time) (int64, error)
	ListFriends(ctx context.Context, userID int64, loc *time.Location, now time.Time) ([]Friend, error)
	RemoveFriend(ctx context.Context, userID, friendID int64) error

	GoalStreak(ctx context.Context, userID int64, loc *time.Location, now time.Time) (GoalStreak, error)
	// AddStreakFreeze records a covered day; the caller validates eligibility.
	AddStreakFreeze(ctx context.Context, userID int64, day string) error
	Milestones(ctx context.Context, userID int64, loc *time.Location, now time.Time) ([]Milestone, error)

	UpsertPushSubscription(ctx context.Context, userID int64, endpoint, p256dh, auth string) error
	DeletePushSubscription(ctx context.Context, userID int64, endpoint string) error
	DeleteSubscriptionByEndpoint(ctx context.Context, endpoint string) error
	// ReminderCandidates lists users with reminders on and a subscription;
	// filtering by local hour and last reminder day happens in the caller.
	ReminderCandidates(ctx context.Context) ([]ReminderCandidate, error)
	MarkReminded(ctx context.Context, userID int64, day string) error
	// StudiedOn reports whether the user logged any session on the local day.
	StudiedOn(ctx context.Context, userID int64, loc *time.Location, day time.Time) (bool, error)
	GoalsStats(ctx context.Context, userID int64, loc *time.Location, now time.Time) (GoalsStats, error)
	Heatmap(ctx context.Context, userID int64, loc *time.Location, now time.Time, days int) ([]DailyStat, error)
	HourlyStats(ctx context.Context, userID int64, loc *time.Location) ([]HourStat, error)
	WeeklyReview(ctx context.Context, userID int64, loc *time.Location, now time.Time) (WeeklyReview, error)

	GetTimer(ctx context.Context, userID int64) (TimerSnapshot, error)
	// PutTimer stores the snapshot only if it is newer than the stored one;
	// it returns the snapshot that is current afterwards.
	PutTimer(ctx context.Context, userID int64, snap TimerSnapshot) (TimerSnapshot, error)

	ExportAll(ctx context.Context, userID int64) (Export, error)
	ImportAll(ctx context.Context, userID int64, in ImportInput) (ImportResult, error)
	CreateFeedback(ctx context.Context, in FeedbackInput) (int64, error)
}
