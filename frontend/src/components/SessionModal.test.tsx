import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SessionModal } from './SessionModal'

const projects = [
  { id: 1, name: 'Go', color: '#3987e5', description: '', target_minutes_per_day: 60 },
  { id: 2, name: 'DSA', color: '#9085e9', description: '', target_minutes_per_day: 60 },
]
const tasks = [
  { id: 10, project_id: 1, title: 'Go task', estimate_pomodoros: 1, completed_pomodoros: 0, done: false, position: 0 },
  { id: 11, project_id: 2, title: 'DSA task', estimate_pomodoros: 1, completed_pomodoros: 0, done: false, position: 0 },
]

describe('SessionModal', () => {
  it('shows interruptions and filters tasks by project', () => {
    const { rerender } = render(
      <SessionModal isOpen onClose={vi.fn()} onSave={vi.fn()} durationSeconds={1500} interruptions={0} projects={projects} tasks={tasks} defaultProjectId={1} defaultTaskId={null} />,
    )
    expect(screen.queryByText(/interruption/)).toBeNull()
    expect(screen.getByRole('option', { name: 'Go task' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'DSA task' })).toBeNull()
    rerender(
      <SessionModal isOpen onClose={vi.fn()} onSave={vi.fn()} durationSeconds={1500} interruptions={2} projects={projects} tasks={tasks} defaultProjectId={1} defaultTaskId={null} />,
    )
    expect(screen.getByText('2 interruptions')).toBeInTheDocument()
  })
})
