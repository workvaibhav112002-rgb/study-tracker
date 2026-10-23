package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"study-tracker-backend/auth"
	"study-tracker-backend/database"
	"study-tracker-backend/models"
)

func GetSessions(w http.ResponseWriter, r *http.Request) {
	userID, err := auth.GetUserID(r.Context())
	if err != nil {
		http.Error(w, `{"error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	limitStr := r.URL.Query().Get("limit")
	limit := 100
	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	projectIDStr := r.URL.Query().Get("project_id")

	query := `
		SELECT 
			s.id, s.user_id, s.project_id, COALESCE(p.name, 'Unknown'), COALESCE(p.color, '#6b7280'),
			s.start_time, s.end_time, s.duration_seconds, s.session_type,
			s.focus_rating, s.notes, s.created_at
		FROM sessions s
		LEFT JOIN projects p ON s.project_id = p.id
		WHERE s.user_id = ?
	`
	args := []interface{}{userID}

	if projectIDStr != "" {
		projectID, err := strconv.ParseInt(projectIDStr, 10, 64)
		if err == nil {
			query += " AND s.project_id = ?"
			args = append(args, projectID)
		}
	}

	query += " ORDER BY s.start_time DESC LIMIT ?"
	args = append(args, limit)

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	sessions := make([]models.Session, 0)
	for rows.Next() {
		var s models.Session
		if err := rows.Scan(
			&s.ID, &s.UserID, &s.ProjectID, &s.ProjectName, &s.ProjectColor,
			&s.StartTime, &s.EndTime, &s.DurationSeconds, &s.SessionType,
			&s.FocusRating, &s.Notes, &s.CreatedAt,
		); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		sessions = append(sessions, s)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sessions)
}

func CreateSession(w http.ResponseWriter, r *http.Request) {
	userID, err := auth.GetUserID(r.Context())
	if err != nil {
		http.Error(w, `{"error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var s models.Session
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if s.ProjectID <= 0 {
		http.Error(w, "project_id is required", http.StatusBadRequest)
		return
	}

	if s.DurationSeconds <= 0 {
		http.Error(w, "duration_seconds must be positive", http.StatusBadRequest)
		return
	}

	now := time.Now().UTC()
	if s.StartTime == "" {
		s.StartTime = now.Add(-time.Duration(s.DurationSeconds) * time.Second).Format(time.RFC3339)
	}
	if s.EndTime == "" {
		s.EndTime = now.Format(time.RFC3339)
	}
	if s.SessionType == "" {
		s.SessionType = "pomodoro"
	}
	if s.FocusRating < 1 || s.FocusRating > 5 {
		s.FocusRating = 5
	}

	result, err := database.DB.Exec(`
		INSERT INTO sessions (user_id, project_id, start_time, end_time, duration_seconds, session_type, focus_rating, notes)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, userID, s.ProjectID, s.StartTime, s.EndTime, s.DurationSeconds, s.SessionType, s.FocusRating, s.Notes)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	id, _ := result.LastInsertId()
	s.ID = id
	s.UserID = userID

	_ = database.DB.QueryRow("SELECT name, color FROM projects WHERE id = ? AND user_id = ?", s.ProjectID, userID).
		Scan(&s.ProjectName, &s.ProjectColor)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(s)
}

func DeleteSession(w http.ResponseWriter, r *http.Request) {
	userID, err := auth.GetUserID(r.Context())
	if err != nil {
		http.Error(w, `{"error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid session ID", http.StatusBadRequest)
		return
	}

	_, err = database.DB.Exec("DELETE FROM sessions WHERE id = ? AND user_id = ?", id, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
