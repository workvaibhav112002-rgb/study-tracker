package httpapi

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"study-tracker-backend/internal/store"
)

// exportCSV streams every session as a spreadsheet-friendly CSV. Times are
// RFC 3339 in the requested timezone so the file round-trips through /import.
func (a *api) exportCSV(w http.ResponseWriter, r *http.Request) {
	loc, err := parseLocation(r.URL.Query().Get("tz"))
	if err != nil {
		handleErr(w, r, err)
		return
	}
	sessions, err := a.store.ListSessions(r.Context(), userID(r), store.SessionFilter{})
	if err != nil {
		handleErr(w, r, err)
		return
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="study_tracker_sessions_%s.csv"`, time.Now().In(loc).Format("2006-01-02")))
	w.WriteHeader(http.StatusOK)
	cw := csv.NewWriter(w)
	cw.UseCRLF = true
	_ = cw.Write([]string{"project", "start_time", "end_time", "duration_minutes", "session_type", "focus_rating", "interruptions", "notes"})
	for _, s := range sessions {
		_ = cw.Write([]string{
			s.ProjectName,
			s.StartTime.In(loc).Format(time.RFC3339),
			s.EndTime.In(loc).Format(time.RFC3339),
			strconv.Itoa(s.DurationSeconds / 60),
			s.SessionType,
			strconv.Itoa(s.FocusRating),
			strconv.Itoa(s.Interruptions),
			s.Notes,
		})
	}
	cw.Flush()
}
