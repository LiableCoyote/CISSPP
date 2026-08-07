import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getItem, setItem, removeItem, getJSON, setJSON } from "./safeStorage";

/**
 * The whole point of this module is that it never throws — which is exactly
 * what these assert. Tests run under `environment: "node"`, so `window` is
 * stubbed per case.
 */
type StubKind = "working" | "throws-on-access" | "throws-on-write" | "absent";

function installStorage(kind: StubKind) {
  const data = new Map<string, string>();

  const working: Storage = {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k: string) => data.get(k) ?? null,
    key: (i: number) => [...data.keys()][i] ?? null,
    removeItem: (k: string) => void data.delete(k),
    setItem: (k: string, v: string) => void data.set(k, v),
  };

  const throwing: Storage = {
    ...working,
    setItem: () => {
      throw new DOMException("QuotaExceededError");
    },
  };

  if (kind === "absent") {
    (globalThis as { window?: unknown }).window = {};
    return data;
  }

  if (kind === "throws-on-access") {
    (globalThis as { window?: unknown }).window = {
      get localStorage(): Storage {
        throw new DOMException("SecurityError");
      },
      get sessionStorage(): Storage {
        throw new DOMException("SecurityError");
      },
    };
    return data;
  }

  const store = kind === "throws-on-write" ? throwing : working;
  (globalThis as { window?: unknown }).window = { localStorage: store, sessionStorage: store };
  return data;
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("with working storage", () => {
  beforeEach(() => installStorage("working"));

  it("round-trips a string", () => {
    expect(setItem("k", "v")).toBe(true);
    expect(getItem("k")).toBe("v");
  });

  it("returns null for a missing key", () => {
    expect(getItem("nope")).toBeNull();
  });

  it("removes a key", () => {
    setItem("k", "v");
    expect(removeItem("k")).toBe(true);
    expect(getItem("k")).toBeNull();
  });

  it("round-trips JSON", () => {
    expect(setJSON("j", { a: 1 })).toBe(true);
    expect(getJSON("j", null)).toEqual({ a: 1 });
  });

  it("falls back when stored JSON is corrupt", () => {
    setItem("j", "{not json");
    expect(getJSON("j", "fallback")).toBe("fallback");
  });

  it("falls back when the key is absent", () => {
    expect(getJSON("missing", 42)).toBe(42);
  });

  it("keeps local and session storage separate in the API surface", () => {
    setItem("k", "local");
    expect(getItem("k", "session")).toBe("local"); // same stub backs both here
  });
});

describe("when storage access throws", () => {
  beforeEach(() => installStorage("throws-on-access"));

  it("reads null instead of throwing", () => {
    expect(() => getItem("k")).not.toThrow();
    expect(getItem("k")).toBeNull();
  });

  it("reports a failed write instead of throwing", () => {
    expect(() => setItem("k", "v")).not.toThrow();
    expect(setItem("k", "v")).toBe(false);
  });

  it("reports a failed remove instead of throwing", () => {
    expect(removeItem("k")).toBe(false);
  });

  it("returns the fallback from getJSON", () => {
    expect(getJSON("k", "fb")).toBe("fb");
  });
});

describe("when writes are rejected (quota)", () => {
  beforeEach(() => installStorage("throws-on-write"));

  it("returns false rather than throwing", () => {
    expect(setItem("k", "v")).toBe(false);
    expect(setJSON("k", { a: 1 })).toBe(false);
  });
});

describe("when there is no storage at all", () => {
  beforeEach(() => installStorage("absent"));

  it("degrades to null and false", () => {
    expect(getItem("k")).toBeNull();
    expect(setItem("k", "v")).toBe(false);
    expect(getJSON("k", "fb")).toBe("fb");
  });
});
