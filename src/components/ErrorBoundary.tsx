import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error)
    return { hasError: true, message }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <p className="text-[#ef4444] font-medium">Erro ao carregar a página</p>
          <p className="text-sm text-[#a1a1aa] max-w-md text-center">{this.state.message}</p>
          <button
            onClick={() => { this.setState({ hasError: false, message: '' }); window.history.back() }}
            className="text-sm text-[#22c55e] hover:underline"
          >
            Voltar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
