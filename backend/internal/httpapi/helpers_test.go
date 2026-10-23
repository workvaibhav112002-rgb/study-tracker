package httpapi_test

import (
	"encoding/json"
	"testing"
)

func mustJSON(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return string(b)
}

func decode(t *testing.T, data []byte, dst any) {
	t.Helper()
	if err := json.Unmarshal(data, dst); err != nil {
		t.Fatalf("decode %q: %v", data, err)
	}
}

func wantStatus(t *testing.T, got int, want int, body []byte) {
	t.Helper()
	if got != want {
		t.Fatalf("status %d, want %d: %s", got, want, body)
	}
}

func errorMessage(t *testing.T, body []byte) string {
	t.Helper()
	var e struct {
		Error string `json:"error"`
	}
	decode(t, body, &e)
	return e.Error
}
