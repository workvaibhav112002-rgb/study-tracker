package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"study-tracker-backend/internal/store"
)

const settingsColumns = `work_duration, short_break_duration, long_break_duration, long_break_interval, auto_start_breaks, sound_enabled, reminder_enabled, reminder_hour, timezone`

func scanSettings(row pgx.Row) (store.Settings, error) {
	var x store.Settings
	err := row.Scan(&x.WorkDuration, &x.ShortBreakDuration, &x.LongBreakDuration, &x.LongBreakInterval, &x.AutoStartBreaks, &x.SoundEnabled, &x.ReminderEnabled, &x.ReminderHour, &x.Timezone)
	return x, mapErr(err)
}

// GetSettings returns the user's settings, or defaults if no row exists yet.
func (s *Store) GetSettings(ctx context.Context, userID int64) (store.Settings, error) {
	x, err := scanSettings(s.pool.QueryRow(ctx, `SELECT `+settingsColumns+` FROM settings WHERE user_id = $1`, userID))
	if errors.Is(err, store.ErrNotFound) {
		return store.DefaultSettings(), nil
	}
	return x, err
}

// UpsertSettings writes all fields atomically and returns the stored row.
func (s *Store) UpsertSettings(ctx context.Context, userID int64, in store.Settings) (store.Settings, error) {
	return scanSettings(s.pool.QueryRow(ctx, `
		INSERT INTO settings (user_id, `+settingsColumns+`)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (user_id) DO UPDATE SET
			work_duration = EXCLUDED.work_duration,
			short_break_duration = EXCLUDED.short_break_duration,
			long_break_duration = EXCLUDED.long_break_duration,
			long_break_interval = EXCLUDED.long_break_interval,
			auto_start_breaks = EXCLUDED.auto_start_breaks,
			sound_enabled = EXCLUDED.sound_enabled,
			reminder_enabled = EXCLUDED.reminder_enabled,
			reminder_hour = EXCLUDED.reminder_hour,
			timezone = EXCLUDED.timezone,
			updated_at = now()
		RETURNING `+settingsColumns,
		userID, in.WorkDuration, in.ShortBreakDuration, in.LongBreakDuration, in.LongBreakInterval, in.AutoStartBreaks, in.SoundEnabled, in.ReminderEnabled, in.ReminderHour, in.Timezone,
	))
}
