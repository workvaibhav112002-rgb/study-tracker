import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { StreakCard } from './StreakCard'
import { MilestonesPanel } from './MilestonesPanel'
import type { GoalStreak, Milestone } from '../types'

const base: GoalStreak = { days: 3, best_days: 5, target_minutes: 60, today_met: false, yesterday_met: true, day_before_met: true, freeze_available: true, freeze_days: [], missed_yesterday: '' }

describe('StreakCard', () => {
  it('shows the streak and hides the freeze when yesterday was met', () => {
    render(<StreakCard streak={base} onFreeze={vi.fn()} />)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /freeze/i })).toBeNull()
    expect(screen.getByText('Freeze ready')).toBeInTheDocument()
  })

  it('offers the freeze for a missed yesterday and calls back', async () => {
    const onFreeze = vi.fn().mockResolvedValue(undefined)
    render(<StreakCard streak={{ ...base, yesterday_met: false, missed_yesterday: '2026-03-09' }} onFreeze={onFreeze} />)
    fireEvent.click(screen.getByRole('button', { name: /freeze/i }))
    expect(onFreeze).toHaveBeenCalledTimes(1)
  })

  it('does not offer a freeze when there is no streak to reconnect', () => {
    render(<StreakCard streak={{ ...base, days: 0, yesterday_met: false, day_before_met: false, missed_yesterday: '2026-03-09' }} onFreeze={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /freeze/i })).toBeNull()
  })

  it('explains when no goal is set', () => {
    render(<StreakCard streak={{ ...base, target_minutes: 0, days: 0 }} onFreeze={vi.fn()} />)
    expect(screen.getByText(/set a daily target/i)).toBeInTheDocument()
  })
})

describe('MilestonesPanel', () => {
  const ms: Milestone[] = [
    { id: 'a', title: 'First focus', description: 'd', icon: 'sparkles', target: 1, progress: 1, achieved: true, achieved_at: '2026-01-02' },
    { id: 'b', title: 'Ten tomatoes', description: 'd', icon: 'timer', target: 10, progress: 4, achieved: false, achieved_at: null },
  ]
  it('counts unlocked badges and shows progress on locked ones', () => {
    render(<MilestonesPanel milestones={ms} />)
    expect(screen.getByText('1 of 2 unlocked')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4')
    expect(screen.getByText('since 2026-01-02')).toBeInTheDocument()
  })
})
