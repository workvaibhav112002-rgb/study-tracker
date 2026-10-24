package postgres

import (
	"context"
	"fmt"
	"math"
	"time"

	"study-tracker-backend/internal/store"
)

// WeeklyReview summarises the last complete Monday–Sunday week in loc and
// compares it with the week before.
func (s *Store) WeeklyReview(ctx context.Context, userID int64, loc *time.Location, now time.Time) (store.WeeklyReview, error) {
	today, _, tz := localDay(loc, now)
	// Monday of the current week, then step back one week.
	offset := (int(today.Weekday()) + 6) % 7
	thisMonday := today.AddDate(0, 0, -offset)
	start := thisMonday.AddDate(0, 0, -7)
	end := thisMonday.AddDate(0, 0, -1)
	prevStart := start.AddDate(0, 0, -7)

	out := store.WeeklyReview{
		WeekStart: start.Format(dateLayout),
		WeekEnd:   end.Format(dateLayout),
		Days:      make([]store.DailyStat, 0, 7),
		Insights:  make([]string, 0, 4),
	}

	// Week totals, previous week, ratings, interruptions, pomodoros.
	err := s.pool.QueryRow(ctx, `
		SELECT
			COALESCE(SUM(duration_seconds) FILTER (WHERE (start_time AT TIME ZONE $2)::date BETWEEN $3::date AND $4::date), 0) / 60,
			COALESCE(SUM(duration_seconds) FILTER (WHERE (start_time AT TIME ZONE $2)::date BETWEEN $5::date AND $3::date - 1), 0) / 60,
			COUNT(*) FILTER (WHERE (start_time AT TIME ZONE $2)::date BETWEEN $3::date AND $4::date),
			COUNT(*) FILTER (WHERE session_type = 'pomodoro' AND (start_time AT TIME ZONE $2)::date BETWEEN $3::date AND $4::date),
			COALESCE(AVG(focus_rating) FILTER (WHERE (start_time AT TIME ZONE $2)::date BETWEEN $3::date AND $4::date), 0)::float8,
			COALESCE(AVG(interruptions) FILTER (WHERE (start_time AT TIME ZONE $2)::date BETWEEN $3::date AND $4::date), 0)::float8
		FROM sessions WHERE user_id = $1`,
		userID, tz, out.WeekStart, out.WeekEnd, prevStart.Format(dateLayout),
	).Scan(&out.Minutes, &out.PreviousMinutes, &out.Sessions, &out.Pomodoros, &out.AvgRating, &out.AvgInterruptions)
	if err != nil {
		return out, mapErr(err)
	}
	out.AvgRating = math.Round(out.AvgRating*10) / 10
	out.AvgInterruptions = math.Round(out.AvgInterruptions*10) / 10
	if out.PreviousMinutes > 0 {
		pct := math.Round(float64(out.Minutes-out.PreviousMinutes)*1000/float64(out.PreviousMinutes)) / 10
		out.DeltaPercent = &pct
	}

	// Per-day minutes for the week.
	rows, err := s.pool.Query(ctx, `
		SELECT (start_time AT TIME ZONE $2)::date AS day, SUM(duration_seconds) / 60
		FROM sessions
		WHERE user_id = $1
		  AND start_time >= ($3::date::timestamp AT TIME ZONE $2)
		  AND (start_time AT TIME ZONE $2)::date <= $4::date
		GROUP BY day`, userID, tz, out.WeekStart, out.WeekEnd)
	if err != nil {
		return out, mapErr(err)
	}
	daily := map[string]int{}
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
	for i := 0; i < 7; i++ {
		d := start.AddDate(0, 0, i).Format(dateLayout)
		ds := store.DailyStat{Date: d, Minutes: daily[d]}
		out.Days = append(out.Days, ds)
		if ds.Minutes > 0 {
			out.ActiveDays++
			if out.BestDay == nil || ds.Minutes > out.BestDay.Minutes {
				copyDS := ds
				out.BestDay = &copyDS
			}
		}
	}

	// Top project in the week.
	var tp store.ProjectStat
	err = s.pool.QueryRow(ctx, `
		SELECT p.id, p.name, p.color, SUM(s.duration_seconds), COUNT(*)
		FROM sessions s JOIN projects p ON p.id = s.project_id AND p.user_id = s.user_id
		WHERE s.user_id = $1 AND (s.start_time AT TIME ZONE $2)::date BETWEEN $3::date AND $4::date
		GROUP BY p.id ORDER BY SUM(s.duration_seconds) DESC, p.id LIMIT 1`,
		userID, tz, out.WeekStart, out.WeekEnd,
	).Scan(&tp.ProjectID, &tp.Name, &tp.Color, &tp.TotalSeconds, &tp.SessionCount)
	if err == nil {
		out.TopProject = &tp
		if out.Minutes > 0 {
			out.TopProjectShare = math.Round(float64(tp.TotalSeconds/60)*1000/float64(out.Minutes)) / 10
		}
	} else if mapErr(err) != store.ErrNotFound {
		return out, mapErr(err)
	}

	// Best starting hour in the week.
	var hour int
	err = s.pool.QueryRow(ctx, `
		SELECT EXTRACT(HOUR FROM (start_time AT TIME ZONE $2))::int
		FROM sessions WHERE user_id = $1 AND (start_time AT TIME ZONE $2)::date BETWEEN $3::date AND $4::date
		GROUP BY 1 ORDER BY SUM(duration_seconds) DESC LIMIT 1`, userID, tz, out.WeekStart, out.WeekEnd).Scan(&hour)
	if err == nil {
		out.BestHour = &hour
	} else if mapErr(err) != store.ErrNotFound {
		return out, mapErr(err)
	}

	// Streak as of the end of that week.
	rows, err = s.pool.Query(ctx, `
		SELECT DISTINCT (start_time AT TIME ZONE $2)::date AS day
		FROM sessions WHERE user_id = $1 AND start_time >= now() - interval '2 years'`, userID, tz)
	if err != nil {
		return out, mapErr(err)
	}
	days := map[string]struct{}{}
	for rows.Next() {
		var d time.Time
		if err := rows.Scan(&d); err != nil {
			rows.Close()
			return out, mapErr(err)
		}
		days[d.Format(dateLayout)] = struct{}{}
	}
	rows.Close()
	out.StreakDays = streak(days, end)

	out.Insights = reviewInsights(out)
	return out, nil
}

