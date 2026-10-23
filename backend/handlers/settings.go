package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"study-tracker-backend/database"
	"study-tracker-backend/models"
)

func GetSettings(w http.ResponseWriter, r *http.Request) {
	rows, err := database.DB.Query("SELECT key, value FROM settings")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	s := models.Settings{
		WorkDuration:       25,
		ShortBreakDuration: 5,
		LongBreakDuration:  15,
		LongBreakInterval:  4,
		AutoStartBreaks:    false,
		SoundEnabled:       true,
	}

	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err == nil {
			switch k {
			case "work_duration":
				if val, e := strconv.Atoi(v); e == nil {
					s.WorkDuration = val
				}
			case "short_break_duration":
				if val, e := strconv.Atoi(v); e == nil {
					s.ShortBreakDuration = val
				}
			case "long_break_duration":
				if val, e := strconv.Atoi(v); e == nil {
					s.LongBreakDuration = val
				}
			case "long_break_interval":
				if val, e := strconv.Atoi(v); e == nil {
					s.LongBreakInterval = val
				}
			case "auto_start_breaks":
				s.AutoStartBreaks = (v == "true")
			case "sound_enabled":
				s.SoundEnabled = (v == "true")
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s)
}

func UpdateSettings(w http.ResponseWriter, r *http.Request) {
	var s models.Settings
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	updates := map[string]string{
		"work_duration":        strconv.Itoa(s.WorkDuration),
		"short_break_duration": strconv.Itoa(s.ShortBreakDuration),
		"long_break_duration":  strconv.Itoa(s.LongBreakDuration),
		"long_break_interval":  strconv.Itoa(s.LongBreakInterval),
		"auto_start_breaks":    strconv.FormatBool(s.AutoStartBreaks),
		"sound_enabled":        strconv.FormatBool(s.SoundEnabled),
	}

	for k, v := range updates {
		_, _ = database.DB.Exec("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", k, v)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s)
}
