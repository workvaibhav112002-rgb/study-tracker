package httpapi

import (
	"net/http"

	"study-tracker-backend/internal/store"
)

type projectRequest struct {
	Name                string `json:"name"`
	Color               string `json:"color"`
	Description         string `json:"description"`
	TargetMinutesPerDay *int   `json:"target_minutes_per_day"`
}

func (p projectRequest) validate() (store.ProjectInput, error) {
	name, err := cleanText("name", p.Name, maxNameLen, true)
	if err != nil {
		return store.ProjectInput{}, err
	}
	color, err := validateColor(p.Color)
	if err != nil {
		return store.ProjectInput{}, err
	}
	desc, err := cleanText("description", p.Description, maxDescriptionLen, false)
	if err != nil {
		return store.ProjectInput{}, err
	}
	target := 60
	if p.TargetMinutesPerDay != nil {
		target = *p.TargetMinutesPerDay
	}
	if err := inRange("target_minutes_per_day", target, 1, 1440); err != nil {
		return store.ProjectInput{}, err
	}
	return store.ProjectInput{Name: name, Color: color, Description: desc, TargetMinutesPerDay: target}, nil
}

func (a *api) listProjects(w http.ResponseWriter, r *http.Request) {
	projects, err := a.store.ListProjects(r.Context(), userID(r))
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, projects)
}

func (a *api) createProject(w http.ResponseWriter, r *http.Request) {
	var req projectRequest
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	in, err := req.validate()
	if err != nil {
		handleErr(w, r, err)
		return
	}
	p, err := a.store.CreateProject(r.Context(), userID(r), in)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

func (a *api) updateProject(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	var req projectRequest
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	in, err := req.validate()
	if err != nil {
		handleErr(w, r, err)
		return
	}
	p, err := a.store.UpdateProject(r.Context(), userID(r), id, in)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (a *api) deleteProject(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	if err := a.store.DeleteProject(r.Context(), userID(r), id); err != nil {
		handleErr(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
