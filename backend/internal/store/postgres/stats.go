package postgres

import (
	"context"
	"time"

	"study-tracker-backend/internal/store"
)

const dateLayout = "2006-01-02"

// DashboardStats computes analytics with day boundaries in loc. "Today" is
// derived once from now in loc and passed to SQL, so Go and Postgres agree.
func (s *Store) DashboardStats(ctx context.Context, userID int64, loc *time.Location, now time.Time) (store.DashboardStats, error) {
	local := now.In(loc)
	today := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, loc)
	todayStr := today.Format(dateLayout)
	tz := loc.String()

	out := store.DashboardStats{
		ProjectStats: make([]store.ProjectStat, 0),
		DailyTrend:   make([]store.DailyStat, 0, 14),
	}

	// Totals, today, rolling 7 days and pomodoro count in one pass.
	err := s.pool.QueryRow(ctx, `
		SELECT
			COALESCE(SUM(duration_seconds) FILTER (WHERE (start_time AT TIME ZONE $2)::date = $3::date), 0) / 60,
			COALESCE(SUM(duration_seconds) FILTER (WHERE (start_time AT TIME ZONE $2)::date >= $3::date - 6
			                                        AND (start_time AT TIME ZONE $2)::date <= $3::date), 0) / 60,
			COALESCE(SUM(duration_seconds), 0) / 60,
			COUNT(*) FILTER (WHERE session_type = 'pomodoro')
		FROM sessions
		WHERE user_id = $1`, userID, tz, todayStr,
	).Scan(&out.TodayMinutes, &out.WeeklyMinutes, &out.TotalMinutes, &out.CompletedPomodoros)
	if err != nil {
		return out, mapErr(err)
	}

	// Per-project distribution.
	rows, err := s.pool.Query(ctx, `
		SELECT p.id, p.name, p.color,
		       COALESCE(SUM(s.duration_seconds), 0) AS total_seconds,
		       COUNT(s.id)                          AS session_count
		FROM projects p
		LEFT JOIN sessions s ON s.project_id = p.id AND s.user_id = p.user_id
		WHERE p.user_id = $1
		GROUP BY p.id
		HAVING COALESCE(SUM(s.duration_seconds), 0) > 0
		ORDER BY total_seconds DESC, p.id`, userID)
	if err != nil {
		return out, mapErr(err)
	}
	for rows.Next() {
		var ps store.ProjectStat
		if err := rows.Scan(&ps.ProjectID, &ps.Name, &ps.Color, &ps.TotalSeconds, &ps.SessionCount); err != nil {
			rows.Close()
			return out, mapErr(err)
		}
		out.ProjectStats = append(out.ProjectStats, ps)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return out, mapErr(err)
	}

	// Daily trend: last 14 local days, filled with zeros.
	rows, err = s.pool.Query(ctx, `
		SELECT (start_time AT TIME ZONE $2)::date AS day, SUM(duration_seconds) / 60
		FROM sessions
		WHERE user_id = $1
		  AND start_time >= (($3::date - 13)::timestamp AT TIME ZONE $2)
		  AND (start_time AT TIME ZONE $2)::date <= $3::date
		GROUP BY day`, userID, tz, todayStr)
	if err != nil {
		return out, mapErr(err)
	}
	daily := make(map[string]int, 14)
	for rows.Next() {
		var day time.Time
		var mins int
		if err := rows.Scan(&day, &mins); err != nil {
			rows.Close()
			return out, mapErr(err)
		}
		daily[day.Format(dateLayout)] = mins
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return out, mapErr(err)
	}
	for i := 13; i >= 0; i-- {
		d := today.AddDate(0, 0, -i).Format(dateLayout)
		out.DailyTrend = append(out.DailyTrend, store.DailyStat{Date: d, Minutes: daily[d]})
	}

	// Streak: distinct local study days, walked backwards from today (or
	// yesterday if nothing has been logged yet today).
	rows, err = s.pool.Query(ctx, `
		SELECT DISTINCT (start_time AT TIME ZONE $2)::date AS day
		FROM sessions
		WHERE user_id = $1 AND start_time >= now() - interval '2 years'`, userID, tz)
	if err != nil {
		return out, mapErr(err)
	}
	days := make(map[string]struct{})
	for rows.Next() {
		var day time.Time
		if err := rows.Scan(&day); err != nil {
			rows.Close()
			return out, mapErr(err)
		}
		days[day.Format(dateLayout)] = struct{}{}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return out, mapErr(err)
	}
	out.CurrentStreakDays = streak(days, today)

	return out, nil
}

// streak counts consecutive days ending today or yesterday.
func streak(days map[string]struct{}, today time.Time) int {
	cursor := today
	if _, ok := days[cursor.Format(dateLayout)]; !ok {
		cursor = cursor.AddDate(0, 0, -1)
	}
	n := 0
	for {
		if _, ok := days[cursor.Format(dateLayout)]; !ok {
			return n
		}
		n++
		cursor = cursor.AddDate(0, 0, -1)
	}
}
