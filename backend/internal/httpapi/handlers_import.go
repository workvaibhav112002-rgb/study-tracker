package httpapi

import (
	"net/http"
	"time"

	"study-tracker-backend/internal/store"
)

const (
	maxImportProjects = 200
	maxImportSessions = 10000
)

type importSessionRequest struct {
	ProjectName string `json:"project_name"`
	sessionRequest
}

type importRequest struct {
	Projects []projectRequest       `json:"projects"`
	Sessions []importSessionRequest `json:"sessions"`
}

// importAll restores a backup produced by /export. Validation is complete
// before the store runs, so the transaction either applies fully or not at all.
func (a *api) importAll(w http.ResponseWriter, r *http.Request) {
	var req importRequest
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	if len(req.Projects) == 0 {
		handleErr(w, r, invalid("projects must contain at least one project"))
		return
	}
	if len(req.Projects) > maxImportProjects || len(req.Sessions) > maxImportSessions {
		handleErr(w, r, invalid("import is limited to %d projects and %d sessions", maxImportProjects, maxImportSessions))
		return
	}

	in := store.ImportInput{Projects: make([]store.ProjectInput, 0, len(req.Projects)), Sessions: make([]store.ImportSession, 0, len(req.Sessions))}
	names := make(map[string]struct{}, len(req.Projects))
	for i, p := range req.Projects {
		pi, err := p.validate()
		if err != nil {
			handleErr(w, r, invalid("projects[%d]: %s", i, err.Error()))
			return
		}
		if _, dup := names[pi.Name]; dup {
			handleErr(w, r, invalid("projects[%d]: duplicate name %q", i, pi.Name))
			return
		}
		names[pi.Name] = struct{}{}
		in.Projects = append(in.Projects, pi)
	}
	now := time.Now()
	for i, s := range req.Sessions {
		if _, ok := names[s.ProjectName]; !ok {
			handleErr(w, r, invalid("sessions[%d]: project %q is not in projects", i, s.ProjectName))
			return
		}
		// project_id is irrelevant for imports; satisfy the validator.
		s.sessionRequest.ProjectID = 1
		si, err := s.sessionRequest.validate(now)
		if err != nil {
			handleErr(w, r, invalid("sessions[%d]: %s", i, err.Error()))
			return
		}
		si.TaskID = nil
		in.Sessions = append(in.Sessions, store.ImportSession{ProjectName: s.ProjectName, SessionInput: si})
	}

	res, err := a.store.ImportAll(r.Context(), userID(r), in)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, res)
}
