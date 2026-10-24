package httpapi

import (
	"testing"
	"time"

	"study-tracker-backend/internal/store"
)

func TestNextSchedule(t *testing.T) {
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	c := store.Card{Ease: 2.5}

	first := nextSchedule(c, ratingGood, now)
	if first.IntervalDays != 1 || first.Repetitions != 1 || first.Ease != 2.5 {
		t.Fatalf("first good: %+v", first)
	}
	c2 := store.Card{Ease: first.Ease, IntervalDays: first.IntervalDays, Repetitions: first.Repetitions}
	second := nextSchedule(c2, ratingGood, now)
	if second.IntervalDays != 6 || second.Repetitions != 2 {
		t.Fatalf("second good: %+v", second)
	}
	c3 := store.Card{Ease: second.Ease, IntervalDays: second.IntervalDays, Repetitions: second.Repetitions}
	third := nextSchedule(c3, ratingGood, now)
	if third.IntervalDays != 15 {
		t.Fatalf("third good: %+v", third)
	}
	easy := nextSchedule(c3, ratingEasy, now)
	if easy.IntervalDays <= third.IntervalDays || easy.Ease <= third.Ease {
		t.Fatalf("easy should grow: %+v vs %+v", easy, third)
	}
	hard := nextSchedule(c3, ratingHard, now)
	if hard.IntervalDays >= third.IntervalDays || hard.Ease >= third.Ease {
		t.Fatalf("hard should shrink: %+v vs %+v", hard, third)
	}
	again := nextSchedule(c3, ratingAgain, now)
	if again.Repetitions != 0 || again.Lapses != 1 || again.IntervalDays != 0 || !again.DueAt.Equal(now.Add(10*time.Minute)) {
		t.Fatalf("again: %+v", again)
	}
	floor := nextSchedule(store.Card{Ease: 1.3, IntervalDays: 3, Repetitions: 5}, ratingAgain, now)
	if floor.Ease != 1.3 {
		t.Fatalf("ease floor: %v", floor.Ease)
	}
}
