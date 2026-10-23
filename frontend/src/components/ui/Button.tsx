import React from 'react'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg' | 'xl'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: React.ReactNode
}

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-brand-400 to-brand-600 text-surface-950 font-semibold shadow-glow hover:from-brand-300 hover:to-brand-500 hover:-translate-y-px active:translate-y-0',
  secondary:
    'bg-white/[0.06] border border-white/[0.08] text-ink-100 font-medium shadow-inner-hi hover:bg-white/[0.10] hover:border-white/[0.14]',
  ghost: 'text-ink-400 font-medium hover:text-ink-50 hover:bg-white/[0.06]',
  danger: 'bg-gradient-to-b from-rose-500 to-rose-600 text-white font-semibold shadow-[0_12px_32px_-12px_rgb(244_63_94/0.6)] hover:from-rose-400 hover:to-rose-500',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
  md: 'h-9 px-4 text-[13px] rounded-xl gap-2',
  lg: 'h-10 px-5 text-sm rounded-xl gap-2',
  xl: 'h-12 px-6 text-sm rounded-2xl gap-2',
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
    className={`focus-ring inline-flex items-center justify-center whitespace-nowrap transition-all duration-200 ease-premium disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${variants[variant]} ${sizes[size]} ${className}`}
    {...rest}
  >
    {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
    {children}
  </button>
)
