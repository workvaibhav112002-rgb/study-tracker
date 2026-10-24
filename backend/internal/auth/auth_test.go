package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var secret = []byte("0123456789abcdef0123456789abcdef")

func TestSignParseRoundTrip(t *testing.T) {
	i := NewIssuer(secret, time.Hour)
	tok, err := i.Sign(42, 3)
	if err != nil {
		t.Fatal(err)
	}
	id, ver, err := i.Parse(tok)
	if err != nil || id != 42 || ver != 3 {
		t.Fatalf("got id=%d ver=%d, %v", id, ver, err)
	}
}

func TestParseLegacyTokenWithoutVersion(t *testing.T) {
	i := NewIssuer(secret, time.Hour)
	legacy, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{
		Subject: "7", Issuer: issuerName, ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
	}).SignedString(secret)
	id, ver, err := i.Parse(legacy)
	if err != nil || id != 7 || ver != 0 {
		t.Fatalf("legacy token: id=%d ver=%d err=%v", id, ver, err)
	}
}

func TestParseRejectsBadTokens(t *testing.T) {
	i := NewIssuer(secret, time.Hour)
	other := NewIssuer([]byte("ffffffffffffffffffffffffffffffff"), time.Hour)
	wrongKey, _ := other.Sign(1, 0)

	hs512, _ := jwt.NewWithClaims(jwt.SigningMethodHS512, jwt.RegisteredClaims{
		Subject: "1", Issuer: issuerName, ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
	}).SignedString(secret)

	badIssuer, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{
		Subject: "1", Issuer: "someone-else", ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
	}).SignedString(secret)

	noExp, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{Subject: "1", Issuer: issuerName}).SignedString(secret)

	past := NewIssuer(secret, time.Hour)
	past.now = func() time.Time { return time.Now().Add(-3 * time.Hour) }
	expired, _ := past.Sign(1, 0)

	noneAlg, _ := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.RegisteredClaims{
		Subject: "1", Issuer: issuerName, ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
	}).SignedString(jwt.UnsafeAllowNoneSignatureType)

	for name, tok := range map[string]string{
		"garbage": "not.a.token", "wrong key": wrongKey, "hs512": hs512,
		"bad issuer": badIssuer, "no exp": noExp, "expired": expired, "none alg": noneAlg, "empty": "",
	} {
		if _, _, err := i.Parse(tok); err == nil {
			t.Errorf("%s: expected rejection", name)
		}
	}
}

func TestPasswordHashing(t *testing.T) {
	h, err := HashPassword("correct horse battery")
	if err != nil {
		t.Fatal(err)
	}
	if !CheckPassword(h, "correct horse battery") || CheckPassword(h, "wrong") || CheckPassword("", "anything") {
		t.Error("unexpected check result")
	}
	if _, err := HashPassword(string(make([]byte, 73))); err != ErrPasswordTooLong {
		t.Errorf("expected ErrPasswordTooLong, got %v", err)
	}
}
