import React, { useId } from 'react'

interface FieldProps {
  label: React.ReactNode
  hint?: React.ReactNode
  error?: string | null
  className?: string
  children: (id: string, describedBy: string | undefined) => React.ReactNode
}

export const inputClass =
  'w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all disabled:opacity-60'

/** Label + control wiring via a stable generated id. */
export const Field: React.FC<FieldProps> = ({ label, hint, error, className = '', children }) => {
  const id = useId()
  const hintId = `${id}-hint`
  const describedBy = hint || error ? hintId : undefined
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-300 mb-1.5">
        {label}
      </label>
      {children(id, describedBy)}
      {(error || hint) && (
        <p id={hintId} className={`text-[11px] mt-1 ${error ? 'text-rose-400' : 'text-slate-500'}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}
