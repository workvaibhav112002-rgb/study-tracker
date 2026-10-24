import { describe, expect, it } from 'vitest'
import { validateImport } from './importValidate'

describe('validateImport', () => {
  it('accepts an export shape and counts entries', () => {
    const r = validateImport({ projects: [{ name: 'A' }], sessions: [{ project_name: 'A', duration_seconds: 60 }] })
    expect(r.ok).toBe(true)
    expect(r.counts).toEqual({ projects: 1, sessions: 1 })
  })
  it('rejects malformed input', () => {
    expect(validateImport(null).ok).toBe(false)
    expect(validateImport({ projects: [] }).ok).toBe(false)
    expect(validateImport({ projects: [{}] }).ok).toBe(false)
    expect(validateImport({ projects: [{ name: 'A' }], sessions: [{ project_name: 'A' }] }).ok).toBe(false)
  })
})
