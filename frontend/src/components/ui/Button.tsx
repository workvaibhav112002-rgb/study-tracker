import React from 'react'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: React.ReactNode
}

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold shadow-lg shadow-brand-500/20 hover:scale-[1.02] active:scale-[0.98]',
  secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold border border-slate-700',
  ghost: 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 font-medium',
  danger: 'bg-rose-500 hover:bg-rose-600 text-white font-bold shadow-lg shadow-rose-500/20',
}

const sizes: Record<Size, string> = {
  sm: 'px-3.5 py-2 text-xs rounded-xl',
  md: 'px-5 py-2 text-xs rounded-xl',
  lg: 'px-5 py-2.5 text-sm rounded-xl',
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    className={`inline-flex items-center justify-center gap-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${variants[variant]} ${sizes[size]} ${className}`}
    {...rest}
  >
    {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : icon}
    {children}
  </button>
)
