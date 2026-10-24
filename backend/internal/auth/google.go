package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
)

// GoogleClaims are the fields the app needs from a Google ID token.
type GoogleClaims struct {
	Subject       string
	Email         string
	EmailVerified bool
	Name          string
}

// GoogleVerifier validates Google Identity Services ID tokens.
type GoogleVerifier interface {
	Verify(ctx context.Context, idToken string) (GoogleClaims, error)
}

// ErrGoogleToken covers every verification failure.
var ErrGoogleToken = errors.New("invalid Google token")

const googleJWKS = "https://www.googleapis.com/oauth2/v3/certs"

type googleVerifier struct {
	clientID string
	keys     keyfunc.Keyfunc
}

// NewGoogleVerifier fetches Google's signing keys (refreshed in the background)
// and verifies tokens issued for clientID.
func NewGoogleVerifier(ctx context.Context, clientID string) (GoogleVerifier, error) {
	kf, err := keyfunc.NewDefaultCtx(ctx, []string{googleJWKS})
	if err != nil {
		return nil, fmt.Errorf("google jwks: %w", err)
	}
	return &googleVerifier{clientID: clientID, keys: kf}, nil
}

type googleIDClaims struct {
	jwt.RegisteredClaims
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
}

func (g *googleVerifier) Verify(_ context.Context, idToken string) (GoogleClaims, error) {
	var c googleIDClaims
	tok, err := jwt.ParseWithClaims(idToken, &c, g.keys.Keyfunc,
		jwt.WithValidMethods([]string{"RS256"}),
		jwt.WithAudience(g.clientID),
		jwt.WithExpirationRequired(),
		jwt.WithLeeway(30*time.Second),
	)
	if err != nil || !tok.Valid {
		return GoogleClaims{}, ErrGoogleToken
	}
	if c.Issuer != "accounts.google.com" && c.Issuer != "https://accounts.google.com" {
		return GoogleClaims{}, ErrGoogleToken
	}
	if c.Subject == "" || c.Email == "" {
		return GoogleClaims{}, ErrGoogleToken
	}
	return GoogleClaims{Subject: c.Subject, Email: c.Email, EmailVerified: c.EmailVerified, Name: c.Name}, nil
}
