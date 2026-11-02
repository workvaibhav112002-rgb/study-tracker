package httpapi

import (
	"math"

	"study-tracker-backend/internal/store"
)

// Default flag thresholds when a project has no exam template.
const (
	defaultAccuracyThreshold = 85.0
	defaultPenaltyLimit      = 2.5
)

// SectionScore is the computed result for one mock section. The frontend
// mirrors this logic in src/lib/scoring.ts; keep the two in step.
type SectionScore struct {
	Name         string  `json:"name"`
	Attempted    int     `json:"attempted"`
	Net          float64 `json:"net"`
	Penalty      float64 `json:"penalty"`
	Accuracy     float64 `json:"accuracy"`     // percent of attempts that were correct
	AttemptRate  float64 `json:"attempt_rate"` // percent of questions attempted
	LowAccuracy  bool    `json:"low_accuracy"`
	HighPenalty  bool    `json:"high_penalty"`
	MaxMarks     float64 `json:"max_marks"`
	SecondsSpent int     `json:"seconds"`
}

// MockScore totals a mock.
type MockScore struct {
	Sections    []SectionScore `json:"sections"`
	Net         float64        `json:"net"`
	Penalty     float64        `json:"penalty"`
	MaxMarks    float64        `json:"max_marks"`
	Accuracy    float64        `json:"accuracy"`
	AttemptRate float64        `json:"attempt_rate"`
}

func round2(v float64) float64 { return math.Round(v*100) / 100 }

func pct(n, d float64) float64 {
	if d <= 0 {
		return 0
	}
	return round2(n / d * 100)
}

// ScoreSection computes net marks, accuracy and attempt rate for a section
// and flags it against the thresholds.
func ScoreSection(s store.MockSection, accuracyThreshold, penaltyLimit float64) SectionScore {
	attempted := s.Correct + s.Incorrect
	penalty := float64(s.Incorrect) * s.NegativeEach
	sc := SectionScore{
		Name:         s.Name,
		Attempted:    attempted,
		Net:          round2(float64(s.Correct)*s.MarksEach - penalty),
		Penalty:      round2(penalty),
		Accuracy:     pct(float64(s.Correct), float64(attempted)),
		AttemptRate:  pct(float64(attempted), float64(s.Questions)),
		MaxMarks:     round2(float64(s.Questions) * s.MarksEach),
		SecondsSpent: s.Seconds,
	}
	sc.LowAccuracy = attempted > 0 && sc.Accuracy < accuracyThreshold
	sc.HighPenalty = sc.Penalty > penaltyLimit
	return sc
}

// ScoreMock scores every section using the template's thresholds, if any.
func ScoreMock(m store.Mock, t *store.ExamTemplate) MockScore {
	acc, lim := defaultAccuracyThreshold, defaultPenaltyLimit
	if t != nil {
		if t.AccuracyThreshold > 0 {
			acc = t.AccuracyThreshold
		}
		if t.PenaltyLimit > 0 {
			lim = t.PenaltyLimit
		}
	}
	out := MockScore{Sections: make([]SectionScore, 0, len(m.Sections))}
	var correct, attempted, questions int
	for _, s := range m.Sections {
		sc := ScoreSection(s, acc, lim)
		out.Sections = append(out.Sections, sc)
		out.Net += sc.Net
		out.Penalty += sc.Penalty
		out.MaxMarks += sc.MaxMarks
		correct += s.Correct
		attempted += sc.Attempted
		questions += s.Questions
	}
	out.Net = round2(out.Net)
	out.Penalty = round2(out.Penalty)
	out.MaxMarks = round2(out.MaxMarks)
	out.Accuracy = pct(float64(correct), float64(attempted))
	out.AttemptRate = pct(float64(attempted), float64(questions))
	return out
}
