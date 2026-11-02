package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"study-tracker-backend/internal/brand"
	"time"

	"study-tracker-backend/internal/auth"
	"study-tracker-backend/internal/store"
)

func (a *api) health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	if err := a.store.Ping(ctx); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "degraded", "error": "database unreachable"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (a *api) dashboardStats(w http.ResponseWriter, r *http.Request) {
	loc, err := parseLocation(r.URL.Query().Get("tz"))
	if err != nil {
		handleErr(w, r, err)
		return
	}
	stats, err := a.store.DashboardStats(r.Context(), userID(r), loc, time.Now())
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

func (a *api) goalsStats(w http.ResponseWriter, r *http.Request) {
	loc, err := parseLocation(r.URL.Query().Get("tz"))
	if err != nil {
		handleErr(w, r, err)
		return
	}
	out, err := a.store.GoalsStats(r.Context(), userID(r), loc, time.Now())
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *api) heatmapStats(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	loc, err := parseLocation(q.Get("tz"))
	if err != nil {
		handleErr(w, r, err)
		return
	}
	days, err := parseDays(q.Get("days"))
	if err != nil {
		handleErr(w, r, err)
		return
	}
	out, err := a.store.Heatmap(r.Context(), userID(r), loc, time.Now(), days)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *api) hourlyStats(w http.ResponseWriter, r *http.Request) {
	loc, err := parseLocation(r.URL.Query().Get("tz"))
	if err != nil {
		handleErr(w, r, err)
		return
	}
	out, err := a.store.HourlyStats(r.Context(), userID(r), loc)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *api) weeklyReview(w http.ResponseWriter, r *http.Request) {
	loc, err := parseLocation(r.URL.Query().Get("tz"))
	if err != nil {
		handleErr(w, r, err)
		return
	}
	out, err := a.store.WeeklyReview(r.Context(), userID(r), loc, time.Now())
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

const maxTimerStateBytes = 4096

func (a *api) getTimer(w http.ResponseWriter, r *http.Request) {
	snap, err := a.store.GetTimer(r.Context(), userID(r))
	if errors.Is(err, store.ErrNotFound) {
		writeJSON(w, http.StatusOK, map[string]any{"state": nil, "updated_at": 0})
		return
	}
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, snap)
}

func (a *api) putTimer(w http.ResponseWriter, r *http.Request) {
	var snap store.TimerSnapshot
	if err := decodeJSON(r, &snap); err != nil {
		handleErr(w, r, err)
		return
	}
	if len(snap.State) == 0 || len(snap.State) > maxTimerStateBytes || snap.UpdatedAt <= 0 {
		handleErr(w, r, invalid("state (up to %d bytes) and updated_at are required", maxTimerStateBytes))
		return
	}
	if !json.Valid(snap.State) || snap.State[0] != '{' {
		handleErr(w, r, invalid("state must be a JSON object"))
		return
	}
	out, err := a.store.PutTimer(r.Context(), userID(r), snap)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *api) getSettings(w http.ResponseWriter, r *http.Request) {
	s, err := a.store.GetSettings(r.Context(), userID(r))
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, s)
}

// settingsRequest makes the add-on flags optional so an older client that
// does not know them cannot switch them off by saving its timer settings.
type settingsRequest struct {
	store.Settings
	CardsEnabled      *bool `json:"cards_enabled"`
	MistakeLabEnabled *bool `json:"mistake_lab_enabled"`
}

func (a *api) updateSettings(w http.ResponseWriter, r *http.Request) {
	var req settingsRequest
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	s := req.Settings
	if req.CardsEnabled == nil || req.MistakeLabEnabled == nil {
		current, err := a.store.GetSettings(r.Context(), userID(r))
		if err != nil {
			handleErr(w, r, err)
			return
		}
		s.CardsEnabled, s.MistakeLabEnabled = current.CardsEnabled, current.MistakeLabEnabled
	}
	if req.CardsEnabled != nil {
		s.CardsEnabled = *req.CardsEnabled
	}
	if req.MistakeLabEnabled != nil {
		s.MistakeLabEnabled = *req.MistakeLabEnabled
	}
	for _, c := range []struct {
		name   string
		v      int
		lo, hi int
	}{
		{"work_duration", s.WorkDuration, 1, 180},
		{"short_break_duration", s.ShortBreakDuration, 1, 60},
		{"long_break_duration", s.LongBreakDuration, 1, 120},
		{"long_break_interval", s.LongBreakInterval, 1, 12},
		{"reminder_hour", s.ReminderHour, 0, 23},
	} {
		if err := inRange(c.name, c.v, c.lo, c.hi); err != nil {
			handleErr(w, r, err)
			return
		}
	}
	if s.Timezone == "" {
		s.Timezone = "UTC"
	}
	if loc, err := parseLocation(s.Timezone); err != nil || loc.String() != s.Timezone || len(s.Timezone) > 64 {
		handleErr(w, r, invalid("timezone must be an IANA zone name"))
		return
	}
	saved, err := a.store.UpsertSettings(r.Context(), userID(r), s)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (a *api) export(w http.ResponseWriter, r *http.Request) {
	data, err := a.store.ExportAll(r.Context(), userID(r))
	if err != nil {
		handleErr(w, r, err)
		return
	}
	w.Header().Set("Content-Disposition",
		fmt.Sprintf(`attachment; filename="%s_backup_%s.json"`, brand.FilePrefix, data.ExportedAt.Format("2006-01-02")))
	writeJSON(w, http.StatusOK, data)
}

type feedbackRequest struct {
	Type    string `json:"type"`
	Message string `json:"message"`
	Email   string `json:"email"`
}

func (a *api) createFeedback(w http.ResponseWriter, r *http.Request) {
	var req feedbackRequest
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	msg, err := cleanText("message", req.Message, maxMessageLen, true)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	kind := req.Type
	if kind == "" {
		kind = "general"
	}
	if err := oneOf("type", kind, store.FeedbackTypes); err != nil {
		handleErr(w, r, err)
		return
	}
	email := normalizeEmail(req.Email)
	if email != "" {
		if err := validateEmail(email); err != nil {
			handleErr(w, r, err)
			return
		}
	}
	in := store.FeedbackInput{Email: email, Type: kind, Message: msg}
	if uid, ok := auth.UserIDFrom(r.Context()); ok {
		in.UserID = &uid
	}
	id, err := a.store.CreateFeedback(r.Context(), in)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"status": "ok", "message": "Thank you for your feedback!", "id": id})
}
