import React from 'react'
import { captureException } from '../lib/monitoring'

interface State {
  error: Error | null
}

/** Last-resort fallback so a render error never leaves a blank page. */
export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack)
    captureException(error, { componentStack: info.componentStack })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-200">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-xl font-bold">Something went wrong</h1>
          <p className="text-sm text-slate-400">The page hit an unexpected error. Reloading usually fixes it; your saved data is safe on the server.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 text-sm font-bold"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
