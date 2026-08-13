import { describe, it, expect, afterEach } from "vitest";
import {
  requestPersistence,
  persistenceState,
  storageEstimate,
  describePersistence,
  formatBytes,
  daysSinceBackup,
  type PersistenceState,
} from "./storage";

/** `navigator` is a getter-only global in node, so it must be redefined. */
const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");

function installStorage(storage: unknown) {
  Object.defineProperty(globalThis, "navigator", {
    value: storage === undefined ? {} : { storage },
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  if (original) Object.defineProperty(globalThis, "navigator", original);
  else delete (globalThis as { navigator?: unknown }).navigator;
});

describe("requestPersistence", () => {
  it("reports unsupported where the API is absent", async () => {
    installStorage(undefined);
    expect(await requestPersistence()).toBe("unsupported");
  });

  it("grants when the browser agrees", async () => {
    installStorage({ persisted: async () => false, persist: async () => true });
    expect(await requestPersistence()).toBe("granted");
  });

  it("denies when the browser refuses — an ordinary outcome, not an error", async () => {
    installStorage({ persisted: async () => false, persist: async () => false });
    expect(await requestPersistence()).toBe("denied");
  });

  // Firefox prompts. Re-prompting someone who already said yes is a good way
  // to get a no.
  it("does not ask again when already granted", async () => {
    let asked = 0;
    installStorage({
      persisted: async () => true,
      persist: async () => {
        asked += 1;
        return true;
      },
    });
    expect(await requestPersistence()).toBe("granted");
    expect(asked).toBe(0);
  });

  it("never throws when the API rejects", async () => {
    installStorage({
      persisted: async () => {
        throw new Error("SecurityError");
      },
    });
    await expect(requestPersistence()).resolves.toBe("unsupported");
  });
});

describe("persistenceState", () => {
  it("reports without requesting anything", async () => {
    let asked = 0;
    installStorage({
      persisted: async () => true,
      persist: async () => {
        asked += 1;
        return true;
      },
    });
    expect(await persistenceState()).toBe("granted");
    expect(asked).toBe(0);
  });

  it("is unsupported where the API is absent", async () => {
    installStorage(undefined);
    expect(await persistenceState()).toBe("unsupported");
  });
});

describe("storageEstimate", () => {
  it("reports usage, quota and a percentage", async () => {
    installStorage({ estimate: async () => ({ usage: 250, quota: 1000 }) });
    expect(await storageEstimate()).toEqual({ usageBytes: 250, quotaBytes: 1000, pct: 25 });
  });

  it("is null where the browser won't say", async () => {
    installStorage({ estimate: async () => ({}) });
    expect(await storageEstimate()).toBeNull();
  });

  it("does not divide by a zero quota", async () => {
    installStorage({ estimate: async () => ({ usage: 0, quota: 0 }) });
    expect(await storageEstimate()).toBeNull();
  });

  it("is null rather than throwing when the API rejects", async () => {
    installStorage({
      estimate: async () => {
        throw new Error("nope");
      },
    });
    await expect(storageEstimate()).resolves.toBeNull();
  });
});

describe("describePersistence", () => {
  // The whole point of this round: never imply the data is safe.
  it("never promises safety, in any state", () => {
    for (const state of ["granted", "denied", "unsupported"] as PersistenceState[]) {
      const text = describePersistence(state);
      expect(text).not.toMatch(/\b(safe|guaranteed|permanent|never be (lost|cleared))\b/i);
      expect(text.length).toBeGreaterThan(20);
    }
  });

  it("still tells a granted user to export", () => {
    expect(describePersistence("granted")).toMatch(/export/i);
    expect(describePersistence("granted")).toMatch(/not a guarantee/i);
  });

  // The platform most likely to evict is the one persist() does nothing on.
  it("names the iOS case where the browser won't say", () => {
    expect(describePersistence("unsupported")).toMatch(/iOS/);
    expect(describePersistence("unsupported")).toMatch(/week/i);
  });
});

describe("formatBytes", () => {
  it("scales through B, KB and MB", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("handles zero", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
});

describe("daysSinceBackup", () => {
  const now = new Date("2026-06-15T12:00:00.000Z");

  it("is null when there has never been a backup", () => {
    expect(daysSinceBackup(null, now)).toBeNull();
  });

  it("counts whole days", () => {
    expect(daysSinceBackup("2026-06-15T09:00:00.000Z", now)).toBe(0);
    expect(daysSinceBackup("2026-06-08T12:00:00.000Z", now)).toBe(7);
  });

  // A device whose clock jumped backwards shouldn't read as a negative age,
  // which would compare as "fresh" against any threshold.
  it("clamps a future timestamp to zero", () => {
    expect(daysSinceBackup("2026-12-01T00:00:00.000Z", now)).toBe(0);
  });

  it("is null rather than NaN on a corrupt stored value", () => {
    expect(daysSinceBackup("not a date", now)).toBeNull();
  });
});
