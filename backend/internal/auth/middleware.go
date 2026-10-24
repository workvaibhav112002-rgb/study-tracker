package auth

import (
	"context"
	"net/http"
	"strings"
)

type ctxKey struct{}

// UserChecker is the slice of the store the middleware needs.
type UserChecker interface {
	AuthState(ctx context.Context, id int64) (exists bool, tokenVersion int, err error)
}

// Authenticator turns bearer tokens into a user id in the request context.
type Authenticator struct {
	Issuer *Issuer
	Users  UserChecker
	// OnUnauthorized writes the 401 response; injected to keep this package
	// free of the HTTP layer's response helpers.
	OnUnauthorized func(w http.ResponseWriter, r *http.Request)
	// OnError writes a 500 for unexpected store failures.
	OnError func(w http.ResponseWriter, r *http.Request, err error)
}

// Require rejects requests without a valid, current token for an existing user.
func (a *Authenticator) Require(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		uid, ver, ok := a.fromRequest(r)
		if !ok {
			w.Header().Set("WWW-Authenticate", `Bearer realm="study-tracker"`)
			a.OnUnauthorized(w, r)
			return
		}
		exists, current, err := a.Users.AuthState(r.Context(), uid)
		if err != nil {
			a.OnError(w, r, err)
			return
		}
		if !exists || current != ver {
			a.OnUnauthorized(w, r)
			return
		}
		next.ServeHTTP(w, r.WithContext(WithUserID(r.Context(), uid)))
	})
}

// Optional attaches the user id when a valid token is present and otherwise
// continues anonymously.
func (a *Authenticator) Optional(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if uid, ver, ok := a.fromRequest(r); ok {
			if exists, current, err := a.Users.AuthState(r.Context(), uid); err == nil && exists && current == ver {
				r = r.WithContext(WithUserID(r.Context(), uid))
			}
		}
		next.ServeHTTP(w, r)
	})
}

func (a *Authenticator) fromRequest(r *http.Request) (int64, int, bool) {
	scheme, token, ok := strings.Cut(r.Header.Get("Authorization"), " ")
	if !ok || !strings.EqualFold(scheme, "Bearer") {
		return 0, 0, false
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return 0, 0, false
	}
	uid, ver, err := a.Issuer.Parse(token)
	return uid, ver, err == nil
}

// WithUserID stores the id in ctx (exported for tests).
func WithUserID(ctx context.Context, id int64) context.Context {
	return context.WithValue(ctx, ctxKey{}, id)
}

// UserIDFrom returns the authenticated user id, if any.
func UserIDFrom(ctx context.Context) (int64, bool) {
	id, ok := ctx.Value(ctxKey{}).(int64)
	return id, ok
}
