import { useState } from "react";
import {
  getSlots,
  getActiveSlotId,
  switchSlot,
  createSlot,
  deleteSlot,
  type ProfileSlot,
} from "../lib/profiles";

export default function ProfileSwitcher() {
  const [slots, setSlots] = useState<ProfileSlot[]>(() => getSlots());
  const [activeId] = useState(() => getActiveSlotId());
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = () => {
    if (!newName.trim()) return;
    try {
      const id = createSlot(newName.trim());
      setSlots(getSlots());
      setNewName("");
      setCreating(false);
      switchSlot(id); // immediately switch to the new profile (reloads page)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create that profile.");
    }
  };

  const handleSwitch = (id: string) => {
    try {
      switchSlot(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't switch profile.");
    }
  };

  const handleDelete = (id: string) => {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      return;
    }
    deleteSlot(id);
    setSlots(getSlots());
    setDeleteConfirm(null);
  };

  return (
    <section aria-labelledby="profiles-heading" className="card mb-4">
      <h2 id="profiles-heading" className="font-semibold mb-3">Study Profiles</h2>

      {error && (
        <p className="text-xs text-danger mb-3" role="alert">
          {error}
        </p>
      )}
      <p className="text-sm text-dim mb-3">
        Each profile has its own independent progress, quests, and flashcards. Switching profiles
        reloads the app.
      </p>

      <div className="space-y-2 mb-3">
        {slots.map((slot) => (
          <div
            key={slot.id}
            className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${
              slot.id === activeId ? "bg-accent/10 border border-accent/30" : "bg-panel2"
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{slot.displayName}</p>
              <p className="text-xs text-dim">
                {slot.id === activeId ? "Active" : `Created ${new Date(slot.created).toLocaleDateString()}`}
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {slot.id !== activeId && (
                <>
                  <button
                    onClick={() => handleSwitch(slot.id)}
                    className="btn-outline text-xs px-2 py-1"
                    aria-label={`Switch to ${slot.displayName}`}
                  >
                    Switch
                  </button>
                  {slot.id !== "default" && (
                    <button
                      onClick={() => handleDelete(slot.id)}
                      className="btn-danger text-xs px-2 py-1"
                      aria-label={deleteConfirm === slot.id ? `Confirm delete ${slot.displayName}` : `Delete ${slot.displayName}`}
                    >
                      {deleteConfirm === slot.id ? "Confirm" : "Delete"}
                    </button>
                  )}
                </>
              )}
              {slot.id === activeId && (
                <span className="text-xs text-accent font-semibold">✓ Active</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {creating ? (
        <div className="flex gap-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setCreating(false);
            }}
            placeholder="Profile name…"
            className="input flex-1"
            maxLength={40}
            aria-label="New profile name"
          />
          <button onClick={handleCreate} className="btn-primary" disabled={!newName.trim()}>
            Create
          </button>
          <button onClick={() => setCreating(false)} className="btn-ghost">
            Cancel
          </button>
        </div>
      ) : (
        <button onClick={() => setCreating(true)} className="btn-outline w-full">
          + New Profile
        </button>
      )}
    </section>
  );
}
