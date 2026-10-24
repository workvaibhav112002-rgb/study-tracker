import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TaskPanel } from './TaskPanel'
import type { Task } from '../types'

const task = (id: number, title: string, done = false): Task => ({
  id, project_id: 1, title, estimate_pomodoros: 2, completed_pomodoros: 0, done, position: id,
})

describe('TaskPanel', () => {
  it('adds, toggles, moves and selects tasks', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined)
    const onToggle = vi.fn().mockResolvedValue(undefined)
    const onMove = vi.fn().mockResolvedValue(undefined)
    const onSetCurrent = vi.fn()
    render(
      <TaskPanel projectName="Go" tasks={[task(1, 'First'), task(2, 'Second'), task(3, 'Old', true)]} currentTaskId={2}
        onAdd={onAdd} onToggle={onToggle} onRemove={vi.fn()} onMove={onMove} onSetCurrent={onSetCurrent} />,
    )
    expect(screen.getByText('1 of 3 done')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('New task'), { target: { value: 'Read' } })
    fireEvent.click(screen.getByLabelText('Increase estimate'))
    fireEvent.submit(screen.getByLabelText('New task').closest('form')!)
    expect(onAdd).toHaveBeenCalledWith('Read', 2)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Mark First done' }))
    expect(onToggle).toHaveBeenCalledWith(1, true)

    expect(screen.getAllByLabelText('Move up')[0]).toBeDisabled()
    fireEvent.click(screen.getAllByLabelText('Move down')[0])
    expect(onMove).toHaveBeenCalledWith(1, 1)

    const current = screen.getByRole('button', { name: 'Second is the current task' })
    expect(current).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(current)
    expect(onSetCurrent).toHaveBeenCalledWith(null)
  })
})
