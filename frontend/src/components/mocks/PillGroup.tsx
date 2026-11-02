import { useId } from 'react'

interface Props<T extends string> {
  label: string
  options: { value: T; label: string; title?: string }[]
  value: T | ''
  onChange: (v: T) => void
  required?: boolean
  tone?: (v: T) => string
}

/**
 * Native radio buttons styled as pills: Tab enters the group, arrow keys move
 * and select, so the whole form works without a mouse.
 */
export function PillGroup<T extends string>({ label, options, value, onChange, required, tone }: Props<T>) {
  const name = useId()
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-medium text-ink-300">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const checked = value === o.value
          return (
            <label
              key={o.value}
              title={o.title}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400/60 ${
                checked ? tone?.(o.value) ?? 'border-brand-500/40 bg-brand-500/15 text-brand-200' : 'border-fg/[0.08] bg-fg/[0.03] text-ink-300 hover:bg-fg/[0.07]'
              }`}
            >
              <input type="radio" className="sr-only" name={name} value={o.value} checked={checked} required={required} onChange={() => onChange(o.value)} />
              {o.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
