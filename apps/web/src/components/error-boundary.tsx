import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Catches render-time crashes so a single bad note/plugin can't blank the app. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="crash">
          <div className="crash-card">
            <h1>Something went wrong</h1>
            <p className="crash-message">{this.state.error.message}</p>
            <p className="crash-hint">Your notes are safe on disk. Try again, or reload the app.</p>
            <div className="crash-actions">
              <button className="crash-btn" onClick={this.reset}>
                Try again
              </button>
              <button className="crash-btn crash-btn--primary" onClick={() => location.reload()}>
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
