import { getItem, setItem, setJSON } from "./safeStorage";

export interface ProfileSlot {
  id: string;
  displayName: string;
  examDate: string | null;
  created: string;
}

const SLOTS_KEY = "cisspp-slots";
const ACTIVE_KEY = "cisspp-active-slot";

function defaultSlot(): ProfileSlot {
  return {
    id: "default",
    displayName: "Scholar",
    examDate: null,
    created: new Date().toISOString(),
  };
}

function isSlot(value: unknown): value is ProfileSlot {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return typeof s.id === "string" && s.id.length > 0 && typeof s.displayName === "string";
}

/**
 * Reads the slot list, tolerating missing, blocked or corrupt storage.
 *
 * This is called during render by ProfileSwitcher, which Settings mounts
 * unconditionally — so an unguarded parse here used to take down the whole
 * Settings page, and with it the backup/restore UI the user would need to
 * recover.
 */
export function getSlots(): ProfileSlot[] {
  const raw = getItem(SLOTS_KEY);
  if (raw === null) {
    const def = defaultSlot();
    setJSON(SLOTS_KEY, [def]);
    return [def];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [defaultSlot()];
  }

  if (!Array.isArray(parsed)) return [defaultSlot()];

  const slots = parsed.filter(isSlot);
  return slots.length > 0 ? slots : [defaultSlot()];
}

export function getActiveSlotId(): string {
  return getItem(ACTIVE_KEY) || "default";
}

/**
 * Switches the active profile and reloads. Throws rather than returning early:
 * the caller renders a button, and a silent no-op made it look broken.
 */
export function switchSlot(id: string): void {
  if (!setItem(ACTIVE_KEY, id)) {
    throw new Error("Couldn't switch profile — this browser is blocking storage.");
  }
  window.location.reload();
}

/**
 * Creates a slot. Throws if the list can't be persisted — the caller switches
 * to the new slot immediately, and if only the active-slot write had landed the
 * user would boot into a database that appears in no slot list at all.
 */
export function createSlot(displayName: string): string {
  const id = "slot-" + Date.now();
  const slots = getSlots();
  slots.push({ id, displayName, examDate: null, created: new Date().toISOString() });
  if (!setJSON(SLOTS_KEY, slots)) {
    throw new Error("Couldn't save the new profile — this browser is blocking storage.");
  }
  return id;
}

export function updateSlotMeta(
  id: string,
  updates: Partial<Pick<ProfileSlot, "displayName" | "examDate">>
): void {
  const slots = getSlots().map((s) => (s.id === id ? { ...s, ...updates } : s));
  setJSON(SLOTS_KEY, slots);
}

export function deleteSlot(id: string): void {
  const active = getActiveSlotId();
  if (id === "default" || id === active) return;
  const slots = getSlots().filter((s) => s.id !== id);
  setJSON(SLOTS_KEY, slots);
  if ("indexedDB" in window) {
    const req = indexedDB.deleteDatabase("cisspp-" + id);
    // Deletion is blocked while another tab holds the database open; say so
    // rather than leaving an orphaned database behind silently.
    req.onblocked = () =>
      console.warn(`Database for ${id} is open elsewhere — close other tabs to remove it.`);
    req.onerror = () => console.error(`Could not delete the database for ${id}.`);
  }
}
