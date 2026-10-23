package models

type User struct {
	ID           int64  `json:"id"`
	Email        string `json:"email"`
	PasswordHash string `json:"-"`
	Name         string `json:"name"`
	CreatedAt    string `json:"created_at"`
}

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type Project struct {
	ID                  int64  `json:"id"`
	UserID              int64  `json:"user_id"`
	Name                string `json:"name"`
	Color               string `json:"color"`
	Description         string `json:"description"`
	TargetMinutesPerDay int    `json:"target_minutes_per_day"`
	CreatedAt           string `json:"created_at"`
	TotalMinutes        int    `json:"total_minutes,omitempty"`
}

type Session struct {
	ID              int64  `json:"id"`
	UserID          int64  `json:"user_id"`
	ProjectID       int64  `json:"project_id"`
	ProjectName     string `json:"project_name,omitempty"`
	ProjectColor    string `json:"project_color,omitempty"`
	StartTime       string `json:"start_time"`
	EndTime         string `json:"end_time"`
	DurationSeconds int    `json:"duration_seconds"`
	SessionType     string `json:"session_type"`
	FocusRating     int    `json:"focus_rating"`
	Notes           string `json:"notes"`
	CreatedAt       string `json:"created_at"`
}

type Settings struct {
	UserID             int64 `json:"user_id"`
	WorkDuration       int   `json:"work_duration"`
	ShortBreakDuration int   `json:"short_break_duration"`
	LongBreakDuration  int   `json:"long_break_duration"`
	LongBreakInterval  int   `json:"long_break_interval"`
	AutoStartBreaks    bool  `json:"auto_start_breaks"`
	SoundEnabled       bool  `json:"sound_enabled"`
}

type ProjectStat struct {
	ProjectID    int64  `json:"project_id"`
	Name         string `json:"name"`
	Color        string `json:"color"`
	TotalSeconds int    `json:"total_seconds"`
	SessionCount int    `json:"session_count"`
}

type DailyStat struct {
	Date    string `json:"date"`
	Minutes int    `json:"minutes"`
}

type DashboardStats struct {
	TodayMinutes       int           `json:"today_minutes"`
	WeeklyMinutes      int           `json:"weekly_minutes"`
	TotalMinutes       int           `json:"total_minutes"`
	CurrentStreakDays  int           `json:"current_streak_days"`
	CompletedPomodoros int           `json:"completed_pomodoros"`
	ProjectStats       []ProjectStat `json:"project_stats"`
	DailyTrend         []DailyStat   `json:"daily_trend"`
}

type Feedback struct {
	ID        int64  `json:"id"`
	UserID    int64  `json:"user_id,omitempty"`
	Email     string `json:"email"`
	Type      string `json:"type"` // "feature" | "bug" | "praise" | "general"
	Message   string `json:"message"`
	CreatedAt string `json:"created_at"`
}