// reviewInsights turns the numbers into a few plain sentences.
func reviewInsights(r store.WeeklyReview) []string {
	var out []string
	if r.Minutes == 0 {
		return []string{"No sessions were logged last week. A single 25-minute focus block is enough to restart the streak."}
	}
	switch {
	case r.DeltaPercent == nil:
		out = append(out, fmt.Sprintf("You studied %s across %d sessions, your first full week of data.", fmtMinutes(r.Minutes), r.Sessions))
	case *r.DeltaPercent >= 10:
		out = append(out, fmt.Sprintf("You studied %s, up %.0f%% on the week before.", fmtMinutes(r.Minutes), *r.DeltaPercent))
	case *r.DeltaPercent <= -10:
		out = append(out, fmt.Sprintf("You studied %s, down %.0f%% on the week before.", fmtMinutes(r.Minutes), -*r.DeltaPercent))
	default:
		out = append(out, fmt.Sprintf("You studied %s, about the same as the week before.", fmtMinutes(r.Minutes)))
	}
	if r.BestDay != nil {
		d, _ := time.Parse(dateLayout, r.BestDay.Date)
		out = append(out, fmt.Sprintf("%s was your strongest day with %s.", d.Weekday().String(), fmtMinutes(r.BestDay.Minutes)))
	}
	if r.TopProject != nil && r.TopProjectShare > 0 {
		out = append(out, fmt.Sprintf("%s took %.0f%% of your time.", r.TopProject.Name, r.TopProjectShare))
	}
	if r.ActiveDays >= 6 {
		out = append(out, fmt.Sprintf("You showed up on %d of 7 days. That consistency is the whole game.", r.ActiveDays))
	} else if r.ActiveDays <= 3 {
		out = append(out, fmt.Sprintf("You studied on %d days. Spreading the same time over more days tends to stick better.", r.ActiveDays))
	}
	if r.AvgInterruptions >= 2 {
		out = append(out, fmt.Sprintf("Sessions averaged %.1f interruptions. Try silencing notifications before you start.", r.AvgInterruptions))
	} else if r.Sessions >= 5 && r.AvgInterruptions < 0.5 {
		out = append(out, "Sessions were almost interruption-free. Keep that setup.")
	}
	return out
}

func fmtMinutes(m int) string {
	h, rem := m/60, m%60
	if h == 0 {
		return fmt.Sprintf("%dm", rem)
	}
	return fmt.Sprintf("%dh %dm", h, rem)
}
