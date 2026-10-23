package auth

import (
	"errors"

	"golang.org/x/crypto/bcrypt"
)

// MaxPasswordBytes is bcrypt's hard input limit.
const MaxPasswordBytes = 72

// ErrPasswordTooLong is returned when the password exceeds MaxPasswordBytes.
var ErrPasswordTooLong = errors.New("password exceeds 72 bytes")

// dummyHash is compared against when the email is unknown so that login
// takes the same time whether or not the account exists.
var dummyHash, _ = bcrypt.GenerateFromPassword([]byte("study-tracker-timing-equaliser"), bcrypt.DefaultCost)

// HashPassword returns a bcrypt hash of password.
func HashPassword(password string) (string, error) {
	if len(password) > MaxPasswordBytes {
		return "", ErrPasswordTooLong
	}
	h, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(h), err
}

// CheckPassword reports whether password matches hash. An empty hash is
// compared against a dummy so the call always costs one bcrypt round.
func CheckPassword(hash, password string) bool {
	if hash == "" {
		_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(password))
		return false
	}
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}
