import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, CornerDownLeft } from 'lucide-react'
import { filterCommands, type Command } from '../lib/commands'

interface Props {
  isOpen: boolean
  onClose: () => void
  commands: Command[]
}

const GROUPS: Command['group'][] = ['Timer', 'Navigate', 'Projects', 'Actions']

/** Ctrl/Cmd+K palette. Keyboard: type to filter, arrows to move, Enter to run, Escape to close. */
export const CommandPalette: React.FC<Props> = ({ isOpen, onClose, commands }) => {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const results = useMemo(() => filterCommands(query, commands), [query, commands])

  useEffect(() => {
    if (!isOpen) return
    setQuery('')
    setActive(0)
    const id = window.setTimeout(() => inputRef.current?.focus(), 0)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.clearTimeout(id)
      document.body.style.overflow = prev
    }
  }, [isOpen])

  useEffect(() => setActive(0), [query])

  if (!isOpen) return null

  const run = (c: Command) => {
    onClose()
    c.run()
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(results.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[active]) run(results[active])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  let index = -1
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-surface-950/70 p-4 pt-[12vh] backdrop-blur-md animate-fade-in" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Command palette" className="glass w-full max-w-lg overflow-hidden rounded-2xl shadow-modal animate-scale-in" onKeyDown={onKey}>
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-4">
          <Search className="h-4 w-4 shrink-0 text-ink-500" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search…"
            aria-label="Search commands"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={results[active] ? `cmd-${results[active].id}` : undefined}
            className="h-12 w-full bg-transparent text-sm text-ink-50 placeholder:text-ink-600 focus:outline-none"
          />
          <kbd className="rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-ink-500">Esc</kbd>
        </div>
        <ul id="palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-6 text-center text-xs text-ink-500">No matching commands</li>}
          {GROUPS.map((g) => {
            const items = results.filter((c) => c.group === g)
            if (items.length === 0) return null
            return (
              <li key={g} role="presentation">
                <p className="eyebrow px-3 pb-1 pt-2">{g}</p>
                <ul role="group" aria-label={g}>
                  {items.map((c) => {
                    index++
                    const i = index
                    const selected = i === active
                    return (
                      <li
                        key={c.id}
                        id={`cmd-${c.id}`}
                        role="option"
                        aria-selected={selected}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => run(c)}
                        className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors ${selected ? 'bg-brand-500/10 text-ink-50' : 'text-ink-300 hover:bg-white/[0.04]'}`}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate">{c.label}</span>
                          {c.hint && <span className="truncate text-[11px] text-ink-500">{c.hint}</span>}
                        </span>
                        {selected && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-ink-500" aria-hidden="true" />}
                      </li>
                    )
                  })}
                </ul>
              </li>
            )
          })}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
