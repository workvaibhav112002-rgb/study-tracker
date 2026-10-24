package httpapi

import (
	"context"
	"fmt"
	"net/http"
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

func (a *api) getSettings(w http.ResponseWriter, r *http.Request) {
	s, err := a.store.GetSettings(r.Context(), userID(r))
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, s)
}

func (a *api) updateSettings(w http.ResponseWriter, r *http.Request) {
	var s store.Settings
	if err := decodeJSON(r, &s); err != nil {
		handleErr(w, r, err)
		return
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
	} {
		if err := inRange(c.name, c.v, c.lo, c.hi); err != nil {
			handleErr(w, r, err)
			return
		}
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
		fmt.Sprintf(`attachment; filename="study_tracker_backup_%s.json"`, data.ExportedAt.Format("2006-01-02")))
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
