// Package auth issues and verifies JWTs, hashes passwords and provides the
// HTTP middleware that authenticates requests.
package auth

import (
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const issuerName = "study-tracker"

// ErrInvalidToken covers every verification failure; callers never learn why.
var ErrInvalidToken = errors.New("invalid token")

// Issuer signs and parses HS256 tokens whose subject is the user id.
type Issuer struct {
	secret []byte
	ttl    time.Duration
	now    func() time.Time
}

type claims struct {
	jwt.RegisteredClaims
	// Ver is the user's token_version at signing time. Tokens signed before
	// the field existed decode as 0, which matches the column default.
	Ver int `json:"ver,omitempty"`
}

// NewIssuer builds an Issuer. secret must already be validated for length.
func NewIssuer(secret []byte, ttl time.Duration) *Issuer {
	return &Issuer{secret: secret, ttl: ttl, now: time.Now}
}

// Sign returns a token for userID at the given token version.
func (i *Issuer) Sign(userID int64, version int) (string, error) {
	now := i.now()
	c := claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.FormatInt(userID, 10),
			Issuer:    issuerName,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(i.ttl)),
		},
		Ver: version,
	}
	tok, err := jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(i.secret)
	if err != nil {
		return "", fmt.Errorf("sign token: %w", err)
	}
	return tok, nil
}

// Parse verifies signature, algorithm, issuer and expiry and returns the
// user id and the token version embedded in the token.
func (i *Issuer) Parse(token string) (int64, int, error) {
	var c claims
	_, err := jwt.ParseWithClaims(token, &c,
		func(*jwt.Token) (any, error) { return i.secret, nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(issuerName),
		jwt.WithExpirationRequired(),
		jwt.WithLeeway(30*time.Second),
		jwt.WithTimeFunc(i.now),
	)
	if err != nil {
		return 0, 0, ErrInvalidToken
	}
	id, err := strconv.ParseInt(c.Subject, 10, 64)
	if err != nil || id <= 0 {
		return 0, 0, ErrInvalidToken
	}
	return id, c.Ver, nil
}
