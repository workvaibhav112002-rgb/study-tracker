import React from 'react'
import { Keyboard } from 'lucide-react'
import { Modal } from './ui/Modal'

interface Props {
  isOpen: boolean
  onClose: () => void
}

const SHORTCUTS: { keys: string[]; label: string; scope: 'Anywhere' | 'Timer tab' }[] = [
  { keys: ['Ctrl', 'K'], label: 'Command palette', scope: 'Anywhere' },
  { keys: ['?'], label: 'This cheat sheet', scope: 'Anywhere' },
  { keys: ['1', '…', '7'], label: 'Switch tabs (Focus, Projects, Cards, Notes, History, Analytics, Friends)', scope: 'Anywhere' },
  { keys: ['N'], label: 'Log a past session', scope: 'Anywhere' },
  { keys: [','], label: 'Open settings', scope: 'Anywhere' },
  { keys: ['Space'], label: 'Start or pause', scope: 'Timer tab' },
  { keys: ['R'], label: 'Reset the interval', scope: 'Timer tab' },
  { keys: ['S'], label: 'Skip to the next interval', scope: 'Timer tab' },
  { keys: ['F'], label: 'Zen mode', scope: 'Timer tab' },
  { keys: ['+', '-'], label: 'Add or remove five minutes', scope: 'Timer tab' },
]

const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="rounded-md border border-fg/[0.08] bg-fg/[0.04] px-1.5 py-0.5 font-mono text-[11px] text-ink-300">{children}</kbd>
)

export const ShortcutsModal: React.FC<Props> = ({ isOpen, onClose }) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Keyboard shortcuts" description="Shortcuts are ignored while typing or when a dialog is open." icon={<Keyboard className="h-5 w-5" />}>
    {(['Anywhere', 'Timer tab'] as const).map((scope) => (
      <section key={scope} className="mb-4 last:mb-0" aria-label={scope}>
        <h3 className="eyebrow mb-2">{scope}</h3>
        <ul className="divide-y divide-fg/[0.06] rounded-2xl border border-fg/[0.06]">
          {SHORTCUTS.filter((s) => s.scope === scope).map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-4 px-3.5 py-2.5 text-[13px] text-ink-200">
              <span>{s.label}</span>
              <span className="flex shrink-0 items-center gap-1">
                {s.keys.map((k, i) => (k === '…' ? <span key={i} className="text-ink-500">…</span> : <Key key={i}>{k}</Key>))}
              </span>
            </li>
          ))}
        </ul>
      </section>
    ))}
  </Modal>
)
