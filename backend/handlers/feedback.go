package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"study-tracker-backend/auth"
	"study-tracker-backend/database"
	"study-tracker-backend/models"
)

func CreateFeedback(w http.ResponseWriter, r *http.Request) {
	var f models.Feedback
	if err := json.NewDecoder(r.Body).Decode(&f); err != nil {
		http.Error(w, `{"error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	f.Message = strings.TrimSpace(f.Message)
	if f.Message == "" {
		http.Error(w, `{"error": "Message is required"}`, http.StatusBadRequest)
		return
	}

	if f.Type == "" {
		f.Type = "general"
	}

	// Optional user ID if authenticated
	userID, _ := auth.GetUserID(r.Context())
	f.UserID = userID

	result, err := database.DB.Exec(
		"INSERT INTO feedback (user_id, email, type, message) VALUES (?, ?, ?, ?)",
		f.UserID, f.Email, f.Type, f.Message,
	)
	if err != nil {
		http.Error(w, `{"error": "Failed to save feedback"}`, http.StatusInternalServerError)
		return
	}

	id, _ := result.LastInsertId()
	f.ID = id

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "ok",
		"message": "Thank you for your feedback!",
		"id":      id,
	})
}

func GetFeedback(w http.ResponseWriter, r *http.Request) {
	rows, err := database.DB.Query("SELECT id, user_id, email, type, message, created_at FROM feedback ORDER BY id DESC LIMIT 100")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	list := make([]models.Feedback, 0)
	for rows.Next() {
		var item models.Feedback
		if err := rows.Scan(&item.ID, &item.UserID, &item.Email, &item.Type, &item.Message, &item.CreatedAt); err == nil {
			list = append(list, item)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}
