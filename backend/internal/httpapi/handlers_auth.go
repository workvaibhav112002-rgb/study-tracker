package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"study-tracker-backend/internal/auth"
	"study-tracker-backend/internal/store"
)

type registerRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authResponse struct {
	Token string     `json:"token"`
	User  store.User `json:"user"`
}

func (a *api) register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	email := normalizeEmail(req.Email)
	if err := validateEmail(email); err != nil {
		handleErr(w, r, err)
		return
	}
	if err := validatePassword(req.Password); err != nil {
		handleErr(w, r, err)
		return
	}
	name, err := cleanText("name", req.Name, maxNameLen, false)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	if name == "" {
		name, _, _ = strings.Cut(email, "@")
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		if errors.Is(err, auth.ErrPasswordTooLong) {
			handleErr(w, r, invalid("password must be at most 72 bytes"))
			return
		}
		handleErr(w, r, err)
		return
	}

	user, err := a.store.CreateUser(r.Context(), email, hash, name)
	if err != nil {
		if errors.Is(err, store.ErrConflict) {
			writeError(w, r, http.StatusConflict, "email is already registered")
			return
		}
		handleErr(w, r, err)
		return
	}

	token, err := a.issuer.Sign(user.ID)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, authResponse{Token: token, User: user})
}

func (a *api) login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	email := normalizeEmail(req.Email)
	if email == "" || len(email) > maxEmailLen || req.Password == "" || len(req.Password) > auth.MaxPasswordBytes {
		writeError(w, r, http.StatusUnauthorized, "invalid credentials")
		return
	}

	user, err := a.store.GetUserByEmail(r.Context(), email)
	if err != nil && !errors.Is(err, store.ErrNotFound) {
		handleErr(w, r, err)
		return
	}
	// user.PasswordHash is "" when not found; CheckPassword still burns a
	// bcrypt round so timing does not reveal whether the email exists.
	if !auth.CheckPassword(user.PasswordHash, req.Password) {
		writeError(w, r, http.StatusUnauthorized, "invalid credentials")
		return
	}

	token, err := a.issuer.Sign(user.ID)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, authResponse{Token: token, User: user})
}

func (a *api) me(w http.ResponseWriter, r *http.Request) {
	user, err := a.store.GetUserByID(r.Context(), userID(r))
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, user)
}
