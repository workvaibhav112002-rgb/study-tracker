import React from 'react'

/** Glass tooltip card shared by every chart. */
export const ChartTooltip: React.FC<{ title: string; value: string; swatch?: string }> = ({ title, value, swatch }) => (
  <div className="glass rounded-xl px-3 py-2 text-xs shadow-modal">
    <div className="flex items-center gap-1.5 font-medium text-ink-50">
      {swatch && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: swatch }} aria-hidden="true" />}
      {title}
    </div>
    <div className="mt-0.5 font-mono tabular-nums text-ink-300">{value}</div>
  </div>
)
