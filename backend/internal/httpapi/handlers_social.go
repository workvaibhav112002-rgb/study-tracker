package httpapi

import (
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"study-tracker-backend/internal/store"
)

var handleRe = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{2,29}$`)

// reservedHandles would collide with app routes or look official.
var reservedHandles = map[string]struct{}{
	"api": {}, "u": {}, "admin": {}, "reset": {}, "magic": {}, "settings": {}, "login": {}, "register": {},
	"me": {}, "friends": {}, "study": {}, "studytracker": {}, "support": {}, "help": {}, "about": {},
}

const friendInviteTTL = 7 * 24 * time.Hour

type profileRequest struct {
	Handle *string `json:"handle"`
	Public bool    `json:"profile_public"`
	Bio    string  `json:"bio"`
}

func (a *api) updateProfile(w http.ResponseWriter, r *http.Request) {
	var req profileRequest
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	in := store.ProfileInput{Public: req.Public, Bio: strings.TrimSpace(req.Bio)}
	if len(in.Bio) > 280 {
		handleErr(w, r, invalid("bio must be at most 280 characters"))
		return
	}
	if req.Handle != nil {
		h := strings.ToLower(strings.TrimSpace(*req.Handle))
		if h != "" {
			if !handleRe.MatchString(h) {
				handleErr(w, r, invalid("handle must be 3-30 characters: lowercase letters, digits and hyphens, starting with a letter or digit"))
				return
			}
			if _, reserved := reservedHandles[h]; reserved {
				handleErr(w, r, invalid("that handle is reserved"))
				return
			}
			in.Handle = &h
		}
	}
	if in.Public && in.Handle == nil {
		handleErr(w, r, invalid("choose a handle before making your profile public"))
		return
	}
	u, err := a.store.UpdateProfile(r.Context(), userID(r), in)
	if errors.Is(err, store.ErrConflict) {
		writeError(w, r, http.StatusConflict, "that handle is taken")
		return
	}
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, u)
}

// publicProfile is anonymous; unknown and private handles both 404.
func (a *api) publicProfile(w http.ResponseWriter, r *http.Request) {
	handle := strings.ToLower(chi.URLParam(r, "handle"))
	if !handleRe.MatchString(handle) {
		handleErr(w, r, store.ErrNotFound)
		return
	}
	loc, err := parseLocation(r.URL.Query().Get("tz"))
	if err != nil {
		handleErr(w, r, err)
		return
	}
	p, err := a.store.PublicProfile(r.Context(), handle, loc, time.Now())
	if err != nil {
		handleErr(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=60")
	writeJSON(w, http.StatusOK, p)
}

func (a *api) createFriendInvite(w http.ResponseWriter, r *http.Request) {
	raw, hash, err := newToken()
	if err != nil {
		handleErr(w, r, err)
		return
	}
	expires := time.Now().Add(friendInviteTTL)
	if err := a.store.CreateFriendInvite(r.Context(), userID(r), hash, expires); err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{
		"token":      raw,
		"url":        a.cfg.AppURL + "/friend?token=" + raw,
		"expires_at": expires.UTC().Format(time.RFC3339),
	})
}

func (a *api) acceptFriendInvite(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token string `json:"token"`
	}
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	if !calendarTokenRe.MatchString(req.Token) {
		handleErr(w, r, invalid("token is required"))
		return
	}
	inviter, err := a.store.AcceptFriendInvite(r.Context(), userID(r), hashToken(req.Token), time.Now())
	switch {
	case errors.Is(err, store.ErrNotFound):
		handleErr(w, r, invalid("this invite link is invalid, expired, or already used"))
		return
	case errors.Is(err, store.ErrInvalid):
		handleErr(w, r, invalid("you cannot accept your own invite"))
		return
	case err != nil:
		handleErr(w, r, err)
		return
	}
	loc, _ := parseLocation(r.URL.Query().Get("tz"))
	friends, err := a.store.ListFriends(r.Context(), userID(r), loc, time.Now())
	if err != nil {
		handleErr(w, r, err)
		return
	}
	var added *store.Friend
	for i := range friends {
		if friends[i].ID == inviter {
			added = &friends[i]
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"friend": added, "friends": friends})
}

func (a *api) listFriends(w http.ResponseWriter, r *http.Request) {
	loc, err := parseLocation(r.URL.Query().Get("tz"))
	if err != nil {
		handleErr(w, r, err)
		return
	}
	out, err := a.store.ListFriends(r.Context(), userID(r), loc, time.Now())
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *api) removeFriend(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	if err := a.store.RemoveFriend(r.Context(), userID(r), id); err != nil {
		handleErr(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
