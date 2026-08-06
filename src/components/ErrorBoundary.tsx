import { Component, type ErrorInfo, type ReactNode } from "react";
import { exportData } from "../lib/export";
import { downloadJSON } from "../lib/download";

type BackupState = "idle" | "working" | "done" | "failed";

interface State {
  hasError: boolean;
  error: Error | null;
  backup: BackupState;
  backupError: string | null;
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, error: null, backup: "idle", backupError: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App error:", error, info.componentStack);
  }

  handleBackup = async () => {
    // This is the user's last-ditch data rescue and it runs in an already-broken
    // app, so a failure here is likely — it must be reported, not swallowed.
    this.setState({ backup: "working", backupError: null });
    try {
      const data = await exportData();
      downloadJSON(data, `cisspp-crash-backup-${Date.now()}.json`);
      this.setState({ backup: "done" });
    } catch (err) {
      console.error("Crash backup failed:", err);
      this.setState({
        backup: "failed",
        backupError: err instanceof Error ? err.message : "Unknown error",
      });
    }
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
            <button
              onClick={this.handleBackup}
              disabled={this.state.backup === "working"}
              className="btn-outline w-full mb-2 disabled:opacity-60"
            >
              {this.state.backup === "working" ? "Saving…" : "Download Backup First"}
            </button>
            {this.state.backup === "done" && (
              <p className="text-xs text-high mb-2" role="status">
                <span aria-hidden="true">✓ </span>Backup saved to your downloads.
              </p>
            )}
            {this.state.backup === "failed" && (
              <p className="text-xs text-danger mb-2" role="alert">
                Backup failed: {this.state.backupError}. Your data is still in this browser —
                try reloading, then export from Settings.
              </p>
            )}
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
