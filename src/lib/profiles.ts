export interface ProfileSlot {
  id: string;
  displayName: string;
  examDate: string | null;
  created: string;
}

const SLOTS_KEY = "cisspp-slots";
const ACTIVE_KEY = "cisspp-active-slot";

export function getSlots(): ProfileSlot[] {
  const raw = localStorage.getItem(SLOTS_KEY);
  if (!raw) {
    const def: ProfileSlot = {
      id: "default",
      displayName: "Scholar",
      examDate: null,
      created: new Date().toISOString(),
    };
    localStorage.setItem(SLOTS_KEY, JSON.stringify([def]));
    return [def];
  }
  return JSON.parse(raw) as ProfileSlot[];
}

export function getActiveSlotId(): string {
  return localStorage.getItem(ACTIVE_KEY) || "default";
}

export function switchSlot(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id);
  window.location.reload();
}

export function createSlot(displayName: string): string {
  const id = "slot-" + Date.now();
  const slots = getSlots();
  slots.push({ id, displayName, examDate: null, created: new Date().toISOString() });
  localStorage.setItem(SLOTS_KEY, JSON.stringify(slots));
  return id;
}

export function updateSlotMeta(
  id: string,
  updates: Partial<Pick<ProfileSlot, "displayName" | "examDate">>
): void {
  const slots = getSlots().map((s) => (s.id === id ? { ...s, ...updates } : s));
  localStorage.setItem(SLOTS_KEY, JSON.stringify(slots));
}

export function deleteSlot(id: string): void {
  const active = getActiveSlotId();
  if (id === "default" || id === active) return;
  const slots = getSlots().filter((s) => s.id !== id);
  localStorage.setItem(SLOTS_KEY, JSON.stringify(slots));
  if ("indexedDB" in window) {
    indexedDB.deleteDatabase("cisspp-" + id);
  }
}
