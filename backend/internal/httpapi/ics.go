package httpapi

import (
	"fmt"
	"io"
	"strings"
	"unicode/utf8"

	"study-tracker-backend/internal/store"
)

const icsTimeLayout = "20060102T150405Z"

// icsEscape escapes text per RFC 5545 section 3.3.11.
func icsEscape(s string) string {
	r := strings.NewReplacer(`\`, `\\`, ";", `\;`, ",", `\,`, "\r\n", `\n`, "\n", `\n`)
	return r.Replace(s)
}

// icsFold wraps a content line at 75 octets with CRLF + single space.
func icsFold(line string) string {
	const limit = 75
	if len(line) <= limit {
		return line
	}
	var b strings.Builder
	cur := 0
	for len(line) > 0 {
		_, size := utf8.DecodeRuneInString(line)
		if cur+size > limit {
			b.WriteString("\r\n ")
			cur = 1
		}
		b.WriteString(line[:size])
		line = line[size:]
		cur += size
	}
	return b.String()
}

// writeICS renders sessions as a VCALENDAR feed.
func writeICS(w io.Writer, sessions []store.Session) error {
	var b strings.Builder
	line := func(s string) {
		b.WriteString(icsFold(s))
		b.WriteString("\r\n")
	}
	line("BEGIN:VCALENDAR")
	line("VERSION:2.0")
	line("PRODID:-//study-tracker//EN")
	line("CALSCALE:GREGORIAN")
	line("METHOD:PUBLISH")
	line("X-WR-CALNAME:Study Tracker")
	for _, s := range sessions {
		desc := fmt.Sprintf("Focus rating: %d/5\nInterruptions: %d", s.FocusRating, s.Interruptions)
		if s.Notes != "" {
			desc = s.Notes + "\n" + desc
		}
		line("BEGIN:VEVENT")
		line(fmt.Sprintf("UID:%d@study-tracker", s.ID))
		line("DTSTAMP:" + s.CreatedAt.UTC().Format(icsTimeLayout))
		line("DTSTART:" + s.StartTime.UTC().Format(icsTimeLayout))
		line("DTEND:" + s.EndTime.UTC().Format(icsTimeLayout))
		line("SUMMARY:" + icsEscape("Focus: "+s.ProjectName))
		line("DESCRIPTION:" + icsEscape(desc))
		line("END:VEVENT")
	}
	line("END:VCALENDAR")
	_, err := io.WriteString(w, b.String())
	return err
}
