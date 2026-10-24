package httpapi

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"study-tracker-backend/internal/auth"
	"study-tracker-backend/internal/store"
)

const (
	resetTokenTTL = 60 * time.Minute
	magicTokenTTL = 15 * time.Minute
	mailTimeout   = 15 * time.Second
)

// config exposes which optional features are switched on so the frontend can
// hide what is unavailable. The Google client id is public by design.
func (a *api) config(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"email_enabled":    a.mailer.Enabled(),
		"google_client_id": a.cfg.GoogleClientID,
		"app_url":          a.cfg.AppURL,
		"vapid_public_key": a.cfg.VAPIDPublicKey,
	})
}

func newToken() (raw, hash string, err error) {
	var buf [32]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return "", "", err
	}
	raw = base64.RawURLEncoding.EncodeToString(buf[:])
	return raw, hashToken(raw), nil
}

// sendAsync delivers mail off the request path with its own deadline.
func (a *api) sendAsync(to, subject, body string) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), mailTimeout)
		defer cancel()
		if err := a.mailer.Send(ctx, to, subject, body); err != nil {
			slog.Error("send mail", "err", err, "subject", subject)
		}
	}()
}

type emailRequest struct {
	Email string `json:"email"`
}

// forgotPassword always answers 200 so it cannot be used to enumerate accounts.
func (a *api) forgotPassword(w http.ResponseWriter, r *http.Request) {
	if !a.mailer.Enabled() {
		writeError(w, r, http.StatusNotImplemented, "email is not configured on this server")
		return
	}
	var req emailRequest
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	email := normalizeEmail(req.Email)
	if err := validateEmail(email); err != nil {
		handleErr(w, r, err)
		return
	}
	user, err := a.store.GetUserByEmail(r.Context(), email)
	if err != nil && !errors.Is(err, store.ErrNotFound) {
		handleErr(w, r, err)
		return
	}
	if err == nil {
		raw, hash, err := newToken()
		if err != nil {
			handleErr(w, r, err)
			return
		}
		if err := a.store.CreateAuthToken(r.Context(), user.ID, "reset", hash, time.Now().Add(resetTokenTTL)); err != nil {
			handleErr(w, r, err)
			return
		}
		link := a.cfg.AppURL + "/reset?token=" + url.QueryEscape(raw)
		a.sendAsync(user.Email, "Reset your Study Tracker password",
			fmt.Sprintf("Hi %s,\n\nSomeone asked to reset the password for this account. If that was you, open the link below within the next hour:\n\n%s\n\nIf you did not ask for this, you can ignore this email; your password will not change.\n\n— Study Tracker", user.Name, link))
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "message": "If an account exists for that email, a reset link is on its way."})
}

type resetRequest struct {
	Token       string `json:"token"`
	NewPassword string `json:"new_password"`
}

// resetPassword consumes a reset token, stores the new hash, invalidates every
// existing session and signs the user in.
func (a *api) resetPassword(w http.ResponseWriter, r *http.Request) {
	var req resetRequest
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	if !calendarTokenRe.MatchString(strings.TrimSpace(req.Token)) {
		handleErr(w, r, invalid("this reset link is invalid or has expired"))
		return
	}
	if err := validatePassword(req.NewPassword); err != nil {
		handleErr(w, r, err)
		return
	}
	hash, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	userID, err := a.store.ConsumeAuthToken(r.Context(), "reset", hashToken(strings.TrimSpace(req.Token)))
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			handleErr(w, r, invalid("this reset link is invalid or has expired"))
			return
		}
		handleErr(w, r, err)
		return
	}
	version, err := a.store.UpdatePassword(r.Context(), userID, hash)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	_ = a.store.MarkEmailVerified(r.Context(), userID)
	a.issueSession(w, r, userID, version, http.StatusOK)
}

