import { describe, it, expect, afterEach, vi } from "vitest";
import {
  getSlots,
  getActiveSlotId,
  switchSlot,
  createSlot,
  updateSlotMeta,
  deleteSlot,
} from "./profiles";

/**
 * getSlots has four fallback paths and deleteSlot guards a data-loss case, and
 * none of it was covered. Tests run under `environment: "node"`, so window and
 * its storage are stubbed per case — the same approach as safeStorage.test.ts.
 */
type StubKind = "working" | "throws-on-write";

function installWindow(kind: StubKind = "working") {
  const data = new Map<string, string>();

  const store: Storage = {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k: string) => data.get(k) ?? null,
    key: (i: number) => [...data.keys()][i] ?? null,
    removeItem: (k: string) => void data.delete(k),
    setItem: (k: string, v: string) => {
      if (kind === "throws-on-write") throw new DOMException("QuotaExceededError");
      data.set(k, v);
    },
  };

  const reload = vi.fn();
  (globalThis as { window?: unknown }).window = {
    localStorage: store,
    sessionStorage: store,
    location: { reload },
  };
  return { data, reload };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  vi.restoreAllMocks();
});

describe("getSlots", () => {
  it("seeds a default slot when storage is empty, and persists it", () => {
    const { data } = installWindow();
    const slots = getSlots();
    expect(slots).toHaveLength(1);
    expect(slots[0].id).toBe("default");
    // Persisted, not just returned — otherwise every read re-seeds a slot with
    // a new `created` timestamp.
    expect(data.get("cisspp-slots")).toBeTruthy();
    expect(JSON.parse(data.get("cisspp-slots")!)).toHaveLength(1);
  });

  it("falls back to a default slot on unparseable JSON", () => {
    const { data } = installWindow();
    data.set("cisspp-slots", "{not json");
    expect(getSlots().map((s) => s.id)).toEqual(["default"]);
  });

  it("falls back when the stored value is valid JSON but not an array", () => {
    const { data } = installWindow();
    data.set("cisspp-slots", JSON.stringify({ id: "default" }));
    expect(getSlots().map((s) => s.id)).toEqual(["default"]);
  });

  it("drops malformed entries but keeps the good ones", () => {
    const { data } = installWindow();
    data.set(
      "cisspp-slots",
      JSON.stringify([
        { id: "a", displayName: "A", examDate: null, created: "x" },
        null,
        { id: "", displayName: "empty id" },
        { displayName: "no id" },
        { id: "b", displayName: "B", examDate: null, created: "x" },
      ]),
    );
    expect(getSlots().map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("falls back when every entry is malformed", () => {
    const { data } = installWindow();
    data.set("cisspp-slots", JSON.stringify([null, 42, { nope: true }]));
    expect(getSlots().map((s) => s.id)).toEqual(["default"]);
  });
});

describe("getActiveSlotId", () => {
  it("is 'default' when nothing has been chosen", () => {
    installWindow();
    expect(getActiveSlotId()).toBe("default");
  });

  it("reads back what switchSlot wrote", () => {
    installWindow();
    switchSlot("slot-123");
    expect(getActiveSlotId()).toBe("slot-123");
  });
});

describe("switchSlot", () => {
  it("reloads so the new database is opened", () => {
    const { reload } = installWindow();
    switchSlot("slot-9");
    expect(reload).toHaveBeenCalledOnce();
  });

  // A silent early return made the button look dead. The caller needs to be
  // able to say why nothing happened.
  it("throws rather than failing silently when storage is blocked", () => {
    const { reload } = installWindow("throws-on-write");
    expect(() => switchSlot("slot-9")).toThrow(/blocking storage/i);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("createSlot", () => {
  it("appends to the list and returns the new id", () => {
    installWindow();
    const id = createSlot("Second");
    const slots = getSlots();
    expect(id).toMatch(/^slot-/);
    expect(slots.map((s) => s.id)).toContain(id);
    expect(slots.find((s) => s.id === id)?.displayName).toBe("Second");
  });

  it("keeps the existing slots", () => {
    installWindow();
    createSlot("Second");
    createSlot("Third");
    expect(getSlots().map((s) => s.displayName)).toEqual(["Scholar", "Second", "Third"]);
  });

  // The caller switches to the new slot immediately. If only the active-slot
  // write landed, the user would boot into a database in no slot list at all.
  it("throws when the list cannot be persisted", () => {
    installWindow("throws-on-write");
    expect(() => createSlot("Doomed")).toThrow(/blocking storage/i);
  });
});

describe("updateSlotMeta", () => {
  it("patches only the named slot", () => {
    installWindow();
    const id = createSlot("Second");
    updateSlotMeta(id, { displayName: "Renamed", examDate: "2026-01-01" });
    const slots = getSlots();
    expect(slots.find((s) => s.id === id)).toMatchObject({
      displayName: "Renamed",
      examDate: "2026-01-01",
    });
    expect(slots.find((s) => s.id === "default")?.displayName).toBe("Scholar");
  });

  it("is a no-op for an unknown id", () => {
    installWindow();
    updateSlotMeta("nonexistent", { displayName: "X" });
    expect(getSlots().map((s) => s.displayName)).toEqual(["Scholar"]);
  });
});

describe("deleteSlot", () => {
  it("removes an inactive, non-default slot", () => {
    installWindow();
    const id = createSlot("Second");
    deleteSlot(id);
    expect(getSlots().map((s) => s.id)).not.toContain(id);
  });

  // Both guards protect against deleting the database you are currently using.
  it("refuses to delete the default slot", () => {
    installWindow();
    createSlot("Second");
    deleteSlot("default");
    expect(getSlots().map((s) => s.id)).toContain("default");
  });

  it("refuses to delete the active slot", () => {
    installWindow();
    const id = createSlot("Second");
    switchSlot(id);
    deleteSlot(id);
    expect(getSlots().map((s) => s.id)).toContain(id);
  });
});
