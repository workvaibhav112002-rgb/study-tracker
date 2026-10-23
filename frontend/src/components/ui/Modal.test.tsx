import { describe, expect, it, vi } from 'vitest'
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

  it('renders nothing when closed', () => {
    render(
      <Modal isOpen={false} title="Hidden">
        <p>x</p>
      </Modal>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
