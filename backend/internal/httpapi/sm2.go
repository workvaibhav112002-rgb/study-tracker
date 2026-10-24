package httpapi

import (
	"math"
	"time"

	"study-tracker-backend/internal/store"
)

// Review ratings: 1 again, 2 hard, 3 good, 4 easy.
const (
	ratingAgain = 1
	ratingHard  = 2
	ratingGood  = 3
	ratingEasy  = 4
)

// nextSchedule applies a 4-button SM-2 variant. "Again" resets the card and
// brings it back in ten minutes; the others grow the interval by the ease
// factor, which itself drifts with how hard the card felt.
func nextSchedule(c store.Card, rating int, now time.Time) store.CardSchedule {
	ease := c.Ease
	if ease == 0 {
		ease = 2.5
	}
	next := store.CardSchedule{Ease: ease, IntervalDays: c.IntervalDays, Repetitions: c.Repetitions, Lapses: c.Lapses}

	switch rating {
	case ratingAgain:
		next.Repetitions = 0
		next.IntervalDays = 0
		next.Lapses = c.Lapses + 1
		next.Ease = math.Max(1.3, ease-0.2)
		next.DueAt = now.Add(10 * time.Minute)
		return next
	case ratingHard:
		next.Ease = math.Max(1.3, ease-0.15)
	case ratingGood:
		// unchanged ease
	default: // easy
		next.Ease = math.Min(3.0, ease+0.15)
	}

	next.Repetitions = c.Repetitions + 1
	switch {
	case c.Repetitions == 0:
		next.IntervalDays = 1
	case c.Repetitions == 1:
		next.IntervalDays = 6
	default:
		next.IntervalDays = int(math.Round(float64(c.IntervalDays) * next.Ease))
	}
	if rating == ratingHard {
		next.IntervalDays = int(math.Max(1, math.Round(float64(next.IntervalDays)*0.6)))
	}
	if rating == ratingEasy {
		next.IntervalDays = int(math.Round(float64(next.IntervalDays) * 1.3))
	}
	if next.IntervalDays < 1 {
		next.IntervalDays = 1
	}
	if next.IntervalDays > 365 {
		next.IntervalDays = 365
	}
	next.Ease = math.Round(next.Ease*100) / 100
	next.DueAt = now.Add(time.Duration(next.IntervalDays) * 24 * time.Hour)
	return next
}
