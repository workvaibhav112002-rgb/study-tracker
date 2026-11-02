import React from 'react'


/** Card wrapper for a dashboard panel. */
export const Panel: React.FC<{ title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; testId?: string }> = ({ title, subtitle, actions, children, testId }) => (
  <section className="card p-5" aria-label={title} data-testid={testId}>
    <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
      <div>
        <h3 className="text-sm font-semibold text-ink-50">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
      </div>
      {actions}
    </div>
    {children}
  </section>
)

/** Collapsible data table so every chart has a non-visual equivalent. */
export function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) return null
  return (
    <details className="mt-3 text-xs text-ink-400">
      <summary className="cursor-pointer select-none hover:text-ink-200">Show as table</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left tabular-nums">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>{head.map((h) => <th key={h} scope="col" className="border-b border-fg/[0.08] px-2 py-1 font-medium text-ink-300">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>{r.map((c, j) => <td key={j} className="border-b border-fg/[0.04] px-2 py-1 text-ink-200">{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

/** Legend with swatches; text stays in ink colours. */
export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-300" aria-label="Legend">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          {i.dashed ? (
            <span className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: i.color }} aria-hidden="true" />
          ) : (
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: i.color }} aria-hidden="true" />
          )}
          {i.label}
        </li>
      ))}
    </ul>
  )
}

