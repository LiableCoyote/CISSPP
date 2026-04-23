import { Component, type ReactNode } from "react";
import { exportData } from "../lib/export";

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("App error:", error);
  }

  handleBackup = async () => {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cisspp-crash-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="card max-w-md text-center">
            <p className="text-4xl mb-2">💥</p>
            <h2 className="text-xl font-bold mb-2">Something broke</h2>
            <p className="text-sm text-dim mb-4">
              {this.state.error?.message || "Unknown error"}
            </p>
            <button onClick={this.handleBackup} className="btn-outline w-full mb-2">
              Download Backup First
            </button>
            <button onClick={() => window.location.reload()} className="btn-primary w-full">
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
