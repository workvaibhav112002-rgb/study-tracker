import { beforeEach, describe, expect, it } from 'vitest'
import { loadLastProject, pickProject, saveLastProject } from './lastProject'

const projects = [{ id: 1 }, { id: 2 }, { id: 3 }]

describe('pickProject', () => {
  it('keeps the current choice, then the remembered one, then the latest session, then the first', () => {
    expect(pickProject(projects, 2, 3, 1)).toBe(2)
    expect(pickProject(projects, null, 3, 1)).toBe(3)
    expect(pickProject(projects, null, null, 2)).toBe(2)
    expect(pickProject(projects, null, null, null)).toBe(1)
  })
  it('skips projects that were deleted', () => {
    expect(pickProject(projects, 9, 8, 3)).toBe(3)
    expect(pickProject(projects, null, 8, 7)).toBe(1)
    expect(pickProject([], 1, 1, 1)).toBeNull()
  })
})

describe('last project storage', () => {
  beforeEach(() => localStorage.clear())
  it('is remembered per user', () => {
    saveLastProject(1, 3)
    saveLastProject(2, 5)
    expect(loadLastProject(1)).toBe(3)
    expect(loadLastProject(2)).toBe(5)
    saveLastProject(1, null)
    expect(loadLastProject(1)).toBeNull()
  })
  it('ignores junk', () => {
    localStorage.setItem('study_tracker_last_project_v1:1', 'abc')
    expect(loadLastProject(1)).toBeNull()
  })
})
