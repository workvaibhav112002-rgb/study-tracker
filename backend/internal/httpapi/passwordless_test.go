package httpapi_test

import (
	"context"
	"strings"
	"testing"

	"study-tracker-backend/internal/auth"
)

func TestConfigEndpoint(t *testing.T) {
	s := newServer(t, nil)
	res, body := s.do(t, "GET", "/api/config", "", nil)
	wantStatus(t, res.StatusCode, 200, body)
	for _, want := range []string{`"email_enabled":true`, `"google_client_id":"test-client"`, `"app_url":"https://app.test"`} {
		if !strings.Contains(string(body), want) {
			t.Errorf("config missing %s: %s", want, body)
		}
	}
	s.mail.on = false
	res, body = s.do(t, "GET", "/api/config", "", nil)
	if !strings.Contains(string(body), `"email_enabled":false`) {
		t.Errorf("config should report email off: %s", body)
	}
	res, body = s.do(t, "POST", "/api/auth/forgot-password", "", map[string]string{"email": "x@example.com"})
	wantStatus(t, res.StatusCode, 501, body)
}

func TestForgotAndResetPassword(t *testing.T) {
	s := newServer(t, nil)
	oldToken, _ := s.register(t, "reset@example.com")

	// Unknown emails look identical and send nothing.
	res, body := s.do(t, "POST", "/api/auth/forgot-password", "", map[string]string{"email": "nobody@example.com"})
	wantStatus(t, res.StatusCode, 200, body)
	res, body = s.do(t, "POST", "/api/auth/forgot-password", "", map[string]string{"email": "not-an-email"})
	wantStatus(t, res.StatusCode, 400, body)

	res, body = s.do(t, "POST", "/api/auth/forgot-password", "", map[string]string{"email": "Reset@Example.com"})
	wantStatus(t, res.StatusCode, 200, body)
	mails := s.mail.wait(t, 1)
	if mails[0].To != "reset@example.com" || !strings.Contains(mails[0].Body, "https://app.test/reset?token=") {
		t.Fatalf("mail: %+v", mails[0])
	}
	tok := tokenFrom(t, mails[0].Body)

	res, body = s.do(t, "POST", "/api/auth/reset-password", "", map[string]string{"token": tok, "new_password": "short"})
	wantStatus(t, res.StatusCode, 400, body)
	res, body = s.do(t, "POST", "/api/auth/reset-password", "", map[string]string{"token": "garbage", "new_password": "newpassword123"})
	wantStatus(t, res.StatusCode, 400, body)

	res, body = s.do(t, "POST", "/api/auth/reset-password", "", map[string]string{"token": tok, "new_password": "newpassword123"})
	wantStatus(t, res.StatusCode, 200, body)
	var out struct {
		Token string `json:"token"`
		User  struct {
			EmailVerifiedAt *string `json:"email_verified_at"`
		} `json:"user"`
	}
	decode(t, body, &out)
	if out.Token == "" || out.User.EmailVerifiedAt == nil {
		t.Fatalf("reset response: %s", body)
	}

	// Single use: the second attempt fails and the row is marked used.
	res, body = s.do(t, "POST", "/api/auth/reset-password", "", map[string]string{"token": tok, "new_password": "anotherpass123"})
	wantStatus(t, res.StatusCode, 400, body)
	var used int
	_ = testPool.QueryRow(context.Background(), `SELECT count(*) FROM auth_tokens WHERE kind='reset' AND used_at IS NOT NULL`).Scan(&used)
	if used != 1 {
		t.Fatalf("used tokens: %d", used)
	}

	// Old sessions are dead, the new password and token work.
	res, body = s.do(t, "GET", "/api/auth/me", oldToken, nil)
	wantStatus(t, res.StatusCode, 401, body)
	res, body = s.do(t, "GET", "/api/auth/me", out.Token, nil)
	wantStatus(t, res.StatusCode, 200, body)
	res, body = s.do(t, "POST", "/api/auth/login", "", map[string]string{"email": "reset@example.com", "password": "password123"})
	wantStatus(t, res.StatusCode, 401, body)
	res, body = s.do(t, "POST", "/api/auth/login", "", map[string]string{"email": "reset@example.com", "password": "newpassword123"})
	wantStatus(t, res.StatusCode, 200, body)
}

