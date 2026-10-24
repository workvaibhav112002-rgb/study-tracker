package httpapi

import (
	"net/http"
	"strings"
	"time"

	"study-tracker-backend/internal/store"
)

const (
	maxCardFront = 2000
	maxCardBack  = 4000
	maxTags      = 10
	maxTagLen    = 30
)

func cleanTags(raw []string) ([]string, error) {
	out := make([]string, 0, len(raw))
	seen := map[string]struct{}{}
	for _, t := range raw {
		t = strings.ToLower(strings.TrimSpace(t))
		if t == "" {
			continue
		}
		if len(t) > maxTagLen {
			return nil, invalid("tags must be at most %d characters", maxTagLen)
		}
		if strings.ContainsAny(t, " ,\n\t") {
			return nil, invalid("tags must be single words")
		}
		if _, dup := seen[t]; dup {
			continue
		}
		seen[t] = struct{}{}
		out = append(out, t)
		if len(out) > maxTags {
			return nil, invalid("at most %d tags", maxTags)
		}
	}
	return out, nil
}

type cardRequest struct {
	ProjectID int64    `json:"project_id"`
	Front     string   `json:"front"`
	Back      string   `json:"back"`
	Tags      []string `json:"tags"`
}

func (c cardRequest) validate(requireProject bool) (store.CardInput, error) {
	if requireProject && c.ProjectID <= 0 {
		return store.CardInput{}, invalid("project_id is required")
	}
	front, err := cleanText("front", c.Front, maxCardFront, true)
	if err != nil {
		return store.CardInput{}, err
	}
	back, err := cleanText("back", c.Back, maxCardBack, true)
	if err != nil {
		return store.CardInput{}, err
	}
	tags, err := cleanTags(c.Tags)
	if err != nil {
		return store.CardInput{}, err
	}
	return store.CardInput{ProjectID: c.ProjectID, Front: front, Back: back, Tags: tags}, nil
}

func (a *api) listCards(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	pid, err := parseOptionalID(q.Get("project_id"), "project_id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	archived, err := parseOptionalBool(q.Get("archived"), "archived")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	due, err := parseOptionalBool(q.Get("due"), "due")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	limit, err := parseLimit(q.Get("limit"))
	if err != nil {
		handleErr(w, r, err)
		return
	}
	f := store.CardFilter{ProjectID: pid, Archived: archived, Limit: limit, DueOnly: due != nil && *due}
	if f.Archived == nil && !f.DueOnly {
		no := false
		f.Archived = &no
	}
	cards, err := a.store.ListCards(r.Context(), userID(r), f)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, cards)
}

func (a *api) createCard(w http.ResponseWriter, r *http.Request) {
	var req cardRequest
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	in, err := req.validate(true)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	c, err := a.store.CreateCard(r.Context(), userID(r), in)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, c)
}

func (a *api) updateCard(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	var req cardRequest
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	in, err := req.validate(false)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	c, err := a.store.UpdateCard(r.Context(), userID(r), id, in)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (a *api) archiveCard(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	var req struct {
		Archived *bool `json:"archived"`
	}
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	if req.Archived == nil {
		handleErr(w, r, invalid("archived is required"))
		return
	}
	c, err := a.store.SetCardArchived(r.Context(), userID(r), id, *req.Archived)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (a *api) deleteCard(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	if err := a.store.DeleteCard(r.Context(), userID(r), id); err != nil {
		handleErr(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *api) reviewCard(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	var req struct {
		Rating int `json:"rating"`
	}
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	if err := inRange("rating", req.Rating, ratingAgain, ratingEasy); err != nil {
		handleErr(w, r, err)
		return
	}
	card, err := a.store.GetCard(r.Context(), userID(r), id)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	updated, err := a.store.ReviewCard(r.Context(), userID(r), id, req.Rating, nextSchedule(card, req.Rating, time.Now()))
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (a *api) cardStats(w http.ResponseWriter, r *http.Request) {
	pid, err := parseOptionalID(r.URL.Query().Get("project_id"), "project_id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	st, err := a.store.CardStats(r.Context(), userID(r), pid)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, st)
}

// ---- notes

const (
	maxNoteTitle = 200
	maxNoteBody  = 20000
)

type noteRequest struct {
	ProjectID *int64   `json:"project_id"`
	Title     string   `json:"title"`
	Body      string   `json:"body"`
	Tags      []string `json:"tags"`
	Pinned    bool     `json:"pinned"`
}

func (n noteRequest) validate() (store.NoteInput, error) {
	if n.ProjectID != nil && *n.ProjectID <= 0 {
		return store.NoteInput{}, invalid("project_id must be a positive integer")
	}
	title, err := cleanText("title", n.Title, maxNoteTitle, true)
	if err != nil {
		return store.NoteInput{}, err
	}
	body := strings.TrimSpace(n.Body)
	if len([]rune(body)) > maxNoteBody {
		return store.NoteInput{}, invalid("body must be at most %d characters", maxNoteBody)
	}
	tags, err := cleanTags(n.Tags)
	if err != nil {
		return store.NoteInput{}, err
	}
	return store.NoteInput{ProjectID: n.ProjectID, Title: title, Body: body, Tags: tags, Pinned: n.Pinned}, nil
}

func (a *api) listNotes(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	pid, err := parseOptionalID(q.Get("project_id"), "project_id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	limit, err := parseLimit(q.Get("limit"))
	if err != nil {
		handleErr(w, r, err)
		return
	}
	query := strings.TrimSpace(q.Get("q"))
	if len(query) > 100 {
		handleErr(w, r, invalid("q must be at most 100 characters"))
		return
	}
	notes, err := a.store.ListNotes(r.Context(), userID(r), store.NoteFilter{ProjectID: pid, Tag: strings.ToLower(strings.TrimSpace(q.Get("tag"))), Query: query, Limit: limit})
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, notes)
}

func (a *api) createNote(w http.ResponseWriter, r *http.Request) {
	var req noteRequest
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	in, err := req.validate()
	if err != nil {
		handleErr(w, r, err)
		return
	}
	n, err := a.store.CreateNote(r.Context(), userID(r), in)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, n)
}

func (a *api) updateNote(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	var req noteRequest
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	in, err := req.validate()
	if err != nil {
		handleErr(w, r, err)
		return
	}
	n, err := a.store.UpdateNote(r.Context(), userID(r), id, in)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, n)
}

func (a *api) deleteNote(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	if err := a.store.DeleteNote(r.Context(), userID(r), id); err != nil {
		handleErr(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
