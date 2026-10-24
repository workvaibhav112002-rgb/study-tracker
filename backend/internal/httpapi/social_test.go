package httpapi_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestProfileAndPublicPage(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.register(t, "alex@example.test")
	profile := func(body map[string]any) (*http.Response, []byte) {
		return s.do(t, "PUT", "/api/auth/profile", token, body)
	}

	for _, bad := range []map[string]any{
		{"handle": "ab", "profile_public": false, "bio": ""},
		{"handle": "-nope", "profile_public": false, "bio": ""},
		{"handle": "api", "profile_public": false, "bio": ""},
		{"handle": nil, "profile_public": true, "bio": ""},
		{"handle": "okay-handle", "profile_public": false, "bio": strings.Repeat("x", 281)},
	} {
		if res, body := profile(bad); res.StatusCode != 400 {
			t.Fatalf("expected 400 for %v: %d %s", bad, res.StatusCode, body)
		}
	}

	// Private until opted in; handles are case-folded.
	res, body := profile(map[string]any{"handle": "Study-Buddy", "profile_public": false, "bio": "hi"})
	if res.StatusCode != 200 || !strings.Contains(string(body), `"handle":"study-buddy"`) {
		t.Fatalf("profile: %d %s", res.StatusCode, body)
	}
	if res, _ := s.do(t, "GET", "/api/u/study-buddy", "", nil); res.StatusCode != 404 {
		t.Fatalf("private profile should 404: %d", res.StatusCode)
	}
	if res, _ := s.do(t, "GET", "/api/u/nobody-here", "", nil); res.StatusCode != 404 {
		t.Fatalf("unknown profile should 404: %d", res.StatusCode)
	}

	// Handle uniqueness.
	token2, _ := s.register(t, "sam@example.test")
	if res, body := s.do(t, "PUT", "/api/auth/profile", token2, map[string]any{"handle": "study-buddy", "profile_public": false, "bio": ""}); res.StatusCode != 409 {
		t.Fatalf("duplicate handle: %d %s", res.StatusCode, body)
	}

	pid := s.createProject(t, token, "P")
	s.createSession(t, token, pid, time.Now().Add(-2*time.Hour), 1500)
	if res, body := profile(map[string]any{"handle": "study-buddy", "profile_public": true, "bio": "hi"}); res.StatusCode != 200 {
		t.Fatalf("publish: %d %s", res.StatusCode, body)
	}
	res, body = s.do(t, "GET", "/api/u/STUDY-buddy?tz=UTC", "", nil)
	if res.StatusCode != 200 {
		t.Fatalf("public: %d %s", res.StatusCode, body)
	}
	if strings.Contains(string(body), "example.test") || strings.Contains(string(body), `"email"`) {
		t.Fatalf("public profile leaks email: %s", body)
	}
	var p struct {
		Name         string           `json:"name"`
		Handle       string           `json:"handle"`
		TotalMinutes int              `json:"total_minutes"`
		Sessions     int              `json:"sessions"`
		Heatmap      []map[string]any `json:"heatmap"`
		Badges       []map[string]any `json:"badges"`
	}
	decode(t, body, &p)
	if p.Handle != "study-buddy" || p.TotalMinutes != 25 || p.Sessions != 1 || len(p.Heatmap) != 91 || len(p.Badges) != 1 {
		t.Fatalf("public body: %+v", p)
	}
	// /auth/me carries the profile fields for the owner.
	res, body = s.do(t, "GET", "/api/auth/me", token, nil)
	if res.StatusCode != 200 || !strings.Contains(string(body), `"profile_public":true`) {
		t.Fatalf("me: %d %s", res.StatusCode, body)
	}
}

