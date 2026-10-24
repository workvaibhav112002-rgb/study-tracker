package httpapi

import (
	"net/http"
	"time"

	"study-tracker-backend/internal/store"
)

type sessionRequest struct {
	ProjectID       int64      `json:"project_id"`
	StartTime       *time.Time `json:"start_time"`
	EndTime         *time.Time `json:"end_time"`
	DurationSeconds int        `json:"duration_seconds"`
	SessionType     string     `json:"session_type"`
	FocusRating     *int       `json:"focus_rating"`
	Notes           string     `json:"notes"`
	Interruptions   *int       `json:"interruptions"`
	TaskID          *int64     `json:"task_id"`
}

const (
	maxSessionSeconds = 86400
	// maxFutureSkew tolerates client clocks slightly ahead of the server.
	maxFutureSkew = 5 * time.Minute
	// maxDurationMismatch bounds how far duration_seconds may differ from
	// end-start; pauses make them legitimately diverge.
	maxDurationMismatch = 2 * time.Hour
	maxInterruptions    = 100
)

func (s sessionRequest) validate(now time.Time) (store.SessionInput, error) {
	if s.ProjectID <= 0 {
		return store.SessionInput{}, invalid("project_id is required")
	}
	if err := inRange("duration_seconds", s.DurationSeconds, 1, maxSessionSeconds); err != nil {
		return store.SessionInput{}, err
	}
	sessionType := s.SessionType
	if sessionType == "" {
		sessionType = "pomodoro"
	}
	if err := oneOf("session_type", sessionType, store.SessionTypes); err != nil {
		return store.SessionInput{}, err
	}
	rating := 5
	if s.FocusRating != nil && *s.FocusRating != 0 {
		rating = *s.FocusRating
	}
	if err := inRange("focus_rating", rating, 1, 5); err != nil {
		return store.SessionInput{}, err
	}
	notes, err := cleanText("notes", s.Notes, maxNotesLen, false)
	if err != nil {
		return store.SessionInput{}, err
	}
	interruptions := 0
	if s.Interruptions != nil {
		interruptions = *s.Interruptions
	}
	if err := inRange("interruptions", interruptions, 0, maxInterruptions); err != nil {
		return store.SessionInput{}, err
	}
	if s.TaskID != nil && *s.TaskID <= 0 {
		return store.SessionInput{}, invalid("task_id must be a positive integer")
	}

	dur := time.Duration(s.DurationSeconds) * time.Second
	var start, end time.Time
	switch {
	case s.StartTime != nil && s.EndTime != nil:
		start, end = *s.StartTime, *s.EndTime
	case s.StartTime != nil:
		start, end = *s.StartTime, s.StartTime.Add(dur)
	case s.EndTime != nil:
		start, end = s.EndTime.Add(-dur), *s.EndTime
	default:
		start, end = now.Add(-dur), now
	}
	if start.IsZero() || end.IsZero() {
		return store.SessionInput{}, invalid("start_time and end_time must be RFC3339 timestamps")
	}
	if end.Before(start) {
		return store.SessionInput{}, invalid("end_time must not be before start_time")
	}
	if end.After(now.Add(maxFutureSkew)) {
		return store.SessionInput{}, invalid("end_time is in the future")
	}
	if span := end.Sub(start); span-dur > maxDurationMismatch || dur-span > maxDurationMismatch {
		return store.SessionInput{}, invalid("duration_seconds does not match start_time and end_time")
	}

	return store.SessionInput{
		ProjectID: s.ProjectID, StartTime: start.UTC(), EndTime: end.UTC(),
		DurationSeconds: s.DurationSeconds, SessionType: sessionType, FocusRating: rating, Notes: notes,
		Interruptions: interruptions, TaskID: s.TaskID,
	}, nil
}

func (a *api) listSessions(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit, err := parseLimit(q.Get("limit"))
	if err != nil {
		handleErr(w, r, err)
		return
	}
	pid, err := parseOptionalID(q.Get("project_id"), "project_id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	f := store.SessionFilter{Limit: limit, ProjectID: pid}
	sessions, err := a.store.ListSessions(r.Context(), userID(r), f)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, sessions)
}

func (a *api) createSession(w http.ResponseWriter, r *http.Request) {
	var req sessionRequest
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	in, err := req.validate(time.Now())
	if err != nil {
		handleErr(w, r, err)
		return
	}
	s, err := a.store.CreateSession(r.Context(), userID(r), in)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, s)
}

func (a *api) deleteSession(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	if err := a.store.DeleteSession(r.Context(), userID(r), id); err != nil {
		handleErr(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
