/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', '"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Every token is a CSS variable (see index.css) so themes and accents
        // switch at runtime. `fg` is white in dark mode and black in light mode
        // and is used for hairline borders and faint fills.
        fg: 'rgb(var(--fg) / <alpha-value>)',
        surface: {
          950: 'rgb(var(--surface-950) / <alpha-value>)',
          900: 'rgb(var(--surface-900) / <alpha-value>)',
          800: 'rgb(var(--surface-800) / <alpha-value>)',
          700: 'rgb(var(--surface-700) / <alpha-value>)',
          600: 'rgb(var(--surface-600) / <alpha-value>)',
          500: 'rgb(var(--surface-500) / <alpha-value>)',
        },
        ink: {
          50: 'rgb(var(--ink-50) / <alpha-value>)',
          100: 'rgb(var(--ink-100) / <alpha-value>)',
          200: 'rgb(var(--ink-200) / <alpha-value>)',
          300: 'rgb(var(--ink-300) / <alpha-value>)',
          400: 'rgb(var(--ink-400) / <alpha-value>)',
          500: 'rgb(var(--ink-500) / <alpha-value>)',
          600: 'rgb(var(--ink-600) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
        },
        brand: {
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
        },
        accent: {
          violet: '#8b7cf6',
          sky: '#4cc2f5',
          amber: '#f5b63d',
          rose: '#f26a86',
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        glow: '0 0 0 1px rgb(var(--brand-500) / 0.25), 0 12px 40px -12px rgb(var(--brand-500) / 0.55)',
        'glow-lg': '0 0 80px -16px rgb(var(--brand-500) / 0.5)',
        card: 'inset 0 1px 0 0 rgb(var(--fg) / 0.05), 0 24px 48px -32px rgb(0 0 0 / var(--shadow-a))',
        'card-hover': 'inset 0 1px 0 0 rgb(var(--fg) / 0.08), 0 28px 56px -28px rgb(0 0 0 / var(--shadow-a))',
        modal: 'inset 0 1px 0 0 rgb(var(--fg) / 0.06), 0 40px 80px -24px rgb(0 0 0 / var(--shadow-a))',
        'inner-hi': 'inset 0 1px 0 0 rgb(var(--fg) / 0.06)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.97)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        'gradient-pan': {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        blob: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '33%': { transform: 'translate3d(40px, -30px, 0) scale(1.08)' },
          '66%': { transform: 'translate3d(-30px, 24px, 0) scale(0.94)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        count: {
          '0%': { opacity: '0', transform: 'translateY(6px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out both',
        'fade-up': 'fade-up 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-up': 'slide-up 240ms cubic-bezier(0.22, 1, 0.36, 1) both',
        breathe: 'breathe 2.4s ease-in-out infinite',
        'gradient-pan': 'gradient-pan 8s linear infinite',
        float: 'float 6s ease-in-out infinite',
        blob: 'blob 18s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
        count: 'count 300ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
