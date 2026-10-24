import { describe, expect, it } from 'vitest'
import { parseEntryLink } from './entryLink'

const tok = 'A'.repeat(43)

describe('parseEntryLink', () => {
  it('recognises reset and magic links with valid tokens', () => {
    expect(parseEntryLink('/reset', `?token=${tok}`)).toEqual({ kind: 'reset', token: tok })
    expect(parseEntryLink('/magic/', `?token=${tok}&x=1`)).toEqual({ kind: 'magic', token: tok })
  })
  it('ignores other paths and bad tokens', () => {
    expect(parseEntryLink('/', `?token=${tok}`)).toBeNull()
    expect(parseEntryLink('/reset', '?token=short')).toBeNull()
    expect(parseEntryLink('/reset', '')).toBeNull()
  })
})
