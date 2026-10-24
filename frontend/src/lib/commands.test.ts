import { describe, expect, it } from 'vitest'
import { filterCommands, type Command } from './commands'

const cmds: Command[] = [
  { id: 'a', label: 'Start timer', group: 'Timer', run: () => undefined },
  { id: 'b', label: 'Go to analytics', keywords: 'stats charts', group: 'Navigate', run: () => undefined },
  { id: 'c', label: 'New project', group: 'Projects', run: () => undefined },
]

describe('filterCommands', () => {
  it('returns everything for an empty query and ranks exact matches first', () => {
    expect(filterCommands('', cmds)).toHaveLength(3)
    expect(filterCommands('charts', cmds).map((c) => c.id)).toEqual(['b'])
    expect(filterCommands('np', cmds).map((c) => c.id)).toEqual(['c'])
    expect(filterCommands('zzz', cmds)).toHaveLength(0)
  })
})
