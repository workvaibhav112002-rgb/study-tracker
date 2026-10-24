package postgres

import (
	"context"
	"sort"
	"time"

	"study-tracker-backend/internal/store"
)

// GoalStreak walks back from today over days that met the summed daily
// target of all projects, treating frozen days as met. One freeze per ISO
// week may be spent on a missed day within the last 7 days.
func (s *Store) GoalStreak(ctx context.Context, userID int64, loc *time.Location, now time.Time) (store.GoalStreak, error) {
	today, _, tz := localDay(loc, now)
	out := store.GoalStreak{FreezeDays: []string{}}

	var frozen []time.Time
	err := s.pool.QueryRow(ctx, `
		SELECT COALESCE((SELECT SUM(target_minutes_per_day) FROM projects WHERE user_id = $1), 0),
		       COALESCE((SELECT streak_freeze_days FROM settings WHERE user_id = $1), '{}'::date[])`, userID,
	).Scan(&out.TargetMinutes, &frozen)
	if err != nil {
		return out, mapErr(err)
	}
	frozenSet := map[string]struct{}{}
	for _, d := range frozen {
		k := d.Format(dateLayout)
		frozenSet[k] = struct{}{}
		out.FreezeDays = append(out.FreezeDays, k)
	}
	sort.Strings(out.FreezeDays)

	rows, err := s.pool.Query(ctx, `
		SELECT (start_time AT TIME ZONE $2)::date AS day, SUM(duration_seconds) / 60
		FROM sessions WHERE user_id = $1 AND start_time >= now() - interval '2 years'
		GROUP BY day`, userID, tz)
	if err != nil {
		return out, mapErr(err)
	}
	minutes := map[string]int{}
	for rows.Next() {
		var day time.Time
		var mins int
		if err := rows.Scan(&day, &mins); err != nil {
			rows.Close()
			return out, mapErr(err)
		}
		minutes[day.Format(dateLayout)] = mins
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return out, mapErr(err)
	}

	met := func(d time.Time) bool {
		k := d.Format(dateLayout)
		if _, ok := frozenSet[k]; ok {
			return true
		}
		return out.TargetMinutes > 0 && minutes[k] >= out.TargetMinutes
	}
	out.TodayMet = met(today)
	yesterday := today.AddDate(0, 0, -1)
	out.YesterdayMet = met(yesterday)
	if !out.YesterdayMet {
		out.MissedYesterdayISO = yesterday.Format(dateLayout)
	}

	// Current streak: today counts if met; otherwise start from yesterday.
	cursor := today
	if !out.TodayMet {
		cursor = yesterday
	}
	for met(cursor) {
		out.Days++
		cursor = cursor.AddDate(0, 0, -1)
		if out.Days > 3650 {
			break
		}
	}

	// Best streak over all recorded days (plus freezes).
	days := make([]string, 0, len(minutes)+len(frozenSet))
	seen := map[string]struct{}{}
	for k := range minutes {
		days = append(days, k)
		seen[k] = struct{}{}
	}
	for k := range frozenSet {
		if _, ok := seen[k]; !ok {
			days = append(days, k)
		}
	}
	sort.Strings(days)
	run, best := 0, 0
	var prev time.Time
	for _, k := range days {
		d, _ := time.ParseInLocation(dateLayout, k, loc)
		if !met(d) {
			run = 0
			continue
		}
		if run > 0 && d.Sub(prev) == 24*time.Hour {
			run++
		} else {
			run = 1
		}
		prev = d
		if run > best {
			best = run
		}
	}
	if out.Days > best {
		best = out.Days
	}
	out.BestDays = best

	// A freeze is available when none was used in the current ISO week.
	year, week := today.ISOWeek()
	out.FreezeAvailable = true
	for _, d := range frozen {
		y, w := d.ISOWeek()
		if y == year && w == week {
			out.FreezeAvailable = false
			break
		}
	}
	return out, nil
}

// AddStreakFreeze appends a day to the user's frozen days.
func (s *Store) AddStreakFreeze(ctx context.Context, userID int64, day string) error {
	tag, err := s.pool.Exec(ctx, `
		UPDATE settings SET streak_freeze_days = array_append(streak_freeze_days, $2::date), updated_at = now()
		WHERE user_id = $1 AND NOT ($2::date = ANY(streak_freeze_days))`, userID, day)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return store.ErrConflict
	}
	return nil
}