func TestMagicLinkSignsInAndSignsUp(t *testing.T) {
	s := newServer(t, nil)

	// Unknown email: an account is created and a link sent (passwordless signup).
	res, body := s.do(t, "POST", "/api/auth/magic-link", "", map[string]string{"email": "New.Person@example.com"})
	wantStatus(t, res.StatusCode, 200, body)
	mails := s.mail.wait(t, 1)
	tok := tokenFrom(t, mails[0].Body)
	if !strings.Contains(mails[0].Body, "https://app.test/magic?token=") {
		t.Fatalf("mail: %+v", mails[0])
	}

	res, body = s.do(t, "POST", "/api/auth/magic", "", map[string]string{"token": tok})
	wantStatus(t, res.StatusCode, 200, body)
	var out struct {
		Token string `json:"token"`
		User  struct {
			Email       string `json:"email"`
			HasPassword bool   `json:"has_password"`
		} `json:"user"`
	}
	decode(t, body, &out)
	if out.User.Email != "new.person@example.com" || out.User.HasPassword {
		t.Fatalf("magic user: %s", body)
	}
	res, body = s.do(t, "GET", "/api/projects", out.Token, nil)
	wantStatus(t, res.StatusCode, 200, body)
	if !strings.Contains(string(body), "Go Programming") {
		t.Error("magic signup did not seed projects")
	}

	// Password login is impossible for a password-less account; link reuse fails.
	res, body = s.do(t, "POST", "/api/auth/login", "", map[string]string{"email": "new.person@example.com", "password": "anything123"})
	wantStatus(t, res.StatusCode, 401, body)
	res, body = s.do(t, "POST", "/api/auth/magic", "", map[string]string{"token": tok})
	wantStatus(t, res.StatusCode, 400, body)

	// Existing account: link signs in to the same user.
	existing, uid := s.register(t, "has.pw@example.com")
	_ = existing
	res, body = s.do(t, "POST", "/api/auth/magic-link", "", map[string]string{"email": "has.pw@example.com"})
	wantStatus(t, res.StatusCode, 200, body)
	mails = s.mail.wait(t, 2)
	res, body = s.do(t, "POST", "/api/auth/magic", "", map[string]string{"token": tokenFrom(t, mails[1].Body)})
	wantStatus(t, res.StatusCode, 200, body)
	var again struct {
		User struct {
			ID int64 `json:"id"`
		} `json:"user"`
	}
	decode(t, body, &again)
	if again.User.ID != uid {
		t.Fatalf("magic link signed into %d, want %d", again.User.ID, uid)
	}
}

func TestGoogleSignIn(t *testing.T) {
	s := newServer(t, nil)
	s.google.tokens["new"] = auth.GoogleClaims{Subject: "g-1", Email: "G.User@Example.com", EmailVerified: true, Name: "G User"}
	s.google.tokens["unverified"] = auth.GoogleClaims{Subject: "g-2", Email: "u@example.com", EmailVerified: false, Name: "U"}
	s.google.tokens["existing"] = auth.GoogleClaims{Subject: "g-3", Email: "has.pw@example.com", EmailVerified: true, Name: "Linked"}

	res, body := s.do(t, "POST", "/api/auth/google", "", map[string]string{"credential": "bogus"})
	wantStatus(t, res.StatusCode, 401, body)
	res, body = s.do(t, "POST", "/api/auth/google", "", map[string]string{"credential": "unverified"})
	wantStatus(t, res.StatusCode, 401, body)

	// New Google user: account created, password-less, verified.
	res, body = s.do(t, "POST", "/api/auth/google", "", map[string]string{"credential": "new"})
	wantStatus(t, res.StatusCode, 200, body)
	var out struct {
		Token string `json:"token"`
		User  struct {
			ID           int64   `json:"id"`
			Email        string  `json:"email"`
			Name         string  `json:"name"`
			HasPassword  bool    `json:"has_password"`
			GoogleLinked bool    `json:"google_linked"`
			Verified     *string `json:"email_verified_at"`
		} `json:"user"`
	}
	decode(t, body, &out)
	if out.User.Email != "g.user@example.com" || out.User.Name != "G User" || out.User.HasPassword || !out.User.GoogleLinked || out.User.Verified == nil {
		t.Fatalf("google user: %s", body)
	}
	first := out.User.ID
	res, body = s.do(t, "POST", "/api/auth/google", "", map[string]string{"credential": "new"})
	wantStatus(t, res.StatusCode, 200, body)
	decode(t, body, &out)
	if out.User.ID != first {
		t.Fatalf("second google sign-in created a new user")
	}

	// Existing password account with the same verified email gets linked.
	_, uid := s.register(t, "has.pw@example.com")
	res, body = s.do(t, "POST", "/api/auth/google", "", map[string]string{"credential": "existing"})
	wantStatus(t, res.StatusCode, 200, body)
	decode(t, body, &out)
	if out.User.ID != uid || !out.User.GoogleLinked || !out.User.HasPassword {
		t.Fatalf("link: %s", body)
	}
	res, body = s.do(t, "GET", "/api/auth/me", out.Token, nil)
	wantStatus(t, res.StatusCode, 200, body)

	// A Google-only account can set its first password without a current one.
	res, body = s.do(t, "POST", "/api/auth/google", "", map[string]string{"credential": "new"})
	decode(t, body, &out)
	res, body = s.do(t, "POST", "/api/auth/change-password", out.Token, map[string]string{"new_password": "firstpassword1"})
	wantStatus(t, res.StatusCode, 200, body)
	res, body = s.do(t, "POST", "/api/auth/login", "", map[string]string{"email": "g.user@example.com", "password": "firstpassword1"})
	wantStatus(t, res.StatusCode, 200, body)
}
