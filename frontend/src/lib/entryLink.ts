/** Recognises emailed deep links (/reset?token=, /magic?token=) without a router. */
export type EntryLink = { kind: 'reset' | 'magic'; token: string } | null

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/

export function parseEntryLink(pathname: string, search: string): EntryLink {
  const path = pathname.replace(/\/+$/, '')
  if (path !== '/reset' && path !== '/magic') return null
  const token = new URLSearchParams(search).get('token') ?? ''
  if (!TOKEN_RE.test(token)) return null
  return { kind: path === '/reset' ? 'reset' : 'magic', token }
}

/** Removes the token from the address bar so it is not kept in history. */
export function cleanEntryLink(): void {
  try {
    window.history.replaceState(null, '', '/')
  } catch {
    /* ignore */
  }
}
