package httpapi

import (
	"net/http"

	"study-tracker-backend/internal/store"
)

const (
	maxTaskTitleLen      = 200
	maxEstimatePomodoros = 20
	maxReorderIDs        = 500
)

type taskRequest struct {
	ProjectID         int64  `json:"project_id"`
	Title             string `json:"title"`
	EstimatePomodoros *int   `json:"estimate_pomodoros"`
}

func (t taskRequest) validate(requireProject bool) (store.TaskInput, error) {
	if requireProject && t.ProjectID <= 0 {
		return store.TaskInput{}, invalid("project_id is required")
	}
	title, err := cleanText("title", t.Title, maxTaskTitleLen, true)
	if err != nil {
		return store.TaskInput{}, err
	}
	estimate := 1
	if t.EstimatePomodoros != nil {
		estimate = *t.EstimatePomodoros
	}
	if err := inRange("estimate_pomodoros", estimate, 1, maxEstimatePomodoros); err != nil {
		return store.TaskInput{}, err
	}
	return store.TaskInput{ProjectID: t.ProjectID, Title: title, EstimatePomodoros: estimate}, nil
}

func (a *api) listTasks(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	pid, err := parseOptionalID(q.Get("project_id"), "project_id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	done, err := parseOptionalBool(q.Get("done"), "done")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	tasks, err := a.store.ListTasks(r.Context(), userID(r), store.TaskFilter{ProjectID: pid, Done: done})
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, tasks)
}

func (a *api) createTask(w http.ResponseWriter, r *http.Request) {
	var req taskRequest
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	in, err := req.validate(true)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	t, err := a.store.CreateTask(r.Context(), userID(r), in)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, t)
}

func (a *api) updateTask(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	var req taskRequest
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	in, err := req.validate(false)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	t, err := a.store.UpdateTask(r.Context(), userID(r), id, in.Title, in.EstimatePomodoros)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, t)
}

func (a *api) setTaskDone(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	var req struct {
		Done *bool `json:"done"`
	}
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	if req.Done == nil {
		handleErr(w, r, invalid("done is required"))
		return
	}
	t, err := a.store.SetTaskDone(r.Context(), userID(r), id, *req.Done)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, t)
}

func (a *api) deleteTask(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		handleErr(w, r, err)
		return
	}
	if err := a.store.DeleteTask(r.Context(), userID(r), id); err != nil {
		handleErr(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *api) reorderTasks(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IDs []int64 `json:"ids"`
	}
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	if len(req.IDs) == 0 || len(req.IDs) > maxReorderIDs {
		handleErr(w, r, invalid("ids must contain between 1 and %d task ids", maxReorderIDs))
		return
	}
	seen := make(map[int64]struct{}, len(req.IDs))
	for _, id := range req.IDs {
		if id <= 0 {
			handleErr(w, r, invalid("ids must be positive integers"))
			return
		}
		if _, dup := seen[id]; dup {
			handleErr(w, r, invalid("ids must not repeat"))
			return
		}
		seen[id] = struct{}{}
	}
	if err := a.store.ReorderTasks(r.Context(), userID(r), req.IDs); err != nil {
		handleErr(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
