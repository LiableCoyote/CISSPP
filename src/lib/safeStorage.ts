/**
 * localStorage / sessionStorage that never throws.
 *
 * Storage access is not guaranteed to work: Safari private mode, "block all
 * cookies", sandboxed iframes and quota exhaustion all raise SecurityError or
 * QuotaExceededError. Several call sites in this app run at module-load time or
 * inside React render, where an uncaught throw takes down the whole page before
 * ErrorBoundary can mount. Everything here degrades to a null/no-op instead.
 */

type WebStorage = "local" | "session";

function backing(kind: WebStorage): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    // Accessing the property itself throws when storage is blocked.
    return null;
  }
}

export function getItem(key: string, kind: WebStorage = "local"): string | null {
  try {
    return backing(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Returns false when the write could not be persisted. */
export function setItem(key: string, value: string, kind: WebStorage = "local"): boolean {
  try {
    const store = backing(kind);
    if (!store) return false;
    store.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeItem(key: string, kind: WebStorage = "local"): boolean {
  try {
    const store = backing(kind);
    if (!store) return false;
    store.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/** Reads and JSON-parses, returning `fallback` on missing, corrupt or blocked data. */
export function getJSON<T>(key: string, fallback: T, kind: WebStorage = "local"): T {
  const raw = getItem(key, kind);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setJSON(key: string, value: unknown, kind: WebStorage = "local"): boolean {
  try {
    return setItem(key, JSON.stringify(value), kind);
  } catch {
    return false;
  }
}
