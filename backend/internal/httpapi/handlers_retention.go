package httpapi

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"study-tracker-backend/internal/push"
	"study-tracker-backend/internal/store"
)

func (a *api) goalStreak(w http.ResponseWriter, r *http.Request) {
	loc, err := parseLocation(r.URL.Query().Get("tz"))
	if err != nil {
		handleErr(w, r, err)
		return
	}
	out, err := a.store.GoalStreak(r.Context(), userID(r), loc, time.Now())
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

// freezeStreak spends the weekly freeze on yesterday when it was missed.
func (a *api) freezeStreak(w http.ResponseWriter, r *http.Request) {
	loc, err := parseLocation(r.URL.Query().Get("tz"))
	if err != nil {
		handleErr(w, r, err)
		return
	}
	streak, err := a.store.GoalStreak(r.Context(), userID(r), loc, time.Now())
	if err != nil {
		handleErr(w, r, err)
		return
	}
	switch {
	case streak.TargetMinutes == 0:
		handleErr(w, r, invalid("set a daily goal on a project first"))
		return
	case streak.YesterdayMet:
		handleErr(w, r, invalid("yesterday's goal was met; nothing to freeze"))
		return
	case !streak.FreezeAvailable:
		handleErr(w, r, invalid("you already used this week's freeze"))
		return
	}
	if err := a.store.AddStreakFreeze(r.Context(), userID(r), streak.MissedYesterdayISO); err != nil {
		handleErr(w, r, err)
		return
	}
	out, err := a.store.GoalStreak(r.Context(), userID(r), loc, time.Now())
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *api) milestones(w http.ResponseWriter, r *http.Request) {
	loc, err := parseLocation(r.URL.Query().Get("tz"))
	if err != nil {
		handleErr(w, r, err)
		return
	}
	out, err := a.store.Milestones(r.Context(), userID(r), loc, time.Now())
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

type pushSubscribeRequest struct {
	Endpoint string `json:"endpoint"`
	Keys     struct {
		P256dh string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
}

func (p pushSubscribeRequest) validate() error {
	u, err := url.Parse(p.Endpoint)
	if err != nil || u.Scheme != "https" || u.Host == "" || len(p.Endpoint) > 2048 {
		return invalid("endpoint must be an https URL")
	}
	if p.Keys.P256dh == "" || p.Keys.Auth == "" || len(p.Keys.P256dh) > 256 || len(p.Keys.Auth) > 256 {
		return invalid("keys.p256dh and keys.auth are required")
	}
	return nil
}

func (a *api) pushSubscribe(w http.ResponseWriter, r *http.Request) {
	if !a.push.Enabled() {
		handleErr(w, r, invalid("push notifications are not enabled on this server"))
		return
	}
	var in pushSubscribeRequest
	if err := decodeJSON(r, &in); err != nil {
		handleErr(w, r, err)
		return
	}
	if err := in.validate(); err != nil {
		handleErr(w, r, err)
		return
	}
	if err := a.store.UpsertPushSubscription(r.Context(), userID(r), in.Endpoint, in.Keys.P256dh, in.Keys.Auth); err != nil {
		handleErr(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *api) pushUnsubscribe(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Endpoint string `json:"endpoint"`
	}
	if err := decodeJSON(r, &in); err != nil {
		handleErr(w, r, err)
		return
	}
	if in.Endpoint == "" {
		handleErr(w, r, invalid("endpoint is required"))
		return
	}
	if err := a.store.DeletePushSubscription(r.Context(), userID(r), in.Endpoint); err != nil {
		handleErr(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// reminderPayload is what the service worker shows.
type reminderPayload struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	URL   string `json:"url"`
	Tag   string `json:"tag"`
}

// cronReminders is called hourly by a scheduler. It nudges every opted-in
// user whose local clock has reached their reminder hour and who has not
// studied yet today. The response summarises what happened.
func (a *api) cronReminders(w http.ResponseWriter, r *http.Request) {
	if a.cfg.CronSecret == "" {
		handleErr(w, r, store.ErrNotFound)
		return
	}
	got := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if subtle.ConstantTimeCompare([]byte(got), []byte(a.cfg.CronSecret)) != 1 {
		writeError(w, r, http.StatusUnauthorized, "unauthorized")
		return
	}
	if !a.push.Enabled() {
		writeJSON(w, http.StatusOK, map[string]any{"sent": 0, "skipped": 0, "push_enabled": false})
		return
	}
	now := time.Now()
	if raw := r.URL.Query().Get("now"); raw != "" && !a.cfg.IsProduction() {
		if t, err := time.Parse(time.RFC3339, raw); err == nil {
			now = t
		}
	}
	sent, skipped, errs := a.runReminders(r.Context(), now)
	writeJSON(w, http.StatusOK, map[string]any{"sent": sent, "skipped": skipped, "errors": errs, "push_enabled": true})
}

func (a *api) runReminders(ctx context.Context, now time.Time) (sent, skipped, failed int) {
	candidates, err := a.store.ReminderCandidates(ctx)
	if err != nil {
		a.logf("reminders: list", err)
		return 0, 0, 1
	}
	for _, c := range candidates {
		loc, err := time.LoadLocation(c.Timezone)
		if err != nil {
			skipped++
			continue
		}
		local := now.In(loc)
		day := local.Format("2006-01-02")
		// Schedulers run late; accept a three-hour window after the chosen hour.
		late := local.Hour() - c.ReminderHour
		if late < 0 || late >= 3 || (c.LastReminded != nil && c.LastReminded.Format("2006-01-02") == day) {
			skipped++
			continue
		}
		studied, err := a.store.StudiedOn(ctx, c.UserID, loc, local)
		if err != nil {
			failed++
			continue
		}
		if studied {
			// Nothing to nudge; still mark so we do not re-check all day.
			_ = a.store.MarkReminded(ctx, c.UserID, day)
			skipped++
			continue
		}
		streak, _ := a.store.GoalStreak(ctx, c.UserID, loc, now)
		body := "No session logged yet today. A single pomodoro keeps the habit alive."
		if streak.Days > 0 {
			body = "Your " + itoa(streak.Days) + "-day goal streak is waiting. Log a session today to keep it."
		}
		payload, _ := json.Marshal(reminderPayload{Title: "Time to study", Body: body, URL: a.cfg.AppURL + "/?from=reminder", Tag: "reminder-" + day})
		delivered := false
		for _, sub := range c.Subscriptions {
			err := a.push.Send(ctx, push.Subscription{Endpoint: sub.Endpoint, P256dh: sub.P256dh, Auth: sub.Auth}, payload)
			switch {
			case err == nil:
				delivered = true
			case errors.Is(err, push.ErrGone):
				_ = a.store.DeleteSubscriptionByEndpoint(ctx, sub.Endpoint)
			default:
				a.logf("reminders: send", err)
				failed++
			}
		}
		if delivered {
			sent++
		}
		_ = a.store.MarkReminded(ctx, c.UserID, day)
	}
	return sent, skipped, failed
}

func (a *api) logf(msg string, err error) {
	if a.logger != nil {
		a.logger.Warn(msg, "err", err)
	}
}

func itoa(n int) string { return strconv.Itoa(n) }
