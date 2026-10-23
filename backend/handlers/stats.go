package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"study-tracker-backend/auth"
	"study-tracker-backend/database"
	"study-tracker-backend/models"
)

func GetDashboardStats(w http.ResponseWriter, r *http.Request) {
	userID, err := auth.GetUserID(r.Context())
	if err != nil {
		http.Error(w, `{"error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	sevenDaysAgo := todayStart.AddDate(0, 0, -6)

	stats := models.DashboardStats{
		ProjectStats: make([]models.ProjectStat, 0),
		DailyTrend:   make([]models.DailyStat, 0),
	}

	// 1. Today's Minutes
	todayStr := todayStart.Format("2006-01-02")
	_ = database.DB.QueryRow(`
		SELECT COALESCE(SUM(duration_seconds) / 60, 0)
		FROM sessions
		WHERE user_id = ? AND date(start_time, 'localtime') = ?
	`, userID, todayStr).Scan(&stats.TodayMinutes)

	// 2. Weekly Minutes
	sevenDaysAgoStr := sevenDaysAgo.Format("2006-01-02")
	_ = database.DB.QueryRow(`
		SELECT COALESCE(SUM(duration_seconds) / 60, 0)
		FROM sessions
		WHERE user_id = ? AND date(start_time, 'localtime') >= ?
	`, userID, sevenDaysAgoStr).Scan(&stats.WeeklyMinutes)

	// 3. Total Minutes & Pomodoro count
	_ = database.DB.QueryRow(`
		SELECT 
			COALESCE(SUM(duration_seconds) / 60, 0),
			COUNT(CASE WHEN session_type = 'pomodoro' THEN 1 END)
		FROM sessions
		WHERE user_id = ?
	`, userID).Scan(&stats.TotalMinutes, &stats.CompletedPomodoros)

	// 4. Project-wise Stats
	projectRows, err := database.DB.Query(`
		SELECT 
			p.id, p.name, p.color,
			COALESCE(SUM(s.duration_seconds), 0) AS total_seconds,
			COUNT(s.id) AS session_count
		FROM projects p
		LEFT JOIN sessions s ON p.id = s.project_id AND s.user_id = ?
		WHERE p.user_id = ?
		GROUP BY p.id
		HAVING total_seconds > 0
		ORDER BY total_seconds DESC
	`, userID, userID)
	if err == nil {
		defer projectRows.Close()
		for projectRows.Next() {
			var ps models.ProjectStat
			if err := projectRows.Scan(&ps.ProjectID, &ps.Name, &ps.Color, &ps.TotalSeconds, &ps.SessionCount); err == nil {
				stats.ProjectStats = append(stats.ProjectStats, ps)
			}
		}
	}

	// 5. Daily Trend (last 14 days)
	fourteenDaysAgo := todayStart.AddDate(0, 0, -13)
	dailyMap := make(map[string]int)
	dailyRows, err := database.DB.Query(`
		SELECT date(start_time, 'localtime') as day, COALESCE(SUM(duration_seconds) / 60, 0)
		FROM sessions
		WHERE user_id = ? AND date(start_time, 'localtime') >= ?
		GROUP BY day
	`, userID, fourteenDaysAgo.Format("2006-01-02"))
	if err == nil {
		defer dailyRows.Close()
		for dailyRows.Next() {
			var day string
			var mins int
			if err := dailyRows.Scan(&day, &mins); err == nil {
				dailyMap[day] = mins
			}
		}
	}

	for i := 13; i >= 0; i-- {
		d := todayStart.AddDate(0, 0, -i).Format("2006-01-02")
		stats.DailyTrend = append(stats.DailyTrend, models.DailyStat{
			Date:    d,
			Minutes: dailyMap[d],
		})
	}

	// 6. Current Streak Days
	streakRows, err := database.DB.Query(`
		SELECT DISTINCT date(start_time, 'localtime') as day
		FROM sessions
		WHERE user_id = ?
		ORDER BY day DESC
	`, userID)
	if err == nil {
		defer streakRows.Close()
		var studyDates []string
		for streakRows.Next() {
			var d string
			if err := streakRows.Scan(&d); err == nil {
				studyDates = append(studyDates, d)
			}
		}

		streak := 0
		checkDate := todayStart
		dateSet := make(map[string]bool)
		for _, d := range studyDates {
			dateSet[d] = true
		}

		if !dateSet[checkDate.Format("2006-01-02")] {
			checkDate = checkDate.AddDate(0, 0, -1)
		}

		for {
			dStr := checkDate.Format("2006-01-02")
			if dateSet[dStr] {
				streak++
				checkDate = checkDate.AddDate(0, 0, -1)
			} else {
				break
			}
		}
		stats.CurrentStreakDays = streak
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}
