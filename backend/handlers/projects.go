package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"study-tracker-backend/database"
	"study-tracker-backend/models"
)

func GetProjects(w http.ResponseWriter, r *http.Request) {
	rows, err := database.DB.Query(`
		SELECT 
			p.id, p.name, p.color, p.description, p.target_minutes_per_day, p.created_at,
			COALESCE(SUM(s.duration_seconds) / 60, 0) AS total_minutes
		FROM projects p
		LEFT JOIN sessions s ON p.id = s.project_id
		GROUP BY p.id
		ORDER BY p.name ASC
	`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	projects := make([]models.Project, 0)
	for rows.Next() {
		var p models.Project
		if err := rows.Scan(&p.ID, &p.Name, &p.Color, &p.Description, &p.TargetMinutesPerDay, &p.CreatedAt, &p.TotalMinutes); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		projects = append(projects, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(projects)
}

func CreateProject(w http.ResponseWriter, r *http.Request) {
	var p models.Project
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if p.Name == "" {
		http.Error(w, "Project name is required", http.StatusBadRequest)
		return
	}
	if p.Color == "" {
		p.Color = "#3b82f6"
	}
	if p.TargetMinutesPerDay <= 0 {
		p.TargetMinutesPerDay = 60
	}

	result, err := database.DB.Exec(
		"INSERT INTO projects (name, color, description, target_minutes_per_day) VALUES (?, ?, ?, ?)",
		p.Name, p.Color, p.Description, p.TargetMinutesPerDay,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	id, _ := result.LastInsertId()
	p.ID = id
	p.TotalMinutes = 0

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(p)
}

func UpdateProject(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid project ID", http.StatusBadRequest)
		return
	}

	var p models.Project
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	_, err = database.DB.Exec(
		"UPDATE projects SET name = ?, color = ?, description = ?, target_minutes_per_day = ? WHERE id = ?",
		p.Name, p.Color, p.Description, p.TargetMinutesPerDay, id,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	p.ID = id
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

func DeleteProject(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid project ID", http.StatusBadRequest)
		return
	}

	_, err = database.DB.Exec("DELETE FROM projects WHERE id = ?", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
