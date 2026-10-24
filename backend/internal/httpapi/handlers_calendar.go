package httpapi

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"study-tracker-backend/internal/store"
)

var calendarTokenRe = regexp.MustCompile(`^[A-Za-z0-9_-]{43}$`)

func hashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func (a *api) createCalendarToken(w http.ResponseWriter, r *http.Request) {
	var buf [32]byte
	if _, err := rand.Read(buf[:]); err != nil {
		handleErr(w, r, err)
		return
	}
	raw := base64.RawURLEncoding.EncodeToString(buf[:])
	if err := a.store.SetCalendarToken(r.Context(), userID(r), hashToken(raw)); err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"token": raw, "url": "/api/calendar/" + raw + ".ics"})
}

func (a *api) deleteCalendarToken(w http.ResponseWriter, r *http.Request) {
	if err := a.store.ClearCalendarToken(r.Context(), userID(r)); err != nil {
		handleErr(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// calendarFeed is public: the token is the credential.
func (a *api) calendarFeed(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimSuffix(chi.URLParam(r, "token"), ".ics")
	if !calendarTokenRe.MatchString(raw) {
		writeError(w, r, http.StatusNotFound, "not found")
		return
	}
	uid, err := a.store.UserIDByCalendarToken(r.Context(), hashToken(raw))
	if err != nil {
		handleErr(w, r, err)
		return
	}
	since := time.Now().AddDate(0, 0, -180)
	sessions, err := a.store.ListSessions(r.Context(), uid, store.SessionFilter{Since: &since})
	if err != nil {
		handleErr(w, r, err)
		return
	}
	w.Header().Set("Content-Type", "text/calendar; charset=utf-8")
	w.Header().Set("Cache-Control", "private, max-age=300")
	w.Header().Set("Content-Disposition", `inline; filename="study-tracker.ics"`)
	w.WriteHeader(http.StatusOK)
	_ = writeICS(w, sessions)
}
