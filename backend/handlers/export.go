package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"study-tracker-backend/auth"
	"study-tracker-backend/database"
	"study-tracker-backend/models"
)

type FullExportData struct {
	ExportedAt string           `json:"exported_at"`
	Projects   []models.Project `json:"projects"`
	Sessions   []models.Session `json:"sessions"`
}

func ExportData(w http.ResponseWriter, r *http.Request) {
	userID, err := auth.GetUserID(r.Context())
	if err != nil {
		http.Error(w, `{"error": "Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	pRows, err := database.DB.Query(
		"SELECT id, user_id, name, color, description, target_minutes_per_day, created_at FROM projects WHERE user_id = ?",
		userID,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer pRows.Close()

	projects := make([]models.Project, 0)
	for pRows.Next() {
		var p models.Project
		if err := pRows.Scan(&p.ID, &p.UserID, &p.Name, &p.Color, &p.Description, &p.TargetMinutesPerDay, &p.CreatedAt); err == nil {
			projects = append(projects, p)
		}
	}

	sRows, err := database.DB.Query(`
		SELECT 
			s.id, s.user_id, s.project_id, COALESCE(p.name, 'Unknown'), COALESCE(p.color, '#6b7280'),
			s.start_time, s.end_time, s.duration_seconds, s.session_type,
			s.focus_rating, s.notes, s.created_at
		FROM sessions s
		LEFT JOIN projects p ON s.project_id = p.id
		WHERE s.user_id = ?
		ORDER BY s.start_time DESC
	`, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer sRows.Close()

	sessions := make([]models.Session, 0)
	for sRows.Next() {
		var s models.Session
		if err := sRows.Scan(
			&s.ID, &s.UserID, &s.ProjectID, &s.ProjectName, &s.ProjectColor,
			&s.StartTime, &s.EndTime, &s.DurationSeconds, &s.SessionType,
			&s.FocusRating, &s.Notes, &s.CreatedAt,
		); err == nil {
			sessions = append(sessions, s)
		}
	}

	data := FullExportData{
		ExportedAt: time.Now().Format(time.RFC3339),
		Projects:   projects,
		Sessions:   sessions,
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=study_tracker_backup_%s.json", time.Now().Format("2006-01-02")))
	json.NewEncoder(w).Encode(data)
}