// requestMagicLink emails a one-time sign-in link; unknown emails get a new
// account so the link doubles as passwordless signup.
func (a *api) requestMagicLink(w http.ResponseWriter, r *http.Request) {
	if !a.mailer.Enabled() {
		writeError(w, r, http.StatusNotImplemented, "email is not configured on this server")
		return
	}
	var req emailRequest
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	email := normalizeEmail(req.Email)
	if err := validateEmail(email); err != nil {
		handleErr(w, r, err)
		return
	}
	user, err := a.store.GetUserByEmail(r.Context(), email)
	if errors.Is(err, store.ErrNotFound) {
		name, _, _ := strings.Cut(email, "@")
		user, err = a.store.CreateUser(r.Context(), email, "", name)
	}
	if err != nil {
		handleErr(w, r, err)
		return
	}
	raw, hash, err := newToken()
	if err != nil {
		handleErr(w, r, err)
		return
	}
	if err := a.store.CreateAuthToken(r.Context(), user.ID, "magic", hash, time.Now().Add(magicTokenTTL)); err != nil {
		handleErr(w, r, err)
		return
	}
	link := a.cfg.AppURL + "/magic?token=" + url.QueryEscape(raw)
	a.sendAsync(user.Email, "Your Study Tracker sign-in link",
		fmt.Sprintf("Hi %s,\n\nClick the link below to sign in. It works once and expires in 15 minutes:\n\n%s\n\nIf you did not request this, ignore this email.\n\n— Study Tracker", user.Name, link))
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "message": "Check your inbox for a sign-in link."})
}

// magicSignIn redeems a magic-link token for a session.
func (a *api) magicSignIn(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token string `json:"token"`
	}
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	tok := strings.TrimSpace(req.Token)
	if !calendarTokenRe.MatchString(tok) {
		handleErr(w, r, invalid("this sign-in link is invalid or has expired"))
		return
	}
	userID, err := a.store.ConsumeAuthToken(r.Context(), "magic", hashToken(tok))
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			handleErr(w, r, invalid("this sign-in link is invalid or has expired"))
			return
		}
		handleErr(w, r, err)
		return
	}
	_ = a.store.MarkEmailVerified(r.Context(), userID)
	user, err := a.store.GetUserByID(r.Context(), userID)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	a.issueSession(w, r, user.ID, user.TokenVersion, http.StatusOK)
}

// googleSignIn verifies a Google ID token, links or creates the account, and
// signs the user in.
func (a *api) googleSignIn(w http.ResponseWriter, r *http.Request) {
	if a.google == nil {
		writeError(w, r, http.StatusNotImplemented, "Google sign-in is not configured on this server")
		return
	}
	var req struct {
		Credential string `json:"credential"`
	}
	if err := decodeJSON(r, &req); err != nil {
		handleErr(w, r, err)
		return
	}
	claims, err := a.google.Verify(r.Context(), strings.TrimSpace(req.Credential))
	if err != nil {
		writeError(w, r, http.StatusUnauthorized, "Google sign-in failed. Please try again.")
		return
	}
	email := normalizeEmail(claims.Email)

	user, err := a.store.GetUserByGoogleSub(r.Context(), claims.Subject)
	switch {
	case err == nil:
		// already linked
	case errors.Is(err, store.ErrNotFound):
		if !claims.EmailVerified {
			writeError(w, r, http.StatusUnauthorized, "Your Google email address is not verified.")
			return
		}
		user, err = a.store.GetUserByEmail(r.Context(), email)
		switch {
		case err == nil:
			if err := a.store.LinkGoogle(r.Context(), user.ID, claims.Subject, true); err != nil {
				handleErr(w, r, err)
				return
			}
		case errors.Is(err, store.ErrNotFound):
			name, _ := cleanText("name", claims.Name, maxNameLen, false)
			if name == "" {
				name, _, _ = strings.Cut(email, "@")
			}
			user, err = a.store.CreateGoogleUser(r.Context(), email, name, claims.Subject, true)
			if err != nil {
				handleErr(w, r, err)
				return
			}
		default:
			handleErr(w, r, err)
			return
		}
	default:
		handleErr(w, r, err)
		return
	}
	a.issueSession(w, r, user.ID, user.TokenVersion, http.StatusOK)
}

// issueSession signs a token and returns the standard auth response.
func (a *api) issueSession(w http.ResponseWriter, r *http.Request, userID int64, version int, status int) {
	user, err := a.store.GetUserByID(r.Context(), userID)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	user.PasswordHash = ""
	token, err := a.issuer.Sign(user.ID, version)
	if err != nil {
		handleErr(w, r, err)
		return
	}
	writeJSON(w, status, authResponse{Token: token, User: user})
}
