import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GoalRing } from './GoalRing'

describe('GoalRing', () => {
  it('labels progress and shows a check at the goal', () => {
    render(<GoalRing today={32} target={90} />)
    expect(screen.getByRole('img', { name: '32 of 90 minutes today' })).toBeInTheDocument()
    expect(screen.getByText('36%')).toBeInTheDocument()
    render(<GoalRing today={90} target={60} />)
    expect(screen.getByRole('img', { name: '90 of 60 minutes today' })).toBeInTheDocument()
  })
})
