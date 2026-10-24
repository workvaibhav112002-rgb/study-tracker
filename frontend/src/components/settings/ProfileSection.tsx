import React, { useState } from 'react'
import { Globe, Copy, Check } from 'lucide-react'
import type { ProfileInput, User } from '../../types'
import { api, errorMessage } from '../../api/client'
import { Button } from '../ui/Button'
import { Field, inputClass } from '../ui/Field'
import { useToast } from '../ui/Toast'

interface Props {
  user: User
  appUrl: string
  onChanged: () => Promise<void> | void
}

export const ProfileSection: React.FC<Props> = ({ user, appUrl, onChanged }) => {
  const toast = useToast()
  const [form, setForm] = useState<ProfileInput>({ handle: user.handle ?? '', profile_public: Boolean(user.profile_public), bio: user.bio ?? '' })
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const base = (appUrl || window.location.origin).replace(/\/$/, '')
  const link = user.handle ? `${base}/u/${user.handle}` : null

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.updateProfile({ ...form, handle: form.handle?.trim() ? form.handle.trim().toLowerCase() : null })
      await onChanged()
      toast.success(form.profile_public ? 'Profile published.' : 'Profile saved.')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="profile-section" className="space-y-3">
      <div>
        <h3 id="profile-section" className="eyebrow">
          Public profile
        </h3>
        <p className="mt-1 text-xs text-ink-500">Optional page showing your totals, streaks and badges. Never your email, projects or notes.</p>
      </div>
      <form onSubmit={save} className="space-y-3">
        <Field label="Handle" hint="3 to 30 characters: letters, digits, hyphens">
          {(id) => (
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-ink-500">@</span>
              <input id={id} value={form.handle ?? ''} onChange={(e) => setForm({ ...form, handle: e.target.value })} className={`${inputClass} pl-8 font-mono`} placeholder="study-buddy" maxLength={30} autoComplete="off" />
            </div>
          )}
        </Field>
        <Field label="Bio">
          {(id) => <textarea id={id} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className={`${inputClass} min-h-[64px] resize-y`} maxLength={280} placeholder="What are you studying for?" />}
        </Field>
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-fg/[0.06] bg-fg/[0.03] px-4 py-3">
          <span className="flex items-center gap-2.5">
            <Globe className="h-4 w-4 text-brand-400" aria-hidden="true" />
            <span>
              <span className="block text-[13px] font-medium text-ink-100">Make my profile public</span>
              <span className="block text-[11px] text-ink-500">Anyone with the link can see it.</span>
            </span>
          </span>
          <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={form.profile_public} onChange={(e) => setForm({ ...form, profile_public: e.target.checked })} />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" type="submit" loading={saving}>
            Save profile
          </Button>
          {link && user.profile_public && (
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link)
                  setCopied(true)
                  toast.success('Profile link copied.')
                } catch {
                  toast.error('Could not copy the link.')
                }
              }}
              icon={copied ? <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          )}
        </div>
        {link && user.profile_public && <p className="truncate font-mono text-[11px] text-ink-500">{link}</p>}
      </form>
    </section>
  )
}
