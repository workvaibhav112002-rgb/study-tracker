package postgres

import (
	"context"
	"math"
	"time"

	"study-tracker-backend/internal/store"
)

const dateLayout = "2006-01-02"

// localDay anchors "today" in the user's timezone once, so Go and SQL agree.
func localDay(loc *time.Location, now time.Time) (today time.Time, todayStr, tz string) {
	local := now.In(loc)
	today = time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, loc)
	return today, today.Format(dateLayout), loc.String()
}

// DashboardStats computes analytics with day boundaries in loc.
func (s *Store) DashboardStats(ctx context.Context, userID int64, loc *time.Location, now time.Time) (store.DashboardStats, error) {
	today, todayStr, tz := localDay(loc, now)

	out := store.DashboardStats{
		ProjectStats: make([]store.ProjectStat, 0),
		DailyTrend:   make([]store.DailyStat, 0, 14),
	}

	// Totals, today, rolling 7 days, the 7 before, pomodoro count and
	// average interruptions in one pass.
	var prevWeek int
	err := s.pool.QueryRow(ctx, `
		SELECT
			COALESCE(SUM(duration_seconds) FILTER (WHERE (start_time AT TIME ZONE $2)::date = $3::date), 0) / 60,
			COALESCE(SUM(duration_seconds) FILTER (WHERE (start_time AT TIME ZONE $2)::date BETWEEN $3::date - 6 AND $3::date), 0) / 60,
			COALESCE(SUM(duration_seconds) FILTER (WHERE (start_time AT TIME ZONE $2)::date BETWEEN $3::date - 13 AND $3::date - 7), 0) / 60,
			COALESCE(SUM(duration_seconds), 0) / 60,
			COUNT(*) FILTER (WHERE session_type = 'pomodoro'),
			COALESCE(AVG(interruptions), 0)::float8
		FROM sessions
		WHERE user_id = $1`, userID, tz, todayStr,
	).Scan(&out.TodayMinutes, &out.WeeklyMinutes, &prevWeek, &out.TotalMinutes, &out.CompletedPomodoros, &out.AvgInterruptions)
	if err != nil {
		return out, mapErr(err)
	}
	out.AvgInterruptions = math.Round(out.AvgInterruptions*100) / 100
	out.WeekOverWeek = store.WeekOverWeek{
		ThisWeekMinutes:     out.WeeklyMinutes,
		PreviousWeekMinutes: prevWeek,
		DeltaMinutes:        out.WeeklyMinutes - prevWeek,
	}
	if prevWeek > 0 {
		pct := math.Round(float64(out.WeeklyMinutes-prevWeek)*1000/float64(prevWeek)) / 10
		out.WeekOverWeek.DeltaPercent = &pct
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
	trend, err := s.dailyMinutes(ctx, userID, tz, todayStr, today, 14)
	if err != nil {
		return out, err
	}
	out.DailyTrend = trend

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

// dailyMinutes returns a dense series of the last n local days ending today.
func (s *Store) dailyMinutes(ctx context.Context, userID int64, tz, todayStr string, today time.Time, n int) ([]store.DailyStat, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT (start_time AT TIME ZONE $2)::date AS day, SUM(duration_seconds) / 60
		FROM sessions
		WHERE user_id = $1
		  AND start_time >= (($3::date - ($4::int - 1))::timestamp AT TIME ZONE $2)
		  AND (start_time AT TIME ZONE $2)::date <= $3::date
		GROUP BY day`, userID, tz, todayStr, n)
	if err != nil {
		return nil, mapErr(err)
	}
	daily := make(map[string]int, n)
	for rows.Next() {
		var day time.Time
		var mins int
		if err := rows.Scan(&day, &mins); err != nil {
			rows.Close()
			return nil, mapErr(err)
		}
		daily[day.Format(dateLayout)] = mins
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, mapErr(err)
	}
	out := make([]store.DailyStat, 0, n)
	for i := n - 1; i >= 0; i-- {
		d := today.AddDate(0, 0, -i).Format(dateLayout)
		out = append(out, store.DailyStat{Date: d, Minutes: daily[d]})
	}
	return out, nil
}

// Heatmap returns a dense day series for the last `days` local days.
func (s *Store) Heatmap(ctx context.Context, userID int64, loc *time.Location, now time.Time, days int) ([]store.DailyStat, error) {
	today, todayStr, tz := localDay(loc, now)
	return s.dailyMinutes(ctx, userID, tz, todayStr, today, days)
}

// GoalsStats reports today's minutes against each project's daily target.
func (s *Store) GoalsStats(ctx context.Context, userID int64, loc *time.Location, now time.Time) (store.GoalsStats, error) {
	_, todayStr, tz := localDay(loc, now)
	out := store.GoalsStats{Date: todayStr, Projects: make([]store.GoalStat, 0)}

	rows, err := s.pool.Query(ctx, `
		SELECT p.id, p.name, p.color, p.target_minutes_per_day,
		       COALESCE(SUM(s.duration_seconds) FILTER (WHERE (s.start_time AT TIME ZONE $2)::date = $3::date), 0) / 60
		FROM projects p
		LEFT JOIN sessions s ON s.project_id = p.id AND s.user_id = p.user_id
		     AND s.start_time >= ($3::date::timestamp AT TIME ZONE $2)
		WHERE p.user_id = $1
		GROUP BY p.id
		ORDER BY p.created_at, p.id`, userID, tz, todayStr)
	if err != nil {
		return out, mapErr(err)
	}
	defer rows.Close()
	for rows.Next() {
		var g store.GoalStat
		if err := rows.Scan(&g.ProjectID, &g.Name, &g.Color, &g.TargetMinutesPerDay, &g.TodayMinutes); err != nil {
			return out, mapErr(err)
		}
		g.Percent = percent(g.TodayMinutes, g.TargetMinutesPerDay)
		g.Met = g.TodayMinutes >= g.TargetMinutesPerDay
		out.Overall.TargetMinutes += g.TargetMinutesPerDay
		out.Overall.TodayMinutes += g.TodayMinutes
		out.Projects = append(out.Projects, g)
	}
	if err := rows.Err(); err != nil {
		return out, mapErr(err)
	}
	out.Overall.Percent = percent(out.Overall.TodayMinutes, out.Overall.TargetMinutes)
	out.Overall.Met = out.Overall.TargetMinutes > 0 && out.Overall.TodayMinutes >= out.Overall.TargetMinutes
	return out, nil
}

func percent(done, target int) float64 {
	if target <= 0 {
		return 0
	}
	return math.Min(100, math.Round(float64(done)*1000/float64(target))/10)
}

// HourlyStats buckets all sessions by local start hour.
func (s *Store) HourlyStats(ctx context.Context, userID int64, loc *time.Location) ([]store.HourStat, error) {
	out := make([]store.HourStat, 24)
	for i := range out {
		out[i].Hour = i
	}
	rows, err := s.pool.Query(ctx, `
		SELECT EXTRACT(HOUR FROM (start_time AT TIME ZONE $2))::int AS hour,
		       SUM(duration_seconds) / 60, COUNT(*), AVG(focus_rating)::float8
		FROM sessions
		WHERE user_id = $1
		GROUP BY hour`, userID, loc.String())
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()
	for rows.Next() {
		var h store.HourStat
		if err := rows.Scan(&h.Hour, &h.Minutes, &h.SessionCount, &h.AvgRating); err != nil {
			return nil, mapErr(err)
		}
		if h.Hour >= 0 && h.Hour < 24 {
			h.AvgRating = math.Round(h.AvgRating*100) / 100
			out[h.Hour] = h
		}
	}
	return out, mapErr(rows.Err())
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
