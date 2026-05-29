import React from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-ink p-6 text-center text-slate-200">
          <div className="card max-w-md border border-ember/30 bg-ember/5 text-center shadow-[0_0_40px_rgba(251,113,133,0.15)]">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-ember/20 text-ember">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-white">Something went wrong</h2>
            <p className="mb-6 text-sm text-slate-400">
              An unexpected error occurred in the application. We apologize for the inconvenience.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-ember/20 px-4 py-3 font-semibold text-ember transition hover:bg-ember/30 hover:text-white"
            >
              <RefreshCcw className="h-4 w-4" />
              Reload Application
            </button>
            {import.meta.env.MODE !== "production" && this.state.error && (
              <div className="mt-6 overflow-auto rounded-lg bg-black/40 p-4 text-left text-xs text-ember/80">
                <p className="font-semibold">{this.state.error.toString()}</p>
                <pre className="mt-2 whitespace-pre-wrap">{this.state.errorInfo?.componentStack}</pre>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