func TestFriendsFlow(t *testing.T) {
	s := newServer(t, nil)
	tokenA, idA := s.register(t, "a@example.test")
	tokenB, idB := s.register(t, "b@example.test")

	res, body := s.do(t, "POST", "/api/friends/invite", tokenA, nil)
	if res.StatusCode != 201 {
		t.Fatalf("invite: %d %s", res.StatusCode, body)
	}
	var inv struct {
		Token string `json:"token"`
		URL   string `json:"url"`
	}
	decode(t, body, &inv)
	if !strings.Contains(inv.URL, "/friend?token="+inv.Token) {
		t.Fatalf("invite url: %s", inv.URL)
	}

	// Self-accept, garbage, then success, then reuse.
	if res, body := s.do(t, "POST", "/api/friends/accept", tokenA, map[string]any{"token": inv.Token}); res.StatusCode != 400 || !strings.Contains(string(body), "own invite") {
		t.Fatalf("self accept: %d %s", res.StatusCode, body)
	}
	if res, _ := s.do(t, "POST", "/api/friends/accept", tokenB, map[string]any{"token": "nope"}); res.StatusCode != 400 {
		t.Fatalf("bad token: %d", res.StatusCode)
	}
	res, body = s.do(t, "POST", "/api/friends/accept", tokenB, map[string]any{"token": inv.Token})
	if res.StatusCode != 200 {
		t.Fatalf("accept: %d %s", res.StatusCode, body)
	}
	var acc struct {
		Friend  *struct{ ID int64 }  `json:"friend"`
		Friends []struct{ ID int64 } `json:"friends"`
	}
	decode(t, body, &acc)
	if acc.Friend == nil || acc.Friend.ID != idA || len(acc.Friends) != 1 {
		t.Fatalf("accept body: %s", body)
	}
	if res, body := s.do(t, "POST", "/api/friends/accept", tokenB, map[string]any{"token": inv.Token}); res.StatusCode != 400 || !strings.Contains(string(body), "already used") {
		t.Fatalf("reuse: %d %s", res.StatusCode, body)
	}

	// Both sides see each other; presence reflects a live focus timer.
	target := time.Now().Add(20 * time.Minute).UnixMilli()
	state, _ := json.Marshal(map[string]any{"status": "running", "mode": "work", "targetEndAt": target})
	if res, body := s.do(t, "PUT", "/api/timer", tokenA, map[string]any{"state": json.RawMessage(state), "updated_at": time.Now().UnixMilli()}); res.StatusCode != 200 {
		t.Fatalf("timer: %d %s", res.StatusCode, body)
	}
	pidA := s.createProject(t, tokenA, "P")
	s.createSession(t, tokenA, pidA, time.Now().Add(-time.Hour), 1800)

	res, body = s.do(t, "GET", "/api/friends?tz=UTC", tokenB, nil)
	if res.StatusCode != 200 {
		t.Fatalf("list: %d %s", res.StatusCode, body)
	}
	var friends []struct {
		ID           int64 `json:"id"`
		Studying     bool  `json:"studying"`
		TodayMinutes int   `json:"today_minutes"`
		WeekMinutes  int   `json:"week_minutes"`
		Streak       int   `json:"current_streak_days"`
	}
	decode(t, body, &friends)
	if len(friends) != 1 || friends[0].ID != idA || !friends[0].Studying || friends[0].TodayMinutes != 30 || friends[0].WeekMinutes != 30 || friends[0].Streak != 1 {
		t.Fatalf("friends of B: %s", body)
	}
	if strings.Contains(string(body), "example.test") {
		t.Fatalf("friend list leaks email: %s", body)
	}
	// An expired focus timer no longer counts as studying.
	stale, _ := json.Marshal(map[string]any{"status": "running", "mode": "work", "targetEndAt": time.Now().Add(-time.Minute).UnixMilli()})
	s.do(t, "PUT", "/api/timer", tokenA, map[string]any{"state": json.RawMessage(stale), "updated_at": time.Now().UnixMilli() + 1})
	_, body = s.do(t, "GET", "/api/friends", tokenB, nil)
	decode(t, body, &friends)
	if friends[0].Studying {
		t.Fatalf("stale timer should not count: %s", body)
	}

	_, body = s.do(t, "GET", "/api/friends", tokenA, nil)
	decode(t, body, &friends)
	if len(friends) != 1 || friends[0].ID != idB {
		t.Fatalf("friends of A: %s", body)
	}

	// Removing from one side removes both; strangers cannot remove.
	tokenC, _ := s.register(t, "c@example.test")
	if res, _ := s.do(t, "DELETE", "/api/friends/"+itoa(idA), tokenC, nil); res.StatusCode != 404 {
		t.Fatalf("stranger remove: %d", res.StatusCode)
	}
	if res, _ := s.do(t, "DELETE", "/api/friends/"+itoa(idA), tokenB, nil); res.StatusCode != 204 {
		t.Fatalf("remove: %d", res.StatusCode)
	}
	for _, tk := range []string{tokenA, tokenB} {
		_, body = s.do(t, "GET", "/api/friends", tk, nil)
		decode(t, body, &friends)
		if len(friends) != 0 {
			t.Fatalf("still friends: %s", body)
		}
	}
	if res, _ := s.do(t, "GET", "/api/friends", "", nil); res.StatusCode != 401 {
		t.Fatalf("anonymous: %d", res.StatusCode)
	}
}
