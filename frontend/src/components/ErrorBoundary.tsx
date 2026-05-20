import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-8">
          <div className="max-w-lg w-full bg-card border border-border rounded-xl p-6 shadow-lg">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <span className="text-destructive text-lg font-bold">!</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">页面出错了</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {this.state.error.message}
                </p>
              </div>
            </div>
            {this.state.error.stack && (
              <pre className="text-[10px] text-muted-foreground/60 bg-muted rounded-lg p-3 max-h-48 overflow-auto whitespace-pre-wrap mb-4">
                {this.state.error.stack}
              </pre>
            )}
            <button
              onClick={() => this.setState({ error: null })}
              className="h-8 px-4 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
            >
              重试
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