// Milestones computes achievements from the user's history.
func (s *Store) Milestones(ctx context.Context, userID int64, loc *time.Location, now time.Time) ([]store.Milestone, error) {
	var sessions, pomodoros, totalMinutes, reviews, notes, cards int
	var firstSession *time.Time
	err := s.pool.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM sessions WHERE user_id = $1),
			(SELECT COUNT(*) FROM sessions WHERE user_id = $1 AND session_type = 'pomodoro'),
			(SELECT COALESCE(SUM(duration_seconds), 0) / 60 FROM sessions WHERE user_id = $1),
			(SELECT COUNT(*) FROM card_reviews WHERE user_id = $1),
			(SELECT COUNT(*) FROM notes WHERE user_id = $1),
			(SELECT COUNT(*) FROM cards WHERE user_id = $1),
			(SELECT MIN(start_time) FROM sessions WHERE user_id = $1)`, userID,
	).Scan(&sessions, &pomodoros, &totalMinutes, &reviews, &notes, &cards, &firstSession)
	if err != nil {
		return nil, mapErr(err)
	}
	streak, err := s.GoalStreak(ctx, userID, loc, now)
	if err != nil {
		return nil, err
	}
	// Study streak (any session) for the streak badges.
	dash, err := s.DashboardStats(ctx, userID, loc, now)
	if err != nil {
		return nil, err
	}

	type def struct {
		id, title, desc, icon string
		target, progress      int
	}
	defs := []def{
		{"first-session", "First focus", "Log your first session", "sparkles", 1, sessions},
		{"pomodoros-10", "Ten tomatoes", "Complete 10 pomodoros", "timer", 10, pomodoros},
		{"pomodoros-50", "Fifty up", "Complete 50 pomodoros", "timer", 50, pomodoros},
		{"pomodoros-200", "Two hundred", "Complete 200 pomodoros", "timer", 200, pomodoros},
		{"hours-10", "Ten hours", "Study for 10 hours in total", "clock", 600, totalMinutes},
		{"hours-50", "Fifty hours", "Study for 50 hours in total", "clock", 3000, totalMinutes},
		{"hours-100", "Century", "Study for 100 hours in total", "clock", 6000, totalMinutes},
		{"streak-7", "One week", "Study 7 days in a row", "flame", 7, dash.CurrentStreakDays},
		{"streak-30", "One month", "Study 30 days in a row", "flame", 30, dash.CurrentStreakDays},
		{"goal-streak-7", "Goal getter", "Hit your daily goal 7 days in a row", "target", 7, streak.BestDays},
		{"cards-25", "Deck builder", "Create 25 flashcards", "layers", 25, cards},
		{"reviews-100", "Recall", "Review 100 flashcards", "brain", 100, reviews},
		{"notes-10", "Scribe", "Write 10 notes", "notebook", 10, notes},
	}
	out := make([]store.Milestone, 0, len(defs))
	for _, d := range defs {
		m := store.Milestone{ID: d.id, Title: d.title, Description: d.desc, Icon: d.icon, Target: d.target, Progress: min(d.progress, d.target), Achieved: d.progress >= d.target}
		if m.Achieved && d.id == "first-session" && firstSession != nil {
			t := firstSession.In(loc).Format(dateLayout)
			m.AchievedAt = &t
		}
		out = append(out, m)
	}
	return out, nil
}

// UpsertPushSubscription stores or refreshes a browser's push endpoint.
func (s *Store) UpsertPushSubscription(ctx context.Context, userID int64, endpoint, p256dh, auth string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4)
		ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, last_error = NULL`,
		userID, endpoint, p256dh, auth)
	return mapErr(err)
}

// DeletePushSubscription removes one of the user's endpoints.
func (s *Store) DeletePushSubscription(ctx context.Context, userID int64, endpoint string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`, userID, endpoint)
	if err != nil {
		return mapErr(err)
	}
	if tag.RowsAffected() == 0 {
		return store.ErrNotFound
	}
	return nil
}

// DeleteSubscriptionByEndpoint drops an endpoint the push service rejected.
func (s *Store) DeleteSubscriptionByEndpoint(ctx context.Context, endpoint string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM push_subscriptions WHERE endpoint = $1`, endpoint)
	return mapErr(err)
}

// ReminderCandidates returns users who opted in and have a subscription.
func (s *Store) ReminderCandidates(ctx context.Context) ([]store.ReminderCandidate, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT u.id, u.name, st.timezone, st.reminder_hour, st.last_reminded_on,
		       p.id, p.endpoint, p.p256dh, p.auth
		FROM settings st
		JOIN users u ON u.id = st.user_id
		JOIN push_subscriptions p ON p.user_id = u.id
		WHERE st.reminder_enabled
		ORDER BY u.id`)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()
	byUser := map[int64]*store.ReminderCandidate{}
	order := []int64{}
	for rows.Next() {
		var c store.ReminderCandidate
		var sub store.PushSubscription
		if err := rows.Scan(&c.UserID, &c.Name, &c.Timezone, &c.ReminderHour, &c.LastReminded, &sub.ID, &sub.Endpoint, &sub.P256dh, &sub.Auth); err != nil {
			return nil, mapErr(err)
		}
		if _, ok := byUser[c.UserID]; !ok {
			cc := c
			byUser[c.UserID] = &cc
			order = append(order, c.UserID)
		}
		sub.UserID = c.UserID
		byUser[c.UserID].Subscriptions = append(byUser[c.UserID].Subscriptions, sub)
	}
	if err := rows.Err(); err != nil {
		return nil, mapErr(err)
	}
	out := make([]store.ReminderCandidate, 0, len(order))
	for _, id := range order {
		out = append(out, *byUser[id])
	}
	return out, nil
}

// MarkReminded records that the user was nudged on a local day.
func (s *Store) MarkReminded(ctx context.Context, userID int64, day string) error {
	_, err := s.pool.Exec(ctx, `UPDATE settings SET last_reminded_on = $2::date WHERE user_id = $1`, userID, day)
	return mapErr(err)
}

// StudiedOn reports whether any session started on the given local day.
func (s *Store) StudiedOn(ctx context.Context, userID int64, loc *time.Location, day time.Time) (bool, error) {
	var ok bool
	err := s.pool.QueryRow(ctx, `
		SELECT EXISTS (SELECT 1 FROM sessions WHERE user_id = $1 AND (start_time AT TIME ZONE $2)::date = $3::date)`,
		userID, loc.String(), day.Format(dateLayout)).Scan(&ok)
	return ok, mapErr(err)
}
