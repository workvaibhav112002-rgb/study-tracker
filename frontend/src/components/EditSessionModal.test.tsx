import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditSessionModal, MAX_SESSION_NOTES } from './EditSessionModal'
import type { Session } from '../types'

const session = {
  id: 7,
  project_id: 1,
  project_name: 'Writing',
  start_time: '2026-11-01T09:00:00Z',
  end_time: '2026-11-01T09:25:00Z',
  duration_seconds: 1500,
  session_type: 'pomodoro',
  focus_rating: 3,
  notes: 'Draft',
} as Session

describe('EditSessionModal', () => {
  it('sends only what changed, trimmed', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(<EditSessionModal session={session} onClose={onClose} onSave={onSave} />)
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()
    const notes = screen.getByLabelText('Notes')
    await userEvent.clear(notes)
    await userEvent.type(notes, '  Outlined chapter two  ')
    await userEvent.click(save)
    expect(onSave).toHaveBeenCalledWith(7, { notes: 'Outlined chapter two' })
    expect(onClose).toHaveBeenCalled()
  })

  it('saves a new rating and supports clearing the note with Ctrl+Enter', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<EditSessionModal session={session} onClose={vi.fn()} onSave={onSave} />)
    await userEvent.click(screen.getByRole('radio', { name: '5 stars' }))
    const notes = screen.getByLabelText('Notes')
    await userEvent.clear(notes)
    await userEvent.type(notes, '{Control>}{Enter}{/Control}')
    expect(onSave).toHaveBeenCalledWith(7, { notes: '', focus_rating: 5 })
  })

  it('blocks notes over the limit and keeps the text when saving fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('offline'))
    const onClose = vi.fn()
    const { rerender } = render(<EditSessionModal session={{ ...session, notes: 'x'.repeat(MAX_SESSION_NOTES + 1) }} onClose={onClose} onSave={onSave} />)
    await userEvent.click(screen.getByRole('radio', { name: '4 stars' }))
    expect(screen.getByText(/Keep notes under/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()

    rerender(<EditSessionModal session={{ ...session, notes: 'ok' }} onClose={onClose} onSave={onSave} />)
    await userEvent.type(screen.getByLabelText('Notes'), '!')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Notes')).toHaveValue('ok!')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })
})
