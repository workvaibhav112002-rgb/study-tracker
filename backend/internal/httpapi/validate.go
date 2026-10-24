package httpapi

import (
	"net/http"
	"net/mail"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
)

var colorRe = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

const (
	maxEmailLen       = 254
	maxNameLen        = 100
	maxDescriptionLen = 500
	maxNotesLen       = 2000
	maxMessageLen     = 2000
	minPasswordLen    = 8
	defaultLimit      = 100
	maxLimit          = 500
	defaultColor      = "#3b82f6"
)

func pathID(r *http.Request, name string) (int64, error) {
	id, err := strconv.ParseInt(chi.URLParam(r, name), 10, 64)
	if err != nil || id <= 0 {
		return 0, invalid("%s must be a positive integer", name)
	}
	return id, nil
}

func normalizeEmail(s string) string { return strings.ToLower(strings.TrimSpace(s)) }

func validateEmail(email string) error {
	if email == "" {
		return invalid("email is required")
	}
	if len(email) > maxEmailLen {
		return invalid("email is too long")
	}
	addr, err := mail.ParseAddress(email)
	if err != nil || addr.Address != email {
		return invalid("email is not valid")
	}
	return nil
}

func validatePassword(pw string) error {
	if utf8.RuneCountInString(pw) < minPasswordLen {
		return invalid("password must be at least %d characters", minPasswordLen)
	}
	if len(pw) > 72 {
		return invalid("password must be at most 72 bytes")
	}
	return nil
}

// cleanText trims, rejects control characters (except newline/tab) and
// enforces a maximum rune count.
func cleanText(field, s string, max int, required bool) (string, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		if required {
			return "", invalid("%s is required", field)
		}
		return "", nil
	}
	if utf8.RuneCountInString(s) > max {
		return "", invalid("%s must be at most %d characters", field, max)
	}
	for _, r := range s {
		if unicode.IsControl(r) && r != '\n' && r != '\t' && r != '\r' {
			return "", invalid("%s contains invalid characters", field)
		}
	}
	return s, nil
}

func validateColor(c string) (string, error) {
	c = strings.TrimSpace(c)
	if c == "" {
		return defaultColor, nil
	}
	if !colorRe.MatchString(c) {
		return "", invalid("color must be a hex value like #3b82f6")
	}
	return c, nil
}

func inRange(field string, v, lo, hi int) error {
	if v < lo || v > hi {
		return invalid("%s must be between %d and %d", field, lo, hi)
	}
	return nil
}

func oneOf(field, v string, allowed []string) error {
	if !slices.Contains(allowed, v) {
		return invalid("%s must be one of %s", field, strings.Join(allowed, ", "))
	}
	return nil
}

func parseLimit(raw string) (int, error) {
	if raw == "" {
		return defaultLimit, nil
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return 0, invalid("limit must be a positive integer")
	}
	return min(n, maxLimit), nil
}

func parseOptionalID(raw, field string) (*int64, error) {
	if raw == "" {
		return nil, nil
	}
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		return nil, invalid("%s must be a positive integer", field)
	}
	return &id, nil
}

func parseOptionalBool(raw, field string) (*bool, error) {
	if raw == "" {
		return nil, nil
	}
	b, err := strconv.ParseBool(raw)
	if err != nil {
		return nil, invalid("%s must be true or false", field)
	}
	return &b, nil
}

const (
	defaultHeatmapDays = 365
	maxHeatmapDays     = 730
)

func parseDays(raw string) (int, error) {
	if raw == "" {
		return defaultHeatmapDays, nil
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 1 || n > maxHeatmapDays {
		return 0, invalid("days must be between 1 and %d", maxHeatmapDays)
	}
	return n, nil
}

func parseLocation(raw string) (*time.Location, error) {
	if raw == "" {
		return time.UTC, nil
	}
	if len(raw) > 64 {
		return nil, invalid("tz is not a valid IANA timezone")
	}
	loc, err := time.LoadLocation(raw)
	if err != nil {
		return nil, invalid("tz is not a valid IANA timezone")
	}
	return loc, nil
}
