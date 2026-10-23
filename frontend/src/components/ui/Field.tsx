import React, { useId } from 'react'

interface FieldProps {
  label: React.ReactNode
  hint?: React.ReactNode
  error?: string | null
  className?: string
  children: (id: string, describedBy: string | undefined) => React.ReactNode
}

export const inputClass = 'input'

/** Label + control wiring via a stable generated id. */
export const Field: React.FC<FieldProps> = ({ label, hint, error, className = '', children }) => {
  const id = useId()
  const hintId = `${id}-hint`
  const describedBy = hint || error ? hintId : undefined
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-ink-300">
        {label}
      </label>
      {children(id, describedBy)}
      {(error || hint) && (
        <p id={hintId} className={`mt-1.5 text-[11px] ${error ? 'text-rose-400' : 'text-ink-500'}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}
