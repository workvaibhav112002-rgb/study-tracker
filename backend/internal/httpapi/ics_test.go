package httpapi

import (
	"strings"
	"testing"
	"time"

	"study-tracker-backend/internal/store"
)

func TestICSEscapeAndFold(t *testing.T) {
	if got := icsEscape("a,b;c\\d\ne"); got != `a\,b\;c\\d\ne` {
		t.Fatalf("escape: %q", got)
	}
	long := strings.Repeat("x", 200)
	folded := icsFold(long)
	for _, line := range strings.Split(folded, "\r\n") {
		if len(line) > 75 {
			t.Fatalf("line too long: %d", len(line))
		}
	}
	if strings.ReplaceAll(folded, "\r\n ", "") != long {
		t.Fatal("folding lost content")
	}
}

func TestWriteICS(t *testing.T) {
	var b strings.Builder
	at := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	err := writeICS(&b, []store.Session{{ID: 9, ProjectName: "Go", StartTime: at, EndTime: at.Add(25 * time.Minute), CreatedAt: at, FocusRating: 5}})
	if err != nil {
		t.Fatal(err)
	}
	out := b.String()
	for _, want := range []string{"UID:9@study-tracker\r\n", "DTSTART:20260102T030405Z\r\n", "DTEND:20260102T032905Z\r\n", "SUMMARY:Focus: Go\r\n", "END:VCALENDAR\r\n"} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q in\n%s", want, out)
		}
	}
}
