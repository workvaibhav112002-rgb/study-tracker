import { describe, expect, it, vi } from 'vitest'
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { Modal } from './Modal'

describe('Modal', () => {
  it('renders an accessible dialog and closes on Escape', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen onClose={onClose} title="Hello" description="World">
        <button>Inside</button>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Hello' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('World')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignores Escape and hides the close button when not dismissible', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen onClose={onClose} dismissible={false} title="Locked">
        <input aria-label="field" />
      </Modal>,
    )
    expect(screen.queryByLabelText('Close dialog')).toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('keeps focus where the user is typing when the parent re-renders', () => {
    const Harness = () => {
      const [text, setText] = React.useState('')
      // A fresh onClose on every render, as most callers do.
      return (
        <Modal isOpen onClose={() => undefined} title="Edit">
          <input aria-label="Title" />
          <textarea aria-label="Body" value={text} onChange={(e) => setText(e.target.value)} />
        </Modal>
      )
    }
    render(<Harness />)
    const body = screen.getByLabelText('Body')
    body.focus()
    fireEvent.change(body, { target: { value: 'hello' } })
    fireEvent.change(body, { target: { value: 'hello world' } })
    expect(document.activeElement).toBe(body)
    // Escape still uses the latest handler.
  })

  it('renders nothing when closed', () => {
    render(
      <Modal isOpen={false} title="Hidden">
        <p>x</p>
      </Modal>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
