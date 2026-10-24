/**
 * Recognises deep links without a router: emailed /reset and /magic links,
 * friend invites (/friend?token=) and public profiles (/u/handle).
 */
export type EntryLink = { kind: 'reset' | 'magic' | 'friend'; token: string } | { kind: 'profile'; handle: string } | null

const HANDLE_RE = /^[a-z0-9][a-z0-9-]{2,29}$/

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/

export function parseEntryLink(pathname: string, search: string): EntryLink {
  const path = pathname.replace(/\/+$/, '')
  const profile = /^\/u\/([^/]+)$/.exec(path)
  if (profile) {
    const handle = decodeURIComponent(profile[1]).toLowerCase()
    return HANDLE_RE.test(handle) ? { kind: 'profile', handle } : null
  }
  if (path !== '/reset' && path !== '/magic' && path !== '/friend') return null
  const token = new URLSearchParams(search).get('token') ?? ''
  if (!TOKEN_RE.test(token)) return null
  return { kind: path === '/reset' ? 'reset' : path === '/magic' ? 'magic' : 'friend', token }
}

/** Removes the token from the address bar so it is not kept in history. */
export function cleanEntryLink(): void {
  try {
    window.history.replaceState(null, '', '/')
  } catch {
    /* ignore */
  }
}
