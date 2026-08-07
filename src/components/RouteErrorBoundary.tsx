import { Component, type ErrorInfo, type ReactNode } from "react";
import { reloadWithUpdate } from "../lib/pwa";

interface State {
  error: Error | null;
}

/**
 * Wraps the routed area so one page failing doesn't take down the shell.
 *
 * The case this exists for: every route is lazy-loaded with a content-hashed
 * filename, so after a deploy an unvisited route can fail its dynamic import.
 * React rethrows that during render, it bubbles past Suspense, and previously
 * only the root boundary caught it — unmounting the router, header and nav for
 * what is a recoverable per-route problem, with no way back except a reload the
 * user was never told to do.
 */
function isChunkLoadError(error: Error): boolean {
  const text = `${error.name} ${error.message}`;
  return (
    /ChunkLoadError/i.test(text) ||
    /Loading chunk .* failed/i.test(text) ||
    /Failed to fetch dynamically imported module/i.test(text) ||
    /error loading dynamically imported module/i.test(text) ||
    /Importing a module script failed/i.test(text)
  );
}

export default class RouteErrorBoundary extends Component<
  { children: ReactNode; routeKey?: string },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Route error:", error, info.componentStack);
  }

  componentDidUpdate(prev: { routeKey?: string }) {
    // Clear the error when the user navigates somewhere else.
    if (prev.routeKey !== this.props.routeKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const stale = isChunkLoadError(error);

    return (
      <div className="page">
        <div className="card max-w-md mx-auto text-center">
          <p className="text-4xl mb-2" aria-hidden="true">
            {stale ? "🔄" : "💥"}
          </p>
          <h2 className="text-xl font-bold mb-2">
            {stale ? "This page needs a reload" : "This page hit an error"}
          </h2>
          <p className="text-sm text-dim mb-4">
            {stale
              ? "The app was updated while you were using it, so this screen couldn't load. Reloading picks up the new version."
              : error.message || "Unknown error"}
          </p>
          <button
            onClick={() => void reloadWithUpdate()}
            className="btn-primary w-full mb-2"
          >
            Reload page
          </button>
          {!stale && (
            <button
              onClick={() => this.setState({ error: null })}
              className="btn-ghost w-full text-sm"
            >
              Try again
            </button>
          )}
          <p className="text-xs text-dim mt-3">Your study data is safe either way.</p>
        </div>
      </div>
    );
  }
}
