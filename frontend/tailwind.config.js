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
        // Page and layered surfaces: near-black with a cool tint.
        surface: {
          950: '#07080c',
          900: '#0b0d13',
          800: '#10131b',
          700: '#161a24',
          600: '#1e2330',
          500: '#2a3040',
        },
        // Text tokens.
        ink: {
          50: '#f5f6f8',
          100: '#e6e8ee',
          300: '#b4bac8',
          400: '#8e96a8',
          500: '#6b7388',
          600: '#4d5467',
          700: '#343a4a',
        },
        // Accent (kept under the existing `brand` key so classes stay valid).
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
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
        glow: '0 0 0 1px rgb(16 185 129 / 0.25), 0 12px 40px -12px rgb(16 185 129 / 0.55)',
        'glow-lg': '0 0 80px -16px rgb(16 185 129 / 0.5)',
        card: 'inset 0 1px 0 0 rgb(255 255 255 / 0.05), 0 24px 48px -32px rgb(0 0 0 / 0.7)',
        'card-hover': 'inset 0 1px 0 0 rgb(255 255 255 / 0.08), 0 28px 56px -28px rgb(0 0 0 / 0.75)',
        modal: 'inset 0 1px 0 0 rgb(255 255 255 / 0.06), 0 40px 80px -24px rgb(0 0 0 / 0.8)',
        'inner-hi': 'inset 0 1px 0 0 rgb(255 255 255 / 0.06)',
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
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out both',
        'fade-up': 'fade-up 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-up': 'slide-up 240ms cubic-bezier(0.22, 1, 0.36, 1) both',
        breathe: 'breathe 2.4s ease-in-out infinite',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
